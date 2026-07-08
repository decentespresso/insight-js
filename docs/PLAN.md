# Plan — "Insight": a JavaScript skin for Decent.app (reaprime)

Port the de1app **Insight** skin (Tcl/Tk, `/d/admin/code/de1app/de1plus/skins/Insight`)
into a browser-native **reaprime skin** (HTML/CSS/JS served statically, talking to the
Decent.app gateway over REST + WebSocket), structured exactly like the reference skin
**Streamline** (`allofmeng/streamline_project`).

---

## 0. Fidelity target
- Reproduce Insight's **screens, layout, controls, live charts, and behavior** — the classic
  Insight look (green start buttons, three stacked pressure/flow/temperature charts, the
  4-column data card, the tabbed FLUSH/ESPRESSO/STEAM/WATER top bar).
- Not a pixel-for-pixel skeuomorph of the Tcl bitmaps; a faithful, clean re-creation on a
  responsive 1280×800-first layout (Insight's native tablet size), themeable to **Insight Dark**.

## 1. Architecture (mirror Streamline)
- **No framework, no bundler.** Vanilla ES modules + `<script type="importmap">`, static files.
- **Styling:** Tailwind + daisyUI compiled to a static `app.css` (Streamline's toolchain), plus
  hand-CSS for the charts/gauges. Dark theme via `data-theme`.
- **Charts:** Plotly (Streamline bundles `plotly-3.1.0.min.js`) for the live pressure/flow/temp
  graphs and profile previews.
- **Module layout (fork Streamline's plumbing, rebuild the UI):**
  - Reuse largely as-is: `api.js` (REST/WS client), `reconnecting-websocket.js`, `router.js`,
    `chart.js`, `numpad-modal.js`, `i18n.js`, `idb.js`, `scaling.js`, `logger.js`.
  - Rebuild for Insight: `app.js` (tab state machine), `ui.js`, the four brew-tab views,
    `profile_editor.js` / `profile_selector.js` (Insight's pressure/flow/advanced editors),
    `dye.js`, `settings.js`, `gfc.js`.
- **Config:** `skin-manifest.json` (`id: "insight"`, name, version). API base derived like
  Streamline: `http://${location.hostname}:8080/api/v1`, WS `ws://…:8080/ws/v1/…`.

## 2. de1app → reaprime API mapping (the crux)
reaprime models everything as **profiles_v2 JSON** (`steps[]`) + a **workflow** object; it does
NOT expose de1app's `settings_2a/2b/2c` pressure/flow params. So Insight's three editors become
three front-ends that read/write the same v2 `steps[]` (Streamline already solved this).

| Insight concept | reaprime endpoint |
|---|---|
| Live charts (pressure/flow/temp + targets) | WS `/ws/v1/machine/snapshot` (`pressure, flow, targetPressure, targetFlow, mixTemperature, groupTemperature, targets, profileFrame, state`) |
| Live weight / weight-flow | WS `/ws/v1/scale/snapshot` (`weight, weightFlow`) |
| Start/stop a drink | `PUT /machine/state/{espresso\|steam\|hotWater\|flush\|idle\|sleeping}` |
| Espresso profile + target yield | `PUT /workflow` (`profile`, `context.targetYield/targetDoseWeight`) + `POST /machine/shotSettings.targetShotVolume` |
| Steam targets (`steam_timeout`, temp) | `workflow.steamSettings{targetTemperature,duration,flow}` / `shotSettings{targetSteamTemp,targetSteamDuration,steamSetting}` |
| Water (`water_volume/temperature`, `hotwater_flow`) | `workflow.hotWaterData{targetTemperature,volume,duration,flow}` / `shotSettings{targetHotWaterTemp/Volume/Duration}` |
| Flush (`flush_seconds/flush_flow`) | `workflow.rinseData{duration,flow,targetTemperature}` + machine settings `flushTemp/flushFlow/flushTimeout` |
| Presets list / load / save | `GET/POST/PUT /profiles`, `/profiles/{id}`, `/profiles/{id}/visibility`, `/lineage` |
| Machine settings (settings_3) | `GET/POST /machine/settings` (+ `/advanced`, `/reset`) |
| App/skin settings (settings_4) | skin-local (`localStorage` + KV `/store/{ns}`) + `/settings` (gatewayMode, flow multipliers) |
| DYE grinder/bean/dose | `/grinders`, `/beans`, `/beans/{id}/batches` CRUD + `workflow.context` |
| DYE enjoyment/notes/scentone/rating | `PUT /shots/{id}` `{shotNotes, metadata:{rating,tags,scentone}}` |
| "God shot" reference curve | overlay a chosen past shot's `measurements[]` from `GET /shots/{id}` |
| GFC flow calibration | dispense+weigh loop → `POST /settings` (`weightFlowMultiplier/volumeFlowMultiplier/hotWaterFlowMultiplier`) |
| Water tank level | WS `/ws/v1/machine/waterLevels`, `POST /machine/waterLevels` |
| Sleep/wake, brightness | `PUT /machine/state/sleeping`, WS `/ws/v1/display` |

Profile-write caveat (from Streamline's `api.js`): reaprime's strict Dart deserializer rejects
legacy Tcl fields (`type, legacy_profile_type, lang, hidden, …`) and only allows step `exit.type`
∈ {pressure, flow} — fold "stop at weight" into the step `weight` field. Reuse Streamline's
`sanitizeProfileForRea()`.

## 3. Build order (milestones, each independently verifiable against the simulator + Tcl golden)
- **M0 Scaffold + plumbing** — index.html shell, Insight tab bar + layout grid, fork api/WS/router,
  connect to gateway, show live machine state + pressure/flow/temp/weight numbers.
- **M1 Espresso tab** — off / live / post-shot states; 3 stacked charts (pressure, flow w/ weight
  line, temperature) with dashed targets; 4-col data card (time/volume/temp/weight); START/STOP,
  skip-step, chart zoom.
- **M2 Steam tab** · **M3 Water tab** · **M4 Flush tab** — config clicker/slider, START/STOP, live view, "Done" timeout.
- **M5 Profile selector + presets** — list/select/load profiles into workflow.
- **M6 Profile editors** — pressure (2a), flow (2b: A-Flow + D-Flow), advanced multi-step (2c/2c2),
  all writing v2 `steps[]`; live profile-preview chart. (Largest; reuse Streamline `profile_editor.js`.)
- **M7 DYE** — enjoyment/notes, Scent One aroma wheel, grinder/bean/dose (beans+grinders CRUD +
  workflow context), shot annotation, god-shot overlay.
- **M8 Settings** — machine (settings_3) + app (settings_4), presence/display, units (°C/°F), theme.
- **M9 GFC** — graphical flow calibrator.
- **M10 Polish** — Insight Dark theme, i18n, deploy pipeline.

## 4. Unattended dev/test/verify harness (zero hardware)
- **Backend (recommended):** installed `reaprime.app` → Advanced → **Simulated Devices: machine + scale**
  (persists in SharedPreferences). `MockDe1` streams realistic espresso/hot-water shots (flow,
  pressure, weight) on `:8080`. Deterministic, no DE1 needed. Set `gatewayMode:"full"` via `POST /settings`.
- **Serve skin:** `python3 -m http.server 5173` in the skin dir (CORS on gateway is `*`).
- **Drive the new app:** Chrome Beta via the **Chrome MCP** (navigate/click/read_page/console/screenshot) — headless, no takeover of the pointer.
- **Golden reference:** `unde1plus.sh` runs the Tcl Insight in its SDL window; screenshot via
  computer-use for side-by-side layout/label comparison.
- **Per-milestone verification loop:** edit files → refresh Chrome → `curl -X PUT …/machine/state/espresso`
  to fire a simulated shot → assert charts animate, weight accrues, stop-at-weight fires, DYE persists →
  capture screenshot, diff against the Tcl golden. All scriptable.
- **Integration checkpoints:** periodically run against `reaprime.app` + the **real DE1** over BLE.

## 5. Deployment (like Streamline)
- Own GitHub repo; GitHub Action on tag `v*` builds `app.css`, writes `skin-manifest.json`, zips,
  attaches to a Release. Install into Decent.app via `POST /api/v1/webui/skins/install/github-release`
  (or add the repo to `skin_sources.json` for bundling).

## 6. Decisions — LOCKED (2026-07-08)
1. **Working dir:** `~/Documents/insight-skin` (GitHub repo created later).
2. **Test backend:** simulated devices (reaprime.app MockDe1 machine+scale).
3. **Visual fidelity:** faithful classic Insight (+ Insight Dark).
4. **Code reuse:** fork Streamline's ISC-licensed plumbing modules.

## 7. Notes / risks
- Steam shot simulation in `MockDe1` is a placeholder (espresso/hotWater are full) — steam-tab
  charts verified partly against sim, fully at a real-DE1 checkpoint.
- Unattended run uses Chrome MCP (Chrome Beta) + computer-use for the two native windows; this is the
  explicit takeover the user authorized for this task (overrides the standing "no takeover" default).
- de1app "god shots" have no direct reaprime equivalent → implemented as a saved past-shot overlay.
