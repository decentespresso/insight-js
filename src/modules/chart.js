// Insight charts, rendered from a shared data buffer so any view (normal 3-panel
// or a zoomed single panel) draws the full shot history. Buffer shape:
//   { t:[], p:[], pg:[], f:[], fg:[], w:[], T:[], Tg:[] }
// (time, pressure, pressure-goal, flow, flow-goal, weight, temp, temp-goal).
// Each panel has its own x-axis, coloured to match the panel, exactly like the
// Tcl Insight skin. Lines are angular (linear), not splined.
import { logger } from './logger.js';

const COL = {
  pressure: '#00b672', flow: '#6c9bff', temp: '#ff7880', weight: '#a2693d',
  grid: '#e6e6e6', bg: '#ffffff',
};
// Same typeface the Tcl Insight skin uses (Noto Sans UI, embedded via @font-face).
const FONT = "'InsightUI', Helvetica, Arial, sans-serif";

// Insight preview & live lines are angular (linear interpolation), not splined.
const trace = (color, xaxis, yaxis, dash, width) => ({ x: [], y: [], mode: 'lines', xaxis, yaxis,
  line: { color, width, dash: dash || 'solid', shape: 'linear' }, hoverinfo: 'skip' });

// Insight colours EVERYTHING in a panel — numbers, spine, ticks — to match the
// panel accent; only the gridlines stay light grey.
const xAxis = (color, anchor) => ({ anchor, gridcolor: COL.grid, gridwidth: 2, zeroline: false, fixedrange: true,
  showline: true, linecolor: color, linewidth: 2, ticks: 'outside', ticklen: 6, tickcolor: color,
  tickwidth: 2, tickfont: { color, size: 32, family: FONT }, dtick: 100, rangemode: 'tozero', autorange: true });
const yAxis = (color, domain, extra) => ({ domain, gridcolor: COL.grid, gridwidth: 2, zeroline: false, fixedrange: true,
  showline: true, linecolor: color, linewidth: 2, ticks: 'outside', ticklen: 6, tickcolor: color,
  tickwidth: 2, tickfont: { color, size: 32, family: FONT }, ...extra });

// Panel titles: bold coloured label at the top-left of each stacked panel. x is
// slightly negative so the label sits at the far left (Insight x=40), left of the
// y-axis numbers, rather than at the plot-area edge.
const title = (text, color, ytop) => ({ text, xref: 'paper', yref: 'paper',
  x: -0.03, xanchor: 'left', y: ytop, yanchor: 'bottom', showarrow: false,
  font: { color, size: 34, family: FONT, weight: 700 } });

// Zoomed single-panel view: neutral grey axes (Insight draws zoom axes in grey,
// not the panel accent), and top titles anchored left/centre/right.
const GREY = '#6b6b6b', ZLINE = '#c8c8c8';
// pf zoom: neutral grey axes; temp zoom: red axes (matching the panel colour).
const zAxis = (anchor, color, extra) => ({ anchor, gridcolor: COL.grid, gridwidth: 2, zeroline: false, fixedrange: true,
  showline: true, linecolor: color === GREY ? ZLINE : color, linewidth: 2, ticks: 'outside', ticklen: 6,
  tickcolor: color === GREY ? ZLINE : color, tickwidth: 2, tickfont: { color, size: 34, family: FONT }, ...extra });
const zTitle = (text, color, x, xanchor) => ({ text, xref: 'paper', yref: 'paper',
  x, xanchor, y: 1.0, yanchor: 'bottom', showarrow: false,
  font: { color, size: 38, family: FONT, weight: 700 } });

// Three stacked panels: pressure (0-12), flow (0-8)+weight, temperature.
export class EspressoChart {
  constructor(el) { this.el = el;
    // [P solid, P goal, F solid, F goal, weight, T solid, T goal]
    this.traces = [
      trace(COL.pressure, 'x', 'y', null, 13), trace(COL.pressure, 'x', 'y', 'dash', 6),
      trace(COL.flow, 'x2', 'y2', null, 12), trace(COL.flow, 'x2', 'y2', 'dash', 6), trace(COL.weight, 'x2', 'y2', null, 6),
      trace(COL.temp, 'x3', 'y3', null, 12), trace(COL.temp, 'x3', 'y3', 'dash', 6),
    ];
    this.layout = { margin: { l: 78, r: 20, t: 48, b: 50 }, showlegend: false,
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: COL.bg,
      xaxis: xAxis(COL.pressure, 'y'),
      xaxis2: { ...xAxis(COL.flow, 'y2'), matches: 'x' },
      xaxis3: { ...xAxis(COL.temp, 'y3'), matches: 'x' },
      yaxis: yAxis(COL.pressure, [0.74, 0.99], { range: [0, 12], tickvals: [1, 3, 5, 7, 9, 11] }),
      yaxis2: yAxis(COL.flow, [0.40, 0.65], { range: [0, 8.01], tickvals: [1, 2, 3, 4, 5, 6, 7, 8] }),
      yaxis3: yAxis(COL.temp, [0.06, 0.31], { range: [79, 93], tickvals: [80, 85, 90] }),
      annotations: [
        // smaller title font (34 vs 40) plus a few-px lift above each panel top
        // keeps the label clear of the top y-tick number (11 / 8 / 90).
        title('Pressure (bar)', COL.pressure, 0.996),
        title('Flow (mL/s)', COL.flow, 0.656),
        title('Temperature (°C)', COL.temp, 0.316),
      ],
      datarevision: 0 };
    this.config = { displayModeBar: false, responsive: true, staticPlot: true };
    Plotly.newPlot(this.el, this.traces, this.layout, this.config);
  }
  render(b) {
    const map = [b.p, b.pg, b.f, b.fg, b.w, b.T, b.Tg];
    this.traces.forEach((tr, i) => { tr.x = b.t; tr.y = map[i]; });
    this.layout.datarevision++;
    Plotly.react(this.el, this.traces, this.layout, this.config);
  }
  // At-rest preview of the loaded profile: draw target pressure / flow / temp
  // (from profile steps) as the solid coloured lines, like Insight's ready page.
  renderPreview(c) {
    this.traces[0].x = c.t; this.traces[0].y = c.p;   // pressure (solid)
    this.traces[2].x = c.t; this.traces[2].y = c.f;   // flow (solid)
    this.traces[5].x = c.t; this.traces[5].y = c.T;   // temperature (solid)
    [1, 3, 4, 6].forEach((i) => { this.traces[i].x = []; this.traces[i].y = []; });
    this.layout.datarevision++;
    Plotly.react(this.el, this.traces, this.layout, this.config);
  }
  resize() { try { Plotly.Plots.resize(this.el); } catch (e) { logger.warn('resize', e); } }
}

// Single big panel: mode 'pf' (pressure+flow+weight, 0-12) or 'temp' (temperature).
export class ZoomChart {
  constructor(el, mode = 'pf') { this.el = el; this.mode = mode;
    if (mode === 'temp') {
      this.traces = [trace(COL.temp, 'x', 'y', null, 11), trace(COL.temp, 'x', 'y', 'dash', 6)];
      this.layout = { margin: { l: 84, r: 20, t: 60, b: 60 }, showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: COL.bg,
        xaxis: zAxis('y', COL.temp, { dtick: 100, rangemode: 'tozero', autorange: true }),
        yaxis: zAxis('x', COL.temp, { domain: [0, 1], range: [78, 92], tickvals: [80, 85, 90] }),
        annotations: [zTitle('Temperature (°C)', COL.temp, -0.03, 'left')], datarevision: 0 };
    } else {
      const res = trace('#d2d200', 'x', 'y', 'dash', 5); res.visible = false; // puck resistance
      this.traces = [trace(COL.pressure, 'x', 'y', null, 13), trace(COL.pressure, 'x', 'y', 'dash', 6),
        trace(COL.flow, 'x', 'y', null, 13), trace(COL.flow, 'x', 'y', 'dash', 6), trace(COL.weight, 'x', 'y', null, 6), res];
      this.layout = { margin: { l: 84, r: 20, t: 60, b: 60 }, showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: COL.bg,
        xaxis: zAxis('y', GREY, { dtick: 100, rangemode: 'tozero', autorange: true }),
        yaxis: zAxis('x', GREY, { domain: [0, 1], range: [0, 12], dtick: 1 }),
        annotations: [
          zTitle('Flow (mL/s)', COL.flow, -0.03, 'left'),
          zTitle('☐ Resistance', '#d2d200', 0.6, 'center'),
          zTitle('Pressure (bar)', COL.pressure, 1, 'right'),
        ], datarevision: 0 };
    }
    this.config = { displayModeBar: false, responsive: true, staticPlot: true };
    Plotly.newPlot(this.el, this.traces, this.layout, this.config);
  }
  render(b) {
    const map = this.mode === 'temp' ? [b.T, b.Tg] : [b.p, b.pg, b.f, b.fg, b.w, b.r];
    this.traces.forEach((tr, i) => { tr.x = b.t; tr.y = map[i]; });
    this.layout.datarevision++;
    Plotly.react(this.el, this.traces, this.layout, this.config);
  }
  renderPreview(c) {
    if (this.mode === 'temp') {
      this.traces[0].x = c.t; this.traces[0].y = c.T; this.traces[1].x = []; this.traces[1].y = [];
    } else {
      this.traces[0].x = c.t; this.traces[0].y = c.p;   // pressure (solid)
      this.traces[2].x = c.t; this.traces[2].y = c.f;   // flow (solid)
      [1, 3, 4, 5].forEach((i) => { this.traces[i].x = []; this.traces[i].y = []; });
    }
    this.layout.datarevision++;
    Plotly.react(this.el, this.traces, this.layout, this.config);
  }
  // toggle the puck-resistance curve (pf mode only)
  setResistance(on, b) {
    if (this.mode !== 'pf' || !this.traces[5]) return;
    this.traces[5].visible = on;
    if (on && b) { this.traces[5].x = b.t; this.traces[5].y = b.r; }
    this.layout.annotations[1].text = (on ? '☑' : '☐') + ' Resistance';
    this.layout.datarevision++;
    Plotly.react(this.el, this.traces, this.layout, this.config);
  }
  // change the temperature-zoom Y-axis scale (temp mode only)
  setTempRange(range) {
    if (this.mode !== 'temp') return;
    this.layout.yaxis.range = range.slice(); this.layout.yaxis.autorange = false;
    Plotly.relayout(this.el, { 'yaxis.range': range.slice() });
  }
  resize() { try { Plotly.Plots.resize(this.el); } catch (e) { logger.warn('resize', e); } }
}
