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

import setupI18nDOM from './i18n-dom.js';
import webext from './webext.js';

/******************************************************************************/

const i18n = webext.i18n;

const i18n$ = (...args) => i18n.getMessage(...args);

/******************************************************************************/

const isBackgroundProcess = document.documentElement.dataset.uboPage === 'background';

if ( isBackgroundProcess !== true ) {
    setupI18nDOM(i18n, i18n$);
}

/******************************************************************************/

export { i18n, i18n$ };
