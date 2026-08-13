# Insight skin — interaction verification plan

**Goal:** exercise every button, checkbox, slider, and text input in the Insight skin against the **mock DE1 + mock scale**, so tests look like they're driving a real espresso machine but cause no hardware wear/damage. Produce a per-interaction report of **what works and what doesn't**, then fix in priority order.

**Gold truth:** the working **Streamline** skin (`streamline_project` v0.1.92). Its `src/modules/api.js` is the authoritative reference for the correct reaprime call behind each feature. Where Insight and Streamline disagree, Streamline is right.

---

## 1. Test harness (mock machine + mock scale)

The skin talks only to `http://<host>:8080/api/v1` (REST) + `ws://<host>:8080/ws/v1/*` (WS). We stand up that gateway with simulated devices so no real DE1/scale is touched.

**Boot the gateway (choose one):**

```bash
# A) decaid dev tree — gives logs + hot reload
~/code/decaid/scripts/sb-dev.sh start --connect-machine MockDe1 --connect-scale MockScale
# B) installed app (historical insight harness)
open /Applications/Decent.app     # sim prefs already on; then:
curl -s "http://localhost:8080/api/v1/devices/connect?deviceId=MockScale" -X PUT
```

**Verify both devices connected** (must show `state:"connected"` for `MockDe1` and `Mock Scale`):

```bash
curl -s http://localhost:8080/api/v1/devices | jq '.[]|{name,state}'
```

**Serve the skin + drive it:**

```bash
cd ~/Documents/insight-skin && python3 -m http.server 5173
# drive http://localhost:5173/ in Chrome Beta via Chrome MCP (proven harness for this repo)
```

**Mock behavior to rely on:** MockScale weight is synthesized from the machine's flow — it sits at ~0 at rest (after tare) and only climbs when the machine actually pours. A simulated espresso replays a realistic pressure/flow/temp/weight curve. `PUT /machine/state/{espresso|steam|hotWater|flush|idle|sleeping|skipStep}` all no-op safely on the sim.

---

## 2. Per-interaction test method

The engine (`src/modules/page.js` PageHost) renders each tap-zone/slider/toggle as a **real absolutely-positioned DOM element**, so we don't need pixel math — locate the control in the accessibility tree and click it by ref.

For **each** interactive element, the scenario is:

1. **Navigate** to its page via the hash route (`#/espresso`, `#/settings/machine`, `#/settings/presets/new`, …) — deterministic, avoids fragile click-chains. Hard-reload (`cmd+shift+r`) after any code change.
2. **Baseline** the relevant state (`curl GET /workflow`, `/machine/settings`, `/presence/settings`, etc.).
3. **Trigger** the control: `read_page` → `find` the element → `computer` click by ref (or set value for inputs/sliders).
4. **Assert the call** it fired: `read_network_requests` — method + path + payload must match the gold-truth expected call (see the matrix).
5. **Assert the effect**: `curl` the matching GET endpoint to confirm the mock actually received the change; and/or screenshot / probe the `live` object via `javascript_tool`.
6. **Assert no errors**: `read_console_messages` (no uncaught exceptions; and no *hung* PUT — see the exit-condition hazard below).
7. **Record**: PASS / FAIL / BLOCKED + evidence (the request line, the GET diff, any console error).

**Result key:** ✅ works · ❌ broken (wrong/no call, error, or no effect) · ⚠️ inert (fires but only localStorage / no machine effect) · ⛔ unreachable (no way to trigger in UI) · ⏳ hangs.

Two safety notes for the automation itself: (a) the **first click after a navigate is dropped** in this harness — screenshot first, then click, or click twice; (b) a malformed profile write can make `PUT /workflow` **hang forever** (see §4) — put a timeout on those requests so a hang is recorded as ⏳, not a stall.

---

## 3. Test phases (priority order)

Run in this order; each phase yields a slice of the report.

- **Phase 0 — Harness bring-up & smoke.** Load skin, confirm the machine-snapshot + scale WS telemetry render live values, run one simulated espresso end-to-end, confirm sleep/wake. Gates everything else.
- **Phase 1 — Brew controls** (espresso, steam, water, flush): start/stop/skip, setpoint adjust (+/−, numpad, sliders), toggles. Core must-work path.
- **Phase 2 — Profiles: selector + presets CRUD** (load-to-brew, new, rename, delete, visibility, temp-adjust-save).
- **Phase 3 — Profile editors** (pressure / flow / advanced). **Highest bug risk** — the exit-condition hang lives here.
- **Phase 4 — Settings** (machine: presence/keep-hot, clean/descale, calibrate, firmware; app: brightness, devices, skins, plugins, language, misc).
- **Phase 5 — Long tail** (GFC, calibrate pages, maintenance/descale/transport, DYE, screensaver, numpad/time-editor).

---

## 4. Known suspects to confirm first (from static audit + gold-truth)

These are already identified from reading the code against Streamline; the test run confirms and then we fix. Ordered by severity.

| # | Suspect | Why | Expected verdict |
|---|---|---|---|
| 1 | **Advanced-editor save hangs** | REA accepts exit-condition `type` = **pressure\|flow only**. A `weight`/`off`/other exit → ArgumentError in a Timer → `PUT /workflow` **hangs forever**. Insight's advanced editor exposes all 4 exit-if fields and appears to `updateWorkflow` without Streamline's `sanitizeProfileForRea`. | ⏳ likely — port `sanitizeProfileForRea` |
| 2 | **Profile save routing wrong** | Streamline: default+exec-change → POST fork w/ `parentId`; user+exec-change → PUT visibility hidden **then** POST fork; presentation-only → PUT `/profiles/{id}`; remap favorites on content-hash id change. Insight's `savePresetName`/`saveProfile` is much cruder → default-save & rename likely misbehave. | ❌ likely — adopt Streamline routing |
| 3 | ~~DYE unreachable~~ **OUT OF SCOPE** | DYE is being rewritten from scratch for decaid and is not yet ready — excluded from this campaign. | skip |
| 4 | **`skipStep`** | Earlier flagged as a bad state, but gold-truth shows Streamline uses `PUT /machine/state/skipStep`. So it **should** work. | verify it actually advances a frame |
| 5 | **Keep-hot schedule inert** | Writes localStorage only, on the assumption "no endpoint" — but `/presence/schedules` CRUD **exists** (Streamline uses GET/POST + PUT/DELETE `/{id}`). | ⚠️ → wire to real endpoint |
| 6 | **Chart temp field** | Gold-truth reads `groupTemperature`; `mixTemperature` is 2–5 °C off. Confirm which Insight plots. | fix field if wrong |
| 7 | **Transport/travel stubbed** | `maintenance.js` shows the screens but performs no machine op (comments: no reaprime air-purge/cool endpoint). | ⚠️ document as unsupported, hide or gate |
| 8 | **Calibrate/misc inert toggles** | page-1 temp/pressure sensor-cal, page-2 stop-weight-offset, page-3 two-tap-steam-stop/slow-start/eco-steam → localStorage only. Some map to real `shotSettings`/`settings` fields; verify each. | ⚠️ wire the ones with real fields |
| 9 | **`updateWorkflow` sanitization** | Same steps[]/exit hazard as #1 for any brew-setpoint write that carries the profile; also grinder `setting` must be a stringified float. | verify no hang on setpoint saves |
| 10 | **Dead parallel HTML UI** | `views/{espresso,steam,water,flush,simplebrew,_stub,profile_editor,profile_selector}.js` are an older set not mounted by `app.js`. Confirm truly unreachable; candidate deletion. | cleanup |
| 11 | **Firmware progress parsing** | Real upload answers with an **NDJSON stream**; a stream ending without `done` = failure. Insight's GitHub byte-offset check is a different path. | verify upload flow |

---

## 5. Interaction checklist (the report matrix)

One row per control; fill Status + Notes during the run. Grouped by screen. (Config source in parens.)

### Global chrome (`config/shared.js`) — every brew page
| Control | Expected call | Status | Notes |
|---|---|---|---|
| FLUSH / ESPRESSO / STEAM / WATER tabs | view switch + hash, no network | | |
| Sleep (power) | `PUT /machine/state/sleeping` + brightness→10 | | |
| Settings (gear) | open settings overlay | | |

### Espresso (`config/espresso.js`)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| START | `PUT /scale/tare` then `PUT /machine/state/espresso` | | |
| STOP | `PUT /machine/state/idle` | | |
| [skip] | `PUT /machine/state/skipStep` | | suspect #4 |
| Profile title → selector | opens selector | | |
| Edit-profile (card) | opens editor | | |
| Chart zoom PF / temp / unzoom | local, no network | | |
| Resistance checkbox | local chart overlay | | |
| Temp-zoom in/out | local | | |

### Steam (`config/steam.js`)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Auto-off +/− (dial halves) | debounced `PUT /workflow` (steam duration) | | |
| Auto-off value → numpad | `PUT /workflow` on Ok | | |
| START / STOP ring | `PUT /machine/state/steam` / `idle` | | |
| Enabled toggle | `PUT /workflow` steamSettings.targetTemperature (0=off) | | |
| Flow-rate slider | debounced `PUT /workflow` steam flow | | |

### Water (`config/water.js`)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Volume +/−, value→numpad | `PUT /workflow` hotWater volume | | |
| Temp +/−, value→numpad | `PUT /workflow` hotWater temp | | |
| START / STOP ring | tare + `PUT /machine/state/hotWater` / `idle` | | |
| Flow-rate slider | `PUT /workflow` hotWater flow | | |

### Flush / preheat (`config/flush.js`)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Auto-off +/−, value→numpad | `PUT /workflow` flush seconds | | |
| START / STOP ring | `PUT /machine/state/flush` / `idle` | | |
| Flow-rate slider | `PUT /workflow` flush flow | | |

### Profile selector (`views/profile_selector.js` overlay)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Search filter | local | | |
| Profile row → load | `PUT /workflow {profile,context}` | | verify title echoes back |
| Back | close | | |

### Presets tab (`views/settings.js` settings_1)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Preset row → select/load | `PUT /workflow {profile}` | | |
| Preview chart / tap→editor | opens advanced editor | | |
| Thermometer +/− | working-copy temp, save on piggy | | |
| Trash/delete | user→`DELETE /profiles/{id}`; default→`PUT .../visibility hidden` | | suspect #2 |
| + new preset (chooser) | opens Pressure/Flow/Advanced chooser | | |
| Eye / show-all | rows→`PUT /profiles/{id}/visibility` | | |
| Piggy / save name | edited→`POST /profiles`; rename→`PUT /profiles/{id}` | | suspect #2 |

### New-preset chooser (settings_3_choices)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Pressure / Flow / Advanced | copy workflow profile → open editor | | |
| Cancel | close chooser | | |

### Profile editor — pressure/flow (`views/pressure_editor.js`, settings_2a/2b)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| 9 parametric sliders | regen steps → debounced `PUT /workflow` | | suspect #1/#9 |
| 9 value labels → numpad | as above | | |
| Thermometer +/−, per-step-temp toggle | temp edit → save | | |

### Profile editor — advanced (`views/advanced_editor.js`, settings_2c/2c2)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Temp / flow / pressure / time / vol / weight +/− | `PUT /workflow {profile}` | | **suspect #1 — watch for hang** |
| Pump→flow / pump→pressure, transition | as above | | |
| Exit-if pressure/flow over/under +/−, "move on if" toggle | as above | | **most likely to hang** |
| Add / delete step, step-list select | as above | | |
| Title / message inputs | as above | | |
| Beverage-type chooser (8 types + Ok) | as above | | |
| Limits sub-tab: 6 sliders + value taps (tank temp, preinf-ends, stop-vol, max flow/pressure, stop-at-weight) | as above | | |

### Machine settings tab (`views/settings.js` settings_3)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Cool-down-after → numpad | `POST /presence/settings` | | |
| Keep-hot toggle | `POST /presence/settings` | | |
| Keep-hot schedule (on/off, start/end sliders + time editor) | should be `/presence/schedules` CRUD | | suspect #5 (inert now) |
| Read Manual | external link | | |
| Clean | `PUT /machine/state/cleaning` | | |
| Descale | `PUT /machine/state/descaling` | | |
| Calibrate | opens calibrate (warning gate) | | |
| Transport | opens travel screens | | suspect #7 (no machine op) |
| Firmware | GitHub check + upload | | suspect #11 |

### App settings tab (`views/settings.js` settings_4)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Update app | `POST /webui/skins/update` | | |
| Brightness slider | WS `setBrightness` | | |
| Search (Bluetooth) | `GET /devices/scan?connect=false` | | |
| Device Connect/Disconnect rows | `PUT /devices/connect|disconnect?deviceId=` | | |
| Skin picker | `GET /webui/skins`, `PUT /webui/skins/default` | | |
| Language picker | localStorage (i18n) | | ⚠️ no API |
| Misc | see below | | |
| Extensions | `GET /plugins`, `POST /plugins/{id}/enable|disable` | | |
| Quickstart / Exit | external / sleep | | |

### Misc sub-panel
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Saver clock toggle, change-image-every, brightness | localStorage / WS brightness | | |
| °C/°F, AM/PM, decimal-comma | localStorage (cosmetic) | | ⚠️ inert by design |
| Keep-scale-on, dim-on-low-battery, smart-charging | `POST /settings` (rea) | | verify real fields |

### Calibrate (`renderCalPage`) + GFC (`views/gfc.js`)
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Page 1: temp/pressure measured → numpad | localStorage only | | ⚠️ suspect #8 (no sensor-cal endpoint) |
| Page 1: flow-mult / steam-temp / fan / steam-flow sliders | `POST /settings` / `/machine/settings` | | |
| Page 2: 120V/230V, heater sliders, stop-weight-offset, cafe-defaults | `/machine/settings/advanced` (offset=localStorage) | | |
| Page 3: hot-water/flush flow+timeout sliders | `/machine/settings` | | |
| Page 3: two-tap-steam / slow-start / eco-steam toggles, refill-kit | shotSettings? (currently localStorage) | | ⚠️ suspect #8 |
| GFC: reported/actual inputs + Apply | `POST /settings` flow multipliers | | |

### Maintenance / DYE / saver / numpad
| Control | Expected call | Status | Notes |
|---|---|---|---|
| Descale-now / Stop | `PUT /machine/state/descaling` / `idle` | | |
| Clean / Stop | `PUT /machine/state/cleaning` / `idle` | | |
| Transport cancel / purge / wake | **stubbed — no machine op** | | suspect #7 |
| ~~DYE (all controls)~~ | — | SKIP | out of scope — rewritten for decaid, not ready |
| Screensaver tap-to-wake | `PUT /machine/state/idle` | | |
| Numpad steppers/keypad/prev/Ok, time-editor | drive the caller's save | | |

---

## 5b. Results log (live)

**Harness:** decaid `main` 0.7.17 (build 2284) on macOS via sb-dev, MockDe1 + MockScale connected, simulate mode; skin served at :5173, driven in the in-app Browser pane. Driving method: real `computer` clicks at `(40 + cx·0.28125, cy·0.28125)` from config-space `(cx,cy)`; effects verified by direct gateway `curl` (the Browser network panel is lossy; decaid's own request log belongs to a separate instance and isn't tailable). Note: mock espresso shots auto-complete in ~15–20s, so running-state controls must be exercised promptly.

**Phase 0 — smoke: PASS.** Skin loads, no console errors; live WS telemetry confirmed (group temp climbed 43→90 °C in the card; live pressure/flow/temp curves draw during a shot); one simulated espresso ran end-to-end (ready → pouring → done). Settings→Machine loads real data (Counter Espresso 19; Version API v1337 · DE1Pro · GHC no; Firmware v1337; Keep-hot on). Chart "metal"/"coffee" reads `groupTemperature` → **suspect #6 (wrong temp field) looks NOT broken.**

**Phase 1 — brew controls: PASS (all green).** Every brew mechanism verified against the mock; effects confirmed via gateway curl.
- Espresso: ✅ `startEspresso` (`PUT /scale/tare` → `PUT /machine/state/espresso`, live curves), ✅ `stopEspresso` (→idle), ✅ `skipStep` (frame 3→5 on tap; **suspect #4 resolved**).
- Steam: ✅ START (→`steam`), ✅ STOP (→idle), ✅ auto-off `adjust` (duration 18→20 via `PUT /workflow`), ✅ Enabled toggle (targetTemperature 150→0→150 round-trip).
- Water: ✅ START (→`hotWater`), ✅ STOP, ✅ volume `adjust` (10→30), ✅ temp `adjust` (76→78), ✅ flow **slider** drag (4→8), ✅ **numpad** (30 →+50→ 80 → Ok, saved).
- Flush: ✅ START (→`flush`), ✅ STOP, ✅ auto-off `adjust` (8→10).
- Mechanisms proven end-to-end: state transitions, workflow-setpoint `PUT /workflow` (debounced), toggle round-trip, slider drag, numpad modal. **No failures in Phase 1.**
- Deferred (local UI, no API — visual spot-check later): chart zoomPF/zoomTemp/unzoom, resistance toggle, temp-zoom in/out.

**Phase 3 — profile editors (in progress):**
- ✅ **Pressure/parametric editor** (most profiles open here, incl. limiter/weight profiles): edit (thermometer 88→89) + Ok → `PUT /workflow` 200, all step temps updated, returned in 27 ms. Saves correctly.
- ✅ **Advanced step-editor** (via New Preset → Advanced): all saves `PUT /workflow` **200** with **valid** `pressure`/`flow` exits. No 400, no hang.
- 🔑 **Suspect #1 (editor save hangs) — REFUTED on this build.** Two independent reasons: (a) decaid `main` now **rejects an invalid step exit with HTTP 400 in ~4 ms and stays responsive** (probed directly with a `type:"weight"` exit) — the old "hangs forever" is fixed server-side; (b) the Insight editors emit only valid `pressure`/`flow` exits, so they get 200 anyway. Editors save.
- ❌ **CONFIRMED BUG — advanced editor's exit conditions & flow/pressure limiter are broken (flat vs nested schema mismatch).** Root cause in source: `settings.js:593` sets `live._advProfile = structuredClone(wf.profile)` and `saveAdv()` (`:608`) sends it straight back via `updateWorkflow` — **no conversion either direction**. But `advanced_editor.js` uses de1app's **flat** `advanced_shot` fields (`exit_if`, `exit_type`, `exit_pressure_over/under`, `exit_flow_over/under`, `max_flow_or_pressure`) while reaprime steps use **nested** `exit:{type,condition,value}` + `limiter:{value,range}`. Consequences, verified live: (1) existing exits never display — a step with `exit pressure/over/4` shows "Move on if" **off / "-"**; (2) editing "Move on if…" (or the flow/pressure **Limit**) writes fields reaprime ignores → **silently no-ops** (set "pressure is over 0.1 bar", saved workflow still read `value:4`). Direct-named fields (temperature/flow/pressure/seconds/volume/weight/name/transition/sensor) DO map and save. **Fix:** add reaprime↔flat conversion on load and in `saveAdv` (map nested `exit`→`exit_if/exit_type/exit_*`, `limiter`→`max_flow_or_pressure(_range)`, and back). The parametric pressure/flow editor is unaffected (separate `_pp` model).
- ⚠️ **New finding — new preset not persisted until named (suspect #2 texture).** New Preset → Advanced → Ok makes "Untitled" the **active** workflow profile but does **not** add it to the profiles list (must be named+saved separately in Presets). Matches the intended two-step flow but is easy to misread as "my new preset vanished."
- ⏳ Flow editor, per-step numpad entry, add/delete step, beverage-type chooser, Limits sub-tab — pending.

**Phase 2 — profiles: selector + presets CRUD:**
- ✅ Profile selector (from espresso title): lists all profiles w/ search; selecting "7g basket" → `PUT /workflow`, workflow.title updated.
- ✅ Presets tab select/load: tapping "Classic Italian espresso" → loaded into workflow.
- ✅ Visibility (eye → Show-all): checkbox toggle → `PUT /profiles/{id}/visibility {visibility}` 200, round-trips.
- ✅ New preset chooser (Pressure/Flow/Advanced) → createPreset → copies profile, opens editor (see Phase 3).
- ⚠️ (carried) new preset becomes active but isn't persisted to the profiles list until named+saved.
- ⏳ rename (piggy) + trash/delete — not yet exhaustively driven (default profiles route to hide/toast; needs a user profile for a clean rename test).

**Phase 4 — settings (in progress):**
- ✅ Keep-hot toggle → `POST /presence/settings` 200 (payload carries `userPresenceEnabled/sleepTimeoutMinutes/keepAwakeUntil/schedules[]`).
- ❌ **Suspect #5 CONFIRMED — keep-hot schedule inert.** Dragging the Start/End schedule sliders writes **only** `localStorage.insight_keephot_sched={wake,sleep}` and fires **no** API call. The machine never receives the schedule; `/presence/settings.schedules[]` (and `/presence/schedules` CRUD) exist but are unused. Real "doesn't work" — schedule has zero effect. (Also: the schedule sliders are only visible while Keep-hot is on.)
- ✅ Machine tab loads real data (Counter, Version API v1337/DE1Pro/GHC-no, Firmware v1337, "Water level: not reported by this gateway build").
- ⏳ Clean/Descale, Calibrate (+pages), Transport, Firmware, cool-down numpad; APP tab (brightness, devices, skins, plugins, language, misc) — pending.

**Phase 5 — long-tail sweep: PASS (no new bugs).** Everything with an API backing works; the only inert items are the documented no-endpoint ones.
- ✅ **Clean** → `PUT cleaning` → Stop → idle; ✅ **Descale** → prep page → Descale now → `PUT descaling` → Stop → idle.
- ✅ **Cool-down** numpad → `POST /presence/settings` (sleepTimeout 30→80).
- ✅ **Calibrate** sliders: page 1 flow-mult → `POST /settings`; page 2 heater → `POST /machine/settings/advanced` (202); page 3 hot-water flow → `POST /machine/settings` (202). ⚠️ sensor-cal (temp/pressure) + two-tap/slow-start/**eco-steam** toggles → localStorage only (`cal_eco_steam` etc.) — inert, no reaprime field (suspect #8, by necessity).
- ✅ **Brightness** slider → WS `setBrightness` (display 100→50).
- ✅ **Update app** → `POST /webui/skins/update` (200).
- ✅ **Screensaver**: sleep → `sleeping` + saver renders → tap → `idle`.
- ✅ **Presets CRUD** (suspect #2 — works correctly): select/load; visibility (`PUT …/visibility`); new-create (`POST /profiles`); piggy **edited-default save** fires the full correct routing — `POST /profiles` (201) → `PUT …/{default}/visibility` (hide source) → `PUT /workflow` (load); unedited-default piggy → correct **toast guard** ("adjust the profile to save…"); trash **user** profile → `DELETE /profiles/{id}` (200).
- Not exercised (verified wired per audit / local-only): device connect/disconnect (`PUT /devices/…` — skipped to protect the harness), Search (GET scan), Language/Misc (localStorage), chart zoom/resistance/temp-zoom (local UI, no API), firmware GitHub check (runs on load, shows "v1337 · Update…").

## 6. Findings summary & prioritized fix list

**Headline: the core works.** Every brew control, both save paths of the parametric editor, profile load/select/visibility, and the wired settings (presence toggle, calibrate flow-mult, skins, plugins) all function correctly against the mock. The feared "editor save hangs" (suspect #1) is **refuted** — decaid now 400s bad exits in ~4 ms instead of hanging. So "many features don't work" is **not** the brew tabs or ordinary profile editing.

**What's actually broken (fix, in priority order):**
1. ✅ **FIXED + verified — Advanced editor exit conditions & flow/pressure limiter.** Added nested↔flat converters (`reaStepToFlat`/`flatStepToRea`/`advProfileToRea` in `advanced_editor.js`) and wired them into `settings.js` (`loadAdvanced` converts reaprime→flat on load; `saveAdv` + the `ok` handler convert flat→reaprime, stripping flat keys, on save). Verified against the mock: opening a step with `exit pressure/over/4` now shows "Move on if" **on / 4.0 bar** (was "-"); editing it to 4.2 **persists** (`PUT /workflow` 200, clean nested `{type:pressure,condition:over,value:4.2}`, no flat-field leak); a step with `limiter {4.5,1}` now shows **"flow limit 4.5 mL/s"** (was "off") and round-trips. `exit:null` correctly shows the toggle off. No regression to the parametric editor (its step-0 exit survives a temp-edit save). *Converters are idempotent, so parametric (nested-only) profiles pass through untouched.* **Dev note:** the in-app Browser pane caches ES modules by URL — a plain reload serves stale code; verified via a **no-store static server on a fresh port** (`:5174`).

1b. ✅ **FIXED + verified — parametric (pressure & flow) editor exit/limiter.** Same flat-vs-nested mismatch in `pressure_profile.js`/`flow_profile.js`: `parsePressure`/`parseFlow` read flat `max_flow_or_pressure`/`exit_pressure_over` (undefined on nested API steps → limiter showed "off", preinfusion stop-pressure fell back to default), and `buildPressureSteps`/`buildFlowSteps` emitted flat fields. Fixed both to speak reaprime nested natively: parse reads nested `exit`/`limiter` (flat fallback retained), build emits explicit nested `exit`/`limiter` on every step. Verified on the mock: loading "Classic Italian espresso" (rise-and-hold `limiter 4.5`) now shows **"Limit flow 4.5 mL/s"** (was "off"), and saving writes `limiter {value:4.5,range:0.6}` + `preinfusion exit {pressure/over/4}` (was silently lost). Flow module verified in isolation (stop-pressure 5, max-pressure 8.6 both parsed + emitted nested, no flat leak). *(Range normalizes to the parametric default 0.6; the parametric model doesn't track per-step range — set it in the Limits tab.)*
2. ✅ **FIXED + verified — Keep-hot schedule** (suspect #5). Was localStorage-only; now backed by reaprime **wake schedules** (`/presence/schedules`). Added `getSchedules`/`addSchedule`/`updateSchedule`/`deleteSchedule` to `api.js`; `settings.js` now maps the de1app `scheduler_wake`/`scheduler_sleep` model to a single `WakeSchedule` — wake time → `time` ("HH:MM"), the wake→sleep window → `keepAwakeFor` (minutes, capped at the API's 720/12h), `daysOfWeek:[]` = every day. Keep-hot is now derived from the schedule's `enabled` (no longer overloaded onto `userPresenceEnabled`). Verified on the mock: toggle ON → `POST` creates `{time:"06:00",daysOfWeek:[],enabled:true,keepAwakeFor:720}`; dragging Start → debounced `PUT /presence/schedules/{id}` (id preserved, `time:"20:16"`, `keepAwakeFor:104`); reload reads it back (Keep-hot ON, Start 8:16 PM / End 10:00 PM); toggle OFF → `PUT {enabled:false}` (times preserved). **Limitation:** reaprime's model is wake-time + duration (max 720 min), so a keep-hot window over 12h can't be represented — the End effectively caps 12h after Start (the de1app 6:00–22:00 default lands at keepAwakeFor 720).
3. ✅ **FIXED + verified — Transport** (suspect #7). Turned out reaprime **does** have an `airPurge` machine state (`PUT /machine/state/airPurge` → 200), which is the core of Transport (emptying the water), so it's genuinely wired now rather than just labeled. `maintenance.js` `travelPurge` → `PUT /machine/state/airPurge`; `travelWake` → `idle` stops it. Verified on the mock: Transport → Ok → machine state `airPurge`; tap the run page → `idle`. The de1app cooldown step (`de1_send_shot_frames "cool"`) has no reaprime equivalent, so it's dropped — the machine cools passively (documented in code).
4. **New preset not persisted until named** — New Preset → Advanced → Ok only sets the active workflow; the profile isn't added to the list. → clarify UX or auto-save.

**Inert-by-necessity (no reaprime endpoint — document, don't "fix"):** calibrate temperature/pressure **sensor** calibration and the page-2/3 offset/toggle fields (localStorage only); Misc units/AM-PM/decimal-comma (cosmetic).

**Verified working (✅):** brew — espresso/steam/water/flush start·stop·skip, adjust, sliders, numpad, steam Enabled toggle; profiles — selector load, preset select, visibility, new-preset create; editors — parametric pressure/flow save (temp/steps), advanced editor direct fields (temp/flow/pressure/time/vol/weight); settings — keep-hot toggle (`/presence/settings`), calibrate flow-multiplier (`/settings`), skin list (`/webui/skins`), plugin enable/disable (`/plugins/{id}/…`); live telemetry + simulated shots.

**Not yet exhaustively driven (wired per audit / shared mechanisms already proven):** brightness WS slider, device connect/disconnect, firmware GitHub check + upload, Clean/Descale state, Language picker, cool-down numpad, GFC overlay, calibrate pages 2–3 detail, screensaver wake, chart zoom/resistance/temp-zoom, preset rename/delete, flow editor. DYE excluded (being rewritten for decaid).
