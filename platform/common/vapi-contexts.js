/*******************************************************************************

    uBlock Origin - a comprehensive, efficient content blocker
    Copyright (C) 2026-present Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

import webext from './webext.js';

// Tab/frame context tracking on top of Firefox tabs and webNavigation APIs.

/******************************************************************************/

export const tabDict = new Map();
export const TAB_ID_NONE = browser.tabs.TAB_ID_NONE

const listeners = new Set();
const uboOrigin = vAPI.getURL('').replace(/\/$/, '');
const reIsHTTP = /^https?:\/\//;

/******************************************************************************/

function onCreatedNavigationTarget(details) {
    if ( details.tabId === TAB_ID_NONE ) { return; }
    Object.assign(details, { frameId: 0, parentFrameId: -1 });
    addFrame(details);
    listeners.forEach(listener => {
        listener('before-tab-created', details);
    });
}

function onBeforeNavigate(details) {
    if ( details.tabId === TAB_ID_NONE ) { return; }
    addFrame(details);
    listeners.forEach(listener => {
        listener('before-frame-committed', details);
    });
}

function onCommitted(details) {
    if ( details.tabId === TAB_ID_NONE ) { return; }
    addFrame(details);
    listeners.forEach(listener => {
        listener('frame-committed', details);
    });
}

function onFrameRemoved(tabId, frameId) {
    const tabData = tabDict.get(tabId);
    if ( tabData === undefined ) { return; }
    const frameData = tabData.frameDict.get(frameId);
    if ( frameData === undefined ) { return; }
    tabData.frameDict.delete(frameId);
    const details = { tabId, frameId };
    listeners.forEach(listener => {
        listener('frame-removed', details);
    });
}

function onTabCreated(tab) {
    const details = { tabId: tab.id, frameId: 0, parentFrameId: -1, url: tab.url };
    addFrame(details);
    listeners.forEach(listener => {
        listener('tab-created', details);
        listener('before-frame-committed', details);
    });
    return tabDict.get(tab.id);
}

function onTabActivated(details) {
    if ( tabDict.has(details.tabId) === false ) { return; }
    listeners.forEach(listener => {
        listener('tab-activated', details);
    });
}

function onWindowFocused(windowId) {
    if ( windowId === browser.windows.WINDOW_ID_NONE ) { return; }
    if ( windowId === onWindowFocused.windowId ) { return; }
    onWindowFocused.windowId = windowId;
    webext.tabs.query({ active: true, windowId }).then(tabs => {
        if ( tabs.length === 0 ) { return; }
        const tabId = tabs[0].id;
        onTabActivated({ tabId, windowId });
    });
}

function onTabUpdated(tabId, changeInfo, tab) {
    if ( isHTTP(tab.url) === false ) {
        if ( tab.url.startsWith(uboOrigin) === false ) { return; }
    }
    const changedProps = Object.keys(changeInfo).filter(a =>
        onTabUpdated.filters.includes(a)
    );
    if ( changedProps.length === 0 ) { return; }
    const tabData = tabDict.get(tabId) ?? onTabCreated(tab);
    if ( changeInfo.discarded ) {
        tabData.discarded = tab.changeInfo;
    }
    if ( changeInfo.title ) {
        tabData.title = tab.title;
    }
    if ( changeInfo.url ) {
        tabData.frameDict.get(0).url = tab.url;
    }
    const details = Object.assign({ tabId, changeInfo }, tab);
    listeners.forEach(listener => {
        listener('tab-updated', details);
    });
}
onTabUpdated.filters = [ 'discarded', 'status', 'title', 'url' ];

function onTabRemoved(tabId) {
    const tabData = tabDict.get(tabId);
    if ( tabData === undefined ) { return; }
    tabDict.delete(tabId);
    const details = { tabId };
    listeners.forEach(listener => {
        listener('tab-removed', details);
    });
}

/******************************************************************************/

export function addListener(listener) {
    listeners.add(listener);
}

export function removeListener(listener) {
    listeners.delete(listener);
}

export function addFrame(details) {
    const { tabId } = details;
    const tabData = tabDict.get(tabId) ?? { tabId };
    if ( tabData.frameDict === undefined ) {
        tabData.frameDict = new Map();
        tabDict.set(tabId, tabData);
    } else {
        tabData.gettingFrames = undefined;
    }
    const { frameDict } = tabData;
    const { frameId, url } = details;
    if ( frameId === 0 ) {
        frameDict.clear();
    }
    frameDict.set(frameId, {
        frameId,
        parentId: details.parentFrameId ?? -1,
        url,
    });
    // Every 64 frames, we check for removed frames to prevent unbound growth
    // as there is no API listener for removed frames
    if ( (frameDict.size & 0b111111) !== 0 ) { return; }
    const key = self.crypto.randomUUID();
    tabData.gettingFrames = key;
    webext.webNavigation.getAllFrames({ tabId }).then(frames => {
        if ( Array.isArray(frames) === false ) { return; }
        if ( tabData.gettingFrames !== key ) { return; }
        if ( tabDict.has(tabId) === false ) { return; }
        const frameIds = new Set(frames.map(a => a.frameId));
        frameDict.forEach((_, frameId) => {
            if ( frameIds.has(frameId) ) { return; }
            onFrameRemoved(tabId, frameId);
        });
    }, ( ) => { });
}

export function isHTTP(url) {
    return reIsHTTP.test(url);
}

export function getEffectiveURL(tabId, frameId) {
    const tabData = tabDict.get(tabId);
    if ( tabData === undefined ) { return; }
    const { frameDict } = tabData;
    let frameData = frameDict.get(frameId);
    for (;;) {
        if ( Boolean(frameData) === false ) { return; }
        if ( reIsHTTP.test(frameData.url) ) { break; }
        frameId = frameData.parentId;
        if ( frameId === -1 ) { break; }
        frameData = frameDict.get(frameId);
    }
    return frameData.url;
}

export function getAncestors(details) {
    const out = [];
    if ( details.frameId === 0 ) { return out; }
    const tabData = tabDict.get(details.tabId);
    if ( tabData === undefined ) { return out; }
    const { frameDict } = tabData;
    let { frameId } = details;
    do {
        const frameData = frameDict.get(frameId);
        if ( frameData === undefined ) { break; }
        out.push({ frameId: frameData.frameId, url: frameData.url });
        frameId = frameData.parentId;
    } while ( frameId !== -1 );
    return out.slice(1).filter(a => isHTTP(a));
}

// Avoid exception-driven control flow for tabless and behind-the-scene
// requests: a missing frame URL is an expected state on Firefox.
const topFrameURL = tabId => {
    const url = tabDict.get(tabId)?.frameDict.get(0)?.url;
    return typeof url === 'string' && url !== '' ? url : undefined;
};

export function getTopURL(tabId) {
    const rawURL = topFrameURL(tabId);
    if ( rawURL === undefined ) { return; }
    try {
        return new URL(rawURL).href;
    } catch {
    }
}

export function getTopOrigin(tabId) {
    const rawURL = topFrameURL(tabId);
    if ( rawURL === undefined ) { return; }
    try {
        return new URL(rawURL).origin;
    } catch {
    }
}

/******************************************************************************/

export async function start() {
    const tabs = await webext.tabs.query({ url: [ 'http://*/*', 'https://*/*', `${uboOrigin}/*` ] });
    tabs.filter(tab => !tab.discarded && tab.status !== 'unloaded')
        .forEach(onTabCreated);
    browser.webNavigation.onCreatedNavigationTarget.addListener(onCreatedNavigationTarget);
    browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
    browser.webNavigation.onCommitted.addListener(onCommitted);
    browser.tabs.onActivated.addListener(onTabActivated);
    if ( browser?.windows?.onFocusChanged ) {
        browser.windows.onFocusChanged.addListener(onWindowFocused);
    }
    browser.tabs.onUpdated.addListener(onTabUpdated);
    browser.tabs.onRemoved.addListener(onTabRemoved);
}
