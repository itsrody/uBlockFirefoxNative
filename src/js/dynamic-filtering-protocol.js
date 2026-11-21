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

// Object.create(null) is used below to eliminate worries about unexpected
// property names in prototype chain -- and this way we don't have to use
// Object.hasOwn() to avoid this.

/******************************************************************************/

export const supportedDynamicTypes = Object.create(null);
Object.assign(supportedDynamicTypes, {
           '3p': true,
        'image': true,
'inline-script': true,
    '1p-script': true,
    '3p-script': true,
     '3p-frame': true
});

export const typeBitOffsets = Object.create(null);
Object.assign(typeBitOffsets, {
            '*':  0,
'inline-script':  2,
    '1p-script':  4,
    '3p-script':  6,
     '3p-frame':  8,
        'image': 10,
           '3p': 12
});

export const dynamicHostNameToActionMap = Object.create(null);
Object.assign(dynamicHostNameToActionMap, {
    'block': 1,
    'allow': 2,
     'noop': 3
});

export const dynamicHostIntToActionMap = new Map([
    [ 1, 'block' ],
    [ 2, 'allow' ],
    [ 3, 'noop' ]
]);

/******************************************************************************/

export const dynamicURLActionToNameMap = {
    1: 'block',
    2: 'allow',
    3: 'noop'
};

export const dynamicURLNameToActionMap = Object.create(null);
Object.assign(dynamicURLNameToActionMap, {
    'block': 1,
    'allow': 2,
     'noop': 3
});

export const dynamicURLKnownInvalidTypes = new Set([
    'doc',
    'main_frame',
]);

export const dynamicURLIntToActionLogMap = new Map([
    [ 1, ' block' ],
    [ 2, ' allow' ],
    [ 3, ' noop' ]
]);

/******************************************************************************/

export const switchBitOffsets = Object.create(null);
Object.assign(switchBitOffsets, {
       'no-strict-blocking':  0,
                'no-popups':  2,
    'no-cosmetic-filtering':  4,
          'no-remote-fonts':  6,
           'no-large-media':  8,
           'no-csp-reports': 10,
             'no-scripting': 12,
});

export const switchStateToNameMap = Object.create(null);
Object.assign(switchStateToNameMap, {
    '1': 'true',
    '2': 'false',
});

export const nameToSwitchStateMap = Object.create(null);
Object.assign(nameToSwitchStateMap, {
     'true': 1,
    'false': 2,
       'on': 1,
      'off': 2,
});

/******************************************************************************/
