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
filter-compatibility diagnostics. It is not an MV3 runtime path: uBlockFox
blocks requests with the MV2 static filtering engines and does not apply DNR
rules.

---

### Compatibility settings

The following compatibility surfaces are intentionally retained:

- `modifyWebextFlavor` — admin/advanced override for filter-list preparser tokens.
- `cacheControlForFirefox1376932` — optional override for Firefox's modified-response cache workaround; default `unset`.
- backup restore migration for old Firefox/Chromium backups.
- `chrome-extension-scheme` and `chrome:` opener exclusions, because Firefox still uses `chrome:` internal URLs and older stored settings may use the legacy scheme name.
- Firefox-specific undefined-`fetched` storage guard.

These are compatibility records, not plans to support other browsers. Do not
remove them without a separate migration review.

---

### Translations

You can help translate uBO via [Crowdin](https://crowdin.com/project/ublock).

---

### Reporting Issues

This fork targets native Firefox 160 and later only. Issues with builds from
this repository can be reported in the [issue tracker](https://github.com/itsrody/uBlockFox/issues).

#### Support Forum

For support, questions, or assistance, please visit [/r/uBlockOrigin](https://www.reddit.com/r/uBlockOrigin/).

#### Filter List Issues

Report issues related to filter lists or broken website functionality in the [uAssets issue tracker](https://github.com/uBlockOrigin/uAssets/issues).

#### Upstream uBO Issues

For issues in the shared uBO core code, please use the [uBO issue tracker](https://github.com/uBlockOrigin/uBlock-issues/issues).
