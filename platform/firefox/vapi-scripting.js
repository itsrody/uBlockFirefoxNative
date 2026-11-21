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

import * as frameManager from './vapi-contexts.js';
import { hostnameFromURI } from './uri-utils.js';

/******************************************************************************/

// First-navigation fallback for the MAIN world. Native content-script
// registration covers later navigations; this path covers a document that is
// already committing while registration is in flight. Keep it paired with the
// per-world sentinels in uBO_assembleCode().
function uBO_mainWorldFallbackWrapper(details) {

    (function earlyBailoutCode(){})();

    const { sentinel, mainCode } = details;
    const pageGlobal = self.wrappedJSObject;
    let mainCodeRan = false;
    try {
        mainCodeRan = Boolean(pageGlobal && pageGlobal[sentinel]);
    } catch {
    }
    // The MAIN world content script may already have executed: avoid running
    // the scriptlets twice in the same document.
    if ( mainCodeRan ) { return 0; }

    const doc = document;
    const container = doc.createElement('div');
    const shadowRoot = container.attachShadow({ mode: 'closed' });
    try {
        (doc.head || doc.documentElement).appendChild(container);
    } catch {
        return 0;
    }
    const code = [
        `self['${sentinel}'] = true;`,
        mainCode,
    ].join('\n');
    try {
        const script = doc.createElement('script');
        script.appendChild(doc.createTextNode(code));
        shadowRoot.append(script);
    } catch {
    }
    try {
        mainCodeRan = Boolean(pageGlobal && pageGlobal[sentinel]);
    } catch {
    }
    if ( mainCodeRan ) {
        container.remove();
        return 0;
    }
    // https://github.com/uBlockOrigin/uBlock-issues/issues/235
    //   Fall back to blob injection if execution through direct
    //   injection failed
    let url;
    try {
        const blob = new self.Blob(
            [ code ],
            { type: 'text/javascript; charset=utf-8' }
        );
        url = self.URL.createObjectURL(blob);
        const script = doc.createElement('script');
        script.async = false;
        script.src = url;
        shadowRoot.append(script);
    } catch {
    }
    container.remove();
    if ( url ) {
        self.URL.revokeObjectURL(url);
    }
    return 0;
}

const mainWorldFallbackWrapperSource = uBO_mainWorldFallbackWrapper.toString();
const reEarlyBailoutMarker = /\(function earlyBailoutCode\(\)\{\}\)\(\);/;

/******************************************************************************/

// Assemble the MAIN-world fallback code used by manuallyInject(). It is
// combined with the isolated-world code from uBO_assembleCode() so a single
// injection preserves their relative execution order.
function uBO_assembleFallbackCode(details) {
    const { earlyBailoutCode, mainCode } = details;
    if ( Boolean(mainCode) === false ) { return; }
    let wrapperCode = mainWorldFallbackWrapperSource;
    if ( earlyBailoutCode ) {
        const match = reEarlyBailoutMarker.exec(wrapperCode);
        wrapperCode = wrapperCode.slice(0, match.index) +
            earlyBailoutCode +
            wrapperCode.slice(match.index + match[0].length);
    }
    return `// ${details.hostname}\n(${wrapperCode})(${JSON.stringify({ sentinel: mainSentinel, mainCode })});`;
}

/******************************************************************************/

function uBO_assembleCode(world, contentScriptCode, details) {
    if ( Boolean(contentScriptCode) === false ) { return; }
    const isMainWorld = world === 'main';
    const sentinel = isMainWorld ? mainSentinel : isolatedSentinel;
    const code = [
        `// ${details.hostname}`,
        `(function uBO_${world}WorldWrapper() {`,
    ];
    if ( details.earlyBailoutCode ) {
        code.push(details.earlyBailoutCode);
    }
    if ( isMainWorld ) {
        code.push(`if ( self['${sentinel}'] ) { return; }`);
        code.push(`self['${sentinel}'] = true;`);
    } else {
        code.push('try {');
        code.push('const pageGlobal = self.wrappedJSObject;');
        code.push(`if ( pageGlobal && pageGlobal['${sentinel}'] ) { return; }`);
        code.push(`if ( pageGlobal ) { pageGlobal['${sentinel}'] = true; }`);
        code.push('} catch {}');
    }
    code.push(contentScriptCode);
    code.push('})();');
    return code.join('\n');
}

/******************************************************************************/

const CONTENTSCRIPT_DICT_MAX_LOW = 128;
const CONTENTSCRIPT_DICT_MAX_HIGH = CONTENTSCRIPT_DICT_MAX_LOW +
    (CONTENTSCRIPT_DICT_MAX_LOW >>> 3);
// Per-world sentinels prevent running the same scriptlets twice when both
// native registration and the current-document fallback injection apply.
const isolatedSentinel = self.crypto.randomUUID();
const mainSentinel = self.crypto.randomUUID();
const contentScriptDict = new Map();
let getContentScripts;

function prepareContentScript(url, tabId = -1, frameId = 0) {
    const hostname = hostnameFromURI(url);
    const entry = contentScriptDict.get(hostname) ??
        { t: Date.now(), hostname };
    if ( entry.manuallyInjectedCode !== undefined ) { return entry; }
    if ( hostname !== '' ) {
        const result = getContentScripts(url, frameId !== 0
            ? { topOrigin: frameManager.getTopOrigin(tabId) }
            : undefined
        );
        entry.isolatedCode = uBO_assembleCode('isolated', result.isolatedCode, result);
        entry.mainCode = uBO_assembleCode('main', result.mainCode, result);
        // The isolated-world code and the main-world fallback are combined so
        // that a single injection preserves their relative execution order.
        entry.manuallyInjectedCode = [
            entry.isolatedCode,
            uBO_assembleFallbackCode(result),
        ].filter(Boolean).join('\n') || null;
    } else {
        entry.manuallyInjectedCode = null;
    }
    contentScriptDict.set(hostname, entry);
    return entry;
}

function registerWorldHandle(entry, key, code, matches, world) {
    const options = {
        allFrames: true,
        js: [ { code } ],
        matchOriginAsFallback: true,
        matches,
        runAt: 'document_start',
        world,
    };
    entry[key] = browser.contentScripts.register(options).then(handle => {
        entry[key] = handle;
    }, ( ) => {
        entry[key] = null;
    });
}

function unregisterWorldHandle(entry, key) {
    const handle = entry[key];
    if ( !handle ) { return; }
    if ( handle instanceof Promise ) {
        handle.then(( ) => entry[key]?.unregister());
    } else {
        handle.unregister();
    }
}

function registerContentScript(entry) {
    if ( entry.registered ) { return; }
    entry.registered = true;
    // The first committed document may already be loading while registration
    // is in flight: keep the fallback injection armed until that commit.
    entry.firstCommitPending = true;
    if ( Boolean(entry.manuallyInjectedCode) === false ) { return; }
    const { hostname } = entry;
    const matches = [ `http://${hostname}/*`, `https://${hostname}/*` ];
    if ( entry.isolatedCode ) {
        registerWorldHandle(entry, 'isolatedHandle', entry.isolatedCode, matches, 'ISOLATED');
        entry.isolatedCode = null;
    }
    if ( entry.mainCode ) {
        registerWorldHandle(entry, 'mainHandle', entry.mainCode, matches, 'MAIN');
        entry.mainCode = null;
    }
}

function unregisterContentScript(hostname) {
    const entry = contentScriptDict.get(hostname);
    if ( entry === undefined ) { return; }
    contentScriptDict.delete(hostname);
    unregisterWorldHandle(entry, 'mainHandle');
    unregisterWorldHandle(entry, 'isolatedHandle');
}

function manuallyInject(tabId, frameId, entry) {
    if ( Boolean(entry.manuallyInjectedCode) === false ) { return; }
    return browser.tabs.executeScript(tabId, {
        frameId,
        matchAboutBlank: true,
        runAt: 'document_start',
        code: entry.manuallyInjectedCode,
    }).catch(( ) => {
    });
}

function getEffectiveURL(details) {
    const { tabId, frameId } = details;
    let { url } = details;
    if ( frameId !== 0 && frameManager.isHTTP(url) === false ) {
        url = frameManager.getEffectiveURL(tabId, frameId);
        if ( url === undefined ) { return; }
    }
    if ( frameManager.isHTTP(url) === false ) { return; }
    return url;
}

function onBeforeNavigate(details) {
    const url = getEffectiveURL(details);
    if ( frameManager.isHTTP(url) === false ) { return; }
    if ( hostnameFromURI(url) === '' ) { return; }
    const entry = prepareContentScript(url, details.tabId, details.frameId);
    // Register ahead of the commit so the browser can inject at
    // document_start in both worlds through native content scripts.
    registerContentScript(entry);
}

function onCommitted(details) {
    const url = getEffectiveURL(details);
    if ( frameManager.isHTTP(url) === false ) { return; }
    const hostname = hostnameFromURI(url);
    if ( hostname === '' ) { return; }
    const { tabId, frameId } = details;
    const entry = contentScriptDict.get(hostname) ??
        prepareContentScript(url, tabId, frameId);
    registerContentScript(entry);
    if ( entry.firstCommitPending ) {
        // Registration may not have reached the document which is already
        // committing. The fallback code checks per-world sentinels, so it is
        // a no-op when the registered content scripts did run.
        manuallyInject(tabId, frameId, entry);
        entry.firstCommitPending = false;
    }
    entry.t = Date.now();
    if ( contentScriptDict.size <= CONTENTSCRIPT_DICT_MAX_HIGH ) { return; }
    const sortedKeys = Array.from(contentScriptDict.keys()).toSorted((a, b) =>
        contentScriptDict.get(a).t - contentScriptDict.get(b).t
    ).slice(0, -CONTENTSCRIPT_DICT_MAX_LOW);
    for ( const key of sortedKeys ) {
        unregisterContentScript(key);
    }
}

/******************************************************************************/

export async function start(fn) {
    const initialized = Boolean(getContentScripts);
    getContentScripts = fn;
    if ( initialized ) { return; }
    for ( const { url } of frameManager.tabDict.values() ) {
        const entry = prepareContentScript(url)
        registerContentScript(entry);
    }
    frameManager.addListener((type, details) => {
        switch ( type ) {
        case 'before-tab-created':
        case 'before-frame-committed':
            onBeforeNavigate(details);
            break;
        case 'frame-committed':
            onCommitted(details);
            break;
        }
    });
}

export function reset() {
    for ( const hostname of contentScriptDict.keys() ) {
        unregisterContentScript(hostname);
    }
}
