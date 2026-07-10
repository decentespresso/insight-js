# Insight — a Decent.app (reaprime) web skin

A pixel-faithful web port of the de1app **Insight** skin
(`/d/admin/code/de1app/de1plus/skins/Insight`) as a browser-native skin for
**Decent.app / reaprime** (`tadelv/reaprime`). Talks to the gateway over REST
(`:8080/api/v1`) + WebSocket (`:8080/ws/v1`). No framework, no bundler — vanilla
ES modules + importmap, Plotly for charts.

## Install in Decent.app

Grab the latest bundle from [**Releases**](https://github.com/decentespresso/insight-js/releases/latest)
(`insight-<version>.zip`) and install it one of these ways:

- **In the app:** Settings → skins → *Install from .zip…* and pick the downloaded zip.
- **Via the REST API:**
  ```bash
  curl -X POST localhost:8080/api/v1/webui/skins/install/github-release \
    -H 'Content-Type: application/json' \
    -d '{"repo":"decentespresso/insight-js"}'
  ```

Once [tadelv/reaprime#428](https://github.com/tadelv/reaprime/pull/428) merges,
Decent.app will **auto-download** Insight on startup like the other bundled skins.

The skin is packaged as a plain static bundle — `index.html` + `manifest.json` at
the archive root, plus `src/` and `assets/` — per reaprime's `doc/Skins.md`.

## Run it (dev harness, hardware-free)

1. **Gateway:** launch the current build **by path** — `open /Applications/Decent.app`
   (NOT `open -a reaprime`, which hits a stale v1.0.0). Simulated devices are on
   in prefs; the machine auto-connects as `MockDe1`. Connect the mock scale:
   `curl -X PUT "localhost:8080/api/v1/devices/connect?deviceId=MockScale"`.
   The real DE1 must be OFF or it grabs the BLE.
2. **Serve:** `cd ~/Documents/insight-skin && python3 -m http.server 5173`
3. **Open:** `http://localhost:5173/` (targets `localhost:8080` automatically).
4. **Drive a shot:** tap START, or `curl -X PUT localhost:8080/api/v1/machine/state/espresso`.
5. **Golden reference** (the original Tcl skin): `./unde1plus-arm64.sh` in the de1plus tree.

## Architecture

- **`src/modules/page.js`** — `PageHost`: the `#page` canvas is authored in native
  **2560×1600** Insight coordinates and CSS-`transform: scale`d to fit `#stage`
  (full window width), so every tap-zone rect and text overlay scales in lockstep.
  Elements: `button` (tap zone), `var` (live text bound to a `live` object), `graph`.
- **`src/config/`** — `index.js` merges `shared.js` (top nav + sleep/settings, on
  every page) with `espresso/steam/water/flush.js`. Coordinates come from
  `docs/INSIGHT_COORDINATE_MAP.json` and `docs/INSIGHT_STEAM_WATER_FLUSH_MAP.json`
  (2560-space; extracted from `skin.tcl`).
- **`src/modules/app.js`** — family-aware bootstrap; maps machine state → page,
  renders charts from a shared shot buffer, wires all tap-zone actions.
- **`src/modules/chart.js`** — `EspressoChart` (3 stacked panels) + `ZoomChart`
  (pf/temp), rendered from the shared buffer; x-axis auto-ranges (grows with the
  shot, like BLT). `staticPlot:true` so taps fall through to zoom zones.
- **`src/modules/api.js`** — thin REST/WS client.
- **`src/views/`** — `profile_selector`, `profile_editor`, `dye`, `settings`, `gfc`
  (functional overlays via `overlay.js`).
- **`assets/insight/`** — Insight 2560×1600 backgrounds converted to **AVIF**.

## Status

Verified in Chrome against the simulator. Image-backed on the original Insight /
default-skin 2560×1600 assets unless noted:

- **Brew:** flush / espresso / steam / water, each with the live 3-panel chart and
  tap-to-zoom (pressure-flow / temperature) views.
- **Profiles:** selector + New-Preset chooser; pressure / flow / advanced editors
  (`settings_2a/2b/2c`) with per-control sliders, a Steps page, and a Limits page.
- **Settings:** Machine and App tabs, plus the sub-pages — Skin / Language /
  Extensions / Firmware (GitHub firmware check + upload), a Tcl-faithful **Misc**
  page, and the **Calibrate** flow (warning gate → 3 paginated pages, wired to
  `/machine/settings` + `/machine/settings/advanced` + the flow multiplier).
- **Maintenance:** descale-prep / cleaning / transport photographic pages.
- **DYE:** describe-your-espresso pages + the Scent One aroma wheel.
- **Screensaver** with rotating images, and an **Insight Dark** theme.
- **Deep-link routing:** every tab and sub-page has its own `#/…` URL that survives
  a refresh (e.g. `#/settings/machine/calibrate/2`, `#/settings/app/misc`).
- **i18n:** the de1app GUI translation sheet, switchable at runtime.

Still a clean HTML overlay (not image-backed): the Graphical Flow Calibrator (GFC).

## Releases & packaging

Tagging `v*` runs [`.github/workflows/release.yml`](.github/workflows/release.yml):
it writes `manifest.json` with the tag version, zips the static bundle with
`index.html` at the archive root, and publishes a GitHub Release with the
`insight-<tag>.zip` asset — the format reaprime installs (see
[doc/Skins.md](https://github.com/tadelv/reaprime/blob/main/doc/Skins.md)).

```bash
git tag -a v0.1.0 -m "Insight skin v0.1.0"
git push origin v0.1.0
```

## License

**GPL-3.0-or-later.** insight.js is a port of the de1app **Insight** skin and
reuses de1app assets and data — the page background images (default skin),
screensaver images, and the GUI translation sheet
(`src/i18n/de1-translations.csv`) — all of which are GPL-3 from
[decentespresso/de1app](https://github.com/decentespresso/de1app). Vendored
third-party libraries keep their own licenses: Plotly (MIT), Noto Sans UI fonts
(OFL). See [LICENSE](LICENSE).
