[![Badge Commits]][Commit Rate]
[![Badge Localization]][Crowdin]
[![Badge License]][License]
[![Badge Mozilla]][Mozilla]

***

<h1 align="center">
<sub>
<img src="https://github.com/gorhill/uBlock/blob/master/src/img/ublock.svg" height="38" width="38">
</sub>
uBlock Origin — Firefox Native Edition
</h1>

> **uBlock Firefox Native (`uBlock FF`) is a Firefox-only fork of [uBlock Origin][upstream].**
> It targets native Firefox **160 and later** and uses Firefox's Manifest V2
> extension API. Builds are unsigned XPIs distributed manually through GitHub
> releases. There are no Chromium, Edge, Opera, Thunderbird, Safari, or Manifest
> V3 builds.

| Browser | Install from ... | Status |
| :-----: | ---------------- | ------ |
| Firefox 160+ | [GitHub releases][Releases] | Unsigned XPI for native Firefox. Manual install/update; unsigned add-ons must be allowed. |
| Firefox 160+ | [Firefox Add-ons][Mozilla] | Official uBO release (not this fork). |

uBlock Origin (uBO) is a CPU and memory-efficient [wide-spectrum content blocker][Blocking] for Firefox. It blocks ads, trackers, coin miners, popups, annoying anti-blockers, malware sites, etc., by default using [EasyList][EasyList], [EasyPrivacy][EasyPrivacy], [Peter Lowe's Blocklist][Peter Lowe's Blocklist], [Online Malicious URL Blocklist][Malicious Blocklist], and uBO [filter lists][uBO Filters]. There are many other lists available to block even more. Hosts files are also supported. uBO uses the EasyList filter syntax and [extends][Extended Syntax] the syntax to work with custom rules and filters.

You may easily unselect any preselected filter lists if you think uBO blocks too much. For reference, Adblock Plus installs with only EasyList, ABP filters, and Acceptable Ads enabled by default.

It is important to note that using a blocker is **NOT** [theft]. Do not fall for this creepy idea. The _ultimate_ logical consequence of `blocking = theft` is the criminalization of the inalienable right to privacy.

Ads, "unintrusive" or not, are just the visible portion of the privacy-invading means entering your browser when you visit most sites. uBO's primary goal is to help users neutralize these privacy-invading methods in a way that welcomes those users who do not wish to use more technical means.

***

* [Documentation](#documentation)
* [Installation](#installation)
* [Build from source](#build-from-source)
* [Release history](#release-history)
* [Translations](#translations)
* [About](#about)

## Documentation

<table>
    <thead>
        <tr>
            <th>Basic Mode</th>
            <th>Advanced Mode</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>The <a href="https://github.com/gorhill/uBlock/wiki/Quick-guide:-popup-user-interface">simple popup user interface</a> for an install-it-and-forget-it type of installation that is configured optimally by default.</td>
            <td>The <a href="https://github.com/gorhill/uBlock/wiki/Dynamic-filtering:-quick-guide">advanced popup user interface</a> includes a point-and-click firewall that is configurable on a per-site basis.</td>
        </tr>
        <tr>
            <td align="center" valign="top"><a href="https://github.com/gorhill/uBlock/wiki/Quick-guide:-popup-user-interface"><img src="https://user-images.githubusercontent.com/585534/232531044-c4ac4dd5-0b60-4c1e-aabb-914be04b846c.png"/></a></td>
            <td align="center" valign="top"><a href="https://github.com/gorhill/uBlock/wiki/Dynamic-filtering:-quick-guide"><img src="https://user-images.githubusercontent.com/585534/232531439-a8f81cc3-6622-45c4-8b32-7348cecf6e98.png"/></a></td>
        </tr>
    </tbody>
</table>

Visit the [Wiki][Wiki] for documentation.

For support, questions, or help, visit [/r/uBlockOrigin][Reddit].

## Installation

Requires **Firefox 160 or later**. Release builds are **unsigned XPIs** and are
distributed manually through [GitHub releases][Releases]; this fork is not listed
on Firefox Add-ons.

1. Download `uBlock0_<version>.firefox.xpi` from the [releases page][Releases].
2. For a persistent install, use Firefox Developer Edition, Nightly, or ESR and
   set `xpinstall.signatures.required` to `false` in `about:config`. Standard
   Firefox Release and Beta reject unsigned add-ons by design.
3. Open the downloaded XPI in Firefox and follow the prompts to install it.
4. Update manually by downloading a newer XPI and installing it. There is no
   automatic browser update channel for unsigned builds.

For temporary testing, use `about:debugging#/runtime/this-firefox` and
_Load Temporary Add-on..._ instead; temporary add-ons are removed when Firefox
restarts.

[Required Permissions][Permissions]

Do **NOT** use uBO with any other content blocker. uBO [performs][Performance] as well as or better than most popular blockers. Other blockers can prevent uBO's privacy or anti-blocker-defusing features from working correctly.

## Build from source

```bash
git clone https://github.com/itsrody/uBlockFirefoxNative.git uBlockFirefoxNative
cd uBlockFirefoxNative
make firefox
```

`make firefox` produces an **unsigned** `dist/build/uBlock0.firefox.xpi` (and the
unpacked extension in `dist/build/uBlock0.firefox/`). There is no AMO signing
step and no browser update channel; distribute the XPI manually. The build
downloads the filter lists from [uAssets][uAssets]; `make cleanassets` removes
that cached data.

To temporarily load the unpacked extension, open `about:debugging#/runtime/this-firefox`
in Firefox and choose _Load Temporary Add-on..._.

Run `make lint` to check the JavaScript and JSON sources.

## Benchmarks

The build includes a deterministic benchmark dataset at
`assets/requests.json`, so uBO's built-in devtools benchmarks are enabled by
default.

1. Load the unpacked extension with `about:debugging`.
2. Open `moz-extension://<extension-id>/devtools.html`.
3. Click **SNFE: Benchmark**, **CFE: Benchmark**, or **SFE: Benchmark**.
4. Read the result in the devtools log.

The dataset is synthetic and is only used for string matching; no request is
made to any host in it. Regenerate it with:

```bash
npm run benchmark:dataset -- 2000
```

For real-world measurements, replace it with your own JSON array or NDJSON file
where each row has `url`, `frameUrl`, and `cpt`, then set the hidden setting
`benchmarkDatasetURL` to that path or URL.

## Development notes

See [CONTRIBUTING.md](CONTRIBUTING.md) for the Firefox-native architecture,
retained compatibility settings, diagnostic-only DNR export notes, and the
boundary for native/upstream-only performance work. There is only one build
target: `make firefox`.

## Release history

[Releases page][Releases]

## Translations

Help translate uBO via [Crowdin][Crowdin].

## About

[Manifesto][Manifesto]

[Privacy Policy][Privacy Policy]

[GPLv3 License][License]

Free. Open-source. For users by users. No donations sought.

If you ever want to contribute something, think about the people working hard to maintain the filter lists you are using, which are available to use by all for free.

<!----------------------------------------------------------------------------->

[Peter Lowe's Blocklist]: https://pgl.yoyo.org/adservers/
[Malicious Blocklist]: https://gitlab.com/malware-filter/urlhaus-filter#malicious-url-blocklist
[Performance]: https://www.debugbear.com/blog/chrome-extensions-website-performance#the-impact-of-ad-blocking-on-website-performance
[EasyPrivacy]: https://easylist.to/#easyprivacy
[Mozilla]: https://addons.mozilla.org/addon/ublock-origin/
[EasyList]: https://easylist.to/#easylist
[Crowdin]: https://crowdin.com/project/ublock
[Reddit]: https://www.reddit.com/r/uBlockOrigin/
[Theft]: https://x.com/LeaVerou/status/518154828166725632

[Manifesto]: MANIFESTO.md
[License]: LICENSE.txt
[upstream]: https://github.com/gorhill/uBlock

<!---------------------------------[ Internal ]-------------------------------->

[Extended Syntax]: https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#extended-syntax
[Privacy Policy]: https://github.com/gorhill/uBlock/wiki/Privacy-policy
[uBO Filters]: https://github.com/uBlockOrigin/uAssets/tree/master/filters
[uAssets]: https://github.com/uBlockOrigin/uAssets
[Permissions]: https://github.com/gorhill/uBlock/wiki/Permissions
[Commit Rate]: https://github.com/itsrody/uBlockFirefoxNative/commits/master
[Works Best]: https://github.com/gorhill/uBlock/wiki/uBlock-Origin-works-best-on-Firefox
[Blocking]: https://github.com/gorhill/uBlock/wiki/Blocking-mode
[Releases]: https://github.com/itsrody/uBlockFirefoxNative/releases
[Issues]: https://github.com/itsrody/uBlockFirefoxNative/issues
[Wiki]: https://github.com/gorhill/uBlock/wiki

<!----------------------------------[ Badges ]--------------------------------->

[Badge Localization]: https://d322cqt584bo4o.cloudfront.net/ublock/localized.svg
[Badge Commits]: https://img.shields.io/github/commit-activity/m/itsrody/uBlockFirefoxNative?label=Commits
[Badge Mozilla]: https://img.shields.io/amo/rating/ublock-origin?label=Firefox
[Badge License]: https://img.shields.io/badge/License-GPLv3-blue.svg
[Badge Issues]: https://img.shields.io/github/issues/itsrody/uBlockFirefoxNative
