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

export function redirectRequest(engine, redirectEngine, fctxt, directives) {
    if ( directives === undefined ) {
        directives = engine.matchAndFetchModifiers(fctxt, 'redirect-rule');
    }
    // No directive is the most common occurrence.
    if ( directives === undefined ) { return; }
    const highest = directives.length - 1;
    // More than a single directive means more work.
    if ( highest !== 0 ) {
        directives.sort((a, b) => compareRedirectRequests(redirectEngine, a, b));
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

function compareRedirectRequests(redirectEngine, a, b) {
    const { token: atok, priority: aint, bits: abits } =
        parseRedirectRequestValue(a);
    if ( redirectEngine.hasToken(atok) === false ) { return -1; }
    const { token: btok, priority: bint, bits: bbits } =
        parseRedirectRequestValue(b);
    if ( redirectEngine.hasToken(btok) === false ) { return 1; }
    if ( abits !== bbits ) {
        if ( (abits & IMPORTANT_REALM) !== 0 ) { return 1; }
        if ( (bbits & IMPORTANT_REALM) !== 0 ) { return -1; }
        if ( (abits & ALLOW_REALM) !== 0 ) { return -1; }
        if ( (bbits & ALLOW_REALM) !== 0 ) { return 1; }
    }
    return aint - bint;
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
    for ( const directive of directives ) {
        if ( (directive.bits & ALLOW_REALM) !== 0 ) {
            out.push(directive);
            continue;
        }
        const urlin = fctxt.url;
        const value = directive.value;
        const steps = value.includes(' ') && value.split(/ +/) || [ value ];
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
    const query = url.slice(qpos + 1, hpos);
    // Native splitting and flattening preserve raw keys/values, including
    // empty parameters and empty query strings.
    const params = query === '' ? [] : query.split('&').flatMap(kv => {
        const pos = kv.indexOf('=');
        if ( pos === -1 ) { return [ kv, '' ]; }
        return [ kv.slice(0, pos), kv.slice(pos + 1) ];
    });
    const beforeParamCount = params.length;
    for ( const directive of directives ) {
        if ( params.length === 0 ) { break; }
        const isException = (directive.bits & ALLOW_REALM) !== 0;
        if ( isException && directive.value === '' ) {
            out.push(directive);
            break;
        }
        const { all, bad, name, not, re } = parseQueryPruneValue(directive);
        if ( bad ) { continue; }
        if ( all ) {
            if ( isException === false ) { params.length = 0; }
            out.push(directive);
            break;
        }
        let filtered = false;
        let matched = false;
        let i = params.length;
        while ( i > 0 ) {
            i -= 2;
            if ( name !== undefined ) {
                matched = params[i] === name;
            } else if ( re !== undefined ) {
                const key = params[i+0];
                const raw = params[i+1];
                let value = raw;
                try { value = decodeURIComponent(value); }
                catch { }
                matched = re.test(`${key}=${value}`);
            }
            if ( matched === not ) { continue; }
            if ( isException === false ) {
                params.splice(i, 2);
            }
            filtered = true;
        }
        if ( filtered ) {
            out.push(directive);
        }
    }
    if ( out.length === 0 ) { return; }
    if ( params.length !== beforeParamCount ) {
        fctxt.redirectURL = url.slice(0, qpos);
        if ( params.length !== 0 ) {
            fctxt.redirectURL += '?' + Array.from(
                { length: params.length / 2 },
                (_, i) => {
                    const key = params[i*2+0];
                    const val = params[i*2+1];
                    return val !== '' ? `${key}=${val}` : key;
                }
            ).join('&');
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
