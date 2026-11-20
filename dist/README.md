# Install

This fork targets **native Firefox 160 or later** only.

## Firefox 160+

### From a release build

1. Download `uBlock0_<version>.firefox.xpi` from [the releases page](https://github.com/itsrody/uBlockFox/releases).
2. Open the downloaded file in Firefox and follow the prompts to install it.

### Location of uBO settings

On Linux, the settings are saved in a JSON file located at:

```
~/.mozilla/firefox/[profile name]/browser-extension-data/uBlock0@raymondhill.net/storage.js
```

When you uninstall the extension, Firefox deletes this file, and all your settings will be lost.

## Build instructions (for developers)

1. Clone this repository:
   ```bash
   git clone https://github.com/itsrody/uBlockFox.git
   cd uBlockFox
   ```
2. Build the extension:
   ```bash
   make firefox
   ```
   This creates `dist/build/uBlock0.firefox.xpi` and the unpacked extension in
   `dist/build/uBlock0.firefox/`. The build downloads filter lists from
   [uAssets](https://github.com/uBlockOrigin/uAssets) into `dist/build/uAssets`.

3. Load the unpacked extension into Firefox:
   - Navigate to `about:debugging#/runtime/this-firefox`
   - Click _"Load Temporary Add-on..."_
   - Select `dist/build/uBlock0.firefox/manifest.json`

Use `make cleanassets` to remove downloaded assets, and `make clean` to remove
all build output.
