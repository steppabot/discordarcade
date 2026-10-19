TOKEN DREAMCAST EXPERIMENT

Upload this dreamcast-test folder to the root of steppabot/discordarcade.
Open https://discordarcade.com/dreamcast-test/ as its own tab.
The test page requires the existing arcade premium/booster access check.
The main index.html and arcade-player.html are not modified.

BIOS URLs used (existing files, not included):
/emulators/dreamcast/bios/dc_boot.bin
/emulators/dreamcast/bios/dc_flash.bin

GAME INPUT
Paste an HTTPS direct URL to a ZIP containing Crazy Taxi's CUE and all BIN tracks.
Preserve the original filenames inside the ZIP; place the files at its root.
This is an operator test URL field, not a public library feature.
No games or BIOS files are included in this package.

ISOLATION
isolation-sw.js is a service worker scoped only to /dreamcast-test/.
It adds COOP/COEP headers to fetched responses for this test page.
The page reloads once to activate isolation. Open in a standalone tab, not an iframe.
If browser settings prevent service workers/isolation, the page displays an error.

VALIDATION
JavaScript syntax and core ZIP structure checked. EmulatorJS loader paths and
Flycast exports inspected. Gameplay, audio, performance and save states are NOT
verified. Automated browser testing was unavailable in the build environment.
This is an experimental integration, not a confirmed working Dreamcast release.

THIRD-PARTY SOURCES
Flycast WASM v1.0 (GPLv2), unmodified JS/WASM repackaged with core metadata:
https://github.com/nasomers/flycast-wasm/tree/v1.0
https://github.com/nasomers/flycast-wasm/releases/tag/v1.0
https://github.com/nasomers/flycast-wasm/blob/v1.0/LICENSE

EmulatorJS stable CDN snapshot downloaded for this test (GPLv3):
https://cdn.emulatorjs.org/stable/data/
https://github.com/EmulatorJS/EmulatorJS
Its bundled library notices remain in the distributed files.
