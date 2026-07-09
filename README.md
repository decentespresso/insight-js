# Insight — a Decent.app (reaprime) web skin

A pixel-faithful web port of the de1app **Insight** skin
(`/d/admin/code/de1app/de1plus/skins/Insight`) as a browser-native skin for
**Decent.app / reaprime** (`tadelv/reaprime`). Talks to the gateway over REST
(`:8080/api/v1`) + WebSocket (`:8080/ws/v1`). No framework, no bundler — vanilla
ES modules + importmap, Plotly for charts.

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

**Original scope — DONE & verified in Chrome vs the simulator:** 4 brew tabs
(flush/espresso/steam/water), zoom views, presets (profile selector), profile
editors incl a_flow/d_flow (one `steps[]` editor covers pressure/flow/advanced),
machine+app settings, GFC, DYE.

**Faithful (image-backed):** the 4 brew screens + zoom. **Functional overlays**
(not yet image-backed): DYE, settings, profile editor, GFC.

**Remaining / enhancements:** wire the Scent One aroma wheel into DYE
(`scentone_*.avif` already converted); Insight Dark theme (dark colour map is in
the coordinate JSON; needs the dark image set + toggle); make the 4 form pages
image-backed for full fidelity; steam/water running-page mini-graphs;
font/position fine-calibration against `./unde1plus-arm64.sh`.

Deploy (later): GitHub Action on tag → build, write `skin-manifest.json`, zip,
attach to a Release; install via `POST /api/v1/webui/skins/install/github-release`.

## License

**GPL-3.0-or-later.** insight.js is a port of the de1app **Insight** skin and
reuses de1app assets and data — the page background images (default skin),
screensaver images, and the GUI translation sheet
(`src/i18n/de1-translations.csv`) — all of which are GPL-3 from
[decentespresso/de1app](https://github.com/decentespresso/de1app). Vendored
third-party libraries keep their own licenses: Plotly (MIT), Noto Sans UI fonts
(OFL). See [LICENSE](LICENSE).
