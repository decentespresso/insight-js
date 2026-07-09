// Simple PRESSURE profile model — a parametric UI over a fixed
// preinfuse -> rise&hold -> decline espresso shape, matching the Tcl
// Streamline editor (de1_skin_settings.tcl settings_2a + profile.tcl
// pressure_to_advanced_list). reaprime stores only the generated steps[], so
// the "simple" params live client-side: we PARSE a profile's steps into params,
// the sliders edit params, and buildPressureSteps() regenerates steps[].

export const MAXP = 12;          // ::de1(maxpressure)
export const MAXFLOW = 8;        // ::de1(max_flowrate_v11)

// slider ranges (from the Tcl scale -from/-to on settings_2a)
export const LIMITS = {
  time: { min: 0, max: 60, step: 1 },            // preinfusion_time / hold / decline seconds
  stopPressure: { min: 0, max: MAXP, step: 0.1 },// preinfusion_stop_pressure
  flow: { min: 0, max: MAXFLOW, step: 0.1 },     // preinfusion_flow_rate
  pressure: { min: 0, max: MAXP, step: 0.1 },    // espresso_pressure / pressure_end
  maxFlow: { min: 0, max: MAXFLOW, step: 0.1 },  // maximum_flow (0 = off)
  weight: { min: 0, max: 100, step: 0.1 },       // final_desired_shot_weight
  temp: { min: 20, max: 105, step: 0.5 },   // floor low enough not to snap unusual step temps
};

// DE1 default simple-pressure params (matches the Tcl "Default" copy shown as
// "Untitled" in s3: preinfuse 20s / 8mL·s / <4bar, hold 4s / 8.6bar, decline
// 35s / 6bar, stop 36g, 90/88 C).
export const DEFAULT_PARAMS = {
  time: 20, flow: 8, stopPressure: 4,
  holdTime: 4, pressure: 8.6, maxFlow: 0,
  declineTime: 35, pressureEnd: 6,
  weight: 36, temp: 90,
  // per-step temperatures (Tcl espresso_temperature_steps_enabled). When off, the
  // single `temp` drives every frame; when on, temp0 boosts the first tempBump
  // seconds of preinfusion, temp1 the rest, temp2 rise&hold, temp3 decline.
  tempSteps: false, temp0: 90, temp1: 90, temp2: 90, temp3: 90, tempBump: 2,
};

const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// steps[] -> simple params. Recognises step roles by the names the Tcl emits
// ("preinfusion*", "forced rise", "rise and hold", "decline"); falls back to
// pump/transition heuristics for hand-built profiles.
export function parsePressure(profile) {
  const steps = (profile && profile.steps) || [];
  if (!steps.length) return { ...DEFAULT_PARAMS };
  const p = { ...DEFAULT_PARAMS };
  const isPre = (s) => /preinf/i.test(s.name || '') || (s.pump === 'flow' && (s.exit_pressure_over > 0 || /preinf/i.test(s.name || '')));

  const pre = steps.filter(isPre);
  const press = steps.filter((s) => !isPre(s) && s.pump === 'pressure');

  if (pre.length) {
    p.time = Math.round(pre.reduce((a, s) => a + num(s.seconds), 0));
    p.flow = Math.max(...pre.map((s) => num(s.flow, DEFAULT_PARAMS.flow)));
    const stop = Math.max(...pre.map((s) => num(s.exit_pressure_over)));
    if (stop > 0) p.stopPressure = stop;
  } else { p.time = 0; }

  if (press.length) {
    // hold = pressure steps up to & including "rise and hold"; decline = the rest.
    let holdIdx = press.findIndex((s) => /rise and hold/i.test(s.name || ''));
    if (holdIdx < 0) {
      // no marker: treat the trailing "smooth" (declining) tail as decline
      holdIdx = press.length - 1;
      for (let i = press.length - 1; i >= 0; i--) { if (press[i].transition === 'smooth' || /decline/i.test(press[i].name || '')) holdIdx = i - 1; else break; }
    }
    const hold = press.slice(0, holdIdx + 1);
    const dec = press.slice(holdIdx + 1);
    p.holdTime = Math.round(hold.reduce((a, s) => a + num(s.seconds), 0));
    p.pressure = num(hold.length ? hold[hold.length - 1].pressure : press[0].pressure, DEFAULT_PARAMS.pressure);
    p.declineTime = Math.round(dec.reduce((a, s) => a + num(s.seconds), 0));
    p.pressureEnd = dec.length ? num(dec[dec.length - 1].pressure, p.pressure) : p.pressure;
    const mf = press.map((s) => num(s.max_flow_or_pressure)).find((v) => v > 0);
    p.maxFlow = mf || 0;
  }

  // temperatures: one per step. A profile whose steps carry differing
  // temperatures opens in per-step (tempSteps) mode; otherwise a single temp.
  const preMain = pre.find((s) => !/boost/i.test(s.name || '')) || pre[0] || steps[0];
  const holdStep = press.find((s) => /rise and hold/i.test(s.name || '')) || press[0];
  const declineStep = press.length ? press[press.length - 1] : null;
  p.temp = num(preMain.temperature, DEFAULT_PARAMS.temp);
  p.temp1 = num(preMain.temperature, p.temp);
  p.temp2 = num(holdStep ? holdStep.temperature : p.temp, p.temp);
  p.temp3 = num(declineStep ? declineStep.temperature : p.temp, p.temp);
  p.temp0 = p.temp1;
  p.tempSteps = Math.abs(p.temp1 - p.temp2) > 0.05 || Math.abs(p.temp1 - p.temp3) > 0.05;
  if (profile && profile.target_weight > 0) p.weight = num(profile.target_weight, DEFAULT_PARAMS.weight);
  return p;
}

// simple params -> steps[]  (JS port of profile::pressure_to_advanced_list,
// single-temperature variant — no per-step temp boost for now).
export function buildPressureSteps(pp) {
  const on = !!pp.tempSteps;
  const T = num(pp.temp, 90);
  // one temperature per visible step (preinfusion / rise&hold / decline)
  const t1 = on ? num(pp.temp1, T) : T;
  const t2 = on ? num(pp.temp2, T) : T, t3 = on ? num(pp.temp3, T) : T;
  const steps = [];
  const mf = num(pp.maxFlow) > 0 ? { max_flow_or_pressure: num(pp.maxFlow), max_flow_or_pressure_range: 0.6 } : null;

  // preinfusion: a single flow frame at the preinfusion temperature.
  const time = num(pp.time);
  if (time > 0) {
    steps.push({
      name: 'preinfusion', temperature: t1, sensor: 'coffee', pump: 'flow', transition: 'fast',
      pressure: 1, flow: num(pp.flow), seconds: time, volume: 0, weight: 0,
      exit_if: 1, exit_type: 'pressure_over', exit_pressure_over: num(pp.stopPressure),
      exit_pressure_under: 0, exit_flow_over: 6, exit_flow_under: 0,
    });
  }

  let hold = num(pp.holdTime);
  if (hold > 0) {
    if (hold > 3) {
      steps.push({ name: 'forced rise without limit', temperature: t2, sensor: 'coffee', pump: 'pressure', transition: 'fast', pressure: num(pp.pressure), seconds: 3, volume: 0, weight: 0, exit_if: 0 });
      hold -= 3;
    }
    steps.push({ name: 'rise and hold', temperature: t2, sensor: 'coffee', pump: 'pressure', transition: 'fast', pressure: num(pp.pressure), seconds: hold, volume: 0, weight: 0, exit_if: 0, ...(mf || {}) });
  }

  let dec = num(pp.declineTime);
  if (dec > 0) {
    if (hold < 3 && dec > 3) {
      steps.push({ name: 'forced rise without limit', temperature: t3, sensor: 'coffee', pump: 'pressure', transition: 'fast', pressure: num(pp.pressure), seconds: 3, volume: 0, weight: 0, exit_if: 0 });
      dec -= 3;
    }
    steps.push({ name: 'decline', temperature: t3, sensor: 'coffee', pump: 'pressure', transition: 'smooth', pressure: num(pp.pressureEnd), seconds: dec, volume: 0, weight: 0, exit_if: 0, exit_flow_over: 6, ...(mf || {}) });
  }

  if (!steps.length) steps.push({ name: 'empty', temperature: T, sensor: 'coffee', pump: 'flow', transition: 'smooth', flow: 0, seconds: 0, volume: 0, weight: 0, exit_if: 0 });
  return steps;
}

// Target-pressure curve for the explanation chart. Each stage is a SEPARATE band
// with its own point array (so the green band can't bleed into the tan at the
// shared node). Preinfusion ramps 0->stopPressure; rise&hold ramps up to the hold
// pressure then holds (the rise is tan); decline eases to the end pressure.
// Returns { bands:[{color, xs, ys}], line:{xs,ys}, nodes:{xs,ys}, total }.
export function pressureCurve(pp) {
  const GREEN = '#c8e7d5', TAN = '#efdec0', RED = '#edcecb';   // soft Tcl stage colours
  const bands = [], nodes = [];
  const ramp = (t0, t1, y0, y1, n) => { const pts = []; const N = Math.max(n || 2, Math.round(t1 - t0)); for (let i = 0; i <= N; i++) { const f = i / N; pts.push([t0 + (t1 - t0) * f, y0 + (y1 - y0) * f]); } return pts; };
  // eased S-ramp (smoothstep) — the pressure rise eases in and out so it curves
  // into the hold plateau instead of hitting it at a sharp elbow.
  const sRamp = (t0, t1, y0, y1) => { const pts = []; const N = 10; for (let i = 0; i <= N; i++) { const f = i / N, s = f * f * (3 - 2 * f); pts.push([t0 + (t1 - t0) * f, y0 + (y1 - y0) * s]); } return pts; };
  const addBand = (color, pts) => { bands.push({ color, xs: pts.map((p) => p[0]), ys: pts.map((p) => p[1]) }); };
  const node = (t, y) => { if (!nodes.length || Math.abs(nodes[nodes.length - 1][0] - t) > 0.4) nodes.push([t, y]); };

  let clock = 0, last = 0;
  const time = num(pp.time), hold = num(pp.holdTime), dec = num(pp.declineTime);
  const stop = num(pp.stopPressure), press = num(pp.pressure), pend = num(pp.pressureEnd);
  node(0, 0);
  if (time > 0) { addBand(GREEN, ramp(0, time, 0, stop)); clock = time; last = stop; node(time, stop); }
  if (hold > 0) {
    const rise = Math.min(hold, 2);              // eased rise to the hold pressure, then flat
    const pts = sRamp(clock, clock + rise, last, press).concat(ramp(clock + rise, clock + hold, press, press, 2));
    addBand(TAN, pts);
    node(clock + rise, press);                   // dot at the top of the rise
    node(clock + hold, press);                   // dot at the end of the hold plateau
    clock += hold; last = press;
  }
  if (dec > 0) { addBand(RED, ramp(clock, clock + dec, last, pend)); clock += dec; last = pend; node(clock, pend); }
  if (!bands.length) addBand(GREEN, [[0, 0], [0, 0]]);

  // continuous dark line = all band points in order (drop shared duplicates)
  const lx = [], ly = [];
  for (const b of bands) for (let i = 0; i < b.xs.length; i++) { if (lx.length && lx[lx.length - 1] === b.xs[i] && ly[ly.length - 1] === b.ys[i]) continue; lx.push(b.xs[i]); ly.push(b.ys[i]); }
  return { bands, line: { xs: lx, ys: ly }, nodes: { xs: nodes.map((n) => n[0]), ys: nodes.map((n) => n[1]) }, total: clock };
}
