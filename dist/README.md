# Install

uBlock Firefox Native targets **native Firefox 160 or later** only. Release
builds are **unsigned XPIs** and are distributed manually from
[GitHub releases](https://github.com/itsrody/uBlockFirefoxNative/releases). This fork is
not listed on Firefox Add-ons.

## Firefox 160+

### From a release build

1. Download `uBlock0_<version>.firefox.xpi` from
   [the releases page](https://github.com/itsrody/uBlockFirefoxNative/releases).
2. For a persistent install, use Firefox Developer Edition, Nightly, or ESR and
   set `xpinstall.signatures.required` to `false` in `about:config`. Standard
   Firefox Release and Beta reject unsigned add-ons by design.
3. Open the downloaded file in Firefox and follow the prompts to install it.

Updates are manual: download the newer XPI and install it. There is no automatic
browser update channel for unsigned builds.

### Temporary developer install

In any Firefox 160+ build, you can load the unpacked extension temporarily:

- Navigate to `about:debugging#/runtime/this-firefox`
- Click _"Load Temporary Add-on..."_
- Select `dist/build/uBlock0.firefox/manifest.json`

Temporary add-ons are removed when Firefox restarts.

### Location of uBO settings

On Linux, the settings are saved in a JSON file located at:

```
~/.mozilla/firefox/[profile name]/browser-extension-data/uBlockFirefoxNative@itsrody.github.io/storage.js
```

When you uninstall the extension, Firefox deletes this file, and all your settings will be lost.

## Build instructions (for developers)

1. Clone this repository:
   ```bash
   git clone https://github.com/itsrody/uBlockFirefoxNative.git uBlockFirefoxNative
   cd uBlockFirefoxNative
   ```
2. Build the extension:
   ```bash
   make firefox
   ```
   This creates an **unsigned** `dist/build/uBlock0.firefox.xpi` and the unpacked
   extension in `dist/build/uBlock0.firefox/`. There is no AMO signing step. The
   build downloads filter lists from [uAssets](https://github.com/uBlockOrigin/uAssets)
   into `dist/build/uAssets`.

Use `make cleanassets` to remove downloaded assets, and `make clean` to remove
all build output.
