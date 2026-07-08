// Insight charts, rendered from a shared data buffer so any view (normal 3-panel
// or a zoomed single panel) draws the full shot history. Buffer shape:
//   { t:[], p:[], pg:[], f:[], fg:[], w:[], T:[], Tg:[] }
// (time, pressure, pressure-goal, flow, flow-goal, weight, temp, temp-goal).
// The x-axis auto-ranges to the data, so it grows with the shot like BLT.
import { logger } from './logger.js';

const COL = {
  pressure: '#00b672', flow: '#6c9bff', temp: '#ff7880', weight: '#a2693d',
  grid: '#e0e0e0', label: '#7a7a7a', bg: '#ffffff',
};
const smooth = { shape: 'spline', smoothing: 0.5 };
const line = (color, yaxis, dash, width) => ({ x: [], y: [], mode: 'lines', yaxis,
  line: { color, width, dash: dash || 'solid', ...smooth }, hoverinfo: 'skip' });
const axC = { gridcolor: COL.grid, zeroline: false, fixedrange: true, ticks: '',
  tickfont: { color: COL.label, size: 20 } };

// Three stacked panels: pressure (0-12), flow (0-8)+weight, temperature.
export class EspressoChart {
  constructor(el) { this.el = el;
    this.traces = [
      line(COL.pressure, 'y', null, 7), line(COL.pressure, 'y', 'dash', 4),
      line(COL.flow, 'y2', null, 8), line(COL.flow, 'y2', 'dash', 4), line(COL.weight, 'y2', null, 4),
      line(COL.temp, 'y3', null, 6), line(COL.temp, 'y3', 'dash', 4),
    ];
    this.layout = { margin: { l: 70, r: 20, t: 8, b: 40 }, showlegend: false,
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: COL.bg,
      xaxis: { ...axC, autorange: true, rangemode: 'tozero', anchor: 'y3' },
      yaxis: { ...axC, domain: [0.685, 1], range: [0, 12], tickvals: [1, 3, 5, 7, 9, 11] },
      yaxis2: { ...axC, domain: [0.355, 0.63], range: [0, 8.01], tickvals: [1, 2, 3, 4, 5, 6, 7, 8] },
      yaxis3: { ...axC, domain: [0, 0.3], autorange: true },
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
  resize() { try { Plotly.Plots.resize(this.el); } catch (e) { logger.warn('resize', e); } }
}

// Single big panel: mode 'pf' (pressure+flow+weight, 0-12) or 'temp' (temperature).
export class ZoomChart {
  constructor(el, mode = 'pf') { this.el = el; this.mode = mode;
    if (mode === 'temp') {
      this.traces = [line(COL.temp, 'y', null, 8), line(COL.temp, 'y', 'dash', 5)];
      this.layout = { margin: { l: 80, r: 20, t: 10, b: 50 }, showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: COL.bg,
        xaxis: { ...axC, autorange: true, rangemode: 'tozero' },
        yaxis: { ...axC, autorange: true }, datarevision: 0 };
    } else {
      this.traces = [line(COL.pressure, 'y', null, 9), line(COL.pressure, 'y', 'dash', 5),
        line(COL.flow, 'y', null, 10), line(COL.flow, 'y', 'dash', 5), line(COL.weight, 'y', null, 5)];
      this.layout = { margin: { l: 80, r: 20, t: 10, b: 50 }, showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: COL.bg,
        xaxis: { ...axC, autorange: true, rangemode: 'tozero' },
        yaxis: { ...axC, range: [0, 12], tickvals: [0, 2, 4, 6, 8, 10, 12] }, datarevision: 0 };
    }
    this.config = { displayModeBar: false, responsive: true, staticPlot: true };
    Plotly.newPlot(this.el, this.traces, this.layout, this.config);
  }
  render(b) {
    const map = this.mode === 'temp' ? [b.T, b.Tg] : [b.p, b.pg, b.f, b.fg, b.w];
    this.traces.forEach((tr, i) => { tr.x = b.t; tr.y = map[i]; });
    this.layout.datarevision++;
    Plotly.react(this.el, this.traces, this.layout, this.config);
  }
  resize() { try { Plotly.Plots.resize(this.el); } catch (e) { logger.warn('resize', e); } }
}
