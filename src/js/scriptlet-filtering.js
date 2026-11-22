/*******************************************************************************

    uBlock Origin - a comprehensive, efficient content blocker
    Copyright (C) 2017-present Raymond Hill

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

import '../lib/regexanalyzer/regex.js';

import * as makeScriptlets from './make-scriptlets.js';
import * as scripting from './vapi-scripting.js';

import { domainFromHostname, hostnameFromURI } from './uri-utils.js';

import { ScriptletFilteringEngine } from './scriptlet-filtering-core.js';
import { builtinScriptlets } from './resources/scriptlets.js';
import cacheStorage from './cachestorage.js';
import logger from './logger.js';
import { onBroadcast } from './broadcast.js';
import { redirectEngine } from './redirect-engine.js';
import { sessionFirewall } from './filtering-engines.js';
import µb from './background.js';

/******************************************************************************/

const [
    templateBegin,
    templateCore,
    templateEnd,
] = await Promise.all([
    fetch('/js/scriptlet-begin.template.js').then(response => response.text()),
    fetch('/js/scriptlet.template.js').then(response => response.text()),
    fetch('/js/scriptlet-end.template.js').then(response => response.text()),
]);

/******************************************************************************/

function isTrustedContext(fn, data) {
    const docloc = document.location;
    const origins = document.location.ancestorOrigins;
    let topurl = docloc;
    if ( origins?.length ) {
        try {
            topurl = new URL(origins.item(origins.length-1));
        } catch {
        }
    }
    return Boolean(fn(data, topurl.href, topurl.hostname));
}

function topFrameRulesMatcher(rules) {
    const docloc = document.location;
    const origins = document.location.ancestorOrigins;
    let topurl = docloc;
    if ( origins?.length ) {
        try {
            topurl = new URL(origins.item(origins.length-1));
        } catch {
        }
    }
    const hostname = topurl.hostname;
    let pos = 0;
    do {
        const value = rules.get(hostname.slice(pos));
        if ( typeof value === 'boolean' ) { return value; }
        pos = hostname.indexOf('.', pos) + 1;
    } while ( pos !== 0 );
    return rules.get('*') === true;
}

function initCommChannel(name) {
    if ( self.uBO_bcSecret ) { return; }
    try {
        const bcSecret = new self.BroadcastChannel(name);
        bcSecret.onmessage = ev => {
            const msg = ev.data;
            switch ( typeof msg ) {
            case 'string':
                if ( msg !== 'areyouready?' ) { break; }
                bcSecret.postMessage('iamready!');
                break;
            case 'object':
                if ( self.vAPI && self.vAPI.messaging ) {
                    self.vAPI.messaging.send('contentscript', msg);
                } else {
                    console.log(`[uBO][${msg.type}]${msg.text}`);
                }
                break;
            }
        };
        bcSecret.postMessage('iamready!');
        self.uBO_bcSecret = bcSecret;
    } catch {
    }
}

function assembleIsolatedWorldWrapper(isolatedCode, options) {
    const globals = options.scriptletGlobals ?? {};
    let code = isolatedWrapperBegin + '\n' +
        globalsDeclPrefix + JSON.stringify(globals) + ';';
    if ( globals.bcSecret ) {
        code += '\n' + initCommChannelSource +
            '\ninitCommChannel(' + JSON.stringify(globals.bcSecret) + ');';
    }
    if ( options.debug ) { code += '\ndebugger;'; }
    return code + '\n' + ( isolatedCode ?? '' ) + '\n' + wrapperEnd;
}

function assembleMainWorldWrapper(mainCode, options) {
    let code = mainWrapperBegin;
    if ( options.debug ) { code += '\ndebugger;'; }
    code += '\n' + globalsDeclPrefix +
        JSON.stringify(options.scriptletGlobals ?? {}) + ';';
    return code + '\n' + ( mainCode ?? '' ) + '\n' + wrapperEnd;
}

const isTrustedContextSource = isTrustedContext.toString();
const topFrameRulesMatcherSource = topFrameRulesMatcher.toString();
const initCommChannelSource = initCommChannel.toString();
const isolatedWrapperBegin = '(function uBO_isolatedWorldScriptlets() {';
const mainWrapperBegin = '(function uBO_mainWorldScriptlets() {';
const globalsDeclPrefix = 'const $SCRIPTLET_GLOBALS$ = ';
const wrapperEnd = '})();';
const noContentScriptOptions = {};
const retrieveOneScratch = new Map();
const parsedArgsCache = new Map();

/******************************************************************************/

export class ScriptletFilteringEngineEx extends ScriptletFilteringEngine {
    constructor() {
        super();
        this.warOrigin = vAPI.getURL('/web_accessible_resources');
        this.warSecret = vAPI.warSecret.long();
        this.isDevBuild = undefined;
        this.logLevel = 1;
    }

    async start() {
        cacheStorage.remove('makescriptletsCommitResult');
        await scripting.start((...args) =>
            this.getContentScripts(...args)
        );
        this.#startListening();
    }

    reset() {
        super.reset();
        this.warSecret = vAPI.warSecret.long(this.warSecret);
        scripting.reset();
        makeScriptlets.resetAll();
    }

    freeze() {
        super.freeze();
        scripting.reset();
        this.resetCompiler();
    }

    fromSelfie(selfie) {
        scripting.reset();
        this.resetCompiler();
        return super.fromSelfie(selfie);
    }

    resetCompiler() {
        makeScriptlets.resetAll();
        makeScriptlets.init(builtinScriptlets);
        for ( const [ name, entry ] of redirectEngine.resources ) {
            if ( entry.origin !== 'war' && entry.origin !== 'user' ) { continue; }
            if ( typeof entry.data !== 'string' ) { continue; }
            const details = Object.assign({}, entry, {
                name,
                code: entry.data,
            });
            makeScriptlets.importScriptlet(details);
        }
    }

    getContentScripts(url, options = noContentScriptOptions) {
        const hostname = hostnameFromURI(url);
        const domain = domainFromHostname(hostname);
        const map = this.scriptletDB.retrieveOne(
            hostname,
            domain,
            retrieveOneScratch
        );
        makeScriptlets.reset();
        for ( const [ rawargs, details ] of map ) {
            let args = parsedArgsCache.get(rawargs);
            if ( args === undefined ) {
                args = JSON.parse(rawargs);
                parsedArgsCache.set(rawargs, args);
            }
            details.args = args.slice();
            details.trustedSource = true;
            makeScriptlets.compile('uBlock', details);
        }
        const secret = self.crypto.randomUUID();
        const resultCore = makeScriptlets.commit('uBlock', templateCore, secret);
        const resultFramework = makeScriptlets.commitFramework(templateBegin, templateEnd, secret);
        const result = { MAIN: undefined, ISOLATED: undefined };
        if ( resultCore.MAIN ) {
            const { beginCode, endCode } = resultFramework.MAIN;
            result.MAIN = {
                code: beginCode + '\n' + resultCore.MAIN.code + '\n' + endCode,
            };
        }
        if ( resultCore.ISOLATED ) {
            const { beginCode, endCode } = resultFramework.ISOLATED;
            result.ISOLATED = {
                code: beginCode + '\n' + resultCore.ISOLATED.code + '\n' + endCode,
            };
        }
        if ( this.isDevBuild === undefined ) {
            this.isDevBuild = vAPI.webextFlavor.soup.has('devbuild') ||
                µb.hiddenSettings.filterAuthorMode;
        }
        const scriptletGlobals = {
            topOrigin: options.topOrigin,
            bcSecret: undefined,
            logLevel: undefined,
        };
        const out = {
            hostname,
            scriptletGlobals,
            debug: undefined,
            isolatedCode: undefined,
            mainCode: undefined,
            earlyBailoutCode: undefined,
        };
        if ( logger.enabled ) {
            scriptletGlobals.bcSecret = vAPI.generateSecret(3);
            scriptletGlobals.logLevel = this.logLevel;
        }
        if ( result.ISOLATED ) {
            out.debug = µb.hiddenSettings.debugIsolatedScriptlets;
            out.isolatedCode = assembleIsolatedWorldWrapper(result.ISOLATED.code, out);
        }
        if ( result.MAIN ) {
            out.debug = µb.hiddenSettings.debugMainScriptlets;
            out.mainCode = assembleMainWorldWrapper(result.MAIN.code, out);
        }
        const trustedSiteMatcher = µb.trustedSites.getMatcher();
        const trustedData = [];
        for ( const entry of trustedSiteMatcher.data ) {
            if ( entry[0] === '#' ) { continue; }
            trustedData.push(entry);
        }
        let earlyBailoutCode =
            isTrustedContextSource + '\n' +
            'if ( isTrustedContext(\n' +
            `${trustedSiteMatcher.match.toString()},\n` +
            'new Map(\n' +
            JSON.stringify(trustedData) + '\n' +
            ')) ) { return; }';
        const topFrameRules = [];
        for ( const rule of sessionFirewall.export1stPartyRules() ) {
            if ( rule[1] === 'behind-the-scene' ) { continue; }
            topFrameRules.push(rule);
        }
        if ( topFrameRules.length !== 0 ) {
            earlyBailoutCode += '\n' + topFrameRulesMatcherSource +
                '\nif ( topFrameRulesMatcher(new Map(' +
                JSON.stringify(topFrameRules) + ')) ) { return; }';
        }
        out.earlyBailoutCode = earlyBailoutCode;
        return out;
    }

    retrieve(request) {
        const hostname = hostnameFromURI(request.url);
        // https://github.com/gorhill/uBlock/issues/2835
        // Do not inject scriptlets if the site is under an `allow` rule.
        if ( µb.userSettings.advancedUserEnabled ) {
            if ( sessionFirewall.evaluateCellZY(hostname, hostname, '*') === 2 ) {
                return false;
            }
        }
        return super.retrieve(request);
    }

    toLogger(request, filters) {
        if ( Array.isArray(filters) === false ) { return; }
        if ( logger.enabled !== true ) { return; }
        µb.filteringContext
            .duplicate()
            .fromTabId(request.tabId)
            .setRealm('extended')
            .setType('scriptlet')
            .setURL(request.url)
            .setDocOriginFromURL(request.url)
            .setFilter(filters.map(a => ({ source: 'extended', raw: a })))
            .toLogger();
    }

    #startListening() {
        if ( this.bc ) { return; }
        this.bc = onBroadcast(msg => {
            switch ( msg.what ) {
            case 'filteringBehaviorChanged':
                scripting.reset();
                break;
            case 'hiddenSettingsChanged':
                this.isDevBuild = undefined;
                /* fall through */
            case 'loggerEnabled':
            case 'loggerDisabled':
                scripting.reset();
                break;
            case 'loggerLevelChanged':
                this.logLevel = msg.level;
                vAPI.tabs.query({
                    discarded: false,
                    url: [ 'http://*/*', 'https://*/*' ],
                }).then(tabs => {
                    for ( const tab of tabs ) {
                        const { status } = tab;
                        if ( status !== 'loading' && status !== 'complete' ) { continue; }
                        vAPI.tabs.executeScript(tab.id, {
                            allFrames: true,
                            file: `/js/scriptlets/scriptlet-loglevel-${this.logLevel}.js`,
                            matchAboutBlank: true,
                        });
                    }
                });
                scripting.reset();
                break;
            }
        });
    }
}

/******************************************************************************/

const scriptletFilteringEngine = new ScriptletFilteringEngineEx();

export default scriptletFilteringEngine;

/******************************************************************************/
