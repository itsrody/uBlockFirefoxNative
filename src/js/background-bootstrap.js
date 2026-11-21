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

// Firefox background bootstrap. Establish WebExtension capability shims and
// install background-side listeners before startup orchestration is imported.

import './vapi-common.js';
import './vapi-background.js';
import './vapi-background-ext.js';

import './commands.js';
import './messaging.js';
import './storage.js';
import './tab.js';
import './ublock.js';
import './utils.js';

import {
    permanentFirewall,
    permanentSwitches,
    permanentURLFiltering,
    sessionFirewall,
    sessionSwitches,
    sessionURLFiltering,
} from './filtering-engines.js';

import io from './assets.js';
import staticExtFilteringEngine from './static-ext-filtering.js';
import { staticFilteringReverseLookup } from './reverselookup.js';
import staticNetFilteringEngine from './static-net-filtering.js';
import µb from './background.js';

/******************************************************************************/

vAPI.tabs = new vAPI.Tabs();

vAPI.alarms.onAlarm.addListener(alarm => {
    µb.alarmQueue.push(alarm.name);
});

vAPI.app.onShutdown = ( ) => {
    staticFilteringReverseLookup.shutdown();
    io.updateStop();
    staticNetFilteringEngine.reset();
    staticExtFilteringEngine.reset();
    sessionFirewall.reset();
    permanentFirewall.reset();
    sessionURLFiltering.reset();
    permanentURLFiltering.reset();
    sessionSwitches.reset();
    permanentSwitches.reset();
};
