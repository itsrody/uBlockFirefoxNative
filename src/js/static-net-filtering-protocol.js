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

// 10fedcba9876543210
// ||||||||    | || |
// ||||||||    | || |
// ||||||||    | || |
// ||||||||    | || |
// ||||||||    | || +---- bit  0- 1: block=0, allow=1, block important=2
// ||||||||    | |+------ bit     2: unused
// ||||||||    | +------- bit  3- 4: party [0-3]
// ||||||||    +--------- bit  5- 9: type [0-31]
// |||||||+-------------- bit    10: headers-based filters
// ||||||+--------------- bit 13-11: modify type

export const BLOCK_REALM          = 0b0000_0000_0000_0000_0000;
export const ALLOW_REALM          = 0b0000_0000_0000_0000_0001;
export const IMPORTANT_REALM      = 0b0000_0000_0000_0000_0010;
export const BLOCKALLOW_REALM     = BLOCK_REALM | ALLOW_REALM | IMPORTANT_REALM;
export const BLOCKIMPORTANT_REALM = BLOCK_REALM | IMPORTANT_REALM;
export const ANYPARTY_REALM       = 0b0000_0000_0000_0000_0000;
export const FIRSTPARTY_REALM     = 0b0000_0000_0000_0000_1000;
export const THIRDPARTY_REALM     = 0b0000_0000_0000_0001_0000;
export const ALLPARTIES_REALM     = FIRSTPARTY_REALM | THIRDPARTY_REALM;
export const TYPE_REALM           = 0b0000_0000_0011_1110_0000;
export const HEADERS_REALM        = 0b0000_0000_0100_0000_0000;
export const REDIRECT_REALM       = 0b0000_0000_1000_0000_0000;
export const REMOVEPARAM_REALM    = 0b0000_0001_0000_0000_0000;
export const CSP_REALM            = 0b0000_0001_1000_0000_0000;
export const PERMISSIONS_REALM    = 0b0000_0010_0000_0000_0000;
export const URLTRANSFORM_REALM   = 0b0000_0010_1000_0000_0000;
export const REPLACE_REALM        = 0b0000_0011_0000_0000_0000;
export const URLSKIP_REALM        = 0b0000_0011_1000_0000_0000;
export const MODIFY_REALMS        = 0b0000_0011_1000_0000_0000;

/******************************************************************************/

// Do not change order. Compiled filter lists rely on this order being
// consistent across sessions.
export const MODIFIER_TYPE_REDIRECT = 1;
export const MODIFIER_TYPE_REDIRECTRULE = 2;
export const MODIFIER_TYPE_REMOVEPARAM = 3;
export const MODIFIER_TYPE_CSP = 4;
export const MODIFIER_TYPE_PERMISSIONS = 5;
export const MODIFIER_TYPE_URLTRANSFORM = 6;
export const MODIFIER_TYPE_REPLACE = 7;
export const MODIFIER_TYPE_URLSKIP = 8;

export const modifierBitsFromType = new Map([
    [ MODIFIER_TYPE_REDIRECT, REDIRECT_REALM ],
    [ MODIFIER_TYPE_REDIRECTRULE, REDIRECT_REALM ],
    [ MODIFIER_TYPE_REMOVEPARAM, REMOVEPARAM_REALM ],
    [ MODIFIER_TYPE_CSP, CSP_REALM ],
    [ MODIFIER_TYPE_PERMISSIONS, PERMISSIONS_REALM ],
    [ MODIFIER_TYPE_URLTRANSFORM, URLTRANSFORM_REALM ],
    [ MODIFIER_TYPE_REPLACE, REPLACE_REALM ],
    [ MODIFIER_TYPE_URLSKIP, URLSKIP_REALM ],
]);

export const modifierTypeFromName = new Map([
    [ 'redirect', MODIFIER_TYPE_REDIRECT ],
    [ 'redirect-rule', MODIFIER_TYPE_REDIRECTRULE ],
    [ 'removeparam', MODIFIER_TYPE_REMOVEPARAM ],
    [ 'csp', MODIFIER_TYPE_CSP ],
    [ 'permissions', MODIFIER_TYPE_PERMISSIONS ],
    [ 'uritransform', MODIFIER_TYPE_URLTRANSFORM ],
    [ 'replace', MODIFIER_TYPE_REPLACE ],
    [ 'urlskip', MODIFIER_TYPE_URLSKIP ],
]);

export const modifierNameFromType = new Map([
    [ MODIFIER_TYPE_REDIRECT, 'redirect' ],
    [ MODIFIER_TYPE_REDIRECTRULE, 'redirect-rule' ],
    [ MODIFIER_TYPE_REMOVEPARAM, 'removeparam' ],
    [ MODIFIER_TYPE_CSP, 'csp' ],
    [ MODIFIER_TYPE_PERMISSIONS, 'permissions' ],
    [ MODIFIER_TYPE_URLTRANSFORM, 'uritransform' ],
    [ MODIFIER_TYPE_REPLACE, 'replace' ],
    [ MODIFIER_TYPE_URLSKIP, 'urlskip' ],
]);
