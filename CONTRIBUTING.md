# Contributions

Please refer to the sections below to find the appropriate destination for your contributions. Thank you for your support!

---

### Architecture

This fork targets Firefox 160+ only and keeps the Manifest V2 background page.
The remaining `vAPI` modules are Firefox capability shims used by the shared
uBO core; they are not a cross-browser abstraction layer. Guards that remain
in them cover Firefox desktop/Firefox Android API differences.

### Builds

Use `make firefox` to build the Firefox 160+ XPI. `npm run lint` and
`npm run benchmark:dataset` are developer helpers only; there are no other
publish targets.

### Developer tools

The `SNFE: DNR` button in `devtools.html` exports a DNR-shaped ruleset for
filter-compatibility diagnostics. It is not an MV3 runtime path: uBlock Firefox
Native blocks requests with the MV2 static filtering engines and does not apply
DNR rules.

### Native and upstream-only performance work

This repository ships a WebExtension. SpiderMonkey, WarpJIT, Gecko networking,
GeckoView, and browser C++ patches cannot be packaged in the XPI produced by
`make firefox`. Optimization work here must stay within Firefox's MV2 WebExtension
APIs and JavaScript engine behavior.

Ideas that require browser internals belong upstream in Mozilla, not in this
extension:

| Idea | Destination | Why it is not a uBlock Firefox Native patch |
| :--- | :---------- | :------------------------------ |
| JIT/Warp heuristics for filter match loops | SpiderMonkey | No WebExtension control over JIT compilation or inline caches. |
| Native URL, header, or response parsing | Gecko network stack | `webRequest` exposes detail objects, not parser or pipeline hooks. |
| CNAME/DNS resolution changes in the network process | Gecko/Necko | `browser.dns` is the only supported extension surface. |
| Selector-engine or `:has()` matching changes | Gecko style system | Content scripts can only query the engine Firefox provides. |
| GeckoView embedding or injection changes | Firefox for Android / GeckoView | The extension can only use the exposed Android WebExtension APIs. |

Mozilla-side work requires a separate Gecko source checkout, its own build and
test cycle, and an upstream review. This repository intentionally keeps no
native source tree or native build target. When such work is proposed, record
it as an upstream note and keep the shipped extension behavior unchanged.

For extension-side performance changes, use the built-in devtools benchmarks and
the deterministic dataset described in [README.md](README.md#benchmarks). Prefer
changes that reduce allocations, repeated parsing, stale caches, or unnecessary
API work without altering filtering semantics, hidden compatibility settings,
or the retained Firefox Android guards.

---

### Compatibility settings

The following compatibility surfaces are intentionally retained:

- `modifyWebextFlavor` — admin/advanced override for filter-list preparser tokens, including `-native_css_has`.
- `cacheControlForFirefox1376932` — optional override for Firefox's modified-response cache workaround; default `unset`.
- backup restore migration for old Firefox/Chromium backups.
- `chrome-extension-scheme` and `chrome:` opener exclusions, because Firefox still uses `chrome:` internal URLs and older stored settings may use the legacy scheme name.
- Firefox-specific undefined-`fetched` storage guard.
- filter-list preparser tokens for historical browser names (for example `env_chromium`); these select filter-list rules and are not browser support targets.

These are compatibility records, not plans to support other browsers. Do not
remove them without a separate migration review.

Code markers for these records:

- Hidden defaults and trusted-site directives: `src/js/background.js`
- Flavor tokens: `platform/common/vapi-common.js`
- Preparser tokens: `src/js/static-filtering-parser.js`
- Storage guard: `src/js/start.js`
- Backup migration: `src/js/messaging.js`
- Response rewriting and cache override: `src/js/traffic.js`
- Firefox desktop/Android API differences: `platform/common/vapi-background.js`

---

### Translations

You can help translate uBO via [Crowdin](https://crowdin.com/project/ublock).

---

### Reporting Issues

This fork targets native Firefox 160 and later only. Issues with builds from
this repository can be reported in the [issue tracker](https://github.com/itsrody/uBlockFirefoxNative/issues).

#### Support Forum

For support, questions, or assistance, please visit [/r/uBlockOrigin](https://www.reddit.com/r/uBlockOrigin/).

#### Filter List Issues

Report issues related to filter lists or broken website functionality in the [uAssets issue tracker](https://github.com/uBlockOrigin/uAssets/issues).

#### Upstream uBO Issues

For issues in the shared uBO core code, please use the [uBO issue tracker](https://github.com/uBlockOrigin/uBlock-issues/issues).
