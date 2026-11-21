/*******************************************************************************

    uBlock Origin - a comprehensive, efficient content blocker
    Copyright (C) 2014-present Raymond Hill

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

import {
    dynamicHostIntToActionMap,
    dynamicHostNameToActionMap,
    dynamicURLActionToNameMap,
    dynamicURLKnownInvalidTypes,
    dynamicURLNameToActionMap,
    nameToSwitchStateMap,
    switchBitOffsets,
    switchStateToNameMap,
    typeBitOffsets,
} from './dynamic-filtering-protocol.js';
import { LineIterator } from './text-utils.js';
import punycode from '../lib/punycode.js';

/******************************************************************************/

// For performance purpose, as simple tests as possible
const reBadHostname = /[^0-9a-z_.[\]:%-]/;
const reNotASCII = /[^\x20-\x7F]/;

/******************************************************************************/

export function parseRuleText(text, append, engine) {
    const lineIter = new LineIterator(text);
    if ( append !== true ) { engine.reset(); }
    while ( lineIter.eot() === false ) {
        engine.addFromRuleParts(lineIter.next().trim().split(/\s+/));
    }
}

/******************************************************************************/

export function srcHostnameFromRule(rule) {
    return rule.slice(0, rule.indexOf(' '));
}

export function desHostnameFromRule(rule) {
    return rule.slice(rule.indexOf(' ') + 1);
}

/******************************************************************************/

export function validateHostRuleParts(parts) {
    if ( parts.length < 4 ) { return; }

    // Ignore hostname-based switch rules
    if ( parts[0].endsWith(':') ) { return; }

    // Ignore URL-based rules
    if ( parts[1].includes('/') ) { return; }

    if ( typeBitOffsets[parts[2]] === undefined ) { return; }

    if ( dynamicHostNameToActionMap[parts[3]] === undefined ) { return; }

    // https://github.com/chrisaljoudi/uBlock/issues/840
    //   Discard invalid rules
    if ( parts[1] !== '*' && parts[2] !== '*' ) { return; }

    // Performance: avoid punycoding when only ASCII chars
    if ( punycode !== undefined ) {
        if ( reNotASCII.test(parts[0]) ) {
            parts[0] = punycode.toASCII(parts[0]);
        }
        if ( reNotASCII.test(parts[1]) ) {
            parts[1] = punycode.toASCII(parts[1]);
        }
    }

    // https://github.com/chrisaljoudi/uBlock/issues/1082
    //   Discard rules with invalid hostnames
    if (
        (parts[0] !== '*' && reBadHostname.test(parts[0])) ||
        (parts[1] !== '*' && reBadHostname.test(parts[1]))
    ) {
        return;
    }

    return parts;
}

export function hostRuleArray(engine) {
    const out = [];
    engine.rules.forEach((_, key) => {
        const srchn = srcHostnameFromRule(key);
        const deshn = desHostnameFromRule(key);
        const srchnPretty = srchn.includes('xn--') && punycode
            ? punycode.toUnicode(srchn)
            : srchn;
        const deshnPretty = deshn.includes('xn--') && punycode
            ? punycode.toUnicode(deshn)
            : deshn;
        Object.entries(typeBitOffsets).forEach(([type, bitOffset]) => {
            if ( bitOffset === undefined ) { return; }
            const val = engine.evaluateCell(srchn, deshn, type);
            if ( val === 0 ) { return; }
            const action = dynamicHostIntToActionMap.get(val);
            if ( action === undefined ) { return; }
            out.push(`${srchnPretty} ${deshnPretty} ${type} ${action}`);
        });
    });
    return out;
}

/******************************************************************************/

export function validateSwitchRuleParts(parts) {
    if ( parts.length < 3 ) { return; }
    if ( parts[0].endsWith(':') === false ) { return; }
    if ( nameToSwitchStateMap[parts[2]] === undefined ) { return; }
    if ( reNotASCII.test(parts[1]) && punycode !== undefined ) {
        parts[1] = punycode.toASCII(parts[1]);
    }
    return parts;
}

export function switchRuleArray(engine) {
    const out = [];
    engine.switches.forEach((_, hostname) => {
        const prettyHn = hostname.includes('xn--') && punycode
            ? punycode.toUnicode(hostname)
            : hostname;
        Object.entries(switchBitOffsets).forEach(([switchName, bitOffset]) => {
            if ( bitOffset === undefined ) { return; }
            const val = engine.evaluate(switchName, hostname);
            if ( val === 0 ) { return; }
            out.push(`${switchName}: ${prettyHn} ${switchStateToNameMap[val]}`);
        });
    });
    return out;
}

/******************************************************************************/

export function validateURLRuleParts(parts) {
    if ( parts.length !== 4 ) { return; }
    if ( parts[1].indexOf('://') <= 0 ) { return; }
    if (
        /[^a-z_-]/.test(parts[2]) && parts[2] !== '*' ||
        dynamicURLKnownInvalidTypes.has(parts[2])
    ) {
        return;
    }
    if ( dynamicURLNameToActionMap[parts[3]] === undefined ) { return; }
    return parts;
}

export function urlRuleArray(engine) {
    return Array.from(engine.rules).flatMap(([ key, entries ]) => {
        const hn = key.slice(0, key.indexOf(' '));
        const type = key.slice(key.lastIndexOf(' ') + 1);
        return entries.map(({ url, action }) =>
            `${hn} ${url} ${type} ${dynamicURLActionToNameMap[action]}`
        );
    });
}

/******************************************************************************/
