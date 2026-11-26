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

import * as sfp from './static-filtering-parser.js';

import { ALLOW_REALM, IMPORTANT_REALM } from './static-net-filtering-protocol.js';
import { urlSkip as urlSkipDirective } from './urlskip.js';

/******************************************************************************/

// Reused synchronously by filterQuery(): there are no calls out to arbitrary
// code between resets, so the scratch arrays cannot be observed reentrantly.
const queryParams = [];
const queryParts = [];
const queryRemoved = [];

// The redirect sort comparator is called many times per request; resolve each
// directive once and let the comparator read the precomputed values.
const redirectSortScratch = {
    order: [],
    sorted: [],
    priorities: [],
    bits: [],
    available: [],
};

const reSkipSteps = / +/;

// Cache parsed steps without growing the directive's shared parser cache:
// urlskip historically leaves directive.cache untouched.
const urlSkipStepsCache = new WeakMap();

export function redirectRequest(engine, redirectEngine, fctxt, directives) {
    if ( directives === undefined ) {
        directives = engine.matchAndFetchModifiers(fctxt, 'redirect-rule');
    }
    // No directive is the most common occurrence.
    if ( directives === undefined ) { return; }
    const highest = directives.length - 1;
    // More than a single directive means more work.
    if ( highest !== 0 ) {
        const { order, sorted, priorities, bits, available } =
            redirectSortScratch;
        order.length = 0;
        for ( let i = 0; i < directives.length; i++ ) {
            const parsed = parseRedirectRequestValue(directives[i]);
            priorities[i] = parsed.priority;
            bits[i] = parsed.bits;
            available[i] = redirectEngine.hasToken(parsed.token);
            order.push(i);
        }
        order.sort(compareRedirectRequests);
        sorted.length = 0;
        for ( let i = 0; i < order.length; i++ ) {
            sorted[i] = directives[order[i]];
        }
        for ( let i = 0; i < order.length; i++ ) {
            directives[i] = sorted[i];
        }
    }
    // Redirect to highest-ranked directive
    const directive = directives[highest];
    if ( (directive.bits & ALLOW_REALM) !== 0 ) { return directives; }
    const { token } = parseRedirectRequestValue(directive);
    fctxt.redirectURL = redirectEngine.tokenToURL(fctxt, token);
    if ( fctxt.redirectURL === undefined ) { return; }
    return directives;
}

function parseRedirectRequestValue(directive) {
    if ( directive.cache === null ) {
        directive.cache = sfp.parseRedirectValue(directive.value);
    }
    return directive.cache;
}

function compareRedirectRequests(a, b) {
    const { priorities, bits, available } = redirectSortScratch;
    if ( available[a] === false ) { return -1; }
    if ( available[b] === false ) { return 1; }
    const abits = bits[a];
    const bbits = bits[b];
    if ( abits !== bbits ) {
        if ( (abits & IMPORTANT_REALM) !== 0 ) { return 1; }
        if ( (bbits & IMPORTANT_REALM) !== 0 ) { return -1; }
        if ( (abits & ALLOW_REALM) !== 0 ) { return -1; }
        if ( (bbits & ALLOW_REALM) !== 0 ) { return 1; }
    }
    return priorities[a] - priorities[b];
}

/******************************************************************************/

export function transformURL(engine, fctxt, out = [], directives) {
    if ( directives === undefined ) {
        directives = engine.matchAndFetchModifiers(fctxt, 'uritransform');
    }
    if ( directives === undefined ) { return; }
    const redirectURL = new URL(fctxt.url);
    for ( const directive of directives ) {
        if ( (directive.bits & ALLOW_REALM) !== 0 ) {
            out.push(directive);
            continue;
        }
        if ( directive.cache === null ) {
            directive.cache = sfp.parseReplaceByRegexValue(directive.value);
        }
        const cache = directive.cache;
        if ( cache === undefined ) { continue; }
        let { re } = cache;
        const before = redirectURL.href;
        if ( re === undefined ) {
            const logdata = directive.logData();
            if ( logdata === undefined ) { continue; }
            try { re = new RegExp(logdata.regex, cache.flags); }
            catch { continue; }
        }
        if ( re.test(before) !== true ) { continue; }
        const after = before.replace(re, cache.replacement);
        try { void new URL(after); } catch { continue; }
        if ( after === before ) { continue; }
        redirectURL.href = after;
        out.push(directive);
        break;
    }
    if ( out.length === 0 ) { return; }
    if ( redirectURL.href !== fctxt.url ) {
        fctxt.redirectURL = redirectURL.href;
    }
    return out;
}

export function urlSkip(engine, fctxt, blocked, out = [], directives) {
    if ( fctxt.redirectURL !== undefined ) { return; }
    if ( directives === undefined ) {
        directives = engine.matchAndFetchModifiers(fctxt, 'urlskip');
    }
    if ( directives === undefined ) { return; }
    for ( let i = 0, n = directives.length; i < n; i++ ) {
        const directive = directives[i];
        if ( (directive.bits & ALLOW_REALM) !== 0 ) {
            out.push(directive);
            continue;
        }
        const urlin = fctxt.url;
        let steps = urlSkipStepsCache.get(directive);
        if ( steps === undefined ) {
            const value = directive.value;
            steps = value.includes(' ') && value.split(reSkipSteps) || [ value ];
            urlSkipStepsCache.set(directive, steps);
        }
        const urlout = urlSkipDirective(urlin, blocked, steps, directive);
        if ( urlout === undefined ) { continue; }
        if ( urlout === urlin ) { continue; }
        fctxt.redirectURL = urlout;
        out.push(directive);
        break;
    }
    if ( out.length === 0 ) { return; }
    return out;
}

/******************************************************************************/

// https://github.com/uBlockOrigin/uBlock-issues/issues/1626
//   Do not redirect when the number of query parameters does not change.

export function filterQuery(engine, fctxt, out = [], directives) {
    if ( fctxt.redirectURL !== undefined ) { return; }
    if ( directives === undefined ) {
        directives = engine.matchAndFetchModifiers(fctxt, 'removeparam');
    }
    if ( directives === undefined ) { return; }
    const url = fctxt.url;
    const qpos = url.indexOf('?');
    if ( qpos === -1 ) { return; }
    let hpos = url.indexOf('#', qpos + 1);
    if ( hpos === -1 ) { hpos = url.length; }
    queryParams.length = 0;
    let pairCount = 0;
    if ( hpos > qpos + 1 ) {
        let beg = qpos + 1;
        for (;;) {
            const amp = url.indexOf('&', beg);
            const stop = amp === -1 || amp > hpos ? hpos : amp;
            const kv = url.slice(beg, stop);
            const pos = kv.indexOf('=');
            if ( pos === -1 ) {
                queryParams.push(kv, '');
            } else {
                queryParams.push(kv.slice(0, pos), kv.slice(pos + 1));
            }
            queryRemoved[pairCount] = 0;
            pairCount += 1;
            if ( amp === -1 || amp > hpos ) { break; }
            beg = amp + 1;
        }
    }
    const params = queryParams;
    let liveCount = pairCount;
    for ( const directive of directives ) {
        if ( liveCount === 0 ) { break; }
        const isException = (directive.bits & ALLOW_REALM) !== 0;
        if ( isException && directive.value === '' ) {
            out.push(directive);
            break;
        }
        const { all, bad, name, not, re } = parseQueryPruneValue(directive);
        if ( bad ) { continue; }
        if ( all ) {
            if ( isException === false ) {
                for ( let i = 0; i < pairCount; i++ ) {
                    queryRemoved[i] = 1;
                }
                liveCount = 0;
            }
            out.push(directive);
            break;
        }
        let filtered = false;
        let matched = false;
        for ( let i = pairCount - 1; i >= 0; i-- ) {
            if ( queryRemoved[i] !== 0 ) { continue; }
            if ( name !== undefined ) {
                matched = params[i+i] === name;
            } else if ( re !== undefined ) {
                const key = params[i+i];
                let value = params[i+i+1];
                try { value = decodeURIComponent(value); }
                catch { }
                matched = re.test(`${key}=${value}`);
            }
            if ( matched === not ) { continue; }
            if ( isException === false ) {
                queryRemoved[i] = 1;
                liveCount -= 1;
            }
            filtered = true;
        }
        if ( filtered ) {
            out.push(directive);
        }
    }
    if ( out.length === 0 ) { return; }
    if ( liveCount !== pairCount ) {
        fctxt.redirectURL = url.slice(0, qpos);
        if ( liveCount !== 0 ) {
            queryParts.length = 0;
            for ( let i = 0; i < pairCount; i++ ) {
                if ( queryRemoved[i] !== 0 ) { continue; }
                const key = params[i+i];
                const val = params[i+i+1];
                queryParts.push(val !== '' ? key + '=' + val : key);
            }
            fctxt.redirectURL += '?' + queryParts.join('&');
        }
        if ( hpos !== url.length ) {
            fctxt.redirectURL += url.slice(hpos);
        }
    }
    return out;
}

function parseQueryPruneValue(directive) {
    if ( directive.cache === null ) {
        directive.cache =
            sfp.parseQueryPruneValue(directive.value);
    }
    return directive.cache;
}
