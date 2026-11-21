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

/******************************************************************************/

// Firefox-specific, user-origin stylesheet injection for cosmetic filtering.
// The former generic vAPI.Tabs shims mutated the caller's details object,
// awaited the native call, and swallowed both synchronous and async failures.
// Keep all three properties so callers observe identical behavior.

import webext from './webext.js';

/******************************************************************************/

export async function insertCSS(tabId, details) {
    details.cssOrigin = 'user';
    try { await webext.tabs.insertCSS(tabId, details); }
    catch { }
}

export async function removeCSS(tabId, details) {
    details.cssOrigin = 'user';
    try { await webext.tabs.removeCSS(tabId, details); }
    catch { }
}

/******************************************************************************/
