// Simple FLOW profile model — a parametric UI over a fixed preinfuse -> hold ->
// decline shape, all flow-pump, matching the Tcl Streamline flow editor
// (de1_skin_settings.tcl settings_2b + profile.tcl flow_to_advanced_list).
// reaprime stores only generated steps[], so the simple params live client-side.

export const MAXFLOW = 8;   // ::de1(max_flowrate_v11)
export const MAXP = 12;     // ::de1(maxpressure)

export const FLOW_LIMITS = {
  time: { min: 0, max: 60, step: 1 },
  flow: { min: 0, max: MAXFLOW, step: 0.1 },       // preinfusion_flow_rate
  stopPressure: { min: 0, max: MAXP, step: 0.1 },  // preinfusion_stop_pressure
  holdTime: { min: 0, max: 60, step: 1 },          // espresso_hold_time
  flowHold: { min: 0, max: MAXFLOW, step: 0.1 },   // flow_profile_hold
  maxPressure: { min: 0, max: MAXP, step: 0.1 },   // maximum_pressure (0 = off)
  declineTime: { min: 0, max: 60, step: 1 },       // espresso_decline_time
  flowDecline: { min: 0, max: MAXFLOW, step: 0.1 },// flow_profile_decline
  weight: { min: 0, max: 2000, step: 0.2 },
  temp: { min: 20, max: 105, step: 0.5 },
};

export const DEFAULT_FLOW_PARAMS = {
  time: 20, flow: 8, stopPressure: 5,
  holdTime: 30, flowHold: 1.2, maxPressure: 8.6,
  declineTime: 0, flowDecline: 1.2,
  weight: 36, temp: 88,
  tempSteps: false, temp0: 88, temp1: 88, temp2: 88, temp3: 88,
};

const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// steps[] -> simple params. Flow profiles are all flow-pump; roles are told apart
// by name ("preinfusion", "hold", "decline") with transition as a fallback.
export function parseFlow(profile) {
  const steps = (profile && profile.steps) || [];
  if (!steps.length) return { ...DEFAULT_FLOW_PARAMS };
  const p = { ...DEFAULT_FLOW_PARAMS };
  const pre = steps.filter((s) => /preinf/i.test(s.name || ''));
  const rest = steps.filter((s) => !/preinf/i.test(s.name || ''));
  const holdStep = rest.find((s) => /hold/i.test(s.name || '')) || rest.find((s) => s.transition !== 'smooth') || rest[0];
  const declineStep = rest.find((s) => /decline/i.test(s.name || '')) || rest.find((s) => s.transition === 'smooth');

  if (pre.length) {
    p.time = Math.round(pre.reduce((a, s) => a + num(s.seconds), 0));
    p.flow = Math.max(...pre.map((s) => num(s.flow, DEFAULT_FLOW_PARAMS.flow)));
    const stop = Math.max(...pre.map((s) => num(s.exit_pressure_over)));
    if (stop > 0) p.stopPressure = stop;
  } else { p.time = 0; }

  if (holdStep) {
    p.holdTime = Math.round(num(holdStep.seconds));
    p.flowHold = num(holdStep.flow, DEFAULT_FLOW_PARAMS.flowHold);
    p.maxPressure = num(holdStep.max_flow_or_pressure) || 0;
  }
  if (declineStep && declineStep !== holdStep) {
    p.declineTime = Math.round(num(declineStep.seconds));
    p.flowDecline = num(declineStep.flow, p.flowHold);
  } else { p.declineTime = 0; p.flowDecline = p.flowHold; }

  const preMain = pre[0] || steps[0];
  p.temp = num(preMain.temperature, DEFAULT_FLOW_PARAMS.temp);
  p.temp1 = num(preMain.temperature, p.temp);
  p.temp2 = num(holdStep ? holdStep.temperature : p.temp, p.temp);
  p.temp3 = num(declineStep ? declineStep.temperature : p.temp, p.temp);
  p.temp0 = p.temp1;
  p.tempSteps = Math.abs(p.temp1 - p.temp2) > 0.05 || Math.abs(p.temp1 - p.temp3) > 0.05;
  if (profile && profile.target_weight > 0) p.weight = num(profile.target_weight, DEFAULT_FLOW_PARAMS.weight);
  return p;
}

// simple params -> steps[]  (JS port of profile::flow_to_advanced_list, single
// temperature per step). Every frame is flow-pumped.
export function buildFlowSteps(pp) {
  const on = !!pp.tempSteps;
  const T = num(pp.temp, 88);
  const t1 = on ? num(pp.temp1, T) : T, t2 = on ? num(pp.temp2, T) : T, t3 = on ? num(pp.temp3, T) : T;
  const steps = [];
  const mp = num(pp.maxPressure) > 0 ? { max_flow_or_pressure: num(pp.maxPressure), max_flow_or_pressure_range: 0.6 } : null;

  if (num(pp.time) > 0) {
    steps.push({
      name: 'preinfusion', temperature: t1, sensor: 'coffee', pump: 'flow', transition: 'fast',
      pressure: 1, flow: num(pp.flow), seconds: num(pp.time), volume: 0, weight: 0,
      exit_if: 1, exit_type: 'pressure_over', exit_pressure_over: num(pp.stopPressure),
      exit_pressure_under: 0, exit_flow_over: 0, exit_flow_under: 0,
    });
  }
  if (num(pp.holdTime) > 0) {
    steps.push({ name: 'hold', temperature: t2, sensor: 'coffee', pump: 'flow', transition: 'fast', flow: num(pp.flowHold), seconds: num(pp.holdTime), volume: 0, weight: 0, exit_if: 0, exit_flow_over: 6, ...(mp || {}) });
  }
  if (num(pp.declineTime) > 0) {
    steps.push({ name: 'decline', temperature: t3, sensor: 'coffee', pump: 'flow', transition: 'smooth', flow: num(pp.flowDecline), seconds: num(pp.declineTime), volume: 0, weight: 0, exit_if: 0, ...(mp || {}) });
  }
  if (!steps.length) steps.push({ name: 'empty', temperature: T, sensor: 'coffee', pump: 'flow', transition: 'smooth', flow: 0, seconds: 0, volume: 0, weight: 0, exit_if: 0 });
  return steps;
}

// Target-flow curve for the explanation chart. Preinfuse rises to the flow rate
// then holds; hold eases down to the hold flow then holds; decline eases to the
// decline flow. Each stage is a separate band (own point array). Returns the same
// shape as pressureCurve so the editor's chart code is reused verbatim.
export function flowCurve(pp) {
  const GREEN = '#c8e7d5', TAN = '#efdec0', RED = '#edcecb';
  const bands = [], nodes = [];
  const ramp = (t0, t1, y0, y1, n) => { const pts = []; const N = Math.max(n || 2, Math.round(t1 - t0)); for (let i = 0; i <= N; i++) { const f = i / N; pts.push([t0 + (t1 - t0) * f, y0 + (y1 - y0) * f]); } return pts; };
  const sRamp = (t0, t1, y0, y1) => { const pts = []; const N = 10; for (let i = 0; i <= N; i++) { const f = i / N, s = f * f * (3 - 2 * f); pts.push([t0 + (t1 - t0) * f, y0 + (y1 - y0) * s]); } return pts; };
  const addBand = (color, pts) => { bands.push({ color, xs: pts.map((p) => p[0]), ys: pts.map((p) => p[1]) }); };
  const node = (t, y) => { if (!nodes.length || Math.abs(nodes[nodes.length - 1][0] - t) > 0.4) nodes.push([t, y]); };

  let clock = 0, last = 0;
  const time = num(pp.time), hold = num(pp.holdTime), dec = num(pp.declineTime);
  const flow = num(pp.flow), fhold = num(pp.flowHold), fdec = num(pp.flowDecline);
  node(0, 0);
  if (time > 0) {
    const rise = Math.min(time, 2);
    addBand(GREEN, sRamp(0, rise, 0, flow).concat(ramp(rise, time, flow, flow, 2)));
    node(rise, flow); node(time, flow); clock = time; last = flow;
  }
  if (hold > 0) {
    const drop = Math.min(hold, 2.5);
    addBand(TAN, sRamp(clock, clock + drop, last, fhold).concat(ramp(clock + drop, clock + hold, fhold, fhold, 2)));
    node(clock + drop, fhold); node(clock + hold, fhold); clock += hold; last = fhold;
  }
  if (dec > 0) {
    const drop = Math.min(dec, 2.5);
    addBand(RED, sRamp(clock, clock + drop, last, fdec).concat(ramp(clock + drop, clock + dec, fdec, fdec, 2)));
    node(clock + drop, fdec);            // dot at the bottom of the drop (the elbow)
    node(clock + dec, fdec);             // dot at the end
    clock += dec; last = fdec;
  }
  if (!bands.length) addBand(GREEN, [[0, 0], [0, 0]]);

  const lx = [], ly = [];
  for (const b of bands) for (let i = 0; i < b.xs.length; i++) { if (lx.length && lx[lx.length - 1] === b.xs[i] && ly[ly.length - 1] === b.ys[i]) continue; lx.push(b.xs[i]); ly.push(b.ys[i]); }
  return { bands, line: { xs: lx, ys: ly }, nodes: { xs: nodes.map((n) => n[0]), ys: nodes.map((n) => n[1]) }, total: clock };
}
