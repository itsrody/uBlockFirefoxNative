/*******************************************************************************

    uBlock Origin - a comprehensive, efficient content blocker
    Copyright (C) 2014-2018 Raymond Hill

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
    decomposeHostname,
    domainFromHostname,
} from './uri-utils.js';
import {
    desHostnameFromRule as desFromRule,
    hostRuleArray,
    parseRuleText,
    srcHostnameFromRule as srcFromRule,
    validateHostRuleParts,
} from './dynamic-filtering-codec.js';
import {
    dynamicHostIntToActionMap as intToActionMap,
    dynamicHostNameToActionMap as nameToActionMap,
    supportedDynamicTypes,
    typeBitOffsets,
} from './dynamic-filtering-protocol.js';

/******************************************************************************/

const decomposedSource = [];
const decomposedDestination = [];
const reFirstPartyRule = /^(\S+) (\S+)/;

/******************************************************************************/

function is3rdParty(srcHostname, desHostname) {
    // If at least one is party-less, the relation can't be labelled
    // "3rd-party"
    if ( desHostname === '*' || srcHostname === '*' || srcHostname === '' ) {
        return false;
    }

    // No domain can very well occurs, for examples:
    // - localhost
    // - file-scheme
    // etc.
    const srcDomain = domainFromHostname(srcHostname) || srcHostname;

    if ( desHostname.endsWith(srcDomain) === false ) {
        return true;
    }
    // Do not confuse 'example.com' with 'anotherexample.com'
    return desHostname.length !== srcDomain.length &&
           desHostname.charAt(desHostname.length - srcDomain.length - 1) !== '.';
}

/******************************************************************************/

class DynamicHostRuleFiltering {

    constructor() {
        this.reset();
    }

    reset() {
        this.r = 0;
        this.type = '';
        this.y = '';
        this.z = '';
        this.rules = new Map();
        this.changed = false;
    }

    assign(other) {
        // Remove rules not in other
        for ( const k of this.rules.keys() ) {
            if ( other.rules.has(k) === false ) {
                this.rules.delete(k);
                this.changed = true;
            }
        }
        // Add/change rules in other
        for ( const [ k, bits ] of other.rules ) {
            if ( this.rules.get(k) !== bits ) {
                this.rules.set(k, bits);
                this.changed = true;
            }
        }
    }

    copyRules(from, srcHostname, desHostnames) {
        // Specific types
        let thisBits = this.rules.get('* *');
        let fromBits = from.rules.get('* *');
        if ( fromBits !== thisBits ) {
            if ( fromBits !== undefined ) {
                this.rules.set('* *', fromBits);
            } else {
                this.rules.delete('* *');
            }
            this.changed = true;
        }

        const srcWildcardKey = srcHostname + ' *';
        thisBits = this.rules.get(srcWildcardKey);
        fromBits = from.rules.get(srcWildcardKey);
        if ( fromBits !== thisBits ) {
            if ( fromBits !== undefined ) {
                this.rules.set(srcWildcardKey, fromBits);
            } else {
                this.rules.delete(srcWildcardKey);
            }
            this.changed = true;
        }

        // Specific destinations
        const wildcardPrefix = '* ';
        const srcPrefix = srcHostname + ' ';
        const desHostnameList = Object.keys(desHostnames);
        for ( let i = 0; i < desHostnameList.length; i++ ) {
            const desHostname = desHostnameList[i];
            let key = wildcardPrefix + desHostname;
            thisBits = this.rules.get(key);
            fromBits = from.rules.get(key);
            if ( fromBits !== thisBits ) {
                if ( fromBits !== undefined ) {
                    this.rules.set(key, fromBits);
                } else {
                    this.rules.delete(key);
                }
                this.changed = true;
            }
            key = srcPrefix + desHostname;
            thisBits = this.rules.get(key);
            fromBits = from.rules.get(key);
            if ( fromBits !== thisBits ) {
                if ( fromBits !== undefined ) {
                    this.rules.set(key, fromBits);
                } else {
                    this.rules.delete(key);
                }
                this.changed = true;
            }
        }

        return this.changed;
    }

    // - *    *  type
    // - from *  type
    // - *    to *
    // - from to *

    hasSameRules(other, srcHostname, desHostnames) {
        // Specific types
        let key = '* *';
        if ( this.rules.get(key) !== other.rules.get(key) ) { return false; }
        key = srcHostname + ' *';
        if ( this.rules.get(key) !== other.rules.get(key) ) { return false; }
        // Specific destinations
        const wildcardPrefix = '* ';
        const srcPrefix = srcHostname + ' ';
        const desHostnameList = Object.keys(desHostnames);
        for ( let i = 0; i < desHostnameList.length; i++ ) {
            const desHostname = desHostnameList[i];
            key = wildcardPrefix + desHostname;
            if ( this.rules.get(key) !== other.rules.get(key) ) {
                return false;
            }
            key = srcPrefix + desHostname;
            if ( this.rules.get(key) !== other.rules.get(key) ) {
                return false;
            }
        }
        return true;
    }

    setCell(srcHostname, desHostname, type, state) {
        const bitOffset = typeBitOffsets[type];
        const k = srcHostname + ' ' + desHostname;
        const oldBitmap = this.rules.get(k) || 0;
        const newBitmap = oldBitmap & ~(3 << bitOffset) | (state << bitOffset);
        if ( newBitmap === oldBitmap ) { return false; }
        if ( newBitmap === 0 ) {
            this.rules.delete(k);
        } else {
            this.rules.set(k, newBitmap);
        }
        this.changed = true;
        return true;
    }

    unsetCell(srcHostname, desHostname, type) {
        this.evaluateCellZY(srcHostname, desHostname, type);
        if ( this.r === 0 ) { return false; }
        this.setCell(srcHostname, desHostname, type, 0);
        this.changed = true;
        return true;
    }

    evaluateCell(srcHostname, desHostname, type) {
        const key = srcHostname + ' ' + desHostname;
        const bitmap = this.rules.get(key);
        if ( bitmap === undefined ) { return 0; }
        return bitmap >> typeBitOffsets[type] & 3;
    }

    clearRegisters() {
        this.r = 0;
        this.type = this.y = this.z = '';
        return this;
    }

    evaluateCellZ(srcHostname, desHostname, type) {
        decomposeHostname(srcHostname, decomposedSource);
        this.type = type;
        const bitOffset = typeBitOffsets[type];
        const desSuffix = ' ' + desHostname;
        this.r = 0;
        for ( let i = 0; i < decomposedSource.length; i++ ) {
            const srchn = decomposedSource[i];
            this.z = srchn;
            let v = this.rules.get(srchn + desSuffix);
            if ( v === undefined ) { continue; }
            v = v >>> bitOffset & 3;
            if ( v === 0 ) { continue; }
            this.r = v;
            break;
        }
        // srcHostname is '*' at this point
        return this.r;
    }

    evaluateCellZY(srcHostname, desHostname, type) {
        // Pathological cases.
        if ( desHostname === '' ) {
            this.r = 0;
            return 0;
        }

        // Precedence: from most specific to least specific

        // Specific-destination, any party, any type
        decomposeHostname(desHostname, decomposedDestination);
        let found = false;
        for ( let i = 0; i < decomposedDestination.length; i++ ) {
            const deshn = decomposedDestination[i];
            if ( deshn === '*' ) { break; }
            this.y = deshn;
            if ( this.evaluateCellZ(srcHostname, deshn, '*') !== 0 ) {
                found = true;
                break;
            }
        }
        if ( found ) { return this.r; }

        const thirdParty = is3rdParty(srcHostname, desHostname);

        // Any destination
        this.y = '*';

        // Specific party
        if ( thirdParty ) {
            // 3rd-party, specific type
            if ( type === 'script' ) {
                if ( this.evaluateCellZ(srcHostname, '*', '3p-script') !== 0 ) {
                    return this.r;
                }
            } else if ( type === 'sub_frame' || type === 'object' ) {
                if ( this.evaluateCellZ(srcHostname, '*', '3p-frame') !== 0 ) {
                    return this.r;
                }
            }
            // 3rd-party, any type
            if ( this.evaluateCellZ(srcHostname, '*', '3p') !== 0 ) {
                return this.r;
            }
        } else if ( type === 'script' ) {
            // 1st party, specific type
            if ( this.evaluateCellZ(srcHostname, '*', '1p-script') !== 0 ) {
                return this.r;
            }
        }

        // Any destination, any party, specific type
        if ( supportedDynamicTypes[type] !== undefined ) {
            if ( this.evaluateCellZ(srcHostname, '*', type) !== 0 ) {
                return this.r;
            }
            if ( type.startsWith('3p-') ) {
                if ( this.evaluateCellZ(srcHostname, '*', '3p') !== 0 ) {
                    return this.r;
                }
            }
        }

        // Any destination, any party, any type
        if ( this.evaluateCellZ(srcHostname, '*', '*') !== 0 ) {
            return this.r;
        }

        this.type = '';
        return 0;
    }

    mustAllowCellZY(srcHostname, desHostname, type) {
        return this.evaluateCellZY(srcHostname, desHostname, type) === 2;
    }

    mustBlockOrAllow() {
        return this.r === 1 || this.r === 2;
    }

    mustBlock() {
        return this.r === 1;
    }

    mustAbort() {
        return this.r === 3;
    }

    lookupRuleData(src, des, type) {
        const r = this.evaluateCellZY(src, des, type);
        if ( r === 0 ) { return; }
        return `${this.z} ${this.y} ${this.type} ${r}`;
    }

    toLogData() {
        if ( this.r === 0  || this.type === '' ) { return; }
        return {
            source: 'dynamicHost',
            result: this.r,
            raw: `${this.z} ${this.y} ${this.type} ${intToActionMap.get(this.r)}`
        };
    }

    srcHostnameFromRule(rule) {
        return srcFromRule(rule);
    }

    desHostnameFromRule(rule) {
        return desFromRule(rule);
    }

    toArray() {
        return hostRuleArray(this);
    }

    toString() {
        return this.toArray().join('\n');
    }

    fromString(text, append) {
        parseRuleText(text, append, this);
    }

    validateRuleParts(parts) {
        return validateHostRuleParts(parts);
    }

    addFromRuleParts(parts) {
        if ( this.validateRuleParts(parts) !== undefined ) {
            this.setCell(parts[0], parts[1], parts[2], nameToActionMap[parts[3]]);
            return true;
        }
        return false;
    }

    removeFromRuleParts(parts) {
        if ( this.validateRuleParts(parts) !== undefined ) {
            this.setCell(parts[0], parts[1], parts[2], 0);
            return true;
        }
        return false;
    }

    append1stPartyRules(out) {
        const bitoffset = typeBitOffsets['*'];
        for ( const [ srcdes, bits ] of this.rules ) {
            const match = reFirstPartyRule.exec(srcdes);
            if ( match === null ) { continue; }
            if ( match[1] !== match[2] && match[2] !== '*' ) { continue; }
            const value = (bits >>> bitoffset) & 0b11;
            if ( value === 0 ) { continue; }
            out.push([ match[1], value === 2 ]);
        }
        return out;
    }

    export1stPartyRules() {
        return this.append1stPartyRules([]);
    }

    toSelfie() {
        return {
            magicId: this.magicId,
            rules: Array.from(this.rules)
        };
    }

    fromSelfie(selfie) {
        if ( selfie.magicId !== this.magicId ) { return false; }
        this.rules = new Map(selfie.rules);
        this.changed = true;
        return true;
    }
}

DynamicHostRuleFiltering.prototype.magicId = 1;

/******************************************************************************/

export default DynamicHostRuleFiltering;

/******************************************************************************/
