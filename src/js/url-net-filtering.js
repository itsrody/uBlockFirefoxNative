/*******************************************************************************

    uBlock Origin - a comprehensive, efficient content blocker
    Copyright (C) 2015-present Raymond Hill

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

import {
    dynamicURLIntToActionLogMap as intToActionMap,
    dynamicURLNameToActionMap as nameToActionMap,
} from './dynamic-filtering-protocol.js';
import {
    parseRuleText,
    urlRuleArray,
    validateURLRuleParts,
} from './dynamic-filtering-codec.js';
import { decomposeHostname } from './uri-utils.js';

/*******************************************************************************

    The purpose of log filtering is to create ad hoc filtering rules, to
    diagnose and assist in the creation of custom filters.

    buckets: map of [hostname + type]
         bucket: array of rule entries, sorted from shorter to longer url
    rule entry: { url, action }

*******************************************************************************/

const decomposedSource = [];

/******************************************************************************/

class RuleEntry {
    constructor(url, action) {
        this.url = url;
        this.action = action;
    }
}

/******************************************************************************/

function indexOfURL(entries, url) {
    // TODO: binary search -- maybe, depends on common use cases
    // URLs must be ordered by increasing length. Stop at the first entry
    // longer than the target.
    const urlLen = url.length;
    for ( let i = 0; i < entries.length; i++ ) {
        const entry = entries[i];
        if ( entry.url.length > urlLen ) { return -1; }
        if ( entry.url === url ) { return i; }
    }
    return -1;
}

/******************************************************************************/

function indexOfMatch(entries, url) {
    // A longer rule can never prefix a shorter URL, so reverse iteration
    // can both find the length pivot and pick the best prefix match.
    for ( let i = entries.length - 1; i >= 0; i-- ) {
        const entryUrl = entries[i].url;
        if ( entryUrl.length <= url.length && url.startsWith(entryUrl) ) {
            return i;
        }
    }
    return -1;
}

/******************************************************************************/

function indexFromLength(entries, len) {
    // TODO: binary search -- maybe, depends on common use cases
    // URLs must be ordered by increasing length.
    for ( let i = 0; i < entries.length; i++ ) {
        if ( entries[i].url.length > len ) { return i; }
    }
    return -1;
}

/******************************************************************************/

function addRuleEntry(entries, url, action) {
    const entry = new RuleEntry(url, action);
    const i = indexFromLength(entries, url.length);
    if ( i === -1 ) {
        entries.push(entry);
    } else {
        entries.splice(i, 0, entry);
    }
}

/******************************************************************************/

class DynamicURLRuleFiltering {
    constructor() {
        this.reset();
    }

    reset() {
        this.rules = new Map();
        // registers, filled with result of last evaluation
        this.context = '';
        this.url = '';
        this.type = '';
        this.r = 0;
        this.changed = false;
    }

    assign(other) {
        // Remove rules not in other
        for ( const key of this.rules.keys() ) {
            if ( other.rules.has(key) === false ) {
                this.rules.delete(key);
            }
        }
        // Add/change rules in other
        for ( const [ key, entries ] of other.rules ) {
            this.rules.set(key, entries.slice());
        }
        this.changed = true;
    }

    setRule(srcHostname, url, type, action) {
        if ( action === 0 ) {
            return this.removeRule(srcHostname, url, type);
        }
        const bucketKey = srcHostname + ' ' + type;
        let entries = this.rules.get(bucketKey);
        if ( entries === undefined ) {
            entries = [];
            this.rules.set(bucketKey, entries);
        }
        const i = indexOfURL(entries, url);
        if ( i !== -1 ) {
            const entry = entries[i];
            if ( entry.action === action ) { return false; }
            entry.action = action;
        } else {
            addRuleEntry(entries, url, action);
        }
        this.changed = true;
        return true;
    }

    removeRule(srcHostname, url, type) {
        const bucketKey = srcHostname + ' ' + type;
        const entries = this.rules.get(bucketKey);
        if ( entries === undefined ) { return false; }
        const i = indexOfURL(entries, url);
        if ( i === -1 ) { return false; }
        entries.splice(i, 1);
        if ( entries.length === 0 ) {
            this.rules.delete(bucketKey);
        }
        this.changed = true;
        return true;
    }

    evaluateZ(context, target, type) {
        this.r = 0;
        if ( this.rules.size === 0 ) { return 0; }
        const typeSuffix = ' ' + type;
        const wildcardSuffix = ' *';
        decomposeHostname(context, decomposedSource);
        for ( let i = 0; i < decomposedSource.length; i++ ) {
            const srchn = decomposedSource[i];
            this.context = srchn;
            let entries = this.rules.get(srchn + typeSuffix);
            if ( entries !== undefined ) {
                const j = indexOfMatch(entries, target);
                if ( j !== -1 ) {
                    const entry = entries[j];
                    this.url = entry.url;
                    this.type = type;
                    this.r = entry.action;
                    break;
                }
            }
            entries = this.rules.get(srchn + wildcardSuffix);
            if ( entries !== undefined ) {
                const j = indexOfMatch(entries, target);
                if ( j !== -1 ) {
                    const entry = entries[j];
                    this.url = entry.url;
                    this.type = '*';
                    this.r = entry.action;
                    break;
                }
            }
        }
        return this.r;
    }

    mustAllowCellZ(context, target, type) {
        return this.evaluateZ(context, target, type).r === 2;
    }

    mustBlockOrAllow() {
        return this.r === 1 || this.r === 2;
    }

    toLogData() {
        if ( this.r === 0 ) { return; }
        const { context, url, type } = this;
        return {
            source: 'dynamicUrl',
            result: this.r,
            rule: [ context, url, type, intToActionMap.get(this.r) ],
            raw: `${context} ${url} ${type} ${intToActionMap.get(this.r)}`,
        };
    }

    copyRules(other, context, urls, type) {
        for ( let i = urls.length - 1; i >= 0; i-- ) {
            const url = urls[i];
            other.evaluateZ(context, url, type);
            const otherOwn = other.r !== 0 &&
                             other.context === context &&
                             other.url === url &&
                             other.type === type;
            this.evaluateZ(context, url, type);
            const thisOwn  = this.r !== 0 &&
                             this.context === context &&
                             this.url === url &&
                             this.type === type;
            if ( otherOwn && !thisOwn || other.r !== this.r ) {
                this.setRule(context, url, type, other.r);
                this.changed = true;
            }
            if ( !otherOwn && thisOwn ) {
                this.removeRule(context, url, type);
                this.changed = true;
            }
        }
        return this.changed;
    }

    toArray() {
        return urlRuleArray(this);
    }

    toString() {
        return this.toArray().sort().join('\n');
    }

    fromString(text) {
        this.reset();
        parseRuleText(text, true, this);
    }

    validateRuleParts(parts) {
        return validateURLRuleParts(parts);
    }

    addFromRuleParts(parts) {
        if ( this.validateRuleParts(parts) !== undefined ) {
            this.setRule(parts[0], parts[1], parts[2], nameToActionMap[parts[3]]);
            return true;
        }
        return false;
    }

    removeFromRuleParts(parts) {
        if ( this.validateRuleParts(parts) !== undefined ) {
            this.removeRule(parts[0], parts[1], parts[2]);
            return true;
        }
        return false;
    }
}

/******************************************************************************/

export default DynamicURLRuleFiltering;

/******************************************************************************/
