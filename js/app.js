class Component extends DCLogic {
  constructor(...args) {
    super(...args);
    this.state = Object.assign({ page: null, collapsed: false }, this.fresh());
  }

  // Everything a demo can change. Reset puts this back.
  fresh() {
    return {
      now: new Date(), done: {}, acked: {}, recovered: {}, training: {}, service: {}, checkin: {}, submitted: {}, sched: null,
      exportsNew: [], messages: [], log: [], toast: '', scen: 1, teleId: this.props.data.trucks[0].id, sel: this.props.data.trucks[0].id,
      prio: { ot: true, sw: true, bal: true, fuel: true }, msg: '', dispatchTo: '', optRun: false, bid: 0,
      kpiPeriod: 'M', repCat: 'All', repQ: '', fleetFilter: 'All',
      startMs: Date.now(), goals: { otd: 95, margin: 8, empty: 10, cash: 250 }, targets: {}, flags: {}, q: '', aiAns: null, scenSel: null, gate: null, horizon: 7, unavail: {}, insightQ: '', insightText: '', dis: {}, applied: {}, decisions: [], demo: 0, cmp: null, pend: null, planFilter: 'risk', dl: null, showDis: false, autoPend: false
    };
  }
  componentDidMount() { this._t = setInterval(() => this.setState({ now: new Date() }), 1000); }
  componentWillUnmount() { clearInterval(this._t); }
  stamp() { return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }

  // Apply a change and record it in the activity feed.
  act(patchFn, text, kind) {
    this.setState((p) => {
      const patch = patchFn ? patchFn(p) : {};
      const log = text ? [{ t: this.stamp(), text, kind: kind || 'info' }].concat(p.log || []).slice(0, 40) : p.log;
      return Object.assign({}, patch, { log, toast: text || p.toast });
    });
  }
  btn(key, label, doneLabel, text, kind, patchFn) {
    const d = !!(this.state.done || {})[key];
    // Plan changes (lane changes, route adoptions, recommendations, full optimization, training) need explicit human approval.
    const gated = /^(opp\d+|sample\d+|rec\d+|runFull|idleTop)$/.test(key);
    const apply = () => {
      const stamp = this.stamp(), planT = this.fmtT(this.planNowM()), what = text || label;
      this.actOnce((p) => !!(p.done || {})[key], (p) => Object.assign({ done: Object.assign({}, p.done, { [key]: true }), gate: null }, gated ? { decisions: [{ t: stamp, planT, k: key, no: '—', cust: 'Network', label: what, rec: true, by: 'John Jones', cause: 'Plan change proposed by Monifi.', rationale: 'Approved by John Jones after review. ' + what + '.', tradeoffs: 'Reviewed in the approval bar before applying.', effect: what }].concat(p.decisions || []) } : {}, patchFn ? patchFn(p) : {}), gated ? 'Approved by John Jones: ' + what : text, kind);
    };
    const waiting = gated && !d && this.state.gate === key;
    if (gated) { this._gate = this._gate || {}; const prop = [[/^Applied lane change: (.*)$/, 'Apply lane change: $1'], [/^Optimized route adopted on (.*)$/, 'Adopt the optimized route on $1'], [/^Full optimization run: (\d+) lane changes applied$/, 'Run full optimization: apply $1 lane changes'], [/^Merged LTL loads (.*) on (.*): (.*) saved$/, 'Merge LTL loads $1 on $2 ($3 saved)'], [/^Replacement scheduled for (.*)$/, 'Schedule replacement of $1'], [/^Idle Reduction Phase 2 launched for (.*)$/, 'Launch Idle Reduction Phase 2 for $1'], [/^Thursday dispatch rebalanced: (.*) moved to Wednesday$/, 'Rebalance Thursday dispatch: move $1 to Wednesday']].reduce((t, r) => t.replace(r[0], r[1]), text || label); this._gate[key] = { title: prop, run: apply }; }
    return {
      label: d ? doneLabel : waiting ? 'Awaiting approval' : label, isDone: d,
      click: () => { if ((this.state.done || {})[key]) return; if (gated) this.setState({ gate: key }); else apply(); },
      bg: d ? '#e5e8ed' : '#1e3a6e', fg: d ? '#4b5563' : '#ffffff',
      softBg: d ? '#e5e8ed' : 'rgba(108,179,227,.18)', tfg: d ? '#6b7280' : '#1d4f91'
    };
  }
  kpi(label, value, sub, tone, subTone) {
    const T = { neutral: ['#ffffff', '#e3e7ed', '#0f172a'], amber: ['rgba(245,158,11,.10)', 'rgba(245,158,11,.35)', '#b45309'], blue: ['rgba(108,179,227,.10)', 'rgba(108,179,227,.35)', '#1d4f91'], red: ['rgba(239,68,68,.08)', 'rgba(239,68,68,.35)', '#dc2626'], green: ['#ffffff', '#86c99a', '#15803d'] }[tone || 'neutral'];
    const S = { muted: '#6b7280', red: '#dc2626', green: '#15803d', blue: '#1d6fa5' };
    return { label, value, sub: sub || '', bg: T[0], bd: T[1], color: T[2], subColor: S[subTone || 'muted'] };
  }

  // ---------- Map geography (real lon/lat, projected) ----------
  geo() {
    if (this._geo) return this._geo;
    const LON0 = -84.2, LAT1 = 46.5, KX = 0.719, K = 117.6;
    const pj = (p) => [(p[0] - LON0) * KX * K, (LAT1 - p[1]) * K];
    const P = (pts, close) => pts.map((p, i) => { const q = pj(p); return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ') + (close ? ' Z' : '');
    const PP = (list, close) => list.map((pts) => P(pts, close)).join(' ');
    const pc = (p) => { const q = pj(p); return { l: (q[0] / 10).toFixed(2), t: (q[1] / 6.12).toFixed(2) }; };
    const E = (lon, lat, rlon, rlat) => { const q = pj([lon, lat]); return { cx: q[0].toFixed(1), cy: q[1].toFixed(1), rx: (rlon * KX * K).toFixed(1), ry: (rlat * K).toFixed(1) }; };
    const H = {
      h401: [[-83.03, 42.31], [-82.6, 42.33], [-82.18, 42.4], [-81.75, 42.68], [-81.25, 42.95], [-80.75, 43.13], [-80.3, 43.4], [-79.88, 43.52], [-79.6, 43.68], [-79.4, 43.74], [-79.1, 43.82], [-78.85, 43.9], [-78.3, 43.97], [-77.38, 44.18], [-76.85, 44.24], [-76.5, 44.27], [-76.1, 44.4], [-75.68, 44.62], [-75.25, 44.88], [-74.73, 45.03], [-74.3, 45.22], [-73.95, 45.4], [-73.62, 45.47]],
      qew: [[-79.42, 43.64], [-79.62, 43.55], [-79.8, 43.32], [-79.6, 43.2], [-79.24, 43.16], [-79.05, 43.0], [-78.9, 42.89]],
      h400: [[-79.5, 43.75], [-79.6, 44.05], [-79.69, 44.39], [-79.6, 44.75], [-79.85, 45.0], [-80.03, 45.35], [-80.4, 45.8], [-80.99, 46.45]],
      h417: [[-75.7, 45.42], [-75.3, 45.45], [-74.6, 45.57], [-74.1, 45.5], [-73.62, 45.47]],
      h416: [[-75.72, 45.38], [-75.65, 45.0], [-75.6, 44.72]],
      i90e: [[-78.88, 42.89], [-78.3, 43.0], [-77.61, 43.1], [-76.9, 43.03], [-76.15, 43.05], [-75.23, 43.1], [-74.5, 42.95], [-73.76, 42.65]],
      i90w: [[-78.88, 42.89], [-79.35, 42.48], [-80.08, 42.12], [-80.9, 41.75], [-81.69, 41.5], [-82.6, 41.4], [-83.55, 41.65]],
      i75: [[-83.55, 41.65], [-83.3, 42.05], [-83.05, 42.33], [-83.25, 42.6], [-83.69, 43.01], [-83.95, 43.42], [-84.25, 43.9]],
      i81: [[-76.15, 43.05], [-76.0, 43.5], [-75.91, 43.97], [-75.98, 44.33], [-76.05, 44.38]],
      h402: [[-82.4, 42.97], [-82.0, 42.93], [-81.6, 42.95], [-81.25, 42.95]],
      i69: [[-82.42, 42.98], [-82.9, 43.0], [-83.69, 43.01]],
      i94: [[-82.42, 42.98], [-82.75, 42.6], [-83.05, 42.33]],
      i87: [[-73.76, 42.65], [-73.75, 43.1], [-73.68, 43.6], [-73.55, 44.2], [-73.5, 44.7], [-73.45, 45.0], [-73.55, 45.45]],
      a40: [[-73.62, 45.47], [-73.1, 45.8], [-72.4, 46.3]],
      a20: [[-73.55, 45.45], [-73.0, 45.6], [-72.4, 45.85]]
    };
    const minor = [
      [[-79.4, 43.8], [-78.9, 44.0], [-78.32, 44.3], [-77.6, 44.5], [-76.9, 44.75], [-76.2, 44.95], [-75.7, 45.35]],
      [[-79.69, 44.39], [-79.4, 44.6], [-79.3, 45.0], [-79.2, 45.6], [-79.46, 46.31], [-79.5, 46.5]],
      [[-75.7, 45.42], [-76.3, 45.47], [-77.1, 45.83], [-78.0, 46.2], [-79.46, 46.31]],
      [[-79.87, 43.26], [-80.25, 43.55], [-80.5, 43.9], [-80.75, 44.3], [-80.94, 44.58], [-81.15, 44.75]],
      [[-83.0, 42.28], [-82.6, 42.1], [-81.9, 42.35], [-81.2, 42.75], [-80.5, 42.85], [-79.6, 42.9], [-79.25, 42.9]],
      [[-78.85, 43.9], [-78.32, 44.3]], [[-77.61, 43.1], [-77.7, 42.6], [-77.9, 42.1]], [[-76.15, 43.05], [-76.1, 42.5], [-76.0, 42.1]],
      [[-80.5, 43.45], [-81.0, 43.6], [-81.7, 43.75]], [[-81.25, 42.95], [-81.4, 43.4], [-81.72, 43.75]], [[-77.38, 44.18], [-77.4, 44.6], [-77.3, 45.1], [-77.1, 45.83]],
      [[-74.73, 45.03], [-74.6, 45.57]], [[-73.62, 45.47], [-74.2, 45.8], [-74.6, 46.15], [-74.9, 46.5]], [[-80.08, 42.12], [-79.9, 41.6], [-79.8, 41.3]], [[-81.69, 41.5], [-82.2, 41.3]]
    ];
    const water = [
      [[-79.85, 43.27], [-79.68, 43.37], [-79.47, 43.6], [-79.38, 43.63], [-79.2, 43.7], [-78.85, 43.87], [-78.5, 43.9], [-78.17, 43.95], [-77.73, 44.0], [-77.55, 43.92], [-77.2, 43.86], [-76.95, 43.92], [-76.8, 44.03], [-76.5, 44.2], [-76.33, 44.17], [-76.25, 44.0], [-76.2, 43.85], [-76.25, 43.6], [-76.5, 43.46], [-76.97, 43.27], [-77.6, 43.26], [-78.0, 43.36], [-78.4, 43.37], [-78.8, 43.33], [-79.05, 43.26], [-79.3, 43.2], [-79.55, 43.2], [-79.75, 43.23]],
      [[-83.15, 42.05], [-83.45, 41.73], [-83.3, 41.62], [-82.95, 41.5], [-82.7, 41.45], [-82.3, 41.43], [-81.7, 41.5], [-81.3, 41.73], [-80.9, 41.9], [-80.4, 42.02], [-80.1, 42.15], [-79.75, 42.27], [-79.35, 42.5], [-79.05, 42.7], [-78.9, 42.86], [-79.05, 42.88], [-79.25, 42.87], [-79.6, 42.86], [-80.2, 42.78], [-80.6, 42.6], [-81.2, 42.66], [-81.6, 42.5], [-81.85, 42.27], [-82.2, 42.1], [-82.47, 42.0], [-82.52, 41.9], [-82.6, 42.03], [-82.9, 42.03]],
      [[-82.42, 43.0], [-81.76, 43.3], [-81.72, 43.75], [-81.65, 44.18], [-81.38, 44.5], [-81.5, 44.95], [-81.66, 45.25], [-81.3, 45.05], [-81.14, 44.74], [-80.94, 44.58], [-80.6, 44.6], [-80.2, 44.5], [-79.95, 44.55], [-79.88, 44.75], [-80.0, 45.0], [-80.05, 45.35], [-80.4, 45.7], [-80.6, 46.02], [-81.5, 46.12], [-82.5, 46.2], [-83.6, 46.12], [-84.3, 46.0], [-84.3, 45.75], [-83.9, 45.5], [-83.4, 45.3], [-83.4, 45.0], [-83.3, 44.6], [-83.5, 44.25], [-83.85, 43.95], [-83.92, 43.65], [-83.6, 43.78], [-83.3, 43.95], [-82.98, 44.06], [-82.65, 43.88], [-82.52, 43.4]],
      [[-82.92, 42.36], [-82.55, 42.33], [-82.42, 42.45], [-82.55, 42.6], [-82.75, 42.63], [-82.9, 42.52]],
      [[-79.6, 44.45], [-79.42, 44.48], [-79.27, 44.52], [-79.22, 44.4], [-79.3, 44.25], [-79.45, 44.2], [-79.55, 44.3]],
      [[-73.35, 45.02], [-73.25, 44.7], [-73.3, 44.3], [-73.38, 43.9], [-73.42, 43.6], [-73.47, 43.62], [-73.44, 44.0], [-73.4, 44.4], [-73.42, 44.75], [-73.4, 45.02]],
      [[-80.2, 46.2], [-79.75, 46.2], [-79.55, 46.27], [-79.9, 46.35], [-80.15, 46.3]],
      [[-76.1, 43.19], [-75.75, 43.2], [-75.75, 43.25], [-76.05, 43.27]]
    ];
    const islands = [[[-83.0, 45.93], [-82.4, 45.78], [-81.75, 45.75], [-81.68, 45.95], [-82.2, 46.0], [-82.8, 46.03]], [[-77.35, 43.95], [-76.95, 43.95], [-77.05, 44.05], [-77.3, 44.05]]];
    const rivers = [[[-76.33, 44.17], [-76.15, 44.3], [-75.9, 44.42], [-75.68, 44.6], [-75.2, 44.9], [-74.73, 45.01], [-74.4, 45.12], [-74.0, 45.3], [-73.75, 45.42], [-73.5, 45.55], [-73.25, 45.78], [-72.8, 46.06], [-72.4, 46.25]]];
    const streams = [
      [[-73.95, 45.42], [-74.3, 45.5], [-74.6, 45.6], [-75.1, 45.55], [-75.7, 45.43], [-76.1, 45.5], [-76.6, 45.6], [-77.1, 45.83], [-77.6, 46.05], [-78.3, 46.2], [-78.9, 46.32], [-79.4, 46.5]],
      [[-79.05, 43.26], [-79.05, 43.0], [-78.92, 42.88]], [[-82.92, 42.36], [-83.1, 42.2], [-83.15, 42.05]], [[-82.42, 43.0], [-82.45, 42.75], [-82.55, 42.6]],
      [[-73.7, 42.78], [-74.4, 42.95], [-75.2, 43.1]], [[-73.75, 41.3], [-73.75, 42.65], [-73.6, 43.3]], [[-76.95, 42.88], [-76.9, 42.4]], [[-76.75, 42.9], [-76.55, 42.45]],
      [[-81.25, 42.95], [-81.6, 42.75], [-82.1, 42.45], [-82.45, 42.32]], [[-79.9, 43.25], [-80.3, 43.15], [-80.4, 43.45], [-80.6, 43.75]]
    ];
    const border = [[-72.4, 45.01], [-74.7, 45.0], [-75.3, 44.84], [-75.85, 44.42], [-76.25, 44.2], [-76.45, 44.08], [-77.4, 43.68], [-78.7, 43.63], [-79.2, 43.45], [-79.05, 43.1], [-78.98, 42.9], [-79.4, 42.65], [-80.3, 42.35], [-81.3, 42.05], [-82.4, 41.72], [-83.1, 42.0], [-82.95, 42.3], [-82.55, 42.5], [-82.42, 42.98], [-82.15, 43.6], [-82.3, 44.4], [-82.5, 45.3], [-83.6, 45.88], [-84.1, 46.1], [-84.3, 46.5]];
    const states = [[[-79.76, 42.27], [-79.76, 42.0], [-75.36, 42.0], [-74.9, 41.5], [-74.7, 41.3]], [[-80.52, 41.98], [-80.52, 41.3]], [[-83.45, 41.73], [-84.3, 41.7]], [[-73.34, 45.01], [-73.3, 43.6], [-73.27, 42.75], [-73.5, 42.05], [-73.5, 41.3]], [[-74.45, 45.13], [-74.38, 45.57]]];
    const C = (name, lon, lat, size, pos) => {
      const tf = { r: 'translate(8px,-50%)', l: 'translate(calc(-100% - 8px),-50%)', b: 'translate(-50%,7px)', a: 'translate(-50%,calc(-100% - 7px))' }[pos || 'r'];
      return Object.assign(pc([lon, lat]), { name, d: [5, 9, 15, 24][size], fs: [10, 11, 12, 13][size], fw: size >= 2 ? 700 : 500, tf });
    };
    const cities = [
      C('Toronto', -79.38, 43.65, 3, 'a'), C('Montreal', -73.57, 45.5, 3, 'r'), C('Detroit', -83.05, 42.33, 3, 'l'), C('Ottawa', -75.7, 45.42, 2, 'a'),
      C('Buffalo', -78.88, 42.89, 2, 'b'), C('Hamilton', -79.87, 43.26, 2, 'l'), C('Cleveland', -81.69, 41.5, 2, 'r'), C('Rochester', -77.61, 43.16, 2, 'b'),
      C('London', -81.25, 42.98, 1, 'a'), C('Windsor', -83.0, 42.3, 1, 'b'), C('Kitchener', -80.49, 43.45, 1, 'a'), C('Kingston', -76.49, 44.23, 1, 'a'),
      C('Syracuse', -76.15, 43.05, 1, 'b'), C('Toledo', -83.55, 41.65, 1, 'r'), C('Barrie', -79.69, 44.39, 1, 'r'), C('Flint', -83.69, 43.01, 1, 'r'),
      C('Albany', -73.76, 42.65, 1, 'r'), C('Sudbury', -80.99, 46.47, 1, 'b'), C('Peterborough', -78.32, 44.3, 0, 'r'), C('Belleville', -77.38, 44.16, 0, 'a'),
      C('Cornwall', -74.73, 45.02, 0, 'b'), C('Sarnia', -82.4, 42.97, 0, 'r'), C('Erie', -80.08, 42.13, 0, 'r'), C('Niagara Falls', -79.07, 43.09, 0, 'r'),
      C('Brockville', -75.68, 44.59, 0, 'b'), C('Watertown', -75.91, 43.97, 0, 'r'), C('Owen Sound', -80.94, 44.57, 0, 'l'), C('North Bay', -79.46, 46.31, 0, 'r'),
      C('Utica', -75.23, 43.1, 0, 'b'), C('Saginaw', -83.95, 43.42, 0, 'r'), C('Trois-Rivières', -72.55, 46.35, 0, 'l'), C('Pembroke', -77.1, 45.83, 0, 'r')
    ];
    const L = (name, lon, lat) => Object.assign(pc([lon, lat]), { name });
    const regions = [L('ONTARIO', -78.6, 45.05), L('QUÉBEC', -73.9, 46.05), L('NEW YORK', -75.4, 42.45), L('MICHIGAN', -83.75, 44.75), L('OHIO', -82.4, 41.36), L('PENNSYLVANIA', -79.4, 41.62), L('VERMONT', -72.8, 44.2)];
    const waters = [L('Lake Ontario', -77.85, 43.62), L('Lake Erie', -81.3, 42.12), L('Lake Huron', -82.55, 44.7), L('Georgian Bay', -80.75, 45.3), L('St. Lawrence River', -75.0, 44.72)];
    const S = (label, lon, lat, us) => Object.assign(pc([lon, lat]), { label, bg: us ? '#1d4f91' : '#ffffff', fg: us ? '#ffffff' : '#1d4f91' });
    const shields = [S('401', -80.05, 43.48), S('401', -77.9, 44.07), S('401', -82.0, 42.52), S('401', -75.4, 44.8), S('QEW', -79.42, 43.17), S('400', -79.7, 44.62), S('417', -75.05, 45.53), S('416', -75.67, 45.05), S('402', -81.8, 42.94), S('I-90', -77.1, 43.06, 1), S('I-90', -80.55, 41.9, 1), S('I-75', -83.45, 42.75, 1), S('I-81', -75.96, 43.65, 1), S('I-87', -73.64, 43.95, 1), S('I-69', -83.25, 43.0, 1)];
    const terminals = [['Toronto Hub', -79.65, 43.69], ['Windsor Terminal', -82.95, 42.25], ['Ottawa Terminal', -75.6, 45.34], ['Montreal Terminal', -73.72, 45.49], ['Buffalo Cross-dock', -78.76, 42.94]].map((t) => Object.assign(pc([t[1], t[2]]), { name: t[0] }));
    this._geo = {
      pj, pc, H, cities, regions, waters, shields, terminals,
      geo: { p1: E(-78.35, 45.6, 0.6, 0.33), p2: E(-74.3, 44.05, 0.85, 0.55), p3: E(-74.5, 46.35, 0.45, 0.18), p4: E(-83.8, 44.45, 0.3, 0.28), p5: E(-76.65, 44.6, 0.35, 0.18), water: PP(water, true), islands: PP(islands, true), rivers: PP(rivers), streams: PP(streams), border: P(border), states: PP(states), minor: PP(minor), hw: PP(Object.keys(H).map((k) => H[k])) }
    };
    return this._geo;
  }

  // ---------- Scenario data ----------
  // Everything below is read from data/scenarios/<id>/*.json (loaded by js/data.js and passed in as props.data).
  // To change the fleet, loads, disruptions or finances, edit those JSON files, not this code.
  clone(x) { return JSON.parse(JSON.stringify(x)); }

  // The one shared fleet: trucks, drivers, recovery plans.
  base() {
    if (this._base) return this._base;
    const S = this.props.data;
    const drivers = this.clone(S.drivers).map((d, i) => Object.assign({}, d, { i }));
    const D = {}; drivers.forEach((d) => { D[d.name] = d; });
    const TDEF = { route: null, at: null, note: '', dwell: 0, driver: null, load: null, shipper: null, reefer: null, fault: null, predicted: null, unstable: false };
    const trucks = this.clone(S.trucks).map((t) => Object.assign({}, TDEF, t));
    const byId = {}; trucks.forEach((t) => { byId[t.id] = t; });
    const plans = this.clone(S.disruptions.recoveryPlans);
    const onCall = S.scenario.onCall.slice();
    this._base = { drivers, D, trucks, byId, plans, onCall, checkRoute: this.clone(S.scenario.checkRoute), idleNames: drivers.filter((d) => d.idle > 35).map((d) => d.name) };
    return this._base;
  }

  // Scenario start: midnight of day 0 (a Date), and the demo's opening minute of that day.
  startDate() { const c = this.props.data.scenario.clock; return new Date(c.date[0], c.date[1], c.date[2]); }

  // ================= PREDICTIVE PLANNING ENGINE =================
  // One synthetic operation. Times are minutes since midnight of the scenario's first day (see scenario.json clock).
  fmtT(m) {
    if (m == null) return 'Unknown';
    const d = Math.floor(m / 1440), r = ((m % 1440) + 1440) % 1440, h = Math.floor(r / 60), mi = r % 60;
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(((d + this.startDate().getDay()) % 7) + 7) % 7] + ' ' + ((h % 12) || 12) + ':' + String(mi).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  fmtDur(m) { m = Math.round(m); if (m <= 0) return 'Deadline passed'; const h = Math.floor(m / 60); return (h ? h + 'h ' : '') + String(m % 60).padStart(h ? 2 : 1, '0') + 'm left'; }

  pdata() {
    if (this._pd) return this._pd;
    const S = this.props.data, SC = S.scenario, E = SC.economics;
    const N0 = SC.clock.startMinute, dr = (km) => Math.round(km / 85 * 60), B = this.base();
    // Loads: explicit ones from loads.json (defaults filled in) ...
    const LDEF = { eta: null, kind: 'transit', empty: 0, rate: E.ratePerKm, issue: null };
    const loads = this.clone(S.loads.loads).map((l) => {
      const x = Object.assign({}, LDEF, l);
      if (x.kind === 'planned' && x.eta == null && x.pickup != null) x.eta = x.pickup + dr(x.km) + 30;
      return x;
    });
    // ... plus one generated load for every truck that is carrying a load but has no entry of its own.
    const have = {}; loads.forEach((l) => { if (l.truck) have[l.truck] = 1; });
    const lowRate = S.loads.genericRates || {};
    B.trucks.forEach((t, i) => {
      if (!t.load || have[t.id]) return;
      const km = 160 + (i * 37) % 380, eta = N0 + (t.status === 'dock' ? 30 : 90 + (i * 53) % 560);
      loads.push(Object.assign({}, LDEF, { no: t.load.slice(1), cust: t.shipper, from: t.from, to: t.to, eq: t.type, truck: t.id, driver: t.driver, km, due: eta + 120 + (i * 17) % 90, eta, generic: true, rate: lowRate[t.id] || E.ratePerKm }));
    });
    const DRs = loads.filter((l) => !l.urgent).reduce((a, l) => a + l.km * l.rate, 0);
    // Responses. eta = predicted arrival if approved. inf = why it is not feasible.
    const ODEF = { eta: null, extra: 0, rev: 0, empty: 0, side: [], checks: [] };
    const O = {};
    this.clone(S.responses).forEach((o) => { const k = o.no + ':' + o.kind; O[k] = Object.assign({ k }, ODEF, o); });
    const DIS = this.clone(S.disruptions.disruptions);
    const GL = this.clone(SC.levers);
    const SHOP = this.clone(S.disruptions.shop);
    const FIN = this.clone(S.finance);
    // Weekly revenue follows from the fleet: trucks x km per day x loaded share x rate per loaded km.
    const WEEK_REV = E.fleetTrucks * E.kmPerDay * 7 * (1 - E.emptyShare) * E.ratePerKm, MF = E.mf;
    this._pd = { N0, dr, loads, O, DIS, GL, DRs, SHOP, FIN, WEEK_REV, MF, onCall: B.onCall.slice() };
    return this._pd;
  }

  // Run the plan for a given state. Pure: same input, same answer.
  engine(cfg) {
    const PD = this.pdata(), B = this.base(), N0 = PD.N0, days = cfg.horizon || 7, hEnd = N0 + days * 1440;
    const dis = cfg.dis || {}, done = cfg.done || {}, applied = cfg.applied || {};
    const loads = PD.loads.filter((l) => !l.urgent || dis.urgent).map((l) => Object.assign({}, l, { issue: l.issue, conflict: !!l.baseConflict, unassigned: !l.truck, extra: 0, revAdj: 0, emptyX: 0, notes: l.note ? [l.note] : [], chosen: null, newTruck: null, newDriver: null }));
    const LB = {}; loads.forEach((l) => { LB[l.no] = l; });
    const tov = {};
    Object.keys(PD.DIS).forEach((k) => {
      if (!dis[k]) return; const d = PD.DIS[k], l = d.load ? LB[d.load] : null; if (!l || d.supplier) return;
      l.issue = { cause: d.title + '. ' + d.why, act: d.act, why: d.why, dis: k };
      if (d.etaNull) l.eta = null; if (d.delay && l.eta != null) l.eta += d.delay;
    });
    if (dis.route) loads.forEach((l) => { if (l.routeHit && l.eta != null && !(dis.truck && l.no === '4562')) { l.eta += l.routeHit; l.notes.push('Hwy 401 closure adds ' + Math.round(l.routeHit / 60 * 10) / 10 + 'h'); } });
    const used = {}, onCallFree = PD.onCall.slice(), onCallUsed = [], decided = {};
    // Resources removed from the plan by the planner
    const unavail = cfg.unavail || {};
    Object.keys(unavail).forEach((id) => {
      if (!unavail[id]) return;
      if (B.byId[id]) { used[id] = 'unavailable'; tov[id] = { note: 'Removed from the plan by the planner' }; loads.forEach((l) => { if (l.truck === id && l.kind === 'planned') { l.conflict = true; l.issue = { cause: id + ' was removed from the plan, so this pickup has no truck.', act: l.pickup - 60, why: 'Resource unavailable.' }; } }); }
      else { const i = onCallFree.indexOf(id); if (i >= 0) onCallFree.splice(i, 1); }
    });
    // Maintenance supplier: when each truck leaves the shop
    const rel = Object.assign({}, PD.SHOP.release);
    if (dis.supplier) Object.keys(rel).forEach((id) => { rel[id] += 1440; });
    loads.forEach((l) => { if (l.kind === 'planned' && rel[l.truck] != null && rel[l.truck] + 30 > l.pickup && !unavail[l.truck]) { l.conflict = true; l.issue = { cause: PD.SHOP.supplier + ' now releases ' + l.truck + ' at ' + this.fmtT(rel[l.truck]) + ', after the ' + this.fmtT(l.pickup) + ' pickup.', act: l.pickup - 60, why: 'The repair parts delay pushes the truck past this commitment.', dis: dis.supplier ? 'supplier' : undefined }; } });
    const freeBlocked = (o, st) => o.freeTruck && ((st.used[o.freeTruck] && st.used[o.freeTruck].indexOf('4620') !== 0) || !st.LB[o.after] || st.LB[o.after].conflict || st.LB[o.after].partner || st.LB[o.after].newTruck);
    const keys = Object.keys(applied).filter((k) => PD.O[k]).sort((a, b) => applied[a].t - applied[b].t);
    keys.forEach((k) => {
      const o = PD.O[k], l = LB[o.no];
      if (!l || l.chosen || !(l.issue || l.conflict || l.unassigned)) return;
      if (o.inf || (o.truck && used[o.truck]) || (o.oncall && !onCallFree.length)) return;
      if (freeBlocked(o, { used, LB })) return;
      if (o.shopTruck && unavail[o.shopTruck]) return;
      if (o.combine && (!LB[o.combine] || LB[o.combine].conflict)) return;
      if (o.truck) used[o.truck] = k;
      const drv = o.oncall ? onCallFree.shift() : null; if (drv) onCallUsed.push(drv);
      l.chosen = o; decided[o.no] = k;
      l.eta = o.decline ? null : o.shopTruck ? Math.max(l.pickup, rel[o.shopTruck] + 30) + PD.dr(o.dk) + 30 : o.eta + (dis.route && o.r401 ? o.r401 : 0);
      l.lateAgreed = !!o.late; l.partner = !!o.partner; l.declined = !!o.decline;
      l.extra += o.extra; l.revAdj += o.rev; l.emptyX += o.empty; l.conflict = false; l.unassigned = false;
      if (o.truck) l.newTruck = o.truck; l.newDriver = drv || (o.move && o.move.driver) || null;
      if (o.combine) LB[o.combine].notes.push('Runs with urgent #' + o.no + ' on TRK002');
      o.side.forEach((sd) => {
        const t = LB[sd.no]; if (!t) return;
        if (sd.empty) { t.emptyX += sd.empty; t.notes.push(sd.why); }
        if (sd.conflict && !t.chosen) { t.conflict = true; t.issue = { cause: sd.why, act: (t.pickup || N0) - 60, why: 'Caused by approving: ' + o.label + '.', side: k }; }
      });
      if (o.move) {
        const m = o.move, t0 = applied[k].t;
        if (m.plan) { const pl = B.plans[m.plan]; tov[m.truck] = { status: 'moving', route: pl.route, t0, driver: drv || pl.driver, load: '#' + l.no, shipper: l.cust, from: pl.from, to: pl.to, note: 'Recovering Load #' + l.no + ' from ' + m.plan + ' near ' + pl.via }; }
        else tov[m.truck] = { status: 'moving', route: m.route, t0, driver: m.oncallDriver ? drv : m.driver, load: m.load, shipper: m.shipper, from: m.from, to: m.to, note: (m.oncallDriver ? 'Relay driver ' + drv + ' continuing #' : 'Carrying #') + l.no + (o.backhaul ? ' • return load #4615 booked' : '') };
      }
      if (o.kind === 'checkin') tov.TRK027 = { status: 'moving', route: B.checkRoute, t0: applied[k].t, dur: 180000, from: 'Cornwall', to: 'Toronto', note: 'Tracking restored after driver check-in' };
    });
    // Scenario modelling: trucks taken out of service, optionally with a recovery plan
    const wi = cfg.whatIf;
    if (wi && wi.down) wi.down.forEach((id) => {
      const pl = (wi.plan || {})[id];
      loads.forEach((l) => {
        if (l.truck !== id || l.chosen || l.declined) return;
        if (pl) {
          if (l.kind === 'transit') { l.eta = (l.eta == null ? l.due - 60 : l.eta) + pl.delay; l.addCost = (l.addCost || 0) + 850; }
          if (pl.partner) l.partner = true; else { l.extra += pl.extra; l.emptyX += pl.empty; l.newTruck = pl.spare; l.newDriver = pl.driver; }
          l.notes.push('Scenario: ' + id + ' out of service; ' + (pl.partner ? 'covered by ' + pl.partnerName : 'covered by ' + pl.spare));
        } else if (l.kind === 'transit') { l.addCost = (l.addCost || 0) + 1900; l.eta = null; l.issue = { cause: 'Scenario: ' + id + ' out of service with this load on board.', act: N0 + 60, why: 'Needs a replacement truck or partner.' }; }
        else { l.conflict = true; l.issue = { cause: 'Scenario: ' + id + ' out of service; no truck for this pickup.', act: (l.pickup || N0) - 60 }; }
      });
      if (pl && pl.spare) { used[pl.spare] = 'scenario:' + id; loads.forEach((l) => { if (l.truck === pl.spare && l.kind === 'planned' && !l.chosen) { if (l.pickup < N0 + 720) { l.conflict = true; l.issue = { cause: pl.spare + ' was moved to cover ' + id + ' and cannot make this pickup.', act: l.pickup - 60 }; } else { l.emptyX += 300; l.notes.push(pl.spare + ' repositions back for this load (+300 km)'); } } }); }
      if (pl && pl.driver) { const i = onCallFree.indexOf(pl.driver); if (i >= 0) { onCallFree.splice(i, 1); onCallUsed.push(pl.driver); } }
    });
    // Disruptions on the trucks themselves
    if (dis.truck && !tov.TRK029) tov.TRK029 = { status: 'breakdown', at: [-78.86, 43.9], note: 'Out of service: failed roadside inspection (brakes)' };
    if (dis.truck && LB['4562'].chosen) tov.TRK029 = { status: 'breakdown', at: [-78.86, 43.9], note: 'Out of service • Load #4562 handed to ' + (LB['4562'].chosen.handoff || 'another option'), handled: true, load: null };
    if (dis.driver && !tov.TRK037) tov.TRK037 = { status: 'breakdown', at: [-79.69, 44.39], driver: 'Karen Campbell', note: 'Stopped near Barrie: driver unwell' + (LB['4577'].chosen ? ' • ' + LB['4577'].chosen.label : ''), handled: !!LB['4577'].chosen };
    if (dis.loading) tov.TRK042 = { dwellAdd: 180, note: 'Loading delayed 3h: crane breakdown' + (LB['4546'].chosen ? ' • ' + LB['4546'].chosen.label : '') };
    if (dis.route) tov.TRK001 = Object.assign(tov.TRK001 || {}, { note: LB['4502'].chosen && LB['4502'].chosen.kind === 'reroute' ? 'Detouring via Hwy 7 around the 401 closure' : 'Held by the Hwy 401 closure at Belleville' });
    [['TRK012', '4471'], ['TRK040', '4466'], ['TRK031', '4474']].forEach((r) => { const l = LB[r[1]]; if (l.chosen) tov[r[0]] = Object.assign({ handled: true, load: null, note: 'Load #' + r[1] + ' handed to ' + l.chosen.handoff + ' • tow or repair booked' }, tov[r[0]] || {}); });
    if (LB['4545'].chosen && LB['4545'].chosen.kind === 'relay') tov.TRK018 = { driver: LB['4545'].newDriver, note: 'Relay driver ' + LB['4545'].newDriver + ' took over at Fort Erie; Elizabeth Garcia resting' };
    // Status and money for each load
    let onTime = 0, nCount = 0, DR = 0, DC = 0, EX = 0, risk = 0, planned = 0, covered = 0, claim = 0, fees = 0, partnerCost = 0, deferred = 0, cashNow = 0;
    loads.forEach((l) => {
      const slack = l.eta == null ? null : l.due - l.eta;
      l.status = l.declined ? 'Declined' : l.unassigned ? 'Unassigned' : l.conflict ? 'Conflict' : l.eta == null ? 'At risk' : l.lateAgreed ? 'Rescheduled' : slack < 0 ? 'At risk' : slack < 30 ? 'Tight' : 'On time';
      l.onTime = l.status === 'On time' || l.status === 'Tight';
      l.risk = l.status === 'At risk' || l.status === 'Conflict' || l.status === 'Unassigned';
      l.reopened = !!(l.chosen && l.risk);
      l.inH = l.due <= hEnd;
      const rev = l.declined ? 0 : l.km * l.rate + l.revAdj;
      let cost = 0;
      if (!l.declined) {
        if (l.partner) { cost = l.km * 1.95 + 150; partnerCost += cost - (l.km * 1.63 + 60); }
        else if (l.unassigned) cost = l.km * 1.95 * 0.97 + 250;
        else cost = l.km * 1.63 + 60 + l.extra;
        cost += l.emptyX * 1.10 + (l.addCost || 0);
        if (l.risk) { cost += 250; fees += 250; if (l.issue && l.issue.claim && !l.chosen) { cost += l.issue.claim; claim += l.issue.claim; } }
        if (l.status === 'Rescheduled') { cost += 150; fees += 150; }
      }
      l.rev = rev; l.cost = cost; l.profit = rev - cost;
      // Revenue is recognized on delivery. A delivery moved past the period end is deferred, not lost.
      l.inPeriod = !l.declined && (l.eta != null ? l.eta : l.due + 240) <= hEnd;
      if (l.inPeriod) { DR += rev; DC += cost; } else if (!l.declined) deferred += rev;
      EX += l.emptyX;
      // Cash paid now: handling, driver call-outs, roadside work. Partner invoices are paid on 30-day terms (after the period).
      if (!l.declined && !l.partner && !l.unassigned) cashNow += l.extra - (l.chosen && l.chosen.opCost ? l.chosen.opCost : 0) + (l.addCost || 0); else if (l.partner || l.unassigned) cashNow += (l.addCost || 0);
      if (l.inH && !l.declined) { nCount++; if (l.onTime) onTime++; }
      if (l.risk && l.inH) risk++;
      if ((l.kind === 'planned') && l.inH) { planned++; if (!l.risk && !l.declined) covered++; }
    });
    // Levers from the rest of the demo
    const oppGain = [85, 81, 76, 76, 76, 75], sampleWk = [665, 435, 435];
    const nOpp = oppGain.filter((g, i) => done['opp' + i]).length, nSamp = sampleWk.filter((g, i) => done['sample' + i]).length;
    const savWk = oppGain.reduce((a, g, i) => a + (done['opp' + i] ? g : 0), 0) + sampleWk.reduce((a, g, i) => a + (done['sample' + i] ? g : 0), 0) + (done.rec0 ? 847 : 0) + (done.rec1 ? 485 : 0) + (done.rec3 ? 1200 : 0) + (done.reprice ? 2100 : 0) + (cfg.idleN || 0) * 20;
    const rate = 0.9744 + (done.rec3 ? 0.002 : 0);
    const F = Math.max(0, 43 * days - nCount);
    const otd = (onTime + F * rate) / Math.max(1, nCount + F) * 100;
    const hRev = PD.WEEK_REV * days / 7, FR = Math.max(0, hRev - PD.DRs), mf = PD.MF;
    const totRev = FR + DR, totCost = FR * (1 - mf) - savWk * days / 7 + DC;
    const margin = (totRev - totCost) / totRev * 100;
    const totalKm = 50 * 560 * days, er = 0.1035 - 0.0015 * nOpp - 0.001 * nSamp - (done.rec0 ? 0.003 : 0);
    const emptyKm = totalKm * er + EX, empty = emptyKm / (totalKm + EX) * 100;
    // Fleet utilization right now: loaded or under dispatch
    let active = 0; B.trucks.forEach((t) => { const o = tov[t.id]; const st = o && o.status ? o.status : t.status; if (st === 'moving' || st === 'dock') active++; if (t.status === 'offline' && !(o && o.status)) active++; });
    const util = active / B.trucks.length * 100;
    // Cash: the same schedule the 90-day trajectory uses (opening balance, cash paid now, receipts and payments).
    const cf = this.cashFlow(Object.assign({}, cfg, { savWk }), cashNow, partnerCost, null, null), cs = cf.summary(N0, hEnd);
    const evs = cf.ev.filter((e) => !e.steady || e.t <= hEnd).map((e) => Object.assign({}, e, { inPeriod: e.t <= hEnd }));
    const cash = Object.assign(cs, { events: evs, outside: evs.filter((e) => !e.inPeriod && e.kind === 'in').reduce((a, e) => a + e.amt, 0) });
    const minBal = cs.min;
    const resolvedTrucks = {}; [['TRK012', '4471'], ['TRK040', '4466'], ['TRK031', '4474']].forEach((r) => { if (LB[r[1]].chosen) resolvedTrucks[r[0]] = 1; });
    return {
      loads, LB, tov, used, onCallUsed, onCallFree, decided, days, hEnd,
      m: { otd, risk, margin, cover: planned ? covered / planned * 100 : 100, empty, util, active, cash: minBal / 1000 },
      fin: { rev: totRev, cost: totCost, profit: totRev - totCost, claim, fees, partnerCost, partnerPay: partnerCost, savWk: savWk * days / 7, DR, DC, FR, forecastCost: FR * (1 - mf) - savWk * days / 7, deferred }, cash, rel,
      km: { total: totalKm + EX, empty: emptyKm, extra: EX, rate: er },
      counts: { onTime, n: nCount, F, planned, covered }, rec: resolvedTrucks, chk: LB['4490'].chosen ? { TRK027: applied[LB['4490'].chosen.k].t } : {}
    };
  }

  // Everything the planning screens need, cached per state.
  planner() {
    const s = this.state, PD = this.pdata();
    const idleN = Object.keys(s.training || {}).filter((n) => (s.training[n] || {}).course === 'Idle reduction').length;
    const doneKeys = {}; ['opp0', 'opp1', 'opp2', 'opp3', 'opp4', 'opp5', 'sample0', 'sample1', 'sample2', 'rec0', 'rec1', 'rec3', 'reprice'].forEach((k) => { if ((s.done || {})[k]) doneKeys[k] = true; });
    const svc = {}; Object.keys(s.service || {}).forEach((k) => { if (s.service[k]) svc[k] = true; });
    const base = { dis: s.dis || {}, applied: s.applied || {}, done: doneKeys, horizon: s.horizon || 7, idleN, unavail: s.unavail || {}, svc, flags: s.flags || {} };
    const key = JSON.stringify(base);
    if (this._pl && this._pl.key === key) return this._pl;
    const E = (patch) => this.engine(Object.assign({}, base, patch));
    const cur = E({});
    const freeBlk = (o, st) => o.freeTruck && ((st.used[o.freeTruck] && st.used[o.freeTruck].indexOf('4620') !== 0) || !st.LB[o.after] || st.LB[o.after].conflict || st.LB[o.after].partner || st.LB[o.after].newTruck);
    const without = (appl, k) => { const a = Object.assign({}, appl); delete a[k]; return a; };
    const needs = (l) => l.issue && (l.risk || (!l.chosen && (l.status === 'Rescheduled' || l.issue.dis)));
    const open = cur.loads.filter((l) => l.risk && l.issue).sort((a, b) => a.issue.act - b.issue.act);
    // st: state used for feasibility (without this load's current decision); ref: its applied set; cmp: state to measure against.
    const evalOpt = (st, ref, cmp, k) => {
      const o = PD.O[k];
      let block = o.inf || '';
      if (!block && o.truck && st.used[o.truck]) block = st.used[o.truck] === 'unavailable' ? o.truck + ' has been removed from the plan.' : o.truck + ' is already committed' + (st.used[o.truck].indexOf('scenario') === 0 ? ' in this scenario.' : ' by an approved decision for #' + st.used[o.truck].split(':')[0] + '.');
      if (!block && o.shopTruck && (base.unavail || {})[o.shopTruck]) block = o.shopTruck + ' has been removed from the plan.';
      if (!block && freeBlk(o, st)) block = o.freeTruck + ' is not available after #' + o.after + ' (it is committed elsewhere or #' + o.after + ' has changed).';
      if (!block && o.oncall && !st.onCallFree.length) block = 'No on-call driver left. All 3 are committed by approved decisions.';
      if (!block && o.combine && st.LB[o.combine] && st.LB[o.combine].conflict) block = '#' + o.combine + ' has no truck, so it cannot carry this order.';
      if (block) return { k, o, block };
      const after = E({ applied: Object.assign({}, ref, { [k]: { t: 9e15 } }), done: st.doneRef });
      const l1 = after.LB[o.no];
      const newRisk = after.loads.filter((x) => x.no !== o.no && x.risk && !(cmp.LB[x.no] && cmp.LB[x.no].risk)).map((x) => x.no);
      const sideEmpty = o.side.filter((sd) => sd.empty).reduce((a, sd) => a + sd.empty, 0);
      const dProfit = after.fin.profit - cmp.fin.profit;
      const score = (l1.onTime ? 1000 : 0) + (l1.status === 'Rescheduled' ? 300 : 0) - newRisk.length * 800 + dProfit / 10 - (o.empty + sideEmpty) * 0.05 - (o.decline ? 600 : 0);
      return { k, o, after, l1, newRisk, sideEmpty, dProfit, score, dOtd: after.m.otd - cmp.m.otd, dMargin: after.m.margin - cmp.m.margin, dEmpty: after.m.empty - cmp.m.empty, dCover: after.m.cover - cmp.m.cover };
    };
    const optsFor = (stNow, appl, doneX, l) => {
      let ref = appl, st = stNow;
      if (l.chosen) { ref = without(appl, l.chosen.k); st = E({ applied: ref, done: doneX }); }
      st.doneRef = doneX;
      return Object.keys(PD.O).filter((k) => PD.O[k].no === l.no && !(l.chosen && l.chosen.k === k)).map((k) => evalOpt(st, ref, stNow, k));
    };
    const pickBest = (list) => list.filter((x) => !x.block).sort((a, b) => b.score - a.score)[0] || null;
    const options = {}, recommended = {};
    cur.loads.filter(needs).forEach((l) => { const list = optsFor(cur, base.applied, doneKeys, l); options[l.no] = list; const b = pickBest(list); if (b) recommended[l.no] = b.k; });
    // Best case: every open issue resolved with its best response, every lever applied.
    let bApplied = Object.assign({}, base.applied), t = 1e15;
    const allDone = Object.assign({}, doneKeys); PD.GL.forEach((g) => g.keys.forEach((k) => { allDone[k] = true; }));
    for (let pass = 0; pass < 3; pass++) {
      const st = E({ applied: bApplied, done: allDone });
      const left = st.loads.filter((l) => l.risk && l.issue).sort((a, b) => a.issue.act - b.issue.act);
      if (!left.length) break;
      left.forEach((l) => { const stx = E({ applied: bApplied, done: allDone }); const lx = stx.LB[l.no]; if (!lx.risk) return; const b = pickBest(optsFor(stx, bApplied, allDone, lx)); if (b) { if (lx.chosen) bApplied = without(bApplied, lx.chosen.k); bApplied[b.k] = { t: t++ }; } });
    }
    const best = E({ applied: bApplied, done: allDone });
    // Levers: their effect on the current plan
    const levers = PD.GL.map((g) => {
      const isDone = g.keys.every((k) => doneKeys[k]);
      const d2 = Object.assign({}, doneKeys); g.keys.forEach((k) => { d2[k] = true; });
      const after = E({ done: d2 });
      return Object.assign({}, g, { isDone, dOtd: after.m.otd - cur.m.otd, dMargin: after.m.margin - cur.m.margin, dEmpty: after.m.empty - cur.m.empty, dProfit: after.fin.profit - cur.fin.profit });
    });
    // Scenario comparison
    const disKeys = Object.keys(base.dis).filter((k) => base.dis[k]);
    const noDisApplied = {}; Object.keys(base.applied).forEach((k) => { if (!base.applied[k].dis) noDisApplied[k] = base.applied[k]; });
    const plan0 = E({ dis: {}, applied: noDisApplied });
    const noResp = E({ applied: noDisApplied });
    const start = E({ dis: {}, applied: {}, done: {} });
    // ---- 30/60/90-day targets: every state below runs through the same engine and the same trajectory
    const B = this.base(), TD = this.tdata();
    const merge = (p, q) => ({ done: Object.assign({}, p.done || base.done, q.done || {}), svc: Object.assign({}, p.svc || base.svc, q.svc || {}), flags: Object.assign({}, p.flags || base.flags, q.flags || {}), idleN: Math.max(p.idleN != null ? p.idleN : base.idleN, q.idleN || 0), applied: q.applied || p.applied || base.applied });
    const tCache = {};
    const TJ = (patch) => { const p = patch || {}; const k = JSON.stringify(p); if (tCache[k]) return tCache[k]; const cfg = Object.assign({}, base, p); const e7 = base.horizon === 7 && !Object.keys(p).length ? cur : this.engine(Object.assign({}, cfg, { horizon: 7 })); const r = { e7, t: this.traj(e7, cfg), cfg }; tCache[k] = r; return r; };
    const tcur = TJ({}).t, tstart = this.traj(this.engine({ dis: {}, applied: {}, done: {}, horizon: 7, idleN: 0, unavail: {}, svc: {}, flags: {} }), { dis: {}, applied: {}, done: {}, idleN: 0, unavail: {}, svc: {}, flags: {} });
    const svcAll = {}; B.trucks.forEach((t) => { if (t.status !== 'shop' && (t.predicted || t.next < 0)) svcAll[t.id] = true; });
    const pkgPatch = (pk) => ({ done: Object.assign({}, base.done, ...(pk.done || []).map((k) => ({ [k]: true }))), svc: pk.service ? Object.assign({}, base.svc, svcAll) : base.svc, flags: Object.assign({}, base.flags, pk.flags || {}), idleN: pk.training ? Math.max(base.idleN, B.idleNames.length) : base.idleN });
    const pkgApplied = (pk) => (pk.done || []).every((k) => base.done[k]) && (!pk.service || Object.keys(svcAll).every((k) => base.svc[k])) && (!pk.training || base.idleN >= B.idleNames.length) && Object.keys(pk.flags || {}).every((k) => base.flags[k]);
    // Today's decisions as one action: every open load gets its recommended response (checked in deadline order)
    let rApplied = Object.assign({}, base.applied), rt = 1e15;
    for (let pass = 0; pass < 3; pass++) { const st = E({ applied: rApplied }); const left = st.loads.filter((l) => l.risk && l.issue).sort((a, b) => a.issue.act - b.issue.act); if (!left.length) break; let moved = false; left.forEach((l) => { const stx = E({ applied: rApplied }); const lx = stx.LB[l.no]; if (!lx.risk) return; const bb = pickBest(optsFor(stx, rApplied, doneKeys, lx)); if (bb) { if (lx.chosen) rApplied = without(rApplied, lx.chosen.k); rApplied[bb.k] = { t: rt++ }; moved = true; } }); if (!moved) break; }
    const nResp = Object.keys(rApplied).length - Object.keys(base.applied).length;
    const acts = [];
    if (nResp > 0) acts.push({ id: 'R:today', label: 'Approve today\'s ' + nResp + ' recommended response' + (nResp === 1 ? '' : 's'), what: 'One response for each load that is late, uncovered or in conflict, in deadline order.', lead: 'Decide before the first deadline today (' + this.fmtT(open[0] ? open[0].issue.act : PD.N0) + ').', patch: { applied: rApplied }, keys: Object.keys(rApplied).filter((k) => !base.applied[k]) });
    TD.packages.forEach((pk) => { if (!pkgApplied(pk)) acts.push(Object.assign({}, pk, { patch: pkgPatch(pk) })); });
    const dOf = (t) => { const o = {}; TD.measures.forEach((m) => { o[m.k] = t.w.map((w, i) => w[m.k] - tcur.w[i][m.k]); }); return o; };
    acts.forEach((a) => { const r = TJ(a.patch); a.t = r.t; a.e7 = r.e7; a.d = dOf(r.t); a.dProfit = r.t.w.map((w, i) => w.profit - tcur.w[i].profit); a.dCash = r.t.w.map((w, i) => w.cash - tcur.w[i].cash); });
    const tBest = {}, tBestActs = {};
    TD.measures.forEach((m) => {
      const good = acts.filter((a) => a.d[m.k].some((x) => (m.up ? x : -x) > 1e-6));
      let p = {}; good.forEach((a) => { p = merge(p, a.patch); });
      const r = good.length ? TJ(p).t : tcur;
      tBest[m.k] = r.w.map((w, i) => (m.up ? Math.max(w[m.k], tcur.w[i][m.k]) : Math.min(w[m.k], tcur.w[i][m.k])));
      tBestActs[m.k] = good.map((a) => a.id);
    });
    this._pl = { base, key, tcur, tstart, tActs: acts, tBest, tBestActs, TJ, pkgApplied, svcAll, cur, best, open, options, recommended, levers, plan0, noResp, disKeys, start };
    return this._pl;
  }

  scrollTo(id) { setTimeout(() => { try { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* no-op */ } }, 80); }

  // Approval: the only way a response changes the plan.
  approve(k) {
    const PD = this.pdata(), o = PD.O[k]; if (!o) return;
    const pl = this.planner(), cur = pl.cur, l = cur.LB[o.no];
    const list = pl.options[o.no] || []; const ev = list.filter((x) => x.k === k)[0];
    if (!ev || ev.block || !l) return;
    const recK = pl.recommended[o.no];
    const others = list.filter((x) => x.k !== k);
    const rationale = this.why(ev, l, recK === k);
    const tradeoffs = others.map((x) => x.block ? x.o.label + ': not feasible. ' + x.block : x.o.label + ': ' + this.vs(ev, x)).join(' ');
    const isDis = !!(l.issue && l.issue.dis);
    const stamp = this.stamp(), planT = this.fmtT(this.planNowM()), oldK = l.chosen ? l.chosen.k : null;
    this.actOnce((p) => { const a = p.applied || {}; return !!a[k] || (oldK ? !a[oldK] : false) || Object.keys(a).some((x) => x !== oldK && PD.O[x] && PD.O[x].no === o.no); }, (p) => ({
      applied: Object.assign((() => { const a = Object.assign({}, p.applied); if (oldK) delete a[oldK]; return a; })(), { [k]: { t: Date.now(), dis: isDis || !!(oldK && (p.applied[oldK] || {}).dis) } }), pend: null, cmp: o.no,
      decisions: [{ t: stamp, planT, k, no: o.no, cust: l.cust, label: o.label, rec: recK === k, rationale: (oldK ? 'Replans an earlier decision (' + PD.O[oldK].label + ') that no longer meets the commitment. ' : '') + rationale, tradeoffs, effect: 'On-time ' + this.sgn(ev.dOtd, 1, ' pts') + ' • margin ' + this.sgn(ev.dMargin, 2, ' pts') + ' • empty km ' + this.sgn(ev.dEmpty, 2, ' pts'), cause: l.issue ? l.issue.cause : '' }].concat(p.decisions || []),
      demo: p.demo === 5 ? 6 : p.demo
    }), 'Approved for Load #' + o.no + ' (' + l.cust + '): ' + o.label, 'good');
  }
  // Apply a change only if guard(prev) is false; logs and toasts only when it applies (prevents double application).
  actOnce(guard, patchFn, text, kind) {
    this.setState((p) => {
      if (guard(p)) return {};
      const patch = patchFn(p);
      const log = [{ t: this.stamp(), text, kind: kind || 'info' }].concat(p.log || []).slice(0, 40);
      return Object.assign({}, patch, { log, toast: text });
    });
  }
  approveMany(keys, why) {
    const PD = this.pdata(), pl = this.planner(), base = pl.base;
    let applied = Object.assign({}, base.applied), t = Date.now();
    const recs = [], stamp = this.stamp(), planT = this.fmtT(this.planNowM());
    keys.forEach((k) => {
      const o = PD.O[k]; if (!o) return;
      const st = this.engine(Object.assign({}, base, { applied })), l = st.LB[o.no];
      if (!l || !l.risk || o.inf || (o.truck && st.used[o.truck]) || (o.oncall && !st.onCallFree.length)) return;
      const after = this.engine(Object.assign({}, base, { applied: Object.assign({}, applied, { [k]: { t: 9e15 } }) }));
      if (l.chosen) { applied = Object.assign({}, applied); delete applied[l.chosen.k]; }
      applied = Object.assign({}, applied, { [k]: { t: t++, dis: !!(l.issue && l.issue.dis) } });
      const l1 = after.LB[o.no];
      recs.push({ t: stamp, planT, k, no: o.no, cust: l.cust, label: o.label, rec: true, cause: l.issue ? l.issue.cause : '', rationale: (why || 'Auto-reroute.') + ' ' + (l1.onTime ? 'Keeps the ' + this.fmtT(l.due) + ' delivery (arrives ' + this.fmtT(l1.eta) + ')' : l1.status === 'Rescheduled' ? 'Agrees a new time of ' + this.fmtT(l1.eta) : 'Best available response') + '; profit ' + this.sgnMoney(after.fin.profit - st.fin.profit) + '.', tradeoffs: 'Approved together with the other breakdown recoveries; each was checked against the trucks and on-call drivers already committed.', effect: 'On-time ' + this.sgn(after.m.otd - st.m.otd, 1, ' pts') + ' • margin ' + this.sgn(after.m.margin - st.m.margin, 2, ' pts') });
    });
    if (!recs.length) return;
    const sig = JSON.stringify(Object.keys(base.applied).sort());
    this.actOnce((p) => JSON.stringify(Object.keys(p.applied || {}).sort()) !== sig, (p) => ({ applied, autoPend: false, decisions: recs.slice().reverse().concat(p.decisions || []) }), 'Auto-reroute approved for ' + recs.length + ' load' + (recs.length === 1 ? '' : 's') + ': ' + recs.map((d) => '#' + d.no).join(', '), 'good');
  }
  approveLever(g) {
    const pl = this.planner(), lv = pl.levers.filter((x) => x.k === g)[0]; if (!lv || lv.isDone) return;
    const stamp = this.stamp(), planT = this.fmtT(this.planNowM());
    this.actOnce((p) => lv.keys.every((k) => (p.done || {})[k]), (p) => { const d = Object.assign({}, p.done); lv.keys.forEach((k) => { d[k] = true; }); if (g === 'G:routes') d.runFull = true; return { done: d, pend: null, decisions: [{ t: stamp, planT, k: g, no: '—', cust: 'Network', label: lv.label, rec: true, rationale: 'Network-wide change. Expected effect over the planning period: margin ' + this.sgn(lv.dMargin, 2, ' pts') + ', empty km ' + this.sgn(lv.dEmpty, 2, ' pts') + ', on-time ' + this.sgn(lv.dOtd, 2, ' pts') + '.', tradeoffs: 'No load-level conflicts. Applies from the next dispatch cycle.', effect: 'Profit ' + this.sgnMoney(lv.dProfit) }].concat(p.decisions || []) }; }, 'Approved: ' + lv.label, 'good');
  }
  sgn(v, d, u) { const r = Math.abs(v) < Math.pow(10, -d) / 2 ? 0 : v; return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r).toFixed(d) + (u || ''); }
  sgnMoney(v) { const r = Math.round(v); return (r > 0 ? '+$' : r < 0 ? '−$' : '$') + Math.abs(r).toLocaleString('en-US'); }
  planNowM() { return this.pdata().N0 + Math.floor((Date.now() - (this.state.startMs || Date.now())) / 60000); }
  why(ev, l, isRec) {
    const o = ev.o, l1 = ev.l1, parts = [];
    if (l1.onTime) parts.push('Keeps the ' + this.fmtT(l.due) + ' delivery (arrives ' + this.fmtT(l1.eta) + ')');
    else if (l1.status === 'Rescheduled') parts.push('Agrees a new delivery time of ' + this.fmtT(l1.eta) + ' with ' + l.cust + ' instead of missing the window');
    else if (l1.status === 'Declined') parts.push('Declines the order, so no commitment is missed');
    else parts.push('Delivery is still predicted late');
    parts.push('profit ' + this.sgnMoney(ev.dProfit) + ' against doing nothing');
    if (o.empty + ev.sideEmpty) parts.push((o.empty + ev.sideEmpty) + ' extra empty km');
    if (o.backhaul) parts.push('return load #4615 fills the trip back to Toronto');
    parts.push(ev.newRisk.length ? 'puts #' + ev.newRisk.join(', #') + ' at risk' : 'no other customer commitment is affected');
    return (isRec ? 'Recommended. ' : 'Chosen over the recommendation. ') + parts.join('; ') + '.';
  }
  vs(a, b) {
    const t = [];
    if (b.l1.onTime !== a.l1.onTime) t.push(b.l1.onTime ? 'on time' : b.l1.status === 'Rescheduled' ? 'delivery moved to ' + this.fmtT(b.l1.eta) : 'late');
    const dp = b.dProfit - a.dProfit; if (Math.abs(dp) >= 20) t.push(this.sgnMoney(dp) + ' profit');
    const de = (b.o.empty + b.sideEmpty) - (a.o.empty + a.sideEmpty); if (de) t.push((de > 0 ? '+' : '−') + Math.abs(de) + ' empty km');
    if (b.newRisk.length) t.push('puts #' + b.newRisk.join(', #') + ' at risk');
    return (t.length ? t.join(', ') : 'similar outcome') + '.';
  }

  // ---------- Downloads ----------
  async saveFile(filename, data) {
    // Real browser download. If the browser blocks it, show the contents on the page instead.
    try {
      const type = /\.html?$/i.test(filename) ? 'text/html' : /\.csv$/i.test(filename) ? 'text/csv' : 'text/plain';
      const url = URL.createObjectURL(new Blob([data], { type: type + ';charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      this.act(() => ({ dl: null }), 'Downloaded ' + filename, 'info');
    } catch (e) {
      this.setState({ dl: { name: filename, data } });
    }
  }

  // ================= 30 / 60 / 90-DAY TARGETS: one trajectory built from the same model =================
  // Day 0 = Tue Jan 20 (demo start). Days 1-7 come from the detailed 7-day plan; days 8-90 extend the same
  // operation with demand growth, fleet capacity, breakdown risk and the network changes in force.
  tdata() {
    if (this._td) return this._td;
    const PD = this.pdata();
    const TG = this.clone(this.props.data.targets);
    const T = Object.assign({}, TG.params, { growth: TG.params.growthPerMonth / 30, revDay: PD.WEEK_REV / 7, revLoad: PD.WEEK_REV / 7 / TG.params.D0, measures: TG.measures, packages: TG.packages });
    delete T.growthPerMonth;
    this._td = T;
    return T;
  }

  // Expected extra roadside breakdowns per day (above the routine level already in the base rates).
  fleetRisk(cfg) {
    const B = this.base(), T = this.tdata(), svc = cfg.svc || {}, un = cfg.unavail || {}, done = cfg.done || {};
    const b = new Array(91).fill(0), causes = { predicted: 0, overdue: 0, aging: 0 };
    B.trucks.forEach((t) => {
      if (un[t.id] || t.status === 'shop') return;
      if (t.predicted && !svc[t.id]) { const d = Math.max(8, Math.min(90, t.predicted.days)); b[d] += T.pFail; causes.predicted += T.pFail; }
      if (t.next < 0 && !svc[t.id]) for (let d = 8; d <= 90; d++) { b[d] += 0.01; causes.overdue += 0.01; }
    });
    for (let d = 8; d <= 90; d++) { if (!(done.rec1 && d > 30)) { b[d] += 0.02; causes.aging += 0.02; } }
    return { b, causes };
  }

  // Cash: one schedule shared by the 7-day plan and the 90-day trajectory.
  cashFlow(cfg, cashNow, partnerPay, revByDay, extra) {
    const PD = this.pdata(), F = PD.FIN, T = this.tdata(), N0 = PD.N0, dis = cfg.dis || {}, fl = cfg.flags || {}, done = cfg.done || {};
    const at = (d) => d * 1440 + 540, ev = [];
    const late = dis.payment ? PD.DIS.payment : null;
    F.ar.forEach((a) => { const isLate = !!(late && a.id === late.invoice); ev.push({ t: a.t + (isLate ? late.delayDays * 1440 : 0), kind: 'in', id: a.id, party: a.party, amt: a.amt, late: isLate }); });
    F.ap.forEach((a) => ev.push({ t: a.t, kind: 'out', id: a.id, party: a.party, amt: a.amt }));
    // Cumulative revenue, day 0 = today; before today the operation ran at the base daily revenue.
    const rc = [0]; for (let d = 1; d <= 90; d++) rc[d] = rc[d - 1] + (revByDay && revByDay[d] != null ? revByDay[d] : T.revDay * (1 + T.growth * d));
    const Rc = (x) => (x <= 0 ? T.revDay * x : rc[Math.min(90, x)]);
    const lagB = (d) => (fl.collections && d >= 8 ? 20 : 30);
    const vol = (d) => 1 + T.growth * d, sav = (cfg.savWk || 0) / 7;
    for (let d = 8; d <= 90; d++) {
      const a = 0.52 * (Rc(d - 30) - Rc(d - 31)), bpart = 0.48 * (Rc(d - lagB(d)) - Rc(d - 1 - lagB(d - 1))) * (fl.collections && d >= 8 ? 0.99 : 1);
      ev.push({ t: at(d), kind: 'in', id: 'AR-D' + d, party: 'Customer receipts', amt: a + bpart, steady: true });
    }
    for (let d = 1; d <= 90; d++) ev.push({ t: at(d) + 600, kind: 'out', id: 'OPS-D' + d, party: 'Tolls, maintenance, insurance and admin', amt: 13500 * vol(d) - (d >= 8 ? sav : 0), steady: true });
    [16, 30, 44, 58, 72, 86].forEach((d) => ev.push({ t: at(d), kind: 'out', id: 'Northway Fuel', party: 'Diesel (bi-weekly)', amt: 216000 * vol(d) * (d > 15 ? 1 - 0.0012 * (cfg.idleN || 0) : 1), steady: true }));
    [17, 31, 45, 59, 73, 87].forEach((d) => ev.push({ t: at(d), kind: 'out', id: 'Payroll', party: 'Driver and staff payroll', amt: 162300 * vol(d) * (done.rec3 ? 0.985 : 1), steady: true }));
    [36, 66].forEach((d) => ev.push({ t: at(d), kind: 'out', id: 'Equipment leases', party: 'Tractor and trailer leases', amt: 96500 + (done.rec1 ? 2100 : 0), steady: true }));
    [31, 61].forEach((d) => ev.push({ t: at(d), kind: 'out', id: 'Lakeshore Truck Service', party: 'Shop repairs (monthly)', amt: 24600 * (done.rec1 ? 0.8 : 1), steady: true }));
    [25, 55, 85].forEach((d) => ev.push({ t: at(d), kind: 'out', id: 'Equipment loan', party: 'Loan principal (not an expense)', amt: 60000, steady: true }));
    ev.push({ t: at(70), kind: 'out', id: 'Insurance', party: 'Annual fleet insurance premium', amt: 140000, steady: true });
    // One-off cash from approved target scenarios
    if (cfg.idleN) ev.push({ t: at(1), kind: 'out', id: 'Training', party: 'Idle-reduction training (' + cfg.idleN + ' drivers)', amt: cfg.idleN * T.trainCost });
    const nSvc = Object.keys(cfg.svc || {}).filter((k) => (cfg.svc || {})[k]).length;
    if (nSvc) ev.push({ t: at(1), kind: 'out', id: 'Service bookings', party: nSvc + ' trucks serviced early', amt: nSvc * T.serviceCost });
    if (done.rec1) ev.push({ t: at(1), kind: 'out', id: 'Tractor deposit', party: 'Replacement for TRK006 (capital)', amt: T.deposit });
    if (fl.partnerCap) [33, 63].forEach((d) => ev.push({ t: at(d), kind: 'out', id: 'Quinte Freight', party: 'Dedicated partner trucks (monthly)', amt: 2 * T.partnerDay * 30 }));
    if (partnerPay) ev.push({ t: at(31), kind: 'out', id: 'Partner carriers', party: 'Subcontracted loads (30-day terms)', amt: partnerPay });
    const fr = this.fleetRisk(cfg); for (let d = 8; d <= 90; d++) if (fr.b[d] > 1e-9) ev.push({ t: at(d) + 300, kind: 'out', id: 'Roadside', party: 'Breakdown towing and repairs (expected)', amt: fr.b[d] * T.bdCost, steady: true });
    (extra || []).forEach((e) => ev.push(e));
    ev.sort((a, b) => a.t - b.t || (a.kind === 'in' ? -1 : 1));
    const open = F.opening, start = open - (cashNow || 0);
    let bal = start; ev.forEach((e) => { bal += e.kind === 'in' ? e.amt : -e.amt; e.bal = bal; });
    const balAt = (t) => { let b = start; for (const e of ev) { if (e.t > t) break; b = e.bal; } return b; };
    const summary = (from, to) => {
      let min = balAt(from), minT = from, cin = 0, cout = 0, last = min;
      ev.forEach((e) => { if (e.t <= from || e.t > to) return; if (e.kind === 'in') cin += e.amt; else cout += e.amt; last = e.bal; if (e.bal < min) { min = e.bal; minT = e.t; } });
      return { opening: open, start: balAt(from), now: cashNow || 0, collections: cin, payments: cout, closing: last, min, minT };
    };
    return { ev, summary, start };
  }

  // 90-day trajectory for one state of the model. e7 = the detailed plan at a 7-day horizon for the same state.
  traj(e7, cfg) {
    const T = this.tdata(), B = this.base(), PD = this.pdata(), done = cfg.done || {}, fl = cfg.flags || {}, un = cfg.unavail || {};
    const nOpp = ['opp0', 'opp1', 'opp2', 'opp3', 'opp4', 'opp5'].filter((k) => done[k]).length, nSamp = ['sample0', 'sample1', 'sample2'].filter((k) => done[k]).length;
    const lpt = T.lpt * (1 + 0.03 * nOpp / 6 + 0.01 * nSamp / 3 + (done.rec3 ? 0.01 : 0));
    const removed = Object.keys(un).filter((k) => un[k] && B.byId[k]).length;
    const spares = B.trucks.filter((t) => t.status === 'idle' && !un[t.id] && !e7.used[t.id]).length, onCall = e7.onCallFree.length;
    const lExc = spares >= 2 && onCall >= 2 ? T.lExc : T.lExcTight;
    const excDay = T.excDay * (done.rec3 ? 0.9 : 1);
    const er = 0.1035 - 0.0015 * nOpp - 0.001 * nSamp - (done.rec0 ? 0.003 : 0);
    const savDay = ((nOpp ? [85, 81, 76, 76, 76, 75].slice(0, 6).reduce((a, g, i) => a + (done['opp' + i] ? g : 0), 0) : 0) + [665, 435, 435].reduce((a, g, i) => a + (done['sample' + i] ? g : 0), 0) + (done.rec0 ? 847 : 0) + (done.rec1 ? 485 : 0) + (done.rec3 ? 1200 : 0) + (done.reprice ? 2100 : 0)) / 7;
    const idleDay = (cfg.idleN || 0) * 20 / 7;
    const fr = this.fleetRisk(cfg), mf = PD.MF;
    const days = []; const revByDay = []; const extra = [];
    for (let d = 1; d <= 90; d++) {
      if (d <= 7) { days.push(null); revByDay[d] = e7.fin.rev / 7; continue; }
      const D = T.D0 * (1 + T.growth * d) * (done.reprice ? 0.99 : 1);
      const bd = fr.b[d];
      const A = 50 - T.shopAvg - removed - bd * 2 + (done.rec1 && d > 30 ? 0.5 : 0);
      const cap = A * lpt + (fl.partnerCap && d >= 3 ? 2 : 0);
      const served = Math.min(D, cap), unc = D - served, own = Math.min(served, A * lpt);
      const late = served * (1 - T.rBase) + excDay * lExc + bd * T.lBd + unc * 0.4;
      const rev = D * T.revLoad * (done.reprice ? 1.018 : 1);
      const cost = served * T.revLoad * (done.reprice ? 1.018 : 1) * (1 - mf) + unc * (T.revLoad + 150) + bd * T.bdCost + (bd * T.lBd + unc * 0.4) * T.penalty
        - savDay - (d >= 15 ? idleDay : 0) + (fl.partnerCap && d >= 3 ? 2 * T.partnerDay : 0) + (done.rec1 && d > 30 ? 70 : 0) + (fl.collections ? 0.01 * 0.48 * rev : 0);
      const km = T.kmDay * (D / T.D0), ekm = km * er + bd * 150;
      revByDay[d] = rev;
      if (unc > 1e-9) extra.push({ t: (d + 30) * 1440 + 540, kind: 'out', id: 'Spot carriers', party: 'Uncovered loads (premium over own cost)', amt: unc * (T.revLoad * mf + 150), steady: true });
      days.push({ d, D, served, own, unc, late, rev, cost, km, ekm, bd, cap });
    }
    const cf = this.cashFlow(cfg, e7.cash.now, e7.fin.partnerPay, revByDay, extra);
    const N7 = e7.counts.n + e7.counts.F, N0 = PD.N0;
    const win = (a, b) => {
      let loads = 0, late = 0, rev = 0, cost = 0, km = 0, ekm = 0, D = 0, served = 0, own = 0, bd = 0, unc = 0, capMin = 1e9;
      if (a === 1) { loads += N7; late += N7 * (1 - e7.m.otd / 100); rev += e7.fin.rev; cost += e7.fin.cost; km += e7.km.total; ekm += e7.km.empty; D += 7 * T.D0; served += 7 * T.D0 * e7.m.cover / 100; own += 7 * T.utilDen * e7.m.util / 100; }
      for (let d = Math.max(a, 8); d <= b; d++) { const x = days[d - 1]; loads += x.D; late += x.late; rev += x.rev; cost += x.cost; km += x.km; ekm += x.ekm; D += x.D; served += x.served; own += x.own; bd += x.bd; unc += x.unc; capMin = Math.min(capMin, x.cap); }
      const c = cf.summary(N0 + (a - 1) * 1440, N0 + b * 1440);
      return { otd: (1 - late / loads) * 100, margin: (rev - cost) / rev * 100, empty: ekm / km * 100, cover: served / D * 100, util: own / ((b - a + 1) * T.utilDen) * 100, cash: c.min / 1000,
        loads, late, rev, cost, profit: rev - cost, km, ekm, bd, unc, demandEnd: days[b - 1] ? days[b - 1].D : T.D0, capEnd: days[b - 1] ? days[b - 1].cap : 0, cashT: c.minT, cashClose: c.closing, collections: c.collections, payments: c.payments };
    };
    const w = [win(1, 30), win(31, 60), win(61, 90)];
    return { w, lpt, spares, onCall, lExc, er, risk: fr.causes, cash: cf, removed };
  }

  // Approve and apply a target scenario. Applies once; records the decision with its 30/60/90-day effect.
  approvePackage(id) {
    const TD = this.tdata(), B = this.base(), pl = this.planner(), pk = TD.packages.filter((p) => p.id === id)[0];
    const act = pl.tActs.filter((a) => a.id === id)[0];
    if (!pk || !act) return;
    const svcAll = pl.svcAll, stamp = this.stamp(), planT = this.fmtT(this.planNowM());
    const eff = TD.measures.map((m) => m.label + ' ' + act.d[m.k].map((x, i) => [30, 60, 90][i] + 'd ' + (m.k === 'cash' ? (x >= 0 ? '+$' : '−$') + Math.round(Math.abs(x) * 1000).toLocaleString('en-US') : this.sgn(x, m.k === 'otd' || m.k === 'cover' || m.k === 'util' ? 1 : 2, ' pts'))).join(', ')).join('; ');
    const trade = TD.measures.filter((m) => act.d[m.k].some((x) => (m.up ? x : -x) < -(m.k === 'cash' ? 0.05 : 0.005))).map((m) => m.label.toLowerCase()).join(', ');
    this.actOnce((p) => {
      const d = p.done || {}, sv = p.service || {}, tr = p.training || {}, fl = p.flags || {};
      return (pk.done || []).every((k) => d[k]) && (!pk.service || Object.keys(svcAll).every((k) => sv[k])) && (!pk.training || B.idleNames.every((n) => tr[n])) && Object.keys(pk.flags || {}).every((k) => fl[k]);
    }, (p) => {
      const d = Object.assign({}, p.done); (pk.done || []).forEach((k) => { d[k] = true; }); if (pk.done && pk.done.indexOf('opp0') >= 0) d.runFull = true;
      const sv = Object.assign({}, p.service); if (pk.service) Object.keys(svcAll).forEach((k) => { sv[k] = true; });
      const tr = Object.assign({}, p.training); if (pk.training) B.idleNames.forEach((n) => { if (!tr[n]) tr[n] = { course: 'Idle reduction', at: stamp }; });
      return { done: d, service: sv, training: tr, flags: Object.assign({}, p.flags, pk.flags || {}), pend: null,
        decisions: [{ t: stamp, planT, k: id, no: '—', cust: 'Network', label: pk.label + ': ' + pk.what, rec: true, cause: 'Target scenario approved to close gaps against the 30, 60 and 90-day targets.', rationale: 'Expected effect against the current plan: ' + eff + '. Cost: 30-day profit ' + this.sgnMoney(act.dProfit[0]) + ', lowest cash in 30 days ' + (act.dCash[0] >= 0 ? '+$' : '−$') + Math.round(Math.abs(act.dCash[0]) * 1000).toLocaleString('en-US') + '. ' + pk.lead, tradeoffs: trade ? 'Makes ' + trade + ' worse in at least one period.' : 'No target gets worse.', effect: '30-day profit ' + this.sgnMoney(act.dProfit[0]) + ' • 90-day profit ' + this.sgnMoney(act.dProfit[2]) }].concat(p.decisions || []) };
    }, 'Approved and applied: ' + pk.label, 'good');
  }

  // Ask Claude (the artifact's `sample` capability) a question, grounded only in the current demo figures.
  async askAI(q, contextFn) {
    if (!q) return;
    this.setState({ aiAns: { q, status: 'loading', text: '' } });
    try {
      // Plug in your own model by defining window.MONIFI_CONFIG.askAI(prompt) -> Promise<string> in index.html
      // (for example a call to your own backend or serverless function). Without it, the demo says AI is off.
      const hook = window.MONIFI_CONFIG && window.MONIFI_CONFIG.askAI;
      if (typeof hook !== 'function') throw { code: 'unavailable' };
      const prompt = 'You answer questions inside a trucking operations demo called Monifi. Use ONLY the data below; if the answer is not in the data, say so. Plain language, at most 120 words, cite the figures you use. Do not claim competitors cannot do things.\n\nDATA:\n' + contextFn() + '\n\nQUESTION: ' + q;
      const text = await hook(prompt);
      this.setState((p) => (p.aiAns && p.aiAns.q === q ? { aiAns: { q, status: 'done', text: String(text) } } : {}));
    } catch (e) {
      const code = (e && e.code) || 'unavailable';
      const msg = code === 'rate_limited' ? 'Too many questions at once. Try again in a moment.' : 'AI answers are not switched on in this copy of the demo. Answers above come from the demo model.';
      this.setState((p) => (p.aiAns && p.aiAns.q === q ? { aiAns: { q, status: 'error', text: msg } } : {}));
    }
  }

  renderVals() {
    const s = this.state;
    const G = this.geo(), B = this.base();
    const names = { 'Capabilities': 'caps', 'Dashboard': 'cc', 'KPIs': 'kpi', 'Asset Map': 'map', 'Fleet Status': 'fleet', 'Route Optimization': 'route', 'Scenario Planning': 'scen', 'Fuel & Costs': 'fuel', 'Labour Management': 'labour', 'Live Dispatch': 'dispatch', 'Freight Bidding': 'bid', 'Telematics': 'tele', 'Driver Development': 'driver', 'Safety & Compliance': 'safety', 'Reports': 'reports' };
    const page = s.page || names[this.props.startPage] || 'caps';
    const keys = ['caps', 'cc', 'kpi', 'map', 'fleet', 'route', 'scen', 'fuel', 'labour', 'dispatch', 'bid', 'tele', 'driver', 'safety', 'reports'];
    const is = {}, nav = {};
    keys.forEach((k) => { is[k] = page === k; nav[k] = { go: () => this.setState({ page: k, toast: '' }), bg: page === k ? 'rgba(108,179,227,.16)' : 'transparent', fg: page === k ? '#1d6fa5' : '#374151' }; });
    const go = (k, extra) => () => this.setState(Object.assign({ page: k, toast: '' }, extra || {}));
    const now = s.now || new Date(), nowMs = now.getTime(), nowS = nowMs / 1000;
    const PD0 = this.pdata();
    const startMs = s.startMs || nowMs, planClock = new Date(new Date(this.startDate().getTime() + PD0.N0 * 60000).getTime() + Math.max(0, nowMs - startMs));
    const clock = planClock.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    const clockDate = planClock.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    // ---------- The plan: one engine feeds every page ----------
    const PD = this.pdata(), PL = this.planner(), C = PL.cur;
    const nowM = PD0.N0 + Math.floor(Math.max(0, nowMs - startMs) / 60000);
    const TGT = {}; this.tdata().measures.forEach((m) => { TGT[m.k] = ((s.targets || {})[m.k] || m.def).slice(); });
    const goals = { otd: TGT.otd[0], margin: TGT.margin[0], empty: TGT.empty[0], cash: TGT.cash[0] }, days = s.horizon || 7;
    const review = (no) => () => { this.setState({ page: 'cc', cmp: no, pend: null, toast: '' }); this.scrollTo('compare'); };
    const loadOf = {}; PL.open.forEach((l) => { if (l.truck) loadOf[l.truck] = l.no; });
    const planTruck = {}; C.loads.forEach((l) => { if (l.kind === 'planned' && l.truck && !planTruck[l.truck]) planTruck[l.truck] = l.no; });
    const done = s.done || {}, rec = C.rec, chk = C.chk, trn = s.training || {}, svc = s.service || {}, sub = s.submitted || {};
    const money = (v) => v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'K' : '$' + Math.round(v);
    const fmtH = (h) => Math.floor(h) + 'h ' + String(Math.round((h % 1) * 60)).padStart(2, '0') + 'm';

    // ---------- Actions shared by many pages ----------
    // Recoveries are decisions: they open the response comparison and need approval.
    const recover = (bid) => review(B.byId[bid].load.slice(1));
    const recoverAll = () => { this.setState({ page: 'cc', toast: '' }); this.scrollTo('actions'); };
    const checkIn = review('4490');
    const bookService = (id, why) => () => { if ((this.state.service || {})[id]) return; this.act((p) => ({ service: Object.assign({}, p.service, { [id]: true }) }), 'Service booked for ' + id + (why ? ' (' + why + ')' : ''), 'good'); };
    const assignTraining = (list, course) => () => {
      const cur = this.state.training || {}; const fresh = list.filter((n) => !cur[n]);
      if (!fresh.length) return;
      this.act((p) => { const t = Object.assign({}, p.training); fresh.forEach((n) => { t[n] = { course, at: this.stamp() }; }); return { training: t }; }, course + ' training assigned to ' + (fresh.length === 1 ? fresh[0] : fresh.length + ' drivers'), 'good');
    };
    const contact = (name) => () => this.setState({ page: 'dispatch', dispatchTo: name || '', toast: '' });

    // ---------- Live fleet: 50 trucks with real positions ----------
    const kmBetween = (a, b) => { const la = (a[1] + b[1]) / 2 * Math.PI / 180; const dx = (b[0] - a[0]) * 111.32 * Math.cos(la), dy = (b[1] - a[1]) * 110.57; return Math.sqrt(dx * dx + dy * dy); };
    const along = (route, g) => {
      const Ls = [0]; for (let i = 1; i < route.length; i++) Ls.push(Ls[i - 1] + kmBetween(route[i - 1], route[i]));
      const tot = Ls[Ls.length - 1], dist = g * tot; let i = 1; while (i < Ls.length - 1 && Ls[i] < dist) i++;
      const a = route[i - 1], b = route[i], f = (dist - Ls[i - 1]) / ((Ls[i] - Ls[i - 1]) || 1);
      const qa = G.pj(a), qb = G.pj(b);
      return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], deg: Math.atan2(qb[1] - qa[1], qb[0] - qa[0]) * 180 / Math.PI, tot, dist };
    };
    const ST = { moving: ['#1d6fa5', 'In transit', 'rgba(29,111,165,.12)', '#1d4f91'], dock: ['#0e7490', 'At dock', 'rgba(14,116,144,.12)', '#0e7490'], idle: ['#d97706', 'Available', 'rgba(245,158,11,.14)', '#92400e'], shop: ['#7c3aed', 'In shop', 'rgba(124,58,237,.12)', '#6d28d9'], breakdown: ['#dc2626', 'Breakdown', 'rgba(239,68,68,.12)', '#b91c1c'], offline: ['#6b7280', 'Offline', '#eef0f3', '#374151'] };
    const GLYPH = { moving: 'M2 1.5 L8.5 5 L2 8.5 Z', dock: 'M2 4h6v2H2z M4 2h2v6H4z', idle: 'M3.5 3.5h3v3h-3z', shop: 'M3 3h4v4H3z', breakdown: 'M4.2 1.4h1.6v4.6H4.2z M4.2 7h1.6v1.6H4.2z', offline: 'M2 4.2h6v1.6H2z' };
    const selId = s.sel || 'TRK001';
    const tov = C.tov;
    const live = B.trucks.map((t, idx) => {
      let status = t.status, driver = t.driver, load = t.load, shipper = t.shipper, from = t.from, to = t.to, note = t.note, p = t.at, deg = 0, pct = 0, rem = 0, speed = 0;
      let route = t.route, once = false, t0 = 0, dur = 0, recovered = false, action = null, actionLabel = '', dwell = t.dwell;
      const ov = tov[t.id];
      if (ov) {
        if (ov.status) status = ov.status;
        if (ov.at) { p = ov.at; route = null; }
        if (ov.route) { route = ov.route; once = true; t0 = ov.t0; dur = ov.dur || 150000; }
        if (ov.driver !== undefined) driver = ov.driver;
        if (ov.load !== undefined) load = ov.load;
        if (ov.shipper) shipper = ov.shipper; if (ov.from) from = ov.from; if (ov.to) to = ov.to;
        if (ov.note) note = ov.note; if (ov.handled) recovered = true; if (ov.dwellAdd) dwell += ov.dwellAdd;
      }
      if (loadOf[t.id]) { action = review(loadOf[t.id]); actionLabel = 'Compare responses for #' + loadOf[t.id]; }
      if (route) {
        let g, fwd = true;
        if (once) g = Math.min(1, Math.max(0, (nowMs - t0) / dur));
        else { const cyc = ((nowS / t.period) + t.phase) % 1; fwd = cyc < 0.5; g = fwd ? cyc * 2 : 2 - cyc * 2; }
        const a = along(route, g); p = a.p; deg = Math.round(a.deg + (fwd ? 0 : 180));
        if (!fwd) { const x = from; from = to; to = x; }
        pct = fwd ? g : 1 - g; rem = fwd ? a.tot - a.dist : a.dist;
        speed = once && g >= 1 ? 0 : 88 + ((idx * 7 + Math.floor(nowS / 4) * 3) % 19);
        if (once && g >= 1) note = note + ' • arrived';
      }
      const st = ST[status], on = t.id === selId, pos = G.pc(p);
      const lane = status === 'idle' || status === 'shop' ? t.from : status === 'dock' ? note : from + ' → ' + to;
      const etaLabel = route ? 'ETA to ' + to : status === 'dock' ? 'Time at dock' : 'Status';
      const etaTxt = route ? (speed ? fmtH(rem / 85) + ' • ' + Math.round(rem) + ' km' : 'Arrived') : status === 'dock' ? fmtH(dwell / 60) : st[1];
      return {
        id: t.id, type: t.type, make: t.make + ' ' + t.year, status, driver, load, shipper, lane, from, to, l: pos.l, t: pos.t, deg,
        driverTxt: driver || 'No driver assigned', loadTxt: load ? load + ' • ' + shipper : (recovered ? 'Load handed over' : planTruck[t.id] ? 'Next: #' + planTruck[t.id] : 'No load'),
        color: st[0], statusLabel: st[1], pillBg: st[2], pillFg: st[3], glyph: GLYPH[status],
        anim: status === 'breakdown' && !recovered ? 'fcPulse 1.6s ease-in-out infinite' : 'none',
        ring: on ? '6px' : '0px', z: on ? 30 : (status === 'breakdown' || status === 'offline' ? 20 : 10),
        labelDisplay: on || (status === 'breakdown' && !recovered) || status === 'offline' || once ? 'block' : 'none', labelBd: on ? '#1d6fa5' : '#d5dae2',
        speedTxt: speed + ' km/h', etaLabel, etaTxt, pctTxt: Math.round(pct * 100) + '%', hasRoute: !!route,
        note, hasNote: !!note, rank: { breakdown: 0, offline: 1, dock: 3, idle: 4, shop: 5, moving: 2 }[status],
        rowBg: on ? 'rgba(108,179,227,.14)' : '#ffffff', rowBd: on ? '#6cb3e3' : '#eef0f3',
        aria: t.id + ', ' + st[1] + ', ' + lane,
        hasAction: !!action, action: action || (() => {}), actionLabel,
        pick: () => this.setState({ sel: t.id }), open: go('map', { sel: t.id }), pickGo: go('map', { sel: t.id }),
        diag: go('tele', { teleId: t.id }), contact: contact(driver), recovered, base: t, pos: p
      };
    });
    const LV = {}; live.forEach((t) => { LV[t.id] = t; });
    const cntS = (k) => live.filter((t) => t.status === k).length;
    const fc = { moving: cntS('moving'), dock: cntS('dock'), idle: cntS('idle'), shop: cntS('shop'), breakdown: cntS('breakdown'), offline: cntS('offline'), total: live.length };
    fc.active = fc.moving + fc.dock;
    const statusLegend = ['moving', 'dock', 'idle', 'shop', 'breakdown', 'offline'].map((k) => ({ color: ST[k][0], label: ST[k][1], count: fc[k] }));
    const selTruck = LV[selId] || live[0];
    const truckList = live.slice().sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1));
    const openBreak = Object.keys(B.plans).filter((id) => !rec[id]);

    // ---------- Drivers ----------
    const rebal = !!done.rec3;
    const usedOnCall = {}; C.onCallUsed.forEach((n) => { usedOnCall[n] = true; });
    const truckOf = {}; live.forEach((t) => { if (t.driver) truckOf[t.driver] = t; });
    const drv = B.drivers.map((d) => Object.assign({}, d, { ot: Math.round(d.ot * (rebal ? 0.7 : 1) * 10) / 10, truck: truckOf[d.name] || null, onRoute: !!truckOf[d.name], onCall: B.onCall.indexOf(d.name) >= 0 && !usedOnCall[d.name], tr: trn[d.name] || null }));
    const ds = { total: drv.length, onRoute: drv.filter((d) => d.onRoute).length, inOT: drv.filter((d) => d.ot > 0).length, lowSafety: drv.filter((d) => d.safety < 80).length, onCall: drv.filter((d) => d.onCall).length };
    ds.avgOT = (drv.reduce((a, d) => a + d.ot, 0) / drv.length).toFixed(1) + 'h';
    const idleTrained = drv.filter((d) => d.tr && d.tr.course === 'Idle reduction');
    const safetyTrained = drv.filter((d) => d.tr && d.tr.course === 'Safety refresher');

    // ---------- Effects of actions on company numbers ----------
    const oppGain = [85, 81, 76, 76, 76, 75], sampleWk = [665, 435, 435];
    const nOpp = oppGain.filter((g, i) => done['opp' + i]).length, nSamp = sampleWk.filter((g, i) => done['sample' + i]).length;
    const merged = !!done.rec0, replaced = !!done.rec1, nRec = Object.keys(rec).length, nChk = Object.keys(chk).length, nSvc = Object.keys(svc).length;
    const captWk = oppGain.reduce((a, g, i) => a + (done['opp' + i] ? g : 0), 0) + sampleWk.reduce((a, g, i) => a + (done['sample' + i] ? g : 0), 0) + (merged ? 847 : 0);
    const fuelCaptYr = idleTrained.reduce((a, d) => a + d.idle * 3.3 * 12 * 0.6, 0);
    const otCostWk = drv.reduce((a, d) => a + d.ot, 0) * 48;
    const otCostBase = B.drivers.reduce((a, d) => a + d.ot, 0) * 48;
    const DX = {
      empty: -(0.15 * nOpp + 0.1 * nSamp + (merged ? 0.3 : 0)),
      cpm: -(0.004 * nOpp + 0.002 * nSamp + (merged ? 0.006 : 0) + idleTrained.length * 0.0008 + (rebal ? 0.004 : 0) + (replaced ? 0.003 : 0)),
      mpg: 0.008 * idleTrained.length, maint: replaced ? -0.003 : 0, pm: 0.3 * nSvc, hos: rebal ? -0.3 : 0, acc: -0.004 * safetyTrained.length,
      otd: 0.5 * nRec, claims: rec.TRK012 ? -0.03 : 0, csat: 0.03 * nRec, track: 0.3 * nChk
    };
    DX.or = DX.cpm / 2.86 * 100;
    const W = [1, 1, 0.35, 0.1];

    // ---------- KPI scorecard ----------
    const per = s.kpiPeriod || 'M', PI = { W: 0, M: 1, Q: 2, Y: 3 }[per];
    const prevLabel = ['start of day', 'last month', 'last quarter', 'prior 12 months'][PI];
    const kpiPeriods = [['W', 'Next ' + days + ' days'], ['M', 'Month'], ['Q', 'Quarter'], ['Y', '12 months']].map((p) => ({ label: p[1], on: per === p[0], pick: () => this.setState({ kpiPeriod: p[0] }), bg: per === p[0] ? '#ffffff' : 'transparent', fg: per === p[0] ? '#1d6fa5' : '#4b5563', shadow: per === p[0] ? '0 1px 3px rgba(15,23,42,.12)' : 'none' }));
    const fmtV = (v, f) => f === 'pct' ? v.toFixed(1) + '%' : f === 'pct2' ? v.toFixed(2) + '%' : f === 'usd2' ? '$' + v.toFixed(2) : f === 'usd3' ? '$' + v.toFixed(3) : f === 'int' ? Math.round(v).toLocaleString('en-US') : f === 'd1' ? v.toFixed(1) : f === 'd2' ? v.toFixed(2) : f === 'h' ? v.toFixed(1) + 'h' : f === 'r5' ? v.toFixed(2) + ' / 5' : String(v);
    const fmtD = (d, f) => { const a = Math.abs(d); return f === 'pct' ? a.toFixed(1) + ' pts' : f === 'pct2' ? a.toFixed(2) + ' pts' : f === 'usd2' ? '$' + a.toFixed(2) : f === 'usd3' ? '$' + a.toFixed(3) : f === 'int' ? Math.round(a).toLocaleString('en-US') : f === 'd2' ? a.toFixed(2) : f === 'h' ? a.toFixed(1) + 'h' : f === 'r5' ? a.toFixed(2) : a.toFixed(1); };
    const KD = {
      or: { label: 'Operating ratio', def: 'Operating expenses ÷ operating revenue. Lower is better.', v: [92.4, 91.8, 92.1, 92.6], p: [91.9, 92.5, 92.9, 93.4], t: 92, dir: 'down', f: 'pct', page: 'fuel' },
      rpm: { label: 'Revenue per mile', def: 'Linehaul plus fuel surcharge revenue ÷ total miles.', v: [2.84, 2.86, 2.81, 2.79], p: [2.88, 2.79, 2.76, 2.71], t: 2.8, dir: 'up', f: 'usd2', page: 'bid' },
      cpm: { label: 'Cost per mile', def: 'Total operating cost ÷ total miles.', v: [2.62, 2.63, 2.59, 2.58], p: [2.6, 2.66, 2.62, 2.61], t: 2.6, dir: 'down', f: 'usd2', page: 'fuel' },
      empty: { label: 'Empty miles', def: 'Deadhead miles ÷ total miles driven.', v: [10.6, 11.2, 11.8, 12.1], p: [11.4, 12.3, 12.6, 13.0], t: 10, dir: 'down', f: 'pct', page: 'route' },
      mpt: { label: 'Miles per truck per week', def: 'Total miles ÷ active tractors ÷ weeks.', v: [2210, 2140, 2165, 2120], p: [2180, 2095, 2110, 2060], t: 2300, dir: 'up', f: 'int', page: 'fleet' },
      mpg: { label: 'Fuel economy (MPG)', def: 'Miles driven ÷ gallons used, fleet average.', v: [6.7, 6.6, 6.5, 6.5], p: [6.6, 6.5, 6.5, 6.4], t: 6.8, dir: 'up', f: 'd2', page: 'fuel' },
      maint: { label: 'Maintenance cost per mile', def: 'Repairs, parts and shop labour ÷ total miles.', v: [0.18, 0.19, 0.19, 0.18], p: [0.2, 0.18, 0.19, 0.19], t: 0.18, dir: 'down', f: 'usd3', page: 'tele' },
      pm: { label: 'Preventive maintenance on time', def: 'Scheduled services completed by their due date.', v: [96, 94, 93.5, 94.2], p: [92, 93, 92.4, 91.8], t: 95, dir: 'up', f: 'pct', page: 'fleet' },
      turn: { label: 'Driver turnover (annualized)', def: 'Drivers who left ÷ average driver headcount, annualized.', v: [38, 42, 44, 46], p: [41, 47, 49, 52], t: 45, dir: 'down', f: 'pct', page: 'driver' },
      hos: { label: 'HOS violations per 100 drivers', def: 'Hours-of-service violations logged by ELDs per 100 drivers.', v: [1.2, 1.8, 2.1, 2.3], p: [1.5, 2.4, 2.6, 2.9], t: 2, dir: 'down', f: 'd1', page: 'labour' },
      acc: { label: 'Accidents per million miles', def: 'DOT-recordable accidents per 1,000,000 miles driven.', v: [0.55, 0.62, 0.66, 0.71], p: [0.7, 0.74, 0.69, 0.78], t: 0.7, dir: 'down', f: 'd2', page: 'safety' },
      otd: { label: 'On-time delivery', def: 'Loads delivered inside the shipper’s appointment window.', v: [92.4, 91.2, 92.0, 92.8], p: [90.8, 90.0, 91.1, 91.5], t: 95, dir: 'up', f: 'pct', page: 'scen' },
      otp: { label: 'On-time pickup', def: 'Loads picked up inside the scheduled pickup window.', v: [95.8, 94.6, 94.9, 95.2], p: [94.1, 93.8, 94.0, 94.4], t: 95, dir: 'up', f: 'pct', page: 'dispatch' },
      tender: { label: 'Tender acceptance', def: 'Load offers accepted ÷ load offers received from contract shippers.', v: [90.5, 88.0, 87.2, 86.4], p: [87.9, 86.1, 85.5, 84.0], t: 90, dir: 'up', f: 'pct', page: 'bid' },
      dwell: { label: 'Average dwell time', def: 'Average time trucks wait at shipper and receiver docks per stop.', v: [2.2, 2.4, 2.5, 2.6], p: [2.5, 2.6, 2.7, 2.8], t: 2, dir: 'down', f: 'h', page: 'map' },
      claims: { label: 'Claims ratio', def: 'Cargo claim dollars ÷ freight revenue.', v: [0.31, 0.42, 0.45, 0.48], p: [0.38, 0.51, 0.49, 0.55], t: 0.5, dir: 'down', f: 'pct2', page: 'safety' },
      csat: { label: 'Shipper satisfaction', def: 'Average score from post-delivery shipper surveys.', v: [4.4, 4.3, 4.3, 4.2], p: [4.2, 4.1, 4.2, 4.1], t: 4.5, dir: 'up', f: 'r5', page: 'kpi' },
      track: { label: 'Live tracking compliance', def: 'Loads with live location shared to the shipper for the whole trip.', v: [98.6, 98.1, 97.9, 97.6], p: [97.9, 97.5, 97.2, 96.8], t: 98, dir: 'up', f: 'pct', page: 'map' },
      ret: { label: 'Customer revenue retention', def: 'Revenue from existing shippers ÷ their revenue in the prior period.', v: [101.2, 103.5, 104.1, 106.3], p: [99.4, 101.8, 102.2, 103.0], t: 100, dir: 'up', f: 'pct', page: 'bid' }
    };
    const cv = (k, f, label, def, fmt, dir) => { const d = KD[k]; d.v = d.v.map(f); d.p = d.p.map(f); d.t = f(d.t); d.label = label; d.def = def; if (fmt) d.f = fmt; if (dir) d.dir = dir; };
    cv('rpm', (x) => x / 1.609, 'Revenue per km', 'Linehaul plus fuel surcharge revenue ÷ total kilometres.');
    cv('cpm', (x) => x / 1.609, 'Cost per km', 'Total operating cost ÷ total kilometres.');
    cv('empty', (x) => x, 'Empty kilometres', 'Kilometres driven without a load ÷ total kilometres.');
    cv('mpt', (x) => x * 1.609, 'Kilometres per truck per week', 'Total kilometres ÷ active tractors ÷ weeks.');
    cv('mpg', (x) => 235.2 / x, 'Fuel use (L/100 km)', 'Litres of diesel per 100 km, fleet average. Lower is better.', 'd1', 'down');
    cv('maint', (x) => x / 1.609, 'Maintenance cost per km', 'Repairs, parts and shop labour ÷ total kilometres.');
    cv('acc', (x) => x / 1.609, 'Accidents per million km', 'Reportable accidents per 1,000,000 km driven.');
    DX.cpm = DX.cpm / 1.609; DX.maint = DX.maint / 1.609; DX.acc = DX.acc / 1.609; DX.mpg = -5.2 * DX.mpg;
    KD.otd.t = goals.otd; KD.empty.t = goals.empty; KD.or.t = 100 - goals.margin;
    KD.otd.v[0] = C.m.otd; KD.otd.p[0] = PL.start.m.otd; KD.empty.v[0] = C.m.empty; KD.empty.p[0] = PL.start.m.empty; KD.or.v[0] = 100 - C.m.margin; KD.or.p[0] = 100 - PL.start.m.margin;
    const ENG = { otd: 1, empty: 1, or: 1 };
    const kv = (k, pi) => KD[k].v[pi] + (pi === 0 && ENG[k] ? 0 : (DX[k] || 0) * W[pi]);
    const mkKpi = (k, i) => {
      const d = KD[k], v = kv(k, PI), pv = d.p[PI], delta = v - pv, better = d.dir === 'up' ? delta >= 0 : delta <= 0;
      const meets = d.dir === 'up' ? v >= d.t : v <= d.t, near = Math.abs(v - d.t) / Math.abs(d.t) <= 0.04;
      const st = meets ? ['On target', '#ffffff', '#0f172a', '#d5dae2'] : near ? ['Watch', 'rgba(245,158,11,.14)', '#92400e', 'rgba(245,158,11,.35)'] : ['Off target', 'rgba(239,68,68,.10)', '#b91c1c', 'rgba(239,68,68,.35)'];
      const seed = d.label.length * 7 + i * 3 + PI * 11, span = Math.max(Math.abs(d.v[PI] - pv) * 1.6, Math.abs(v) * 0.02);
      const ser = []; for (let j = 0; j < 12; j++) ser.push(pv + (v - pv) * (j / 11) + (Math.sin(seed * 1.7 + j * 1.9) * 0.5 + Math.sin(seed * 0.6 + j * 4.3) * 0.3) * span * (j === 11 ? 0 : 0.6));
      const lo = Math.min.apply(null, ser.concat([d.t])), hi = Math.max.apply(null, ser.concat([d.t])), rg = (hi - lo) || 1, Y = (x) => (29 - (x - lo) / rg * 26).toFixed(1);
      const moved = Math.abs((DX[k] || 0) * W[PI]) > 1e-6;
      return {
        key: k, label: d.label, def: d.def, value: fmtV(v, d.f), targetTxt: (d.dir === 'up' ? '≥ ' : '≤ ') + fmtV(d.t, d.f), meets,
        delta: (delta >= 0 ? '▲ ' : '▼ ') + fmtD(delta, d.f) + ' vs ' + prevLabel, dColor: Math.abs(delta) < 1e-9 ? '#6b7280' : better ? '#15803d' : '#b91c1c',
        stLabel: st[0], stBg: st[1], stFg: st[2], stBd: st[3], cardBd: moved ? '#6cb3e3' : '#e3e7ed', liveTxt: moved ? 'Changed this session' : '12-period trend',
        spark: ser.map((x, j) => (j ? 'L' : 'M') + (j * 120 / 11).toFixed(1) + ' ' + Y(x)).join(' '), tline: 'M0 ' + Y(d.t) + ' L120 ' + Y(d.t),
        sparkColor: meets ? '#1d6fa5' : near ? '#d97706' : '#dc2626', go: nav[d.page].go
      };
    };
    const companyKpis = ['or', 'rpm', 'cpm', 'empty', 'mpt', 'mpg', 'maint', 'pm', 'turn', 'hos', 'acc'].map(mkKpi);
    const customerKpis = ['otd', 'otp', 'tender', 'dwell', 'claims', 'csat', 'track', 'ret'].map(mkKpi);
    const allK = companyKpis.concat(customerKpis), onT = allK.filter((k) => k.meets).length;
    const kpiSections = [{ title: 'Company performance', sub: 'Profitability, asset use, maintenance, drivers and safety', items: companyKpis }, { title: 'Customer performance', sub: 'The service levels your shippers measure you on', items: customerKpis }];
    const opInc = [27, 118, 352, 1390][PI] * 1000 + (-DX.or * W[PI]) / 100 * [0.343, 1.48, 4.43, 17.4][PI] * 1e6;
    const kpiSummary = [
      { label: 'Revenue', value: PI === 0 ? '$' + (C.fin.rev / 1e6).toFixed(2) + 'M' : ['$0.34M', '$1.48M', '$4.43M', '$17.4M'][PI], sub: ['▲ 4.1% vs ', '▲ 6.3% vs ', '▲ 7.0% vs ', '▲ 8.2% vs '][PI] + prevLabel, subColor: '#15803d', bg: '#ffffff', bd: '#e3e7ed' },
      { label: 'Operating income', value: PI === 0 ? money(C.fin.profit) : money(opInc), sub: captWk || idleTrained.length || rebal ? 'Includes savings captured this session' : ['▼ 2.0% vs ', '▲ 11.4% vs ', '▲ 9.6% vs ', '▲ 14.8% vs '][PI] + prevLabel, subColor: '#15803d', bg: '#ffffff', bd: '#e3e7ed' },
      { label: 'Loads in progress', value: String(live.filter((t) => t.load).length), sub: openBreak.length ? openBreak.length + ' at risk from breakdowns' : 'None at risk', subColor: openBreak.length ? '#b91c1c' : '#0f172a', bg: '#ffffff', bd: '#e3e7ed' },
      { label: 'KPIs on target', value: onT + ' of ' + allK.length, sub: (allK.length - onT) + ' need attention', subColor: '#92400e', bg: 'rgba(108,179,227,.10)', bd: '#c6e2f5' }
    ];

    // ---------- Shippers (customer scorecard) ----------
    const band = (v, g, a, up) => up ? (v >= g ? '#0f172a' : v >= a ? '#b45309' : '#b91c1c') : (v <= g ? '#0f172a' : v <= a ? '#b45309' : '#b91c1c');
    const HL = { Healthy: ['#ffffff', '#0f172a', '#d5dae2'], Watch: ['rgba(245,158,11,.14)', '#92400e', 'rgba(245,158,11,.35)'], 'At risk': ['rgba(239,68,68,.10)', '#b91c1c', 'rgba(239,68,68,.35)'] };
    const shipAdj = { 'Maple Fresh Foods': [rec.TRK012 ? 1.6 : 0, rec.TRK012 ? -0.13 : 0], 'Lakeshore Auto Parts': [rec.TRK040 ? 0.3 : 0, 0], 'Northline Retail': [rec.TRK031 ? 0.3 : 0, 0] };
    const custRows = [['Northline Retail', 5.2, 2690, 93.8, 91, 1.9, 0.28, 12.7], ['Maple Fresh Foods', 3.2, 1490, 88.9, 84, 2.9, 0.71, 9.8], ['Lakeshore Auto Parts', 2.2, 1020, 96.2, 93, 1.6, 0.12, 14.2], ['Great Lakes Steel', 1.7, 830, 90.4, 86, 2.7, 0.44, 11.1], ['Laurentian Paper', 1.4, 670, 94.1, 89, 2.1, 0.35, 13.0], ['Northern Fuels', 1.1, 490, 91.7, 82, 2.3, 0.05, 15.6], ['40 other shippers', 2.6, 8480, 92.3, 87, 2.5, 0.52, 10.4]].map((r) => {
      const a = shipAdj[r[0]] || [0, 0], otd = r[3] + a[0], cl = r[6] + a[1];
      const health = otd < 90 || cl > 0.6 ? 'At risk' : (otd < 93 || r[4] < 88 || r[5] > 2.4 || cl > 0.5) ? 'Watch' : 'Healthy';
      const today = live.filter((t) => t.shipper === r[0] && t.load).length;
      return { name: r[0], rev: '$' + r[1].toFixed(1) + 'M', share: (r[1] / 17.4 * 100).toFixed(1) + '%', shareTxt: (r[1] / 17.4 * 100).toFixed(0) + '%', loads: r[2].toLocaleString('en-US'), today: today + ' today', otd: otd.toFixed(1) + '%', otdC: band(otd, 95, 90, true), ten: r[4] + '%', tenC: band(r[4], 90, 85, true), dw: r[5].toFixed(1) + 'h', dwC: band(r[5], 2, 2.5, false), cl: cl.toFixed(2) + '%', clC: band(cl, 0.5, 0.6, false), margin: r[7].toFixed(1) + '%', health, hBg: HL[health][0], hFg: HL[health][1], hBd: HL[health][2] };
    });
    const maple = custRows[1];

    // ---------- Alerts and activity ----------
    const acked = s.acked || {};
    const ack = (id) => () => this.act((p) => ({ acked: Object.assign({}, p.acked, { [id]: true }) }), 'Alert ' + id + ' acknowledged', 'info');
    const alertDefs = [];
    [['TRK012', '8:42 AM', '$2,400'], ['TRK040', '9:02 AM', '$1,200'], ['TRK031', '9:48 AM', '$650']].forEach((r) => { if (!rec[r[0]]) alertDefs.push({ id: r[0], time: r[1], text: B.byId[r[0]].note + ' • Load ' + B.byId[r[0]].load + ' (' + B.byId[r[0]].shipper + ')', impact: r[2], color: '#dc2626', action: recover(r[0]), actionLabel: 'Recover with ' + B.plans[r[0]].spare, locate: go('map', { sel: r[0] }), locateLabel: 'Locate' }); });
    if (!chk.TRK027) alertDefs.push({ id: 'TRK027', time: '9:15 AM', text: 'GEOTAB disconnected for 45+ minutes near Cornwall', impact: '$850', color: '#b45309', action: checkIn, actionLabel: 'Request check-in', locate: go('map', { sel: 'TRK027' }), locateLabel: 'Locate' });
    alertDefs.push({ id: 'DRV015', time: '10:30 AM', text: 'Elizabeth Garcia (TRK018) approaching the 11-hour HOS driving limit (10.2h)', impact: '$340', color: '#c2410c', action: contact('Elizabeth Garcia'), actionLabel: 'Message driver', locate: go('map', { sel: 'TRK018' }), locateLabel: 'Locate' });
    const alerts = alertDefs.filter((a) => !acked[a.id]).map((a) => Object.assign({}, a, { hasAction: true, ack: ack(a.id) }));
    const crit = { has: openBreak.length > 0, clear: openBreak.length === 0, n: openBreak.length, ids: openBreak.join(', '), title: openBreak.length + ' critical alert' + (openBreak.length === 1 ? '' : 's'), text: openBreak.map((id) => id + ': ' + B.byId[id].note).join(' • ') };
    const baseLog = [{ t: '10:30 AM', text: 'Elizabeth Garcia (DRV015) is approaching the 11-hour driving limit', kind: 'warn' }, { t: '9:48 AM', text: 'TRK031 flat tire near Barrie with Load #4474', kind: 'bad' }, { t: '9:15 AM', text: 'TRK027 lost its GEOTAB signal near Cornwall', kind: 'warn' }, { t: '9:02 AM', text: 'TRK040 engine fault P0300 near London', kind: 'bad' }, { t: '8:42 AM', text: 'TRK012 reefer unit failed near Belleville with Load #4471', kind: 'bad' }, { t: '6:00 AM', text: 'Daily Operations Summary sent to the Operations team', kind: 'info' }];
    const KC = { good: '#1e3a6e', bad: '#dc2626', warn: '#b45309', info: '#1d6fa5' };
    const activity = (s.log || []).concat(baseLog).map((e) => ({ t: e.t, text: e.text, color: KC[e.kind] || KC.info }));
    const toast = { text: s.toast || '', view: go('cc') };

    // ---------- Dashboard ----------
    const kpiNowOtd = kv('otd', 0);
    const ops = [
      { label: 'Loads delivered', value: '89', unit: '/156', sub: '57% of today', color: '#0f172a', subColor: '#6b7280', bar: true, barW: '57%', go: nav.kpi.go },
      { label: 'Loads in progress', value: String(live.filter((t) => t.load).length), unit: '', sub: openBreak.length ? openBreak.length + ' at risk' : 'None at risk', color: '#0f172a', subColor: openBreak.length ? '#dc2626' : '#15803d', bar: false, go: nav.map.go },
      { label: 'Active trucks', value: String(fc.active), unit: '/' + fc.total, sub: Math.round(fc.active / fc.total * 100) + '% utilization', color: '#0f172a', subColor: '#6b7280', bar: false, go: nav.fleet.go },
      { label: 'On-time delivery', value: kpiNowOtd.toFixed(1) + '%', unit: '', sub: 'This week • target 95%', color: '#1d6fa5', subColor: '#6b7280', bar: false, go: nav.kpi.go },
      { label: 'Fuel economy', value: kv('mpg', 0).toFixed(2), unit: ' mpg', sub: 'Target 6.8', color: '#0f172a', subColor: '#6b7280', bar: false, go: nav.fuel.go },
      { label: 'Drivers on route', value: String(ds.onRoute), unit: '/' + ds.total, sub: ds.onCall + ' on call', color: '#0f172a', subColor: '#6b7280', bar: false, go: nav.dispatch.go },
      { label: 'Open incidents', value: String(openBreak.length + (chk.TRK027 ? 0 : 1)), unit: '', sub: openBreak.length ? 'Review required' : 'Loads recovered', color: openBreak.length ? '#b45309' : '#15803d', subColor: openBreak.length ? '#dc2626' : '#15803d', bar: false, go: nav.scen.go },
      { label: 'Shipper score', value: kv('csat', 0).toFixed(2), unit: '/5', sub: 'Post-delivery surveys', color: '#0f172a', subColor: '#6b7280', bar: false, go: nav.kpi.go }
    ];
    const tag = { blue: ['rgba(59,130,246,.14)', '#1d4ed8'], amber: ['rgba(245,158,11,.16)', '#92400e'], navy: ['rgba(30,58,110,.10)', '#1e3a6e'] };
    const recs = [
      ['Route Optimization', 'blue', 'Consolidate Toronto → Montreal LTL loads L-3 and L-7', 'Both loads run the same lane at under 60% trailer fill. Combining saves one trip a day.', '94%', 'Low', '$847/week', 'Review & Merge', 'Merged', 'Cuts empty km 0.3 pts', 'Merged LTL loads L-3 and L-7 on Toronto → Montreal: $847/week saved'],
      ['Fleet', 'amber', 'Replace TRK006 (2018 Mack)', 'Maintenance costs 3x fleet average. Projected major failure in 45 days.', '87%', 'Medium', '$2,100/mo', 'Schedule Replacement', 'Replacement scheduled', 'Lowers maintenance cost per mile', 'Replacement scheduled for TRK006 (2018 Mack)'],
      ['Fuel', 'navy', 'Idle Reduction Program - Phase 2', B.idleNames.length + ' drivers average over 35 min idle a day. Training cuts idling by 60%.', '91%', 'Medium', '$18,400/mo', 'Launch Program', 'Program launched', 'Adds training for ' + B.idleNames.length + ' drivers', 'Idle Reduction Phase 2 launched for ' + B.idleNames.length + ' drivers'],
      ['Labour', 'blue', 'Rebalance Thursday Dispatch', 'Thursdays generate 40% of overtime. Moving 3 loads to Wednesday cuts overtime about 30%.', '89%', 'Low', '$1,200/week', 'Reschedule', 'Rescheduled', 'Reduces overtime and HOS risk', 'Thursday dispatch rebalanced: 3 loads moved to Wednesday']
    ].map((r, i) => ({ tag: r[0], tagBg: tag[r[1]][0], tagFg: tag[r[1]][1], title: r[2], desc: r[3], conf: r[4], effort: r[5], value: r[6], effect: r[9],
      btn: Object.assign(this.btn('rec' + i, r[7], r[8], r[10], 'good', i === 2 ? (p) => { const t = Object.assign({}, p.training); B.idleNames.forEach((n) => { if (!t[n]) t[n] = { course: 'Idle reduction', at: this.stamp() }; }); return { training: t }; } : null), done['rec' + i] ? {} : { bg: '#1e3a6e', fg: '#ffffff' }) }));
    const healthTiles = [
      { label: 'Active', value: fc.active, bg: 'rgba(108,179,227,.14)', fg: '#1d6fa5', go: go('fleet', { fleetFilter: 'In transit' }) },
      { label: 'Available', value: fc.idle, bg: 'rgba(245,158,11,.12)', fg: '#b45309', go: go('fleet', { fleetFilter: 'Available' }) },
      { label: 'In shop', value: fc.shop, bg: 'rgba(124,58,237,.10)', fg: '#6d28d9', go: go('fleet', { fleetFilter: 'In shop' }) },
      { label: 'Breakdown', value: fc.breakdown, bg: 'rgba(239,68,68,.10)', fg: '#dc2626', go: go('fleet', { fleetFilter: 'Breakdown' }) }
    ];
    const attn = B.trucks.filter((t) => !svc[t.id] && t.status !== 'shop' && (t.fault || t.predicted || t.next < 0));
    const attnCount = attn.length;
    const savingsTiles = [
      { label: 'Lane optimization', value: money(captWk * 52) + '/yr', sub: captWk ? money(captWk) + ' per week captured' : 'Apply opportunities on Route Optimization', go: nav.route.go },
      { label: 'Fuel (idle reduction)', value: money(fuelCaptYr) + '/yr', sub: idleTrained.length ? idleTrained.length + ' drivers in idle training' : 'Assign training on Fuel & Costs', go: nav.fuel.go },
      { label: 'Overtime', value: money((otCostBase - otCostWk) * 52) + '/yr', sub: rebal ? 'Thursday dispatch rebalanced' : 'Rebalance on Labour Management', go: nav.labour.go }
    ];

    // ---------- Fleet status ----------
    const kpiCpm = kv('cpm', 1);
    const rawAvg = B.trucks.reduce((a, t) => a + t.cpmRaw, 0) / B.trucks.length;
    const filters = [['All', null], ['In transit', 'moving'], ['At dock', 'dock'], ['Available', 'idle'], ['In shop', 'shop'], ['Breakdown', 'breakdown'], ['Offline', 'offline']];
    const ff = s.fleetFilter || 'All', ffKey = (filters.filter((f) => f[0] === ff)[0] || filters[0])[1];
    const fleetFilters = filters.map((f) => ({ label: f[0], count: f[1] ? fc[f[1]] : fc.total, on: ff === f[0], pick: () => this.setState({ fleetFilter: f[0] }), bg: ff === f[0] ? 'rgba(108,179,227,.16)' : '#ffffff', bd: ff === f[0] ? '#6cb3e3' : '#d5dae2', fg: ff === f[0] ? '#1d4f91' : '#374151' }));
    const fleetRows = live.filter((t) => !ffKey || t.status === ffKey).map((t) => {
      const b = t.base, booked = svc[t.id];
      const alert = booked ? 'Service booked' : t.id === 'TRK006' && replaced ? 'Replacement scheduled' : b.fault ? b.fault.code : b.predicted ? 'Predicted: ' + b.predicted.part : 'OK';
      const tone = booked || (t.id === 'TRK006' && replaced) ? ['rgba(108,179,227,.16)', '#1d4f91'] : b.fault ? (b.fault.sev === 'High' ? ['rgba(239,68,68,.12)', '#b91c1c'] : ['rgba(245,158,11,.16)', '#92400e']) : b.predicted ? ['rgba(245,158,11,.16)', '#92400e'] : ['transparent', '#0f172a'];
      return Object.assign({}, t, { util: b.util + '%', cpm: '$' + ((b.cpmRaw - rawAvg) / 1.609 + kpiCpm).toFixed(2), next: booked ? 'Booked' : b.next < 0 ? 'Overdue ' + (-b.next) + 'd' : b.next + 'd', nextC: booked ? '#1d6fa5' : b.next < 0 ? '#dc2626' : b.next <= 7 ? '#b45309' : '#374151', alert, aBg: tone[0], aFg: tone[1] });
    }).sort((a, b) => (a.id < b.id ? -1 : 1));
    const fleetKpis = [this.kpi('Fleet size', String(fc.total), fc.active + ' active • ' + fc.idle + ' available'), this.kpi('Avg utilization', Math.round(B.trucks.reduce((a, t) => a + t.util, 0) / B.trucks.length) + '%', 'Last 30 days'), this.kpi('Avg cost/km', '$' + kpiCpm.toFixed(2), 'Matches the KPI scorecard', 'neutral'), this.kpi('Need attention', String(attnCount), nSvc ? nSvc + ' service bookings this session' : 'Faults, predicted failures, overdue', 'amber')];

    // ---------- Route optimization ----------
    const remainingYr = Math.max(0, 457000 - captWk * 52);
    const routeStats = { remaining: money(remainingYr), captured: captWk ? money(captWk * 52) + '/yr captured this session' : 'Nothing applied yet', miles: Math.round((1343 - captWk * 0.9) * 1.609).toLocaleString('en-US'), hours: (232 - Math.round(captWk * 0.15)) + 'h', empty: kv('empty', 1).toFixed(1) + '%' };
    const laneLive = (a, b) => live.filter((t) => t.status === 'moving' && ((t.from === a && t.to === b) || (t.from === b && t.to === a))).length;
    const lanes = [['Toronto', 'Montreal', 27, '$10,230', '$9,006', '$1,224', '84%'], ['Toronto', 'Ottawa', 24, '$9,472', '$8,351', '$1,121', '80%'], ['Windsor', 'Toronto', 21, '$7,551', '$6,680', '$871', '82%'], ['Toronto', 'Buffalo', 19, '$7,476', '$6,619', '$857', '81%'], ['London', 'Montreal', 18, '$6,829', '$6,012', '$817', '81%'], ['Hamilton', 'Detroit', 17, '$6,952', '$6,148', '$804', '83%'], ['Montreal', 'Ottawa', 19, '$6,705', '$5,904', '$801', '81%'], ['Toronto', 'Kingston', 19, '$6,950', '$6,152', '$798', '80%'], ['Buffalo', 'Albany', 20, '$6,887', '$6,114', '$773', '83%'], ['Toronto', 'Sudbury', 16, '$6,267', '$5,541', '$726', '83%']].map((z) => ({ name: z[0] + ' ↔ ' + z[1], loads: z[2], live: laneLive(z[0], z[1]) + ' now', cur: z[3], opt: z[4], save: z[5], eff: z[6] }));
    const opps = [['Backhaul: Montreal → Toronto', '541 km • 5.6 h • 8% fewer empty km'], ['Consolidate Ottawa LTL', '451 km • 4.7 h • 9% better trailer fill'], ['Re-sequence Windsor drops', '370 km • 4.1 h • 7% shorter route'], ['Backhaul: Buffalo → Toronto', '161 km • 1.9 h • 10% fewer empty km'], ['Shift Detroit pickup to AM', '386 km • 4.3 h • 14% less border wait'], ['Kingston relay swap', '257 km • 2.8 h • 8% better HOS use']]
      .map((o, i) => ({ n: i + 1, name: o[0], meta: o[1], gain: '+$' + oppGain[i] + '/wk', btn: this.btn('opp' + i, 'Apply', 'Applied', 'Applied lane change: ' + o[0] + ' (+$' + oppGain[i] + '/week)', 'good') }));
    const samples = [['Toronto → Montreal', '663 km', '7.4 h', '$1,257', '597 km', '6.6 h', '$1,124', 'Save $133/load'], ['Windsor → Toronto', '431 km', '4.9 h', '$829', '388 km', '4.4 h', '$742', 'Save $87/load'], ['Toronto → Ottawa', '499 km', '5.6 h', '$955', '457 km', '5.1 h', '$868', 'Save $87/load']]
      .map((r, i) => ({ name: r[0], c1: r[1], c2: r[2], c3: r[3], o1: r[4], o2: r[5], o3: r[6], btn: this.btn('sample' + i, r[7], 'Route updated', 'Optimized route adopted on ' + r[0] + ' (' + money(sampleWk[i]) + '/week)', 'good') }));
    const openOpps = oppGain.map((g, i) => i).filter((i) => !done['opp' + i]);
    const runFull = this.btn('runFull', 'Run Full Optimization', 'All opportunities applied', 'Full optimization run: ' + openOpps.length + ' lane changes applied', 'good', (p) => { const d = Object.assign({}, p.done); openOpps.forEach((i) => { d['opp' + i] = true; }); d.runFull = true; return { done: d }; });

    // ---------- Fuel ----------
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fuelBars = [449, 461, 483, 491, 493, 491, 484, 469, 443, 442, 429, 449].map((v, i) => ({ h: (v / 800 * 100).toFixed(1) + '%', m: months[i] }));
    const fuelKpis = [this.kpi('12-month fuel spend', '$5.62M', '+3.2% vs prior 12 months', 'neutral', 'red'), this.kpi('Fuel use', kv('mpg', 1).toFixed(1) + ' L/100 km', 'Target 34.6 • same as KPI scorecard', 'neutral', 'blue'), this.kpi('Idle fuel waste', money(678000 - fuelCaptYr), '730,000 litres idled in 12 months', 'amber'), this.kpi('Savings potential', money(407000 - fuelCaptYr), fuelCaptYr ? money(fuelCaptYr) + '/yr captured this session' : 'With 60% idle reduction', 'blue', fuelCaptYr ? 'blue' : 'muted')];
    const idleSorted = drv.slice().sort((a, b) => b.idle - a.idle).slice(0, 5);
    const idlers = idleSorted.map((d, i) => ({ n: i + 1, name: d.name, meta: d.exp + 'yr exp • ' + (d.truck ? d.truck.id : 'off duty') + (d.tr ? ' • ' + d.tr.course + ' assigned' : ''), idle: d.idle + ' min/day', waste: '~$' + Math.round(d.idle * 3.3) + '/mo waste', bg: d.tr ? 'rgba(108,179,227,.12)' : 'rgba(239,68,68,.07)', fg: d.tr ? '#1d6fa5' : '#dc2626' }));
    const idleBtnBase = this.btn('idleTop', 'Assign idle reduction training to these 5', 'Training assigned', null);
    const idleAllDone = idleSorted.every((d) => d.tr);
    const idleBtn = { label: idleAllDone ? 'Training assigned' : 'Assign idle reduction training to these 5', click: () => { if (!idleAllDone) this.setState({ gate: 'idleTop' }); }, bg: idleAllDone ? '#e5e8ed' : '#1e3a6e', fg: idleAllDone ? '#4b5563' : '#ffffff' };
    void idleBtnBase;
    if (idleAllDone) { if (this._gate) delete this._gate.idleTop; } else { const runIdle = assignTraining(idleSorted.map((d) => d.name), 'Idle reduction'); const idleWhat = 'Idle reduction training for ' + idleSorted.filter((d) => !d.tr).map((d) => d.name).join(', ') + ' (about +$' + (20 * idleSorted.filter((d) => !d.tr).length) + '/week in planned fuel savings)'; this._gate.idleTop = { title: idleWhat, run: () => { if ((this.state.done || {}).idleTop) return; runIdle(); const stamp = this.stamp(), planT = this.fmtT(this.planNowM()); this.setState((p) => (p.done || {}).idleTop ? { gate: null } : ({ gate: null, done: Object.assign({}, p.done, { idleTop: true }), log: [{ t: stamp, text: 'Approved by John Jones: ' + idleWhat, kind: 'good' }].concat(p.log || []).slice(0, 40), toast: 'Approved by John Jones: ' + idleWhat, decisions: [{ t: stamp, planT, k: 'idleTop', no: '—', cust: 'Drivers', label: idleWhat, rec: true, by: 'John Jones', cause: 'High idling on the five worst drivers.', rationale: 'Approved by John Jones after review. ' + idleWhat + '.', tradeoffs: 'Reviewed in the approval bar before applying.', effect: idleWhat }].concat(p.decisions || []) })); } }; }
    if (s.gate === 'idleTop' && !idleAllDone) idleBtn.label = 'Awaiting approval';
    const mpgTone = [['rgba(239,68,68,.08)', '#ef4444', '#dc2626'], ['rgba(249,115,22,.08)', '#f97316', '#c2410c'], ['rgba(245,158,11,.08)', '#f59e0b', '#b45309'], ['#f4f6f9', '#d5dae2', '#b45309'], ['#f4f6f9', '#d5dae2', '#b45309']];
    const mpgList = B.trucks.slice().sort((a, b) => a.mpg - b.mpg).slice(0, 5).map((t, i) => ({ rank: i + 1, id: t.id, mpg: (235.2 / t.mpg).toFixed(1) + ' L/100 km', type: t.type + ' • ' + t.make + ' ' + t.year, cost: '$' + (2900 + Math.round((6.6 - t.mpg) * 900)).toLocaleString('en-US'), bg: mpgTone[i][0], bd: mpgTone[i][1], color: mpgTone[i][2], book: bookService(t.id, 'low fuel economy'), bookLabel: svc[t.id] ? 'Service booked' : t.status === 'shop' ? 'In shop now' : 'Book engine diagnostic', bookFg: svc[t.id] || t.status === 'shop' ? '#6b7280' : '#1e3a6e' }));

    // ---------- Labour ----------
    const labBars = [380, 395, 405, 395, 400, 396, 395, 390, 405, 400, 405, 395].map((b, i) => { const o = [26, 30, 36, 30, 31, 30, 26, 25, 31, 30, 32, 30][i]; return { h: ((b + o) / 1000 * 100).toFixed(1) + '%', ot: (o / (b + o) * 100).toFixed(1) + '%', m: months[i] }; });
    const avgMiles = Math.round(drv.filter((d) => d.onRoute).reduce((a, d) => a + d.miles, 0) / Math.max(1, ds.onRoute));
    const labKpis = [this.kpi('12-month labour cost', '$4.22M', '+2.8% vs budget', 'neutral', 'red'), this.kpi('Overtime this week', money(otCostWk), rebal ? 'Down ' + money(otCostBase - otCostWk) + ' after rebalancing' : 'Across ' + ds.inOT + ' drivers', 'amber', rebal ? 'blue' : 'muted'), this.kpi('Avg productivity', String(Math.round(avgMiles * 1.609)), 'km per driver per day'), this.kpi('HOS violations / 100 drivers', kv('hos', 1).toFixed(1), 'Target 2.0 • same as KPI scorecard', 'blue')];
    const otDrivers = drv.slice().sort((a, b) => b.ot - a.ot).slice(0, 5).map((d) => ({ name: d.name, meta: (40 + d.ot).toFixed(1) + 'h this week • ' + (d.truck ? d.truck.id + ' ' + d.truck.lane : 'off duty'), ot: d.ot.toFixed(1) + 'h OT', extra: '+$' + Math.round(d.ot * 48) + ' extra cost' }));
    const rebalBtn = Object.assign(this.btn('rec3', 'Rebalance Thursday dispatch', 'Thursday dispatch rebalanced', 'Thursday dispatch rebalanced: 3 loads moved to Wednesday', 'good'), done.rec3 ? {} : { bg: '#1e3a6e', fg: '#ffffff' });
    const leaders = drv.slice().sort((a, b) => b.miles - a.miles).slice(0, 5).map((d, i) => ({ rank: i + 1, name: d.name, miles: Math.round(d.miles * 1.609), safety: d.safety, safetyColor: d.safety < 80 ? '#b45309' : '#0f172a', bg: i === 0 ? 'rgba(108,179,227,.12)' : '#f4f6f9', color: i === 0 ? '#1d6fa5' : '#0f172a' }));

    // ---------- Dispatch ----------
    const onRoute = drv.filter((d) => d.onRoute).map((d) => ({ name: d.name, truck: d.truck.id, lane: d.truck.lane, phone: d.phone, color: d.truck.color, bg: s.dispatchTo === d.name ? 'rgba(108,179,227,.16)' : '#f4f6f9', call: () => this.setState({ dispatchTo: d.name }), locate: go('map', { sel: d.truck.id }) })).sort((a, b) => (a.truck < b.truck ? -1 : 1));
    const to = s.dispatchTo || '';
    const send = (kind, fallback) => () => this.act((p) => {
      const text = (p.msg || '').trim() || fallback, toTxt = p.dispatchTo ? p.dispatchTo + (truckOf[p.dispatchTo] ? ' (' + truckOf[p.dispatchTo].id + ')' : '') : 'All ' + ds.onRoute + ' drivers on route';
      return { messages: [{ t: this.stamp(), to: toTxt, text, kind }].concat(p.messages || []), msg: '' };
    }, (kind === 'bad' ? 'Emergency alert' : kind === 'warn' ? 'Weather warning' : 'Message') + ' sent to ' + (to || 'all ' + ds.onRoute + ' drivers on route'), kind === 'bad' ? 'warn' : 'info');
    const messages = (s.messages || []).map((m) => ({ t: m.t, to: m.to, text: m.text, color: KC[m.kind] || KC.info }));

    // ---------- Bidding ----------
    const bidData = [
      { city: 'Northline Retail', short: '12,400 loads/yr • Dry van', meta: '12,400 loads/yr • Dry van • Ontario & Quebec', term: '3yr', rev: '$14.4M/yr', margin: '12.7%', deadline: '2026-03-15', stdTrucks: 47, stdDepots: 4, stdCost: '$12.8M', optTrucks: 44, optDepots: 3, optCost: '$11.8M', saving: 'Optimization saves 3 tractors = $1.0M/year', cons: '$13.7M', aggr: '$12.7M', type: 'Dry Van' },
      { city: 'Maple Fresh Foods', short: '6,900 loads/yr • Reefer', meta: '6,900 loads/yr • Reefer • Ontario & US Northeast', term: '2yr', rev: '$8.3M/yr', margin: '15.5%', deadline: '2026-04-30', stdTrucks: 27, stdDepots: 3, stdCost: '$7.2M', optTrucks: 25, optDepots: 2, optCost: '$6.7M', saving: 'Optimization saves 2 tractors = $0.5M/year', cons: '$7.8M', aggr: '$7.3M', type: 'Reefer' },
      { city: 'Lakeshore Auto Parts', short: '4,700 loads/yr • Flatbed', meta: '4,700 loads/yr • Flatbed • Windsor–Detroit corridor', term: '2yr', rev: '$5.6M/yr', margin: '14.2%', deadline: '2026-06-15', stdTrucks: 19, stdDepots: 2, stdCost: '$4.9M', optTrucks: 18, optDepots: 2, optCost: '$4.7M', saving: 'Optimization saves 1 tractor = $0.2M/year', cons: '$5.3M', aggr: '$5.0M', type: 'Flatbed' }
    ];
    const bi = s.bid || 0;
    const bids = bidData.map((b, i) => Object.assign({}, b, { on: bi === i, pick: () => this.setState({ bid: i }), open: go('bid', { bid: i }), bg: bi === i ? 'rgba(108,179,227,.08)' : '#ffffff', bd: bi === i ? '#6cb3e3' : '#e3e7ed', statusTxt: sub[i] ? 'Bid submitted ' + sub[i] : 'Due in ' + [54, 100, 146][i] + ' days', statusFg: sub[i] ? '#1d6fa5' : '#0f172a' }));
    const bid = Object.assign({}, bidData[bi]);
    const ofType = B.trucks.filter((t) => t.type === bid.type).length, freeType = live.filter((t) => t.type === bid.type && t.status === 'idle').length;
    bid.fleetNote = ofType + ' ' + bid.type.toLowerCase() + ' tractors today, ' + freeType + ' available. Winning needs ' + bid.optTrucks + ' with optimization.';
    const bidSubmit = sub[bi] ? { label: 'Bid submitted ' + sub[bi], click: () => {}, bg: '#e5e8ed', fg: '#4b5563' } : { label: 'Submit bid at ' + bid.aggr, click: () => this.act((p) => ({ submitted: Object.assign({}, p.submitted, { [bi]: this.stamp() }) }), 'Bid submitted to ' + bid.city + ' at ' + bid.aggr, 'good'), bg: '#1e3a6e', fg: '#ffffff' };

    // ---------- Telematics ----------
    const teleKpis = [this.kpi('Connected', String(fc.total - 4 - (chk.TRK027 ? 0 : 1)), '', 'blue'), this.kpi('Unstable signal', '4', '', 'amber'), this.kpi('Disconnected', String(chk.TRK027 ? 0 : 1), '', chk.TRK027 ? 'neutral' : 'red'), this.kpi('Fault codes', String(B.trucks.filter((t) => t.fault && !svc[t.id]).length), '', 'amber'), this.kpi('Predicted failures', String(B.trucks.filter((t) => t.predicted && !svc[t.id]).length), '', 'red'), this.kpi('Service booked', String(nSvc), '', 'neutral')];
    const attnList = attn.map((t) => ({ id: t.id, what: t.fault ? t.fault.code : t.predicted ? t.predicted.part + ' in ' + t.predicted.days + 'd' : 'Service overdue', pick: () => this.setState({ teleId: t.id }), bg: (s.teleId || 'TRK001') === t.id ? 'rgba(108,179,227,.16)' : '#ffffff', bd: t.fault && t.fault.sev === 'High' ? 'rgba(239,68,68,.45)' : '#d5dae2', fg: t.fault && t.fault.sev === 'High' ? '#b91c1c' : '#374151' }));
    const tid = LV[s.teleId] ? s.teleId : 'TRK001', lt = LV[tid], bt = lt.base;
    const ok = '#0f172a', warn = '#b45309', bad = '#dc2626';
    const fz = bt.fault, pz = bt.predicted, booked = !!svc[tid];
    const teleTruck = {
      id: tid, statusLabel: lt.statusLabel, pillBg: lt.pillBg, pillFg: lt.pillFg, desc: bt.make + ' ' + bt.year + ' • ' + bt.type + ' • ' + Math.round(bt.odo * 1.609).toLocaleString('en-US') + ' km • ' + lt.lane,
      conn: lt.status === 'offline' ? 'Disconnected' : bt.unstable ? 'Unstable signal' : 'Connected', connBg: lt.status === 'offline' ? 'rgba(239,68,68,.12)' : bt.unstable ? 'rgba(245,158,11,.16)' : 'rgba(108,179,227,.16)', connFg: lt.status === 'offline' ? '#b91c1c' : bt.unstable ? '#92400e' : '#1d4f91',
      speedTxt: lt.speedTxt, fuel: bt.fuelLvl + '%', eng: bt.engT + '°F', driverShort: lt.driver || '—',
      faultTxt: booked ? 'Service booked' + (fz ? ' for ' + fz.code : '') : fz ? 'Fault ' + fz.code + ': ' + fz.text : pz ? 'Predicted failure: ' + pz.part + ' in about ' + pz.days + ' days' : 'No active faults',
      sev: booked ? 'Booked' : fz ? fz.sev : pz ? 'Predicted' : 'OK', faultBg: booked ? 'rgba(108,179,227,.12)' : fz ? (fz.sev === 'High' ? 'rgba(239,68,68,.10)' : 'rgba(245,158,11,.12)') : pz ? 'rgba(245,158,11,.12)' : '#f4f6f9', faultFg: booked ? '#1d4f91' : fz ? (fz.sev === 'High' ? '#b91c1c' : '#92400e') : pz ? '#92400e' : '#0f172a',
      canBook: !booked && !!(fz || pz) && lt.status !== 'shop', book: bookService(tid, fz ? fz.code : pz ? pz.part : ''), locate: go('map', { sel: tid }),
      ai: booked ? 'Service is booked. The truck stays in rotation until the appointment.' : fz ? fz.ai : pz ? 'Book service before the predicted ' + pz.part.toLowerCase() + ' failure to avoid a roadside breakdown.' : lt.status === 'shop' ? bt.note + '.' : 'No issues detected. Next service in ' + Math.max(0, bt.next) + ' days.',
      groups: [
        { name: 'Engine', rows: [{ k: 'Temp', v: bt.engT + '°F', color: bt.engT > 220 ? bad : ok, hint: 'Optimal: 185-220. Normal operating range' }, { k: 'Oil PSI', v: String(bt.oil), color: bt.oil < 40 ? warn : ok, hint: 'Optimal: 40-60. <25 at idle = check' }] },
        { name: 'Fuel', rows: [{ k: 'Level', v: bt.fuelLvl + '%', color: bt.fuelLvl < 25 ? warn : ok, hint: 'Optimal: >25%. Refuel below 20%' }, { k: 'L/100 km', v: (235.2 / bt.mpg).toFixed(1), color: bt.mpg < 5.5 ? bad : bt.mpg < 6 ? warn : ok, hint: 'Optimal: 29-39. Above 43 = issue' }] },
        { name: 'Emissions', rows: [{ k: 'DEF', v: bt.def + '%', color: bt.def < 25 ? warn : ok, hint: 'Optimal: >25%. 0% = derate' }, { k: 'DPF soot', v: bt.dpf + '%', color: bt.dpf > 60 ? warn : ok, hint: 'Optimal: <60%. >80% = regen' }] },
        { name: 'Trailer', rows: [{ k: 'Reefer temp', v: bt.reefer ? bt.reefer + '°F' : '—', color: bt.reefer && bt.reefer > 40 ? bad : ok, hint: 'Setpoint 36°F. ±4°F = alert' }, { k: 'Tire pressure', v: bt.tire + ' PSI', color: bt.tire < 90 ? bad : ok, hint: 'Optimal: 100-110 PSI' }] }
      ]
    };
    const teleOpts = live.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((t) => ({ id: t.id, label: t.id + ' - ' + t.base.make + ' (' + t.statusLabel + ')' }));

    // ---------- Drivers & safety ----------
    const roster = drv.filter((d) => d.roster || d.tr).map((d) => ({
      name: d.name, isNew: !!d.tr, when: d.tr ? d.tr.at : '', course: d.tr ? d.tr.course : d.mods < 15 ? 'Onboarding' : 'Complete',
      tagBg: d.tr ? 'rgba(30,58,110,.10)' : 'rgba(108,179,227,.14)', tagFg: d.tr ? '#1e3a6e' : '#1d4f91',
      meta: d.exp + 'yr experience • ' + (d.truck ? d.truck.id + ' • ' + d.truck.lane : d.onCall ? 'On call' : 'Off duty') + ' • safety ' + d.safety,
      pct: d.tr ? '0%' : Math.round(d.mods / 15 * 100) + '%', mods: d.tr ? '0/4 modules (new course)' : d.mods + '/15 modules', fam: d.fam + '%', sortKey: d.tr ? 0 : 1
    })).sort((a, b) => a.sortKey - b.sortKey);
    const devKpis = [this.kpi('In training', String(roster.length), Object.keys(trn).length ? Object.keys(trn).length + ' assigned this session' : '10 drivers onboarding', 'blue', Object.keys(trn).length ? 'blue' : 'muted'), this.kpi('Idle reduction', String(idleTrained.length), 'Drivers enrolled', 'neutral'), this.kpi('Safety refresher', String(safetyTrained.length), 'Drivers enrolled', 'neutral'), this.kpi('Avg lane familiarity', Math.round(drv.reduce((a, d) => a + d.fam, 0) / drv.length) + '%', 'All ' + drv.length + ' drivers')];
    const low = drv.filter((d) => d.safety < 80).sort((a, b) => a.safety - b.safety);
    const safetyList = low.map((d) => ({ name: d.name, truck: d.truck ? d.truck.id : d.onCall ? 'on call' : 'off duty', meta: d.hb + ' hard brakes • ' + d.sp + ' speeding (30 days)' + (d.tr ? ' • ' + d.tr.course + ' assigned ' + d.tr.at : ''), score: d.safety, label: d.tr ? 'In training' : 'Assign training', bg: d.tr ? '#e5e8ed' : '#1e3a6e', fg: d.tr ? '#4b5563' : '#ffffff', assign: assignTraining([d.name], 'Safety refresher') }));
    const safeKpis = [this.kpi('Avg safety score', (drv.reduce((a, d) => a + d.safety, 0) / drv.length).toFixed(1), 'All ' + drv.length + ' drivers'), this.kpi('Hard braking (30 days)', String(drv.reduce((a, d) => a + d.hb, 0)), 'Fleet total', 'amber'), this.kpi('Drivers below 80', String(low.length), safetyTrained.length ? safetyTrained.length + ' now in safety training' : 'None in training yet', 'red', safetyTrained.length ? 'blue' : 'muted'), this.kpi('Accidents / million km', kv('acc', 1).toFixed(2), 'Target 0.44 • same as KPI scorecard', 'blue')];

    // ---------- Reports ----------
    const CATS = { Operations: ['#eff6ff', '#1d4ed8', 'Operations team'], Financial: ['#fffbeb', '#92400e', 'Finance team'], Customer: ['#f5f3ff', '#6d28d9', 'Account managers'], 'Safety & Compliance': ['#fef2f2', '#b91c1c', 'Safety manager'], 'Fleet & Maintenance': ['#ecfeff', '#0e7490', 'Maintenance team'] };
    const NEXT = { Daily: 'Tomorrow 6:00 AM', Weekly: 'Mon, Jan 26', Monthly: 'Feb 1', Quarterly: 'Apr 1' };
    const LIVE = {
      'Daily Operations Summary': fc.active + ' active trucks • ' + openBreak.length + ' open breakdowns • ' + alerts.length + ' alerts',
      'Dispatch & Load Status': live.filter((t) => t.load).length + ' open loads • ' + openBreak.length + ' at risk',
      'Lane Profitability': '10 lanes • ' + money(captWk) + '/week captured this session',
      'Empty Kilometres by Lane': 'Empty km ' + kv('empty', 1).toFixed(1) + '% this month',
      'Monthly P&L by Terminal': 'Operating ratio ' + kv('or', 1).toFixed(1) + '% this month',
      'Revenue & Cost per Kilometre': 'Cost per km $' + kv('cpm', 1).toFixed(2) + ' • revenue $1.78',
      'Fuel Tax (IFTA) Summary': 'Q1 filing • 2 provinces, 4 states',
      'Shipper Scorecard': custRows.filter((c) => c.health === 'At risk').length + ' at risk • ' + custRows.filter((c) => c.health === 'Watch').length + ' on watch',
      'On-Time Delivery by Customer': 'On-time ' + kv('otd', 1).toFixed(1) + '% this month',
      'Detention & Dwell': fc.dock + ' trucks at docks now • avg dwell 2.4h',
      'Claims & Damage Log': 'Claims ratio ' + kv('claims', 1).toFixed(2) + '%',
      'HOS Violations': kv('hos', 1).toFixed(1) + ' per 100 drivers • 1 driver near limit',
      'Driver Safety Scores': low.length + ' drivers below 80 • ' + safetyTrained.length + ' in training',
      'DVIR Defects': attnCount + ' trucks with open defects or faults',
      'CSA BASIC Summary': 'All BASICs below intervention threshold',
      'Accident & Incident Register': fc.breakdown + ' roadside incidents today',
      'Preventive Maintenance Due': B.trucks.filter((t) => t.next < 0 && !svc[t.id]).length + ' overdue • ' + nSvc + ' booked this session',
      'Fault Codes & Breakdowns': B.trucks.filter((t) => t.fault && !svc[t.id]).length + ' active fault codes',
      'Asset Utilization': fc.active + ' of ' + fc.total + ' trucks active'
    };
    const reportDefs = [
      ['Operations', 'Daily Operations Summary', 'Loads delivered, on-time rate, kilometres, breakdowns and exceptions from the last 24 hours.', 'Daily', 'Today 6:00 AM'],
      ['Operations', 'Dispatch & Load Status', 'Every open load with driver, ETA, appointment window and delay risk.', 'Daily', 'Today 6:00 AM'],
      ['Operations', 'Lane Profitability', 'Revenue, cost and margin per lane, with empty km and return-load fill.', 'Weekly', 'Mon, Jan 19'],
      ['Operations', 'Empty Kilometres by Lane', 'Empty kilometres by lane and terminal with return-load opportunities.', 'Weekly', 'Mon, Jan 19'],
      ['Financial', 'Monthly P&L by Terminal', 'Revenue, operating cost, operating ratio and margin for each terminal.', 'Monthly', 'Jan 1'],
      ['Financial', 'Revenue & Cost per Kilometre', 'Revenue, fuel, labour and maintenance per km, trended against budget.', 'Monthly', 'Jan 1'],
      ['Financial', 'Fuel Tax (IFTA) Summary', 'Kilometres and fuel purchased by province and state for quarterly IFTA filing.', 'Quarterly', 'Jan 1'],
      ['Customer', 'Shipper Scorecard', 'On-time, tender acceptance, dwell and claims for each shipper, ready to share.', 'Monthly', 'Jan 1'],
      ['Customer', 'On-Time Delivery by Customer', 'Late loads by shipper and lane, with root cause.', 'Weekly', 'Mon, Jan 19'],
      ['Customer', 'Detention & Dwell', 'Dock wait time by facility and the detention charges it supports.', 'Weekly', 'Mon, Jan 19'],
      ['Customer', 'Claims & Damage Log', 'Open and closed cargo claims with amounts, cause and status.', 'Monthly', 'Jan 1'],
      ['Safety & Compliance', 'HOS Violations', 'Hours-of-service violations by driver and type from ELD logs.', 'Weekly', 'Mon, Jan 19'],
      ['Safety & Compliance', 'Driver Safety Scores', 'Hard braking, speeding and safety score trend for every driver.', 'Monthly', 'Jan 1'],
      ['Safety & Compliance', 'DVIR Defects', 'Defects from driver vehicle inspection reports and whether they were repaired.', 'Daily', 'Today 6:00 AM'],
      ['Safety & Compliance', 'CSA BASIC Summary', 'Your scores in each CSA BASIC category, with the inspections behind them.', 'Monthly', 'Jan 1'],
      ['Safety & Compliance', 'Accident & Incident Register', 'Every accident and incident with preventability and follow-up actions.', 'Monthly', 'Jan 1'],
      ['Fleet & Maintenance', 'Preventive Maintenance Due', 'Tractors and trailers due or overdue for service in the next 14 days.', 'Weekly', 'Mon, Jan 19'],
      ['Fleet & Maintenance', 'Fault Codes & Breakdowns', 'Active fault codes, roadside breakdowns and repair status by truck.', 'Daily', 'Today 6:00 AM'],
      ['Fleet & Maintenance', 'Asset Utilization', 'Kilometres, loaded hours and idle days for each tractor and trailer.', 'Monthly', 'Jan 1']
    ];
    const defaultSched = { 'Daily Operations Summary': 1, 'Monthly P&L by Terminal': 1, 'Fuel Tax (IFTA) Summary': 1, 'Shipper Scorecard': 1, 'HOS Violations': 1, 'Preventive Maintenance Due': 1, 'Fault Codes & Breakdowns': 1 };
    const sched = s.sched || defaultSched, repCat = s.repCat || 'All', repQ = s.repQ || '';
    const allReps = reportDefs.map((r, i) => {
      const k = 'rep' + i, ran = !!done[k];
      return {
        cat: r[0], name: r[1], desc: r[2], freq: r[3], last: ran ? 'Today ' + this.stamp() : r[4], live: 'Now: ' + LIVE[r[1]], fmt: r[0] === 'Financial' ? 'PDF • Excel' : 'PDF • Excel • CSV', fmt1: r[0] === 'Financial' ? 'Excel' : 'PDF',
        catBg: CATS[r[0]][0], catFg: CATS[r[0]][1], to: CATS[r[0]][2], next: NEXT[r[3]], isSched: !!sched[r[1]], schedLabel: sched[r[1]] ? 'Unschedule' : 'Schedule',
        toggle: () => this.act((p) => { const cur = Object.assign({}, p.sched || defaultSched); if (cur[r[1]]) delete cur[r[1]]; else cur[r[1]] = 1; return { sched: cur }; }, (sched[r[1]] ? 'Unscheduled ' : 'Scheduled ') + r[1] + ' (' + r[3].toLowerCase() + ')', 'info'),
        run: { label: ran ? 'Run again' : 'Run report', click: () => this.act((p) => ({ done: Object.assign({}, p.done, { [k]: true }), exportsNew: [{ type: r[0] === 'Financial' ? 'XLS' : 'PDF', name: r[1], meta: 'You • ' + this.stamp() + ' • ' + LIVE[r[1]] }].concat(p.exportsNew || []) }), r[1] + ' report generated', 'info'), bg: '#ffffff', fg: '#1e3a6e', bd: '#1e3a6e' }
      };
    });
    const q = repQ.trim().toLowerCase();
    const repList = allReps.filter((r) => (repCat === 'All' || r.cat === repCat) && (!q || (r.name + ' ' + r.desc).toLowerCase().indexOf(q) >= 0));
    const repCats = ['All'].concat(Object.keys(CATS)).map((c) => ({ label: c, count: c === 'All' ? allReps.length : allReps.filter((r) => r.cat === c).length, on: repCat === c, pick: () => this.setState({ repCat: c }), bg: repCat === c ? 'rgba(108,179,227,.16)' : '#ffffff', bd: repCat === c ? '#6cb3e3' : '#d5dae2', fg: repCat === c ? '#1d4f91' : '#374151' }));
    const schedRows = allReps.filter((r) => r.isSched);
    const exportsNew = s.exportsNew || [];
    const repSummary = [{ label: 'Reports available', value: String(allReps.length), sub: 'Across 5 categories' }, { label: 'Scheduled', value: String(schedRows.length), sub: 'Delivered automatically' }, { label: 'Exports this month', value: String(142 + exportsNew.length), sub: exportsNew.length ? exportsNew.length + ' generated this session' : '38 PDF • 104 Excel and CSV' }, { label: 'Next scheduled run', value: '6:00 AM', sub: 'Tomorrow • ' + schedRows.filter((r) => r.freq === 'Daily').length + ' daily reports' }];
    const exportsList = exportsNew.concat([{ type: 'PDF', name: 'Daily Operations Summary', meta: 'Scheduled • Today 6:00 AM • 412 KB' }, { type: 'XLS', name: 'Lane Profitability', meta: 'Dispatch team • Yesterday 4:12 PM • 1.2 MB' }, { type: 'PDF', name: 'Shipper Scorecard: Maple Fresh Foods', meta: 'Account managers • Jan 18 • 286 KB' }, { type: 'CSV', name: 'HOS Violations', meta: 'Safety manager • Jan 19 • 64 KB' }, { type: 'XLS', name: 'Fuel Tax (IFTA) Summary', meta: 'Finance team • Jan 2 • 940 KB' }]).map((e, i) => ({ type: e.type, name: e.name, meta: e.meta, bg: e.type === 'PDF' ? '#fef2f2' : '#e8edf6', fg: e.type === 'PDF' ? '#b91c1c' : '#1e3a6e', btn: Object.assign(this.btn('exp' + e.name + e.meta, 'Download', 'Downloaded'), { tfg: done['exp' + e.name + e.meta] ? '#6b7280' : '#1e3a6e' }) }));
    const newReport = Object.assign(this.btn('newReport', 'New custom report', 'Draft report created', 'Draft custom report created', 'info'), done.newReport ? { bg: '#e5e8ed', fg: '#4b5563' } : { bg: '#1e3a6e', fg: '#ffffff' });

    // ================= PLANNING VIEW MODELS (Dashboard, Scenario, Reports) =================
    const fT = (m) => this.fmtT(m), fD = (m) => this.fmtDur(m), sg = (v, d, u) => this.sgn(v, d, u), sm = (v) => this.sgnMoney(v);
    const pct = (v, d) => v.toFixed(d == null ? 1 : d) + '%', int = (v) => Math.round(v).toLocaleString('en-US');
    const K = C.m, BK = PL.best.m, S0 = PL.start.m, dis = s.dis || {};
    const endDate = new Date(this.startDate().getTime() + days * 86400000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
    const periodTxt = 'the next ' + days + ' days (Tue Jan 20 to ' + endDate + ')', periodShort = 'next ' + days + ' days';
    const remFg = (m) => m <= 0 ? '#b91c1c' : m < 60 ? '#b91c1c' : m < 180 ? '#b45309' : '#1d4f91';
    const GS = { 'On track': ['rgba(29,111,165,.05)', '#c6e2f5', 'rgba(29,111,165,.14)', '#1d4f91'], 'At risk': ['rgba(245,158,11,.06)', 'rgba(245,158,11,.45)', 'rgba(245,158,11,.18)', '#92400e'], 'Unachievable': ['rgba(239,68,68,.05)', 'rgba(239,68,68,.40)', 'rgba(239,68,68,.14)', '#b91c1c'] };
    const LS = { 'On time': ['rgba(29,111,165,.12)', '#1d4f91'], 'Tight': ['rgba(245,158,11,.16)', '#92400e'], 'At risk': ['rgba(239,68,68,.12)', '#b91c1c'], 'Conflict': ['rgba(239,68,68,.12)', '#b91c1c'], 'Unassigned': ['rgba(239,68,68,.12)', '#b91c1c'], 'Rescheduled': ['rgba(109,40,217,.10)', '#6d28d9'], 'Declined': ['#eef0f3', '#4b5563'] };
    const meets = (v, t, up) => up ? v >= t - 1e-9 : v <= t + 1e-9;
    const openL = PL.open, firstAct = openL.length ? openL[0].issue.act : null;
    const leversOpen = PL.levers.filter((g) => !g.isDone);
    const short = (l) => (l.issue ? l.issue.cause : '').split('. ')[0].replace(/\.$/, '');
    const totLoads = C.counts.n + C.counts.F;
    const fin = C.fin, cash = C.cash;
    const kMoney = (v) => (v < 0 ? '−$' : '$') + Math.round(Math.abs(v) / 100) / 10 + 'K';

    // ---------- Goals: target, prediction, cause, deadline, future-back ----------
    const goalStatus = {};
    const goalRows = [
      { k: 'otd', label: 'On-time delivery', up: true, t: goals.otd, v: K.otd, b: BK.otd },
      { k: 'margin', label: 'Operating margin', up: true, t: goals.margin, v: K.margin, b: BK.margin },
      { k: 'empty', label: 'Empty kilometres (share of total km)', up: false, t: goals.empty, v: K.empty, b: BK.empty },
      { k: 'cash', label: 'Minimum cash balance', up: true, t: goals.cash, v: K.cash, b: Math.max(K.cash, BK.cash) }
    ].map((g) => {
      const st = meets(g.v, g.t, g.up) ? 'On track' : meets(g.b, g.t, g.up) ? 'At risk' : 'Unachievable';
      goalStatus[g.k] = st;
      let cause = '', back = '', change = '', action = '', dl = null, dlTxt = '';
      if (g.k === 'otd') {
        const need = Math.ceil(g.t / 100 * totLoads - 1e-9), have = Math.floor(K.otd / 100 * totLoads + 1e-9);
        cause = openL.length ? openL.length + ' load' + (openL.length === 1 ? ' is' : 's are') + ' predicted late or without a truck: ' + openL.slice(0, 3).map((l) => '#' + l.no + ' (' + short(l) + ')').join('; ') + (openL.length > 3 ? '; and ' + (openL.length - 3) + ' more' : '') + '.' : 'Every load in the detailed schedule is predicted on time.';
        back = 'To reach ' + g.t + '%, at least ' + int(need) + ' of the ' + int(totLoads) + ' loads due in the period must arrive on time. Forecast: ' + int(have) + '.' + (have < need ? ' Recover at least ' + Math.min(openL.length, need - have) + ' of the ' + openL.length + ' at-risk loads before their deadlines.' : '');
        dl = firstAct;
        if (st === 'Unachievable') { const gap = Math.max(1, Math.ceil(need - BK.otd / 100 * totLoads)), trucks = Math.max(1, Math.ceil(gap / (6 * days / 7))); change = 'Even with every feasible response approved, the plan reaches ' + pct(g.b) + '. Reaching ' + g.t + '% needs about ' + gap + ' more on-time deliveries than current trucks, drivers and delivery windows allow. Options: add ' + trucks + ' tractor' + (trucks === 1 ? '' : 's') + ' with drivers or contracted partner capacity, or agree wider delivery windows with customers. The target stays at ' + g.t + '% until you change it.'; }
        if (st === 'At risk') action = 'Approve responses for the at-risk loads, starting with #' + (openL[0] ? openL[0].no : '') + '.';
      } else if (g.k === 'margin') {
        const need = g.t / 100 * fin.rev, parts = [];
        if (fin.claim) parts.push(money(fin.claim) + ' cargo claim exposure on #4471');
        if (fin.fees) parts.push(money(fin.fees) + ' in expected late and rescheduling fees');
        if (fin.partnerCost > 1) parts.push(money(fin.partnerCost) + ' in partner premiums');
        const lvM = leversOpen.reduce((a, x) => a + Math.max(0, x.dMargin), 0);
        if (lvM > 0.005) parts.push('network savings worth ' + sg(lvM, 2, ' pts') + ' not yet approved');
        cause = (st === 'On track' ? 'Forecast clears the minimum.' + (parts.length ? ' Still carrying: ' : '') : 'Margin is held back by ') + parts.join('; ') + (parts.length ? '.' : '');
        back = 'To reach ' + g.t + '%, the period needs ' + money(need) + ' of operating profit on ' + money(fin.rev) + ' of revenue. Forecast: ' + money(fin.profit) + (fin.profit < need ? ', a gap of ' + money(need - fin.profit) : '') + '.';
        const cl = C.LB['4471']; dl = fin.claim && cl && cl.issue ? cl.issue.act : firstAct != null ? firstAct : 3600;
        if (st === 'Unachievable') { const gap = (g.t - g.b) / 100 * PL.best.fin.rev; change = 'Even with every response and network saving approved, the plan reaches ' + pct(g.b, 2) + '. Reaching ' + g.t + '% needs ' + money(gap) + ' more profit over ' + days + ' days, about $' + (gap / PL.best.km.total).toFixed(3) + ' per km: reprice under-margin lanes, reduce partner use or lower cost per km. The target stays at ' + g.t + '%.'; }
        if (st === 'At risk') action = fin.claim ? 'Recover #4471 before ' + fT(dl) + ' to remove the claim exposure, then approve the pricing and consolidation changes.' : 'Approve the network savings in Priority Actions.';
      } else if (g.k === 'cash') {
        const late = cash.events.filter((e) => e.late), minE = fT(cash.minT);
        cause = 'Cash is lowest at ' + kMoney(cash.min) + ' on ' + minE + '.' + (late.length ? ' ' + late.map((e) => e.party + ' invoice ' + e.id + ' (' + kMoney(e.amt) + ') now arrives ' + fT(e.t) + (e.inPeriod ? '' : ', after the period')).join('; ') + '.' : '') + (cash.now > 0 ? ' Approved responses and roadside work cost ' + kMoney(cash.now) + ' in cash now.' : '') + ' Revenue and profit are not changed by payment timing.';
        back = 'To keep at least ' + kMoney(g.t * 1000) + ' on hand, receipts must arrive before the ' + fT(cash.events.filter((e) => e.kind === 'out' && e.inPeriod)[0] ? cash.events.filter((e) => e.kind === 'out' && e.inPeriod)[0].t : nowM) + ' supplier payment run. Opening ' + kMoney(cash.opening) + ', collections ' + kMoney(cash.collections) + ', payments ' + kMoney(cash.payments) + ', closing ' + kMoney(cash.closing) + '.';
        dl = late.length ? Math.min.apply(null, cash.events.filter((e) => e.kind === 'out' && e.inPeriod).map((e) => e.t)) : null;
        if (st === 'Unachievable') { const gap = g.t * 1000 - PL.best.cash.min; change = 'No operational response restores the late receipt inside the period. Keeping ' + kMoney(g.t * 1000) + ' needs ' + kMoney(gap) + ' more cash at the low point: collect ' + (late[0] ? late[0].id : 'the overdue invoice') + ' early, move a supplier payment to its terms date, or draw on the credit line. The target stays at ' + kMoney(g.t * 1000) + '.'; }
        if (st === 'At risk') action = 'Approve the responses that cut cash spent now.';
      } else {
        const maxKm = g.t / 100 * C.km.total, lv = leversOpen.filter((x) => x.dEmpty < -0.005), lvE = lv.reduce((a, x) => a + x.dEmpty, 0);
        cause = 'Empty running is ' + pct(g.v, 2) + ' of ' + int(C.km.total) + ' planned km.' + (lv.length ? ' Lane changes and optimized routes not yet approved would cut it by ' + Math.abs(lvE).toFixed(2) + ' pts.' : '') + (C.km.extra ? ' Approved responses add ' + int(C.km.extra) + ' empty km.' : '');
        back = 'To stay at or below ' + g.t + '%, no more than ' + int(maxKm) + ' empty km in the period. Forecast: ' + int(C.km.empty) + (C.km.empty > maxKm ? ', ' + int(C.km.empty - maxKm) + ' km too many' : '') + '.';
        dl = 3600;
        if (st === 'Unachievable') { const gap = (g.b - g.t) / 100 * PL.best.km.total; change = 'Even with every route change approved, empty running is ' + pct(g.b, 2) + '. Reaching ' + g.t + '% needs about ' + int(gap) + ' fewer empty km: more return loads on the Montreal and Ottawa lanes, or fewer one-way commitments. The target stays at ' + g.t + '%.'; }
        if (st === 'At risk') action = 'Approve the route changes before the Thursday 12:00 PM dispatch planning cut-off.';
      }
      const c = GS[st];
      dlTxt = dl == null ? 'None needed' : fT(dl);
      const fmtG = (v) => g.k === 'cash' ? kMoney(v * 1000) : pct(v, g.k === 'otd' ? 1 : 2);
      return { k: g.k, label: g.label, status: st, bg: c[0], bd: c[1], pillBg: c[2], pillFg: c[3], targetTxt: (g.up ? '≥ ' : '≤ ') + (g.k === 'cash' ? kMoney(g.t * 1000) : g.t + '%'), predTxt: fmtG(g.v), predFg: st === 'On track' ? '#0f172a' : c[3], bestTxt: fmtG(g.b), explain: () => { this.setState({ insightQ: g.k }); this.scrollTo('insights'); },
        cause, back, change, hasChange: !!change, action, hasAction: !!action && st !== 'On track', deadline: st === 'On track' && g.k !== 'otd' ? 'No intervention needed' : dlTxt, rem: dl == null || (st === 'On track' && g.k !== 'otd') ? '' : fD(dl - nowM), remFg: dl == null ? '#6b7280' : remFg(dl - nowM) };
    });
    const setGoal = (k, lo, hi) => (e) => { const v = parseFloat(e.target.value); if (!isFinite(v)) return; this.setState((p) => ({ goals: Object.assign({}, p.goals || { otd: 95, margin: 8, empty: 10, cash: 250 }, { [k]: Math.max(lo, Math.min(hi, Math.round(v * 10) / 10)) }) })); };
    const goalInputs = [['otd', 'On-time target', 80, 100, 0.5, '%'], ['margin', 'Minimum margin', 0, 25, 0.1, '%'], ['empty', 'Maximum empty km', 2, 30, 0.1, '%'], ['cash', 'Minimum cash', 0, 1000, 5, '$K']].map((r) => ({ label: r[1], val: String(goals[r[0]]), min: r[2], max: r[3], step: r[4], suffix: r[5], on: setGoal(r[0], r[2], r[3]) }));

    // ================= TARGETS: 30, 60 AND 90 DAYS (same model as every other view) =================
    const TD = this.tdata(), TC = PL.tcur, TS = PL.tstart, DL = TD.deadlines;
    const dayDate = (d) => new Date(this.startDate().getTime() + d * 86400000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
    const minDate = (m) => dayDate(Math.floor(m / 1440)) + ' ' + this.fmtT(m).split(' ').slice(1).join(' ');
    GS['Off track'] = GS['Unachievable'];
    const fmtM = (m, v) => m.k === 'cash' ? kMoney(v * 1000) : v.toFixed(m.dec) + '%';
    const fmtGap = (m, g) => m.k === 'cash' ? (g >= 0 ? '+' : '−') + kMoney(Math.abs(g) * 1000) : sg(g, Math.abs(g) > 1e-9 && Math.abs(g) < 0.5 * Math.pow(10, -m.dec) ? 2 : m.dec, ' pts');
    const epsOf = (m) => m.k === 'cash' ? 0.05 : 0.005, better = (m, x) => (m.up ? x : -x) > epsOf(m), worseBy = (m, x) => (m.up ? x : -x) < -epsOf(m);
    const cashTxt = (x) => Math.abs(x) < 0.05 ? 'unchanged' : (x >= 0 ? '+' : '−') + kMoney(Math.abs(x) * 1000);
    const predFmt = (m, v, t) => m.k !== 'cash' && Math.abs(v - t) < 0.05 && Math.abs(v - t) > 1e-9 ? v.toFixed(2) + '%' : fmtM(m, v);
    const curOf = { otd: K.otd, margin: K.margin, empty: K.empty, cover: K.cover, util: K.util, cash: K.cash };
    const setTarget = (k, i, lo, hi) => (e) => { const v = parseFloat(e.target.value); if (!isFinite(v)) return; this.setState((p) => { const t = Object.assign({}, TGT, p.targets || {}); const arr = (t[k] || TGT[k]).slice(); arr[i] = Math.max(lo, Math.min(hi, Math.round(v * 10) / 10)); return { targets: Object.assign({}, t, { [k]: arr }) }; }); };
    const lim = { otd: [80, 100, 0.5], margin: [0, 25, 0.1], empty: [2, 30, 0.1], cover: [80, 100, 0.5], util: [50, 100, 0.5], cash: [0, 2000, 5] };
    const actLabel = (a) => a.label;
    const whyOff = (m, i) => {
      const w = TC.w[i], b = PL.tBest[m.k][i], used = PL.tBestActs[m.k].map((id) => (PL.tActs.filter((a) => a.id === id)[0] || {}).label).filter(Boolean);
      const withAll = used.length ? ' Even with every available action (' + used.join('; ') + '), the best achievable is ' + fmtM(m, b) + '.' : ' No available action improves it; the best achievable is ' + fmtM(m, b) + '.';
      if (m.k === 'otd') return 'Demand grows to ' + w.demandEnd.toFixed(1) + ' loads a day by ' + dayDate(DL[i]) + ' while fleet capacity is about ' + w.capEnd.toFixed(1) + '; ' + Math.round(w.unc) + ' loads would go to spot carriers and ' + w.bd.toFixed(1) + ' extra breakdowns are expected.' + withAll + ' Closing the rest needs more contracted capacity or wider delivery windows.';
      if (m.k === 'margin') return 'Breakdown repairs, spot-carrier premiums and late penalties cost about $' + int(w.cost - w.rev * (1 - PD.MF)) + ' above the base cost rate in this period.' + withAll + ' Closing the rest needs higher rates or a lower cost per km.';
      if (m.k === 'empty') return 'After every approved route change the base empty share is ' + (TC.er * 100).toFixed(2) + '%.' + withAll + ' Closing the rest needs new return-load business on the Montreal and Ottawa lanes.';
      if (m.k === 'cover') return 'Demand reaches ' + w.demandEnd.toFixed(1) + ' loads a day against capacity of ' + w.capEnd.toFixed(1) + '.' + withAll + ' Closing the rest needs more trucks or partner capacity.';
      if (m.k === 'util') return 'By ' + dayDate(DL[i]) + ' the own fleet can carry about ' + (w.capEnd - (w.capEnd > w.demandEnd ? 0 : 0) - ((PL.base.flags || {}).partnerCap ? 2 : 0)).toFixed(1) + ' loads a day against demand of ' + w.demandEnd.toFixed(1) + ', and the rest of the 50-truck fleet is in the shop, broken down or held as spares.' + withAll + ' Reaching ' + fmtM(m, TGT.util[i]) + ' needs about ' + Math.max(0.1, (TGT.util[i] - b) / 100 * TD.utilDen).toFixed(1) + ' more loads a day carried by own trucks: fewer trucks in the shop, more loads per truck-day, or new business.';
      return 'The lowest balance is ' + kMoney(w.cash * 1000) + ' on ' + minDate(w.cashT) + ', after payroll, fuel' + (i === 2 ? ', loan principal and the annual insurance premium' : ' and loan principal') + '.' + withAll + ' Closing the rest needs a credit line or a later supplier payment date.';
    };
    const backOf = (m, i) => {
      const w = TC.w[i], t = TGT[m.k][i], end = dayDate(DL[i]);
      if (m.k === 'otd') { const need = Math.ceil(t / 100 * w.loads); return 'For the 30 days ending ' + end + ': at least ' + int(need) + ' of ' + int(w.loads) + ' loads on time. Forecast ' + int(w.loads - w.late) + (need > w.loads - w.late ? ', so about ' + int(need - (w.loads - w.late)) + ' more on-time loads are needed' : '') + '.'; }
      if (m.k === 'margin') return 'For the 30 days ending ' + end + ': operating profit of at least $' + int(t / 100 * w.rev) + ' on $' + int(w.rev) + ' of revenue. Forecast $' + int(w.profit) + '.';
      if (m.k === 'empty') return 'For the 30 days ending ' + end + ': no more than ' + int(t / 100 * w.km) + ' empty km of ' + int(w.km) + '. Forecast ' + int(w.ekm) + '.';
      if (m.k === 'cover') return 'By ' + end + ': capacity for ' + (w.demandEnd * t / 100).toFixed(1) + ' loads a day. Forecast capacity ' + w.capEnd.toFixed(1) + ' against demand of ' + w.demandEnd.toFixed(1) + '.';
      if (m.k === 'util') return 'For the 30 days ending ' + end + ': own trucks must carry ' + (t / 100 * TD.utilDen).toFixed(1) + ' loads a day. Forecast ' + (w.util / 100 * TD.utilDen).toFixed(1) + '.';
      return 'Through ' + end + ': keep at least ' + kMoney(t * 1000) + ' in the bank. Forecast low ' + kMoney(w.cash * 1000) + ' on ' + minDate(w.cashT) + '.';
    };
    const tStatus = {};
    const targetRows = TD.measures.map((m) => {
      const cells = DL.map((d, i) => {
        const t = TGT[m.k][i], pr = TC.w[i][m.k], b = PL.tBest[m.k][i];
        const ok = (v) => (m.up ? v >= t - 1e-9 : v <= t + 1e-9);
        const st = ok(pr) ? 'On track' : ok(b) ? 'At risk' : 'Off track', c = GS[st];
        const gap = m.up ? pr - t : t - pr;
        return { d, date: dayDate(d), t, targetTxt: (m.up ? '≥ ' : '≤ ') + fmtM(m, t), pred: pr, predTxt: predFmt(m, pr, t), gap, gapTxt: fmtGap(m, gap), status: st, bg: c[0], bd: c[1], pillBg: c[2], pillFg: c[3], best: b, bestTxt: fmtM(m, b), remain: st === 'Off track' ? fmtGap(m, m.up ? b - t : t - b) : '', back: backOf(m, i), why: st === 'Off track' ? whyOff(m, i) : '', hasWhy: st === 'Off track', val: String(t), min: lim[m.k][0], max: lim[m.k][1], step: lim[m.k][2], on: setTarget(m.k, i, lim[m.k][0], lim[m.k][1]) };
      });
      tStatus[m.k] = cells.map((x) => x.status);
      const need = cells.filter((x) => x.status !== 'On track').map((x, j) => DL.indexOf(x.d));
      const acts = PL.tActs.filter((a) => need.some((i) => better(m, a.d[m.k][i]))).sort((a, b) => Math.max.apply(null, need.map((i) => (m.up ? b.d[m.k][i] : -b.d[m.k][i]))) - Math.max.apply(null, need.map((i) => (m.up ? a.d[m.k][i] : -a.d[m.k][i])))).slice(0, 3)
        .map((a) => ({ id: a.id, label: actLabel(a), effect: DL.map((d, i) => d + 'd ' + (m.k === 'cash' ? cashTxt(a.d[m.k][i]) : Math.abs(a.d[m.k][i]) < epsOf(m) ? 'no change' : fmtGap(m, a.d[m.k][i]))).join(' • '), cost: '30-day profit ' + sm(a.dProfit[0]) + ' • lowest cash ' + cashTxt(a.dCash[0]), lead: a.lead, review: () => { this.setState({ page: 'scen', pend: a.id }); this.scrollTo('targetScen'); } }));
      const worst = cells.some((x) => x.status === 'Off track') ? 'Off track' : cells.some((x) => x.status === 'At risk') ? 'At risk' : 'On track';
      return { k: m.k, label: m.label, unit: m.unit, current: fmtM(m, curOf[m.k]), currentSub: m.k === 'cash' ? 'Lowest balance, next ' + days + ' days' : 'Next ' + days + ' days, detailed plan', start: 'Start of day ' + fmtM(m, m.k === 'cash' ? PL.start.m.cash : PL.start.m[m.k]), cells, acts, hasActs: acts.length > 0, noActs: !acts.length && worst !== 'On track', allOk: worst === 'On track', worst, explain: () => { this.setState({ insightQ: m.k === 'cover' || m.k === 'util' ? 'capacity' : m.k }); this.scrollTo('insights'); } };
    });
    Object.keys(goalStatus).forEach((k) => { if (tStatus[k]) goalStatus[k] = tStatus[k][0]; });
    const tBy = {}; targetRows.forEach((r) => { tBy[r.k] = r; });
    const tSummary = DL.map((d, i) => ({ d, date: dayDate(d), on: targetRows.filter((r) => r.cells[i].status === 'On track').length, risk: targetRows.filter((r) => r.cells[i].status === 'At risk').length, off: targetRows.filter((r) => r.cells[i].status === 'Off track').length, n: targetRows.length }));
    const tLine = (r) => r.cells.map((x) => x.d + ' days (' + x.date + '): target ' + x.targetTxt + ', predicted ' + x.predTxt + ', gap ' + x.gapTxt + ', ' + x.status.toLowerCase() + (x.status === 'Off track' ? ' — best achievable ' + x.bestTxt + ', remaining gap ' + x.remain : '')).join('; ');
    // Target scenarios compared against the same current plan
    const pkgRows = PL.tActs.map((a) => {
      const closes = [], worsens = [];
      TD.measures.forEach((m) => DL.forEach((d, i) => { const t = TGT[m.k][i], ok = (v) => (m.up ? v >= t - 1e-9 : v <= t + 1e-9); if (!ok(TC.w[i][m.k]) && ok(a.t.w[i][m.k])) closes.push(m.label + ' ' + d + 'd'); if (ok(TC.w[i][m.k]) && !ok(a.t.w[i][m.k])) worsens.push(m.label + ' ' + d + 'd'); }));
      const cells = TD.measures.map((m) => ({ label: m.label, vals: DL.map((d, i) => ({ d, v: predFmt(m, a.t.w[i][m.k], TGT[m.k][i]), dl: m.k === 'cash' ? cashTxt(a.d[m.k][i]) : Math.abs(a.d[m.k][i]) < epsOf(m) ? 'no change' : fmtGap(m, a.d[m.k][i]), fg: better(m, a.d[m.k][i]) ? '#1d4f91' : worseBy(m, a.d[m.k][i]) ? '#b91c1c' : '#6b7280' })) }));
      const trade = TD.measures.filter((m) => a.d[m.k].some((x) => worseBy(m, x))).map((m) => m.label.toLowerCase() + ' (' + a.d[m.k].map((x, i) => DL[i] + 'd ' + (m.k === 'cash' ? cashTxt(x) : fmtGap(m, x))).join(', ') + ')');
      return { id: a.id, label: a.label, what: a.what, lead: a.lead, cells, closes: closes.length ? 'Closes: ' + closes.join(', ') : 'Closes no target gap on its own', worsens: worsens.length ? 'Puts on track targets at risk: ' + worsens.join(', ') : '', hasWorsens: worsens.length > 0,
        cost: 'Profit ' + DL.map((d, i) => d + 'd ' + sm(a.dProfit[i])).join(' • ') + ' • lowest cash ' + DL.map((d, i) => d + 'd ' + cashTxt(a.dCash[i])).join(' • '),
        trade: trade.length ? 'Trade-offs: worse ' + trade.join('; ') + '.' : 'Trade-offs: none of the six measures gets worse.', pending: (s.pend || null) === a.id,
        select: () => this.setState({ pend: a.id }), btnLabel: (s.pend || null) === a.id ? 'Selected' : 'Approve and apply…', btnBg: (s.pend || null) === a.id ? '#1e3a6e' : '#ffffff', btnFg: (s.pend || null) === a.id ? '#ffffff' : '#1e3a6e' };
    });
    const pkP = s.pend && /^(P:|R:)/.test(s.pend) ? PL.tActs.filter((a) => a.id === s.pend)[0] : null;
    const pkgPend = pkP ? { has: true, label: pkP.label, effect: (pkgRows.filter((r) => r.id === pkP.id)[0] || {}).closes + '. ' + (pkgRows.filter((r) => r.id === pkP.id)[0] || {}).cost + '. Every page, insight and report updates once you confirm.', confirm: () => { if (pkP.id === 'R:today') this.approveMany(pkP.keys, 'Approved with today\'s responses to protect the 30-day targets.'); else this.approvePackage(pkP.id); this.setState({ pend: null }); }, cancel: () => this.setState({ pend: null }) } : { has: false, label: '', effect: '', confirm: () => {}, cancel: () => {} };
    const tPending = pkP ? true : false;

    // ---------- Six KPI cards ----------
    const card = (label, value, st, target, period, start, def) => { const c = GS[st] || GS['On track']; return { label, value, status: st, stFg: c[3], bar: st === 'On track' ? '#1e3a6e' : st === 'At risk' ? '#f59e0b' : '#dc2626', target, period, start, def }; };
    const kpiCards = [
      card('Predicted on-time delivery', pct(K.otd), tStatus.otd[0], '30-day target ≥ ' + TGT.otd[0] + '%', 'Now: next ' + days + ' days • 30d forecast ' + tBy.otd.cells[0].predTxt, '60d ' + tStatus.otd[1].toLowerCase() + ' • 90d ' + tStatus.otd[2].toLowerCase(), 'Loads predicted to arrive inside the customer’s delivery window ÷ all loads due in the period (detailed schedule plus forecast volume). A rescheduled delivery counts as late.'),
      card('Loads at risk', String(K.risk), K.risk ? 'At risk' : 'On track', 'Target 0', 'Due in the next ' + days + ' days', 'Start of day: ' + S0.risk, 'Loads predicted to miss their delivery window, with no truck, or in a resource conflict, that still need a decision.'),
      card('Expected operating margin', pct(K.margin, 2), tStatus.margin[0], '30-day target ≥ ' + TGT.margin[0] + '%', 'Now: next ' + days + ' days • 30d forecast ' + tBy.margin.cells[0].predTxt, '60d ' + tStatus.margin[1].toLowerCase() + ' • 90d ' + tStatus.margin[2].toLowerCase(), '(Revenue − operating cost) ÷ revenue, including partner premiums, late fees, claim exposure and approved network savings.'),
      card('Capacity coverage', pct(K.cover), tStatus.cover[0], '30-day target ≥ ' + TGT.cover[0] + '%', 'Now: ' + C.counts.covered + ' of ' + C.counts.planned + ' planned loads • 30d forecast ' + tBy.cover.cells[0].predTxt, '60d ' + tStatus.cover[1].toLowerCase() + ' • 90d ' + tStatus.cover[2].toLowerCase(), 'Planned loads with a compatible truck and an eligible driver (enough driving hours) assigned ÷ planned loads in the period.'),
      card('Empty kilometres', pct(K.empty, 2), tStatus.empty[0], '30-day target ≤ ' + TGT.empty[0] + '%', 'Now: next ' + days + ' days • 30d forecast ' + tBy.empty.cells[0].predTxt, '60d ' + tStatus.empty[1].toLowerCase() + ' • 90d ' + tStatus.empty[2].toLowerCase(), 'Kilometres driven without a load ÷ total kilometres driven, including repositioning for approved responses.'),
      card('Fleet utilization', pct(K.util, 0), tStatus.util[0], '30-day target ≥ ' + TGT.util[0] + '%', 'Now: ' + K.active + ' of 50 trucks • 30d forecast ' + tBy.util.cells[0].predTxt, '60d ' + tStatus.util[1].toLowerCase() + ' • 90d ' + tStatus.util[2].toLowerCase(), 'Trucks loaded, loading or dispatched to a load ÷ the 50-truck fleet. Trucks in the shop, broken down or idle count as unused.')
    ];

    // ---------- Disruptions ----------
    const setDis = (k) => () => { const on = !!(this.state.dis || {})[k]; this.act((p) => ({ dis: Object.assign({}, p.dis, { [k]: !on }), showDis: true, demo: p.demo === 2 && k === 'truck' && !on ? 3 : p.demo }), (on ? 'Disruption cleared: ' : 'Disruption simulated: ') + PD.DIS[k].title, on ? 'info' : 'warn'); };
    const disOpts = Object.keys(PD.DIS).map((k) => ({ label: PD.DIS[k].label, on: !!dis[k], toggle: setDis(k), stateTxt: dis[k] ? 'Active • click to clear' : 'Simulate', bg: dis[k] ? 'rgba(239,68,68,.08)' : '#ffffff', bd: dis[k] ? 'rgba(239,68,68,.55)' : '#d5dae2', fg: dis[k] ? '#b91c1c' : '#1f2937' }));
    const disActive = PL.disKeys.map((k) => {
      const d = PD.DIS[k], l = d.load ? C.LB[d.load] : null, also = k === 'route' ? C.loads.filter((x) => x.routeHit && x.no !== d.load && !(dis.truck && x.no === '4562')) : k === 'supplier' ? C.loads.filter((x) => x.no !== d.load && x.chosen && x.chosen.shopTruck) : [];
      const loads = [l].concat(also).filter(Boolean).map((x) => ({ no: x.no, cust: x.cust, status: x.status + (x.eta != null && x.status !== 'Declined' ? ' (arrives ' + fT(x.eta) + ', due ' + fT(x.due) + ')' : ''), why: x.no === d.load ? (x.chosen ? 'Response approved: ' + x.chosen.label : d.why.split('. ')[0]) : 'Also on the 401 east of Belleville; ' + (x.onTime ? 'still on time' : 'now at risk') }));
      if (k === 'supplier') { loads.forEach((a) => { if (a.no !== d.load) a.why = 'Depends on a truck from ' + PD.SHOP.supplier + '; ' + (C.LB[a.no].risk ? 'approved plan no longer works' : 'still feasible'); }); Object.keys(C.rel).forEach((id) => loads.push({ no: id, cust: PD.SHOP.supplier, status: 'Released ' + fT(C.rel[id]), why: 'was ' + fT(PD.SHOP.release[id]) })); }
      if (k === 'payment') { const e = cash.events.filter((x) => x.id === d.invoice)[0]; loads.push({ no: d.invoice, cust: 'Northline Retail', status: 'Receipt moves to ' + fT(e.t) + (e.inPeriod ? '' : ' (after the period)'), why: 'Cash low point ' + kMoney(PL.plan0.cash.min) + ' → ' + kMoney(cash.min) + '; revenue and profit unchanged' }); }
      const open = k === 'payment' ? cash.min < goals.cash * 1000 : !!(l && l.risk);
      return { title: d.title, why: d.why, kind: d.label, loads, deadline: fT(d.act), rem: open ? fD(d.act - nowM) : 'Handled', remFg: open ? remFg(d.act - nowM) : '#1d4f91', compare: k === 'payment' ? () => this.scrollTo('finance') : review(d.load), cta: k === 'payment' ? 'See cash forecast' : open ? 'Compare responses' : 'View decision' };
    });
    const mRow = (label, f, up, t) => ({ label, f, up, t });
    const metricDefs = [
      mRow('Predicted on-time delivery', (m) => pct(m.otd), true, '≥ ' + goals.otd + '%'), mRow('Loads at risk', (m) => String(m.risk), false, '0'),
      mRow('Expected operating margin', (m) => pct(m.margin, 2), true, '≥ ' + goals.margin + '%'), mRow('Capacity coverage', (m) => pct(m.cover), true, '≥ ' + TGT.cover[0] + '%'),
      mRow('Empty kilometres', (m) => pct(m.empty, 2), false, '≤ ' + goals.empty + '%'), mRow('Fleet utilization (now)', (m) => pct(m.util, 0), true, '≥ ' + TGT.util[0] + '%'),
      mRow('Minimum cash balance', (m) => kMoney(m.cash * 1000), true, '≥ ' + kMoney(goals.cash * 1000))
    ];
    const keyOf = ['otd', 'risk', 'margin', 'cover', 'empty', 'util', 'cash'];
    const worse = (a, b, i) => { const k = keyOf[i], up = metricDefs[i].up; return up ? b < a - 1e-6 : b > a + 1e-6; };
    const disImpact = metricDefs.map((d, i) => { const a = PL.plan0.m[keyOf[i]], b = PL.noResp.m[keyOf[i]]; return Math.abs(a - b) > 1e-6 ? d.label.replace('Predicted ', '').replace('Expected ', '') + ' ' + d.f(PL.plan0.m) + ' → ' + d.f(PL.noResp.m) : null; }).filter(Boolean).join(' • ') || 'No change to the period goals yet, but the affected loads still need a decision.';
    const scenRows = metricDefs.map((d, i) => ({ label: d.label, a: d.f(PL.plan0.m), b: d.f(PL.noResp.m), c: d.f(C.m), d: d.f(BK), t: d.t, bFg: worse(PL.plan0.m[keyOf[i]], PL.noResp.m[keyOf[i]], i) ? '#b91c1c' : '#1f2937', cFg: worse(PL.plan0.m[keyOf[i]], C.m[keyOf[i]], i) ? '#b45309' : '#1d4f91' }));

    // ---------- Priority actions ----------
    const pend = s.pend || null;
    const impactTxt = (ev) => [ev.l1.onTime ? 'protects the delivery' : ev.l1.status === 'Rescheduled' ? 'new time agreed' : ev.l1.status === 'Declined' ? 'order declined' : 'still late', 'on-time ' + sg(ev.dOtd, 2, ' pts'), 'margin ' + sg(ev.dMargin, 2, ' pts'), 'profit ' + sm(ev.dProfit), (ev.o.empty + ev.sideEmpty) ? '+' + (ev.o.empty + ev.sideEmpty) + ' empty km' : ''].filter(Boolean).join(' • ');
    const rankL = (l) => l.issue.act - (l.issue.dis ? 600 : 0) - (l.issue.claim ? 120 : 0);
    const paLoads = openL.slice().sort((a, b) => rankL(a) - rankL(b)).map((l) => { const rk = PL.recommended[l.no]; const ev = rk ? (PL.options[l.no] || []).filter((x) => x.k === rk)[0] : null; return { act: l.issue.act, title: 'Load #' + l.no + ' • ' + l.cust + ' • ' + l.from + ' → ' + l.to, action: ev ? ev.o.label : 'No feasible response: escalate', why: l.issue.cause, impact: ev ? impactTxt(ev) : 'Delivery will be missed', deadline: 'Decide by ' + fT(l.issue.act), rem: fD(l.issue.act - nowM), remFg: remFg(l.issue.act - nowM), bd: l.issue.act - nowM < 60 ? 'rgba(239,68,68,.45)' : '#e3e7ed', compare: review(l.no), compareLabel: 'Compare responses', approve: () => { this.setState({ page: 'cc', cmp: l.no, pend: rk || null }); this.scrollTo('compare'); } }; });
    const relevant = pkgRows.filter((r) => r.id !== 'R:today' && r.closes.indexOf('Closes:') === 0).sort((a, b) => b.closes.split(',').length - a.closes.split(',').length);
    const paLevers = relevant.map((g) => ({ title: 'Target scenario • ' + g.closes.replace('Closes: ', 'closes ').split(', ').length + ' target gap' + (g.closes.split(', ').length === 1 ? '' : 's'), action: g.label, why: g.what + (g.hasWorsens ? ' ' + g.worsens + '.' : ''), impact: g.closes.replace('Closes: ', 'closes ') + ' • ' + g.cost, deadline: 'Decide today', rem: g.lead, remFg: '#1d4f91', bd: '#e3e7ed', compare: () => { this.setState({ page: 'scen', pend: null }); this.scrollTo('targetScen'); }, compareLabel: 'Compare scenarios', approve: () => { this.setState({ pend: g.id }); this.scrollTo('actions'); } }));
    const nLv = Math.min(paLevers.length, paLoads.length >= 4 ? 1 : 5 - paLoads.length);
    const paItems = paLoads.slice(0, 5 - nLv).concat(paLevers.slice(0, nLv)).slice(0, 5).map((a, i) => Object.assign({ n: i + 1 }, a));
    const paTotal = paLoads.length + paLevers.length;
    const paSub = paItems.length ? 'The ' + paItems.length + ' most important of ' + paTotal + ' open decisions, ranked by deadline and effect on your goals. Each needs your approval before anything changes.' : 'Nothing needs a decision right now.';
    const lvP = pend && pend.indexOf('G:') === 0 ? PL.levers.filter((g) => g.k === pend)[0] : null;
    const noop = () => {}, pendBlank = { has: false, label: '', effect: '', confirm: noop, cancel: noop };
    const lvPend = pkgPend.has ? pkgPend : lvP ? { has: true, label: lvP.label, effect: 'Expected over ' + periodShort + ': on-time ' + sg(lvP.dOtd, 2, ' pts') + ', margin ' + sg(lvP.dMargin, 2, ' pts') + ', empty km ' + sg(lvP.dEmpty, 2, ' pts') + ', profit ' + sm(lvP.dProfit) + '.', confirm: () => this.approveLever(lvP.k), cancel: () => this.setState({ pend: null }) } : pendBlank;

    // ---------- Future-back explanation ----------
    const futureBack = (l, o) => {
      if (o && o.decline) return 'Declining keeps capacity free for existing commitments. The order is not taken on, so no delivery commitment is made.';
      if (o && o.late) return 'This response moves the commitment to ' + fT(o.eta) + '. It only counts once ' + l.cust + ' agrees, and it still counts as a late delivery against the on-time goal.';
      const dk = o ? (o.dk || l.km) : l.kind === 'planned' ? l.km : null;
      const truck = o && o.truck ? o.truck : o && o.partner ? null : (l.newTruck || l.truck);
      const truckTxt = o && o.partner ? 'a partner ' + l.eq.toLowerCase() : truck ? truck + ' (' + (B.byId[truck] ? B.byId[truck].type : l.eq).toLowerCase() + ')' : 'a compatible ' + l.eq.toLowerCase();
      const drvTxt = o && o.partner ? 'the partner’s driver confirmed' : o && o.oncall ? 'an eligible driver available (on-call ' + (C.onCallFree[0] || 'driver') + ', 13h of driving time)' : 'an eligible driver available (' + ((o && o.move && o.move.driver) || l.newDriver || l.driver || 'to be assigned') + ')';
      if (dk == null) return 'Load #' + l.no + ' is on the road with ' + (l.newTruck || l.truck) + ' and ' + (l.newDriver || l.driver) + '. Predicted arrival ' + fT(l.eta) + ' against a ' + fT(l.due) + ' commitment.';
      const dep = l.due - PD.dr(dk) - 20, from = o && o.dep ? o.dep : l.at || l.from;
      return 'To meet the ' + fT(l.due) + ' delivery in ' + l.to + ', Load #' + l.no + ' must depart ' + from + ' by ' + fT(dep) + ' with ' + truckTxt + ' and ' + drvTxt + '.' + (dep < nowM ? ' That time has passed, so the commitment cannot be met this way.' : ' That is ' + fD(dep - nowM).replace(' left', '') + ' from now.');
    };

    // ---------- Compare responses for one load ----------
    const cl = s.cmp && C.LB[s.cmp] ? C.LB[s.cmp] : null;
    let cmp = { has: false, no: '', title: '', lane: '', status: '', stBg: '#fff', stFg: '#000', cause: '', causeBg: '#fff', causeBd: '#fff', deadline: '', rem: '', remFg: '#000', back: '', decided: false, decidedTxt: '', decidedWhy: '', hasOpts: false, hasRec: false, recWhy: '', recTrade: '', opts: [], pend: pendBlank, close: noop };
    if (cl) {
      const list = PL.options[cl.no] || [], rk = PL.recommended[cl.no], recEv = list.filter((x) => x.k === rk)[0];
      const dec = (s.decisions || []).filter((d) => d.no === cl.no)[0];
      const shownO = recEv ? recEv.o : cl.chosen || null;
      const capTxt = (o) => o.partner ? 'Partner carrier. No company truck or driver used.' : [(o.truck ? 'Uses ' + o.truck + ' (' + B.byId[o.truck].type.toLowerCase() + ')' : 'Keeps the current truck'), (o.oncall ? '1 of ' + C.onCallFree.length + ' free on-call drivers' : o.move && o.move.driver ? o.move.driver + ' continues' : 'no extra driver')].join(' • ');
      const pO = pend && PD.O[pend] && PD.O[pend].no === cl.no ? list.filter((x) => x.k === pend)[0] : null;
      cmp = {
        has: true, no: cl.no, title: 'Load #' + cl.no + ' • ' + cl.cust, lane: cl.from + ' → ' + cl.to + ' • ' + cl.eq + ' • ' + (cl.newTruck || cl.truck || 'no truck') + ' • delivery due ' + fT(cl.due), status: cl.status, stBg: LS[cl.status][0], stFg: LS[cl.status][1],
        cause: cl.issue ? cl.issue.cause + (cl.issue.why && cl.issue.cause.indexOf(cl.issue.why) < 0 ? ' ' + cl.issue.why : '') + (cl.reopened ? ' The approved response (' + cl.chosen.label + ') no longer meets the commitment after the latest change, so Monifi has replanned it.' : '') : 'No open issue. This load is on plan.' + (cl.notes.length ? ' ' + cl.notes.join(' ') : ''),
        causeBg: cl.risk ? 'rgba(239,68,68,.05)' : '#f8fafc', causeBd: cl.risk ? 'rgba(239,68,68,.35)' : '#e3e7ed',
        deadline: cl.issue && (cl.risk || !cl.chosen) ? 'Decide by ' + fT(cl.issue.act) : cl.chosen ? 'Decision approved' : 'No decision needed', rem: cl.issue && (cl.risk || !cl.chosen) ? fD(cl.issue.act - nowM) : '', remFg: cl.issue ? remFg(cl.issue.act - nowM) : '#1d4f91',
        back: futureBack(cl, cl.chosen && !cl.risk ? cl.chosen : shownO),
        decided: !!cl.chosen && !cl.risk, decidedTxt: cl.chosen ? 'Approved: ' + cl.chosen.label : '', decidedWhy: dec ? 'Approved at ' + dec.planT + ' (demo clock). ' + dec.rationale : '',
        hasOpts: list.length > 0 && (cl.risk || !cl.chosen), hasRec: !!recEv, recWhy: recEv ? this.why(recEv, cl, true).replace(/^Recommended\. /, '') : '', recTrade: recEv ? 'Compared with the recommendation. ' + list.filter((x) => x.k !== rk).map((x) => x.block ? x.o.label + ': not feasible. ' + x.block : x.o.label + ': ' + this.vs(recEv, x)).join(' ') : '',
        opts: list.map((x) => x.block ? { label: x.o.label, isRec: false, blocked: true, blockTxt: x.block, feasible: false, otd: '—', otdSub: '', otdFg: '#6b7280', cost: '—', costSub: '', empty: '—', emptySub: '', cap: '—', other: '—', otherFg: '#6b7280', checks: [], rowBg: '#fafafa', approve: () => {}, btnLabel: '', btnBg: '#fff', btnFg: '#1e3a6e' } : {
          label: x.o.label, isRec: x.k === rk, blocked: false, blockTxt: '', feasible: true,
          otd: x.l1.status === 'Declined' ? 'Order declined' : x.l1.status + ' • arrives ' + fT(x.l1.eta), otdFg: x.l1.onTime ? '#1d4f91' : x.l1.status === 'Rescheduled' ? '#6d28d9' : '#b91c1c', otdSub: 'Fleet on-time ' + sg(x.dOtd, 2, ' pts'),
          cost: sm(x.dProfit) + ' profit', costSub: 'Margin ' + sg(x.dMargin, 2, ' pts'),
          empty: (x.o.empty + x.sideEmpty) ? '+' + (x.o.empty + x.sideEmpty) + ' km' : 'No extra', emptySub: 'Share ' + sg(x.dEmpty, 2, ' pts'),
          cap: capTxt(x.o), other: x.newRisk.length ? 'Puts #' + x.newRisk.join(', #') + ' at risk. ' + x.o.side.filter((sd) => sd.conflict).map((sd) => sd.why).join(' ') : x.o.side.length ? x.o.side.map((sd) => sd.why).join(' ') : x.o.combine ? '#' + x.o.combine + ' still delivered early.' : 'No effect on other customers.', otherFg: x.newRisk.length ? '#b91c1c' : '#374151',
          checks: (x.o.shopTruck ? ['Maintenance: ' + PD.SHOP.supplier + ' releases ' + x.o.shopTruck + ' at ' + fT(x.after.rel[x.o.shopTruck])] : []).concat(x.o.checks).concat([x.l1.onTime ? 'Delivery window met (' + fT(x.l1.eta) + ' vs ' + fT(cl.due) + ')' : x.l1.status === 'Rescheduled' ? 'Needs the customer to accept the new time' : x.l1.status === 'Declined' ? 'No window applies' : 'Misses the delivery window']),
          rowBg: x.k === rk ? 'rgba(29,111,165,.05)' : '#ffffff', approve: () => { this.setState({ pend: x.k }); }, btnLabel: pend === x.k ? 'Selected' : 'Approve…', btnBg: pend === x.k ? '#1e3a6e' : '#ffffff', btnFg: pend === x.k ? '#ffffff' : '#1e3a6e'
        }),
        pend: pO && !pO.block ? { has: true, label: pO.o.label, effect: 'Expected effect: ' + impactTxt(pO) + '. ' + (pO.newRisk.length ? 'Puts #' + pO.newRisk.join(', #') + ' at risk. ' : '') + 'Every page updates and the decision is logged with its rationale.', confirm: () => this.approve(pO.k), cancel: () => this.setState({ pend: null }) } : pendBlank,
        close: () => this.setState({ cmp: null, pend: null })
      };
    }

    // ---------- Operational plan ----------
    const pf = s.planFilter || 'risk';
    const inPlan = C.loads.filter((l) => l.inH || l.risk);
    const fdefs = [['risk', 'Needs decision', (l) => l.risk], ['all', 'All loads', () => true], ['transit', 'In transit', (l) => l.kind === 'transit'], ['planned', 'Planned', (l) => l.kind === 'planned']];
    const planFilters = fdefs.map((f) => ({ label: f[1], count: inPlan.filter(f[2]).length, on: pf === f[0], pick: () => this.setState({ planFilter: f[0] }), bg: pf === f[0] ? 'rgba(108,179,227,.16)' : '#ffffff', bd: pf === f[0] ? '#6cb3e3' : '#d5dae2', fg: pf === f[0] ? '#1d4f91' : '#374151' }));
    const fsel = (fdefs.filter((f) => f[0] === pf)[0] || fdefs[0])[2];
    const ord = { 'At risk': 0, 'Conflict': 0, 'Unassigned': 0, 'Tight': 1, 'Rescheduled': 2, 'On time': 3, 'Declined': 4 };
    const planRows = inPlan.filter(fsel).sort((a, b) => (ord[a.status] - ord[b.status]) || ((a.issue && a.risk ? a.issue.act : a.due) - (b.issue && b.risk ? b.issue.act : b.due))).map((l) => ({
      no: l.no, cust: l.cust, lane: l.from + ' → ' + l.to, eq: l.eq, truck: l.partner ? 'Partner carrier' : (l.newTruck || l.truck || 'No truck'), driver: l.partner ? l.chosen.handoff || 'Partner driver' : (l.newDriver || l.driver || 'No driver'),
      dep: l.kind === 'planned' ? 'Departs ' + fT(l.pickup) : 'On the road', eta: l.status === 'Declined' ? 'Not accepted' : l.eta == null ? 'Arrival unknown' : 'Arrives ' + fT(l.eta), due: fT(l.due),
      status: l.status, stBg: LS[l.status][0], stFg: LS[l.status][1], rowBg: s.cmp === l.no ? 'rgba(108,179,227,.12)' : l.risk ? 'rgba(239,68,68,.03)' : '#ffffff',
      note: l.risk && l.issue ? short(l) + ' • decide by ' + fT(l.issue.act) : l.chosen ? 'Approved: ' + l.chosen.label : l.notes.join(' • ') || (l.kind === 'planned' ? 'Must depart by ' + fT(l.due - PD.dr(l.km) - 20) : ''), open: review(l.no)
    }));
    const planFoot = 'Showing ' + planRows.length + ' of ' + inPlan.length + ' loads in the detailed schedule. A further ' + int(C.counts.F) + ' loads in the period are forecast from normal weekly volume. Synthetic demo data.';

    // ---------- Decisions and results ----------
    const decisions = (s.decisions || []).map((d) => Object.assign({}, d, { by: d.by || 'John Jones', recTxt: d.rec ? 'Recommended option' : 'Chosen over the recommendation' }));
    const resultsHas = (s.demo || 0) >= 6 || (PL.disKeys.length > 0 && decisions.some((d) => d.no !== '—' && (s.applied || {})[d.k] && s.applied[d.k].dis));
    const results = { has: resultsHas, sub: 'Same operation, three states: the plan before the disruption, the disruption with no response, and the plan after your approved actions.', rows: metricDefs.map((d, i) => ({ label: d.label, a: d.f(PL.plan0.m), b: d.f(PL.noResp.m), c: d.f(C.m), t: d.t, bFg: worse(PL.plan0.m[keyOf[i]], PL.noResp.m[keyOf[i]], i) ? '#b91c1c' : '#1f2937', cFg: worse(PL.noResp.m[keyOf[i]], C.m[keyOf[i]], i) ? '#b45309' : '#1d4f91' })) };

    // ---------- Run Demo ----------
    const demo = s.demo || 0;
    const stepTitles = ['Set future goals', 'Introduce a disruption', 'Identify goals at risk', 'Compare responses', 'Approve an action', 'Show updated results'];
    const demoSteps = stepTitles.map((t, i) => { const n = i + 1, st = demo > n ? 'done' : demo === n ? 'active' : 'todo'; return { n, title: t, bg: st === 'active' ? '#1e3a6e' : st === 'done' ? 'rgba(30,58,110,.08)' : '#ffffff', fg: st === 'active' ? '#ffffff' : st === 'done' ? '#1e3a6e' : '#6b7280', dotBg: st === 'active' ? '#ffffff' : st === 'done' ? '#1e3a6e' : '#eef0f3', dotFg: st === 'active' ? '#1e3a6e' : st === 'done' ? '#ffffff' : '#6b7280' }; });
    const l62 = C.LB['4562'], rec62 = PL.recommended['4562'], ev62 = rec62 ? (PL.options['4562'] || []).filter((x) => x.k === rec62)[0] : null;
    const DS = {
      1: { text: 'Monifi starts from your targets for 30, 60 and 90 days: on-time delivery ≥ ' + TGT.otd.join('% / ') + '%, operating margin ≥ ' + TGT.margin.join('% / ') + '%, empty km ≤ ' + TGT.empty.join('% / ') + '%. Today ' + tSummary[0].on + ' of 6 thirty-day targets are on track. Edit any target below; every prediction recalculates immediately.', btn: 'Next: introduce a disruption', go: () => { this.setState({ demo: 2, showDis: true }); this.scrollTo('disrupt'); } },
      2: { text: 'Now a real-world event: TRK029 fails a roadside inspection near Oshawa with Laurentian Paper load #4562 on board.', btn: dis.truck ? 'Next: see goals at risk' : 'Simulate truck unavailable', go: () => { if (!(this.state.dis || {}).truck) setDis('truck')(); this.setState({ demo: 3 }); this.scrollTo('goals'); } },
      3: { text: 'On-time delivery for the next 30 days is now predicted at ' + tBy.otd.cells[0].predTxt + ' against ' + tBy.otd.cells[0].targetTxt + ' (' + tStatus.otd[0].toLowerCase() + '; 60 days ' + tStatus.otd[1].toLowerCase() + ', 90 days ' + tStatus.otd[2].toLowerCase() + '). ' + (l62 && l62.risk ? 'Load #4562 must have a response by ' + fT(l62.issue.act) + ' (' + fD(l62.issue.act - nowM) + ').' : 'Load #4562 already has a response.'), btn: 'Next: compare responses', go: () => { this.setState({ demo: 4, cmp: '4562', pend: null }); this.scrollTo('compare'); } },
      4: { text: 'Monifi compares each practical response on on-time delivery, cost and margin, empty km, capacity and other customers, after checking driving hours, equipment, maintenance and delivery windows.' + (ev62 ? ' Recommended: ' + ev62.o.label + '.' : ''), btn: 'Next: approve the recommendation', go: () => { this.setState({ demo: 5, cmp: '4562', pend: rec62 || null }); this.scrollTo('compare'); } },
      5: { text: 'Nothing changes until you approve. Review the recommended response and its tradeoffs in the comparison above, then click Confirm and apply in the approval bar. Monifi never applies a scenario on its own.', btn: 'Review the approval', go: () => { const k = this.state.pend || rec62; this.setState({ cmp: '4562', pend: k || null }); this.scrollTo('compare'); } },
      6: { text: 'Approved. The decision and its rationale are logged, and every page now uses the new plan: the goals, KPI cards, map, fleet, capacity, scorecard and reports.', btn: 'Finish demo', go: () => this.setState({ demo: 0 }) }
    };
    const demoStep = Object.assign({ n: demo }, DS[demo] || DS[1]);
    const runDemo = () => { this.setState(Object.assign(this.fresh(), { page: 'cc', collapsed: this.state.collapsed, demo: 1, toast: '' })); this.scrollTo('demo'); };

    // ---------- Available capacity (scenario page) ----------
    const capList = live.filter((t) => t.status === 'idle').map((t) => ({ name: t.id + ' • ' + t.type, meta: t.lane + (C.used[t.id] ? ' • committed to #' + C.used[t.id].split(':')[0] : planTruck[t.id] ? ' • planned for #' + planTruck[t.id] : ''), tag: C.used[t.id] ? 'Committed' : 'Available', bg: C.used[t.id] ? '#eef0f3' : 'rgba(245,158,11,.14)', fg: C.used[t.id] ? '#4b5563' : '#92400e' }))
      .concat(['TRK015', 'TRK049', 'TRK038'].map((id) => ({ name: id + ' • ' + B.byId[id].type, meta: B.byId[id].note + ' • ' + PD.SHOP.supplier + ' releases it ' + fT(C.rel[id]) + (C.used[id] ? ' • committed to #' + C.used[id].split(':')[0] : ''), tag: C.used[id] ? 'Committed' : 'In maintenance', bg: 'rgba(124,58,237,.10)', fg: '#6d28d9' })))
      .concat(PD.onCall.map((n) => { const u = C.onCallUsed.indexOf(n) >= 0; return { name: n, meta: 'On-call driver • 13h driving available • Toronto Hub', tag: u ? 'Committed' : 'On call', bg: u ? '#eef0f3' : 'rgba(108,179,227,.16)', fg: u ? '#4b5563' : '#1d4f91' }; }))
      .concat([['Ridgeway Logistics', 'Reefer • Kingston and Brampton'], ['Huron Flatbed', 'Flatbed • London'], ['Quinte Freight', 'Dry van • Whitby'], ['Muskoka Carriers', 'Dry van • Barrie']].map((r) => ({ name: r[0], meta: 'Partner carrier • ' + r[1] + ' • contract rate + $150', tag: 'Partner', bg: '#eef0f3', fg: '#374151' })));

    // ---------- Reports: CSV and print summary from the current state ----------
    const repPeriod = 'Tue Jan 20, 10:45 AM to ' + endDate + ' (' + days + ' days)';
    const repScenario = PL.disKeys.length ? PL.disKeys.map((k) => PD.DIS[k].label).join(', ') : 'No disruptions simulated';
    const repGoals = '30 / 60 / 90 days: on-time ≥ ' + TGT.otd.join(' / ') + '% • margin ≥ ' + TGT.margin.join(' / ') + '% • empty km ≤ ' + TGT.empty.join(' / ') + '%';
    const assumptions = [
      'Synthetic demo data: one operation with 50 tractors, 57 drivers and 6 named shippers. Times use a demo clock that starts Tue Jan 20, 10:45 AM.',
      'Revenue $1.95 per loaded km ($2.45 for urgent orders). Operating cost $1.63 per km plus $60 per load. Empty km cost $1.10 per km and are counted once: response costs cover only driver call-out, handling and repairs.',
      'Revenue is recognized when a load is delivered. A delivery moved past the end of the period is deferred to the next period, not lost; only a declined order removes revenue.',
      'Cash is separate from revenue and profit: opening balance $600,000; customers pay the open invoices on their due dates, then about 30 days after delivery (20 days for customers on the early-payment program); suppliers, payroll and leases are paid on the dates shown; partner carriers are paid on 30-day terms; driver call-outs, handling and roadside costs are paid now; fuel and wages for extra driving are paid in the next fuel and payroll runs.',
      'Partner carriers cost the load revenue plus a $150 premium. A load left without a truck is covered at spot rates (97% of revenue plus $250).',
      'Expected penalty $250 for each late or uncovered load and $150 for each rescheduled load. Reefer claim exposure $10,800 on #4471 until it is recovered.',
      'Loads beyond the detailed schedule are forecast at 43 loads per day with 97.4% on time (97.6% after the Thursday rebalance).',
      'Weekly revenue of about $343K follows from the fleet: 50 trucks × 560 km a day × 89.65% loaded × $1.95 per loaded km. Empty share 10.35% before route changes.',
      '30/60/90-day predictions: days 1–7 come from the detailed plan; days 8–90 extend the same operation with demand growing 2% a month, 4 trucks in the shop on average, 1.6 routine exceptions a day, expected breakdowns from predicted failures, overdue services and TRK006, and the network changes in force. Each deadline reports the 30 days ending on that date.',
      'Targets are entered by you and never changed by the model. Status: on track (forecast meets target), at risk (reachable with available actions), off track (not reachable with any available action; the remaining gap and reason are shown).',
      'Average speed 85 km/h. Drivers keep to the 11-hour driving limit; on-call drivers start with 13h available.',
      'Targets are never changed by the planner. Statuses: on track (forecast meets target), at risk (target reachable with available actions), unachievable (not reachable under current constraints).'
    ];
    const esc = (v) => { const t = String(v == null ? '' : v); return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const toCsv = (rows) => '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
    const pre = (title) => [['Monifi demo report', title], ['Data', 'SYNTHETIC DEMO DATA. Not real customers, trucks or drivers.'], ['Planning period', repPeriod], ['Target deadlines', DL.map((d) => d + ' days: ' + dayDate(d)).join('; ')], ['Targets', TD.measures.map((m) => m.label + ' ' + (m.up ? '≥ ' : '≤ ') + TGT[m.k].map((v) => fmtM(m, v)).join(' / ')).join('; ')], ['Generated (demo clock)', fT(nowM)], ['Scenario', repScenario], ['Approved decisions', String(decisions.length)], ['Goals', repGoals]].concat(assumptions.map((a, i) => ['Assumption ' + (i + 1), a])).concat([[]]);
    const statusOf = (k) => goalRows.filter((g) => g.label.indexOf(k) === 0)[0];
    const decOf = (l) => l.chosen ? 'Approved: ' + l.chosen.label : PL.recommended[l.no] ? 'Recommended: ' + PD.O[PL.recommended[l.no]].label : '';
    const builders = {
      summary: () => toCsv(pre('Operational summary').concat([['Measure', 'Value', 'Target', 'Status', 'Period', 'Definition']]).concat(kpiCards.map((k) => [k.label, k.value, k.target, k.status, k.period, k.def])).concat([[], ['Target', 'Deadline', 'Target value', 'Predicted', 'Gap', 'Status', 'Working backward']]).concat([].concat.apply([], targetRows.map((r) => r.cells.map((x) => [r.label, x.d + ' days (' + x.date + ')', x.targetTxt, x.predTxt, x.gapTxt, x.status, x.back])))).concat([[], ['Revenue recognized in period', Math.round(fin.rev)], ['Operating profit in period', Math.round(fin.profit)], ['Operating margin', pct(K.margin, 2)], ['Revenue deferred to next period', Math.round(fin.deferred)], ['Opening cash', Math.round(cash.opening)], ['Closing cash', Math.round(cash.closing)], ['Lowest cash balance', Math.round(cash.min) + ' on ' + fT(cash.minT)], ['Loads due in period', totLoads], ['Loads at risk', K.risk]])),
      targets: () => toCsv(pre('Targets: 30, 60 and 90 days').concat([['Measure', 'Current (next ' + days + ' days)', 'Deadline', 'Date', 'Target', 'Predicted', 'Gap', 'Status', 'Best achievable', 'Remaining gap if off track', 'Working backward', 'Why off track', 'Actions required today']]).concat([].concat.apply([], targetRows.map((r) => r.cells.map((x) => [r.label, r.current, x.d + ' days', x.date, x.targetTxt, x.predTxt, x.gapTxt, x.status, x.bestTxt, x.remain, x.back, x.why, r.acts.map((a) => a.label + ' (' + a.effect + ')').join('; ')])))).concat([[], ['Target scenario', 'What it does', 'Closes', 'Trade-offs', 'Cost', 'Lead time']]).concat(pkgRows.map((p) => [p.label, p.what, p.closes, p.trade + (p.hasWorsens ? ' ' + p.worsens : ''), p.cost, p.lead])).concat([[], ['Period', 'Revenue', 'Operating profit', 'Lowest cash', 'Loads', 'Late loads', 'Expected extra breakdowns', 'Loads to spot carriers']]).concat(TC.w.map((w, i) => [DL[i] + ' days', Math.round(w.rev), Math.round(w.profit), Math.round(w.cash * 1000), Math.round(w.loads), Math.round(w.late), w.bd.toFixed(1), Math.round(w.unc)]))),
      cash: () => toCsv(pre('Cash, receivables and payables').concat([['Date (demo clock)', 'Type', 'Reference', 'Party', 'Amount', 'In period', 'Balance after', 'Note']]).concat([[fT(PD.N0), 'Opening balance', '', '', cash.opening, 'Yes', cash.opening, ''], [fT(PD.N0), 'Cash costs paid now', '', 'Responses and roadside work', -Math.round(cash.now), 'Yes', Math.round(cash.opening - cash.now), 'Driver call-outs, handling, repairs']]).concat(cash.events.map((e) => [fT(e.t), e.kind === 'in' ? 'Customer receipt' : 'Supplier payment', e.id, e.party, e.kind === 'in' ? e.amt : -e.amt, e.inPeriod ? 'Yes' : 'No', e.inPeriod ? Math.round(e.bal) : '', e.late ? 'Paid late (simulated delay)' : ''])).concat([[], ['Collections in period', cash.collections], ['Payments in period', cash.payments], ['Closing cash', Math.round(cash.closing)], ['Lowest balance', Math.round(cash.min)], ['Receipts falling after the period', cash.outside], ['Revenue recognized in period (for comparison)', Math.round(fin.rev)], ['Operating profit in period (for comparison)', Math.round(fin.profit)]])),
      delivery: () => toCsv(pre('Delivery performance and loads at risk').concat([['Load', 'Customer', 'From', 'To', 'Equipment', 'Truck', 'Driver', 'Type', 'Departure', 'Predicted arrival', 'Delivery commitment', 'Status', 'On time', 'Cause', 'Decide by', 'Decision']]).concat(C.loads.filter((l) => l.inH || l.risk).map((l) => [l.no, l.cust, l.from, l.to, l.eq, l.partner ? 'Partner' : (l.newTruck || l.truck || ''), l.newDriver || l.driver || '', l.kind, l.pickup != null ? fT(l.pickup) : 'In transit', l.eta == null ? 'Unknown' : fT(l.eta), fT(l.due), l.status, l.onTime ? 'Yes' : 'No', l.risk && l.issue ? l.issue.cause : '', l.risk && l.issue ? fT(l.issue.act) : '', decOf(l)])).concat([[], ['Forecast loads (not in detailed schedule)', C.counts.F], ['Predicted on-time delivery', pct(K.otd)]])),
      profit: () => { const ls = C.loads.filter((l) => l.inH && !l.declined); const agg = (key) => { const m = {}; ls.forEach((l) => { const k = key(l); m[k] = m[k] || { rev: 0, cost: 0, n: 0 }; m[k].rev += l.rev; m[k].cost += l.cost; m[k].n++; }); return Object.keys(m).sort().map((k) => [k, m[k].n, m[k].rev.toFixed(2), m[k].cost.toFixed(2), (m[k].rev - m[k].cost).toFixed(2), m[k].rev ? ((m[k].rev - m[k].cost) / m[k].rev * 100).toFixed(1) + '%' : '']); };
        return toCsv(pre('Load, route and customer profitability').concat([['Load', 'Customer', 'Lane', 'Loaded km', 'Revenue', 'Cost', 'Profit', 'Margin', 'Partner', 'Extra empty km', 'Status']]).concat(ls.map((l) => [l.no, l.cust, l.from + ' - ' + l.to, l.km, l.rev.toFixed(2), l.cost.toFixed(2), l.profit.toFixed(2), l.rev ? (l.profit / l.rev * 100).toFixed(1) + '%' : '', l.partner ? 'Yes' : 'No', l.emptyX, l.status])).concat([[], ['Lane', 'Loads', 'Revenue', 'Cost', 'Profit', 'Margin']]).concat(agg((l) => l.from + ' - ' + l.to)).concat([[], ['Customer', 'Loads', 'Revenue', 'Cost', 'Profit', 'Margin']]).concat(agg((l) => l.cust)).concat([[], ['Period revenue incl. forecast', Math.round(fin.rev)], ['Period operating profit', Math.round(fin.profit)], ['Expected operating margin', pct(K.margin, 2)], ['Network savings approved (period)', Math.round(fin.savWk)]])); },
      capacity: () => toCsv(pre('Capacity, utilization and empty kilometres').concat([['Truck', 'Type', 'Status', 'Driver', 'Load', 'Location or lane', 'Committed by decision', 'Note']]).concat(live.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((t) => [t.id, t.type, t.statusLabel, t.driver || '', t.load || '', t.lane, C.used[t.id] ? '#' + C.used[t.id].split(':')[0] : '', t.note])).concat([[], ['Fleet utilization (now)', pct(K.util, 0)], ['Capacity coverage (planned loads)', pct(K.cover) + ' (' + C.counts.covered + ' of ' + C.counts.planned + ')'], ['On-call drivers free', C.onCallFree.join('; ') || 'None'], ['Planned km in period', int(C.km.total)], ['Empty km in period', int(C.km.empty)], ['Empty share', pct(K.empty, 2)], ['Extra empty km from approved responses', int(C.km.extra)]])),
      scenario: () => toCsv(pre('Scenario comparisons and approved actions').concat([['Measure', 'Plan before disruptions', 'Disruptions, no response', 'Current plan', 'Best achievable', 'Goal']]).concat(scenRows.map((r) => [r.label, r.a, r.b, r.c, r.d, r.t])).concat([[], ['Active disruption', 'Detail', 'Respond by']]).concat(PL.disKeys.map((k) => [PD.DIS[k].label, PD.DIS[k].title + '. ' + PD.DIS[k].why, fT(PD.DIS[k].act)])).concat([[], ['Approved (demo clock)', 'Approved by', 'Load', 'Customer', 'Decision', 'Recommended', 'Cause', 'Rationale', 'Alternatives considered', 'Effect']]).concat(decisions.slice().reverse().map((d) => [d.planT, d.by, d.no, d.cust, d.label, d.rec ? 'Yes' : 'No', d.cause, d.rationale, d.tradeoffs, d.effect])))
    };
    const RD = [['targets', 'Targets: 30, 60 and 90 days', 'Current performance, target, predicted result, gap, status, best achievable and actions for every measure and deadline, plus target scenarios.', 'monifi-targets-30-60-90.csv', tSummary.map((x) => x.d + 'd: ' + x.on + ' on track').join(' • ')], ['summary', 'Operational summary', 'Six KPIs with definitions, goal status, causes and what it takes to reach each target.', 'monifi-operational-summary.csv', K.risk + ' loads at risk • ' + goalRows.filter((g) => g.status === 'On track').length + ' of 3 goals on track'],
      ['delivery', 'Delivery performance and loads at risk', 'Every load in the period with truck, driver, predicted arrival, status, cause and decision.', 'monifi-delivery-performance.csv', 'On-time ' + pct(K.otd) + ' predicted • ' + inPlan.length + ' scheduled loads'],
      ['profit', 'Load, route and customer profitability', 'Revenue, cost, profit and margin by load, lane and customer.', 'monifi-profitability.csv', 'Margin ' + pct(K.margin, 2) + ' • profit ' + money(fin.profit)],
      ['capacity', 'Capacity, utilization and empty km', 'Every truck with status, driver and commitments, plus coverage and empty kilometres.', 'monifi-capacity-utilization.csv', 'Utilization ' + pct(K.util, 0) + ' • empty ' + pct(K.empty, 2)],
      ['cash', 'Cash, receivables and payables', 'Opening cash, customer receipts, supplier payments and the lowest balance, kept separate from revenue and profit.', 'monifi-cash-receivables-payables.csv', 'Lowest cash ' + kMoney(cash.min) + ' • closing ' + kMoney(cash.closing)],
      ['scenario', 'Scenario comparisons and approved actions', 'Plan before and after disruptions, best achievable, and every approved decision with rationale.', 'monifi-scenarios-decisions.csv', PL.disKeys.length + ' disruption' + (PL.disKeys.length === 1 ? '' : 's') + ' • ' + decisions.length + ' decision' + (decisions.length === 1 ? '' : 's')]];
    const planReports = RD.map((r) => ({ name: r[1], desc: r[2], live: 'Now: ' + r[4], csv: () => this.saveFile(r[3], builders[r[0]]()) }));
    const h = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const tbl = (head, rows) => '<table><thead><tr>' + head.map((x) => '<th>' + h(x) + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((x) => '<td>' + h(x) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    const printHtml = () => '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Monifi operational summary</title><style>body{font-family:Inter,Arial,sans-serif;color:#0f172a;margin:32px;font-size:12px;line-height:1.45}h1{font-size:22px;margin:0}h2{font-size:15px;margin:22px 0 8px;color:#1e3a6e}.tag{display:inline-block;background:#fef3c7;color:#78350f;font-weight:700;padding:2px 8px;border-radius:4px;font-size:11px}.meta{color:#4b5563;margin:6px 0 0}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{text-align:left;border-bottom:1px solid #e3e7ed;padding:5px 6px;vertical-align:top}th{background:#f1f5f9;font-size:11px}.bar{margin:14px 0}button{padding:8px 14px;background:#1e3a6e;color:#fff;border:0;border-radius:6px;font-weight:700;cursor:pointer}@media print{.bar{display:none}body{margin:12mm}}</style></head><body>'
      + '<div class="bar"><button onclick="window.print()">Print or save as PDF</button></div><h1>Monifi operational summary</h1><span class="tag">SYNTHETIC DEMO DATA</span>'
      + '<p class="meta">Planning period: ' + h(repPeriod) + ' • Generated (demo clock): ' + h(fT(nowM)) + ' • Scenario: ' + h(repScenario) + ' • Approved decisions: ' + decisions.length + '</p>'
      + '<h2>Key measures</h2>' + tbl(['Measure', 'Value', 'Target', 'Status', 'Period'], kpiCards.map((k) => [k.label, k.value, k.target, k.status, k.period]))
      + '<h2>Targets: 30, 60 and 90 days</h2>' + tbl(['Measure', 'Current', 'Deadline', 'Target', 'Predicted', 'Gap', 'Status', 'Actions required today'], [].concat.apply([], targetRows.map((r) => r.cells.map((x) => [r.label, r.current, x.d + ' days (' + x.date + ')', x.targetTxt, x.predTxt, x.gapTxt, x.status + (x.hasWhy ? ': ' + x.why : ''), r.acts.map((a) => a.label).join('; ')]))))
      + '<h2>Revenue, profit and cash</h2>' + tbl(['Measure', 'Value'], [['Revenue recognized in period', '$' + int(fin.rev)], ['Operating profit', '$' + int(fin.profit) + ' (' + pct(K.margin, 2) + ')'], ['Revenue deferred to next period', '$' + int(fin.deferred)], ['Opening cash', '$' + int(cash.opening)], ['Lowest cash balance', '$' + int(cash.min) + ' on ' + fT(cash.minT)], ['Closing cash', '$' + int(cash.closing)]])
      + '<h2>Loads needing a decision</h2>' + (openL.length ? tbl(['Load', 'Customer', 'Lane', 'Status', 'Cause', 'Decide by', 'Recommended response'], openL.map((l) => ['#' + l.no, l.cust, l.from + ' → ' + l.to, l.status, l.issue.cause, fT(l.issue.act), PL.recommended[l.no] ? PD.O[PL.recommended[l.no]].label : 'None feasible'])) : '<p>None.</p>')
      + '<h2>Scenario comparison</h2>' + tbl(['Measure', 'Before disruptions', 'No response', 'Current plan', 'Best achievable', 'Goal'], scenRows.map((r) => [r.label, r.a, r.b, r.c, r.d, r.t]))
      + '<h2>Approved decisions</h2>' + (decisions.length ? tbl(['Approved', 'Approved by', 'Load', 'Decision', 'Rationale', 'Effect'], decisions.slice().reverse().map((d) => [d.planT, d.by, d.no, d.label, d.rationale, d.effect])) : '<p>None yet.</p>')
      + '<h2>Assumptions</h2><ul>' + assumptions.map((a) => '<li>' + h(a) + '</li>').join('') + '</ul></body></html>';
    const printSummary = () => this.saveFile('monifi-operational-summary.html', printHtml());
    const dl = s.dl ? { has: true, name: s.dl.name, data: s.dl.data, close: () => this.setState({ dl: null }) } : { has: false, name: '', data: '', close: () => {} };

    // ================= SCENARIO MODELLING: trucks down, optimization engine, resources =================
    const WI_ORDER = ['TRK029', 'TRK037', 'TRK019', 'TRK004', 'TRK016', 'TRK020', 'TRK009', 'TRK025', 'TRK011', 'TRK003'];
    const scN = s.scen || 1, prio = s.prio || {};
    const downIds = WI_ORDER.filter((id) => LV[id] && LV[id].status === 'moving' && !C.used[id] && !(C.tov[id] && C.tov[id].route)).slice(0, scN);
    const baseOtDay = Math.max(1, drv.reduce((a, d) => a + d.ot, 0) / 5);
    const typeOk = (a, b) => a === b || ((a === 'Dry Van' || a === 'Day Cab') && (b === 'Dry Van' || b === 'Day Cab'));
    const PARTNER = { Reefer: 'Ridgeway Logistics', Flatbed: 'Huron Flatbed', Tanker: 'Lakeland Tank Lines', 'Dry Van': 'Quinte Freight', 'Day Cab': 'Quinte Freight' };
    const buildPlan = (pr) => {
      const pool = live.filter((t) => t.status === 'idle' && !C.used[t.id]).map((t) => ({ id: t.id, type: t.type, pos: t.pos, home: t.lane, sameDay: C.loads.some((l) => l.truck === t.id && l.kind === 'planned' && !l.chosen && l.pickup < PD.N0 + 720) }));
      const oc = C.onCallFree.slice(), plan = {}, rows = [];
      let otH = 0, maxRec = 0;
      downIds.forEach((id, i) => {
        const d = LV[id], opts = [], at = d.base.route ? along(d.base.route, 0.25).p : d.pos;
        pool.forEach((sp) => {
          if (!typeOk(sp.type, d.type)) return;
          const km = Math.max(15, Math.round(kmBetween(sp.pos, at) * 1.25)), mins = Math.round(km / 85 * 60) + 30;
          const relay = !!pr.ot && mins > 60 && oc.length > 0, ot = relay ? 0 : mins / 60;
          const cost = km * 1.10 + (relay ? 180 : ot * 48) + (sp.sameDay ? 400 : 0);
          opts.push({ kind: 'spare', sp, km, mins, ot, relay, cost, sc: cost + (pr.sw ? mins * 6 + (sp.sameDay ? 800 : 0) : 0) + (pr.fuel ? km * 0.8 : 0) + (pr.ot ? ot * 150 : 0) });
        });
        const lk = (C.loads.filter((l) => l.truck === id && l.kind === 'transit')[0] || { km: 300 }).km, pm = 120 + 20 * i, pc = 250 + lk * 0.45;
        opts.push({ kind: 'partner', mins: pm, cost: pc, km: 0, ot: 0, sc: pc + (pr.sw ? pm * 6 : 0) });
        opts.sort((a, b) => a.sc - b.sc);
        const ch = opts[0];
        if (ch.kind === 'spare') {
          pool.splice(pool.indexOf(ch.sp), 1);
          const drvName = ch.relay ? oc.shift() : d.driver;
          plan[id] = { spare: ch.sp.id, driver: drvName, delay: ch.mins, extra: 120 + (ch.relay ? 180 : ch.ot * 48), empty: ch.km };
          rows.push({ down: id, what: ch.sp.id + ' (' + ch.sp.type.toLowerCase() + ') from ' + ch.sp.home + ', ' + ch.km + ' km away', who: ch.relay ? 'On-call driver ' + drvName + ' relays; no overtime' : d.driver + ' continues in ' + ch.sp.id + (ch.ot ? ' (+' + ch.ot.toFixed(1) + 'h on shift)' : ''), mins: ch.mins, note: ch.sp.sameDay ? 'Its own same-day pickup becomes a conflict' : 'No other commitment affected', noteFg: ch.sp.sameDay ? '#b91c1c' : '#4b5563' });
        } else {
          plan[id] = { partner: true, partnerName: PARTNER[d.type] || 'Quinte Freight', delay: ch.mins };
          rows.push({ down: id, what: 'Tender ' + (d.load || 'the load') + ' to ' + (PARTNER[d.type] || 'Quinte Freight'), who: 'Partner driver • no company truck or overtime used', mins: ch.mins, note: 'Partner premium about $150; we lose the margin on this load', noteFg: '#4b5563' });
        }
        otH += ch.ot; maxRec = Math.max(maxRec, ch.mins);
      });
      return { plan, rows, otH: otH * (pr.bal ? 0.7 : 1), maxRec };
    };
    const wiKey = JSON.stringify([PL.key, downIds, prio]);
    if (!this._wi || this._wi.key !== wiKey) {
      const P0 = buildPlan({ sw: true }), P1 = buildPlan(prio);
      const Ei = this.engine(Object.assign({}, PL.base, { whatIf: { down: downIds } }));
      const Eo = this.engine(Object.assign({}, PL.base, { whatIf: { down: downIds, plan: P1.plan } }));
      this._wi = { key: wiKey, P0, P1, Ei, Eo };
    }
    const WI = this._wi, Ei = WI.Ei, Eo = WI.Eo, nD = downIds.length;
    const sgnPts = (a, b, d) => sg(b - a, d == null ? 1 : d, ' pts');
    const impact = {
      n: scN, title: 'Impact Analysis: ' + scN + ' Truck' + (scN === 1 ? '' : 's') + ' Down', trucks: downIds.map((id) => id + ' (' + LV[id].type + ', ' + LV[id].lane + ')').join(' • '),
      cov: pct(nD / Math.max(1, C.m.active) * 100), ot: '+' + Math.round(nD * 4.5 / baseOtDay * 100) + '%', cost: '$' + int(Math.max(0, C.fin.profit - Ei.fin.profit)), rec: WI.P0.maxRec + ' min',
      otd: pct(Ei.m.otd) + ' (' + sgnPts(C.m.otd, Ei.m.otd) + ')', risk: String(Ei.m.risk) + ' (+' + (Ei.m.risk - C.m.risk) + ')', margin: pct(Ei.m.margin, 2) + ' (' + sgnPts(C.m.margin, Ei.m.margin, 2) + ')',
      goals: ['otd', 'margin', 'empty'].map((k, i) => { const up = k !== 'empty', t = goals[k], v = k === 'otd' ? Ei.m.otd : k === 'margin' ? Ei.m.margin : Ei.m.empty, b = BK[k]; return (['On-time', 'Margin', 'Empty km'][i]) + ': ' + (meets(v, t, up) ? 'on track' : meets(b, t, up) ? 'at risk' : 'unachievable'); }).join(' • '),
      ai: (() => { const sp = WI.P0.rows.filter((r) => r.what.indexOf('Tender') !== 0), tp = WI.P0.rows.filter((r) => r.what.indexOf('Tender') === 0); if (nD === 1) return sp.length ? 'Nearest available truck reroute: ' + sp[0].what + '.' : 'No compatible truck nearby: ' + tp[0].what.charAt(0).toLowerCase() + tp[0].what.slice(1) + '.'; return (sp.length ? 'Reroute the nearest available trucks (' + sp.map((r) => /^TRK\d+/.exec(r.what)[0]).join(', ') + ')' : 'No compatible spare trucks') + (tp.length ? (sp.length ? ' and tender ' : ': tender ') + tp.length + ' load' + (tp.length === 1 ? '' : 's') + ' to partner carriers.' : '.'); })()
    };
    const scenOpts = [1, 2, 3, 5].map((n) => ({ n, unit: n === 1 ? 'Truck Down' : 'Trucks Down', on: scN === n, pick: () => this.setState({ scen: n, optRun: false }), bd: scN === n ? '#1e3a6e' : '#d5dae2', bg: scN === n ? 'rgba(30,58,110,.06)' : '#ffffff', fg: scN === n ? '#1e3a6e' : '#0f172a', bw: scN === n ? '2px' : '1px' }));
    const prios = [['ot', 'Minimize overtime (labour cost)'], ['sw', 'Maintain delivery windows'], ['bal', 'Balance workload across drivers'], ['fuel', 'Optimize fuel consumption']].map((p) => ({ label: p[1], on: !!prio[p[0]], toggle: () => this.setState((st) => ({ prio: Object.assign({}, st.prio, { [p[0]]: !(st.prio || {})[p[0]] }), optRun: false })) }));
    const activeP = prios.filter((p) => p.on).length;
    const P1 = WI.P1, optRun = !!s.optRun && activeP > 0;
    const optRes = {
      rows: P1.rows, title: 'Optimized plan: ' + nD + ' truck' + (nD === 1 ? '' : 's') + ' down, ' + activeP + ' priorit' + (activeP === 1 ? 'y' : 'ies'),
      metrics: [
        ['On-time delivery', pct(Ei.m.otd), pct(Eo.m.otd)], ['Loads at risk', String(Ei.m.risk), String(Eo.m.risk)], ['Operating margin', pct(Ei.m.margin, 2), pct(Eo.m.margin, 2)],
        ['Empty kilometres', pct(Ei.m.empty, 2), pct(Eo.m.empty, 2)], ['Overtime increase', '+' + Math.round(nD * 4.5 / baseOtDay * 100) + '%', '+' + Math.round(P1.otH / baseOtDay * 100) + '%'], ['Recovery time', 'Not recovered', P1.maxRec + ' min'],
        ['Cost impact', '$' + int(Math.max(0, C.fin.profit - Ei.fin.profit)), '$' + int(Math.max(0, C.fin.profit - Eo.fin.profit))]
      ].map((r) => ({ label: r[0], a: r[1], b: r[2] })),
      saving: 'Saves about $' + int(Math.max(0, Eo.fin.profit - Ei.fin.profit)) + ' against leaving the trucks unrecovered. Scenario only: nothing is dispatched until a real disruption is approved.'
    };
    const optResult = activeP ? '' : 'Select at least one priority to optimize.';
    const inPlanIds = {}; P1.rows.forEach((r) => { const m = /^(TRK\d+)/.exec(r.what); if (m) inPlanIds[m[1]] = r.down; });
    const ORD = { idle: 0, dock: 1, moving: 2, shop: 3, breakdown: 4, offline: 5 };
    const resources = live.slice().sort((a, b) => (ORD[a.status] - ORD[b.status]) || (a.id < b.id ? -1 : 1)).map((t) => {
      const d = t.driver ? drv.filter((x) => x.name === t.driver)[0] : null;
      const tag = downIds.indexOf(t.id) >= 0 ? ['Down in scenario', 'rgba(239,68,68,.12)', '#b91c1c'] : optRun && inPlanIds[t.id] ? ['Covers ' + inPlanIds[t.id], 'rgba(30,58,110,.10)', '#1e3a6e'] : C.used[t.id] ? ['Committed', '#eef0f3', '#4b5563'] : null;
      return { id: t.id, statusLabel: t.statusLabel, pillBg: t.pillBg, pillFg: t.pillFg, type: t.type, fuel: t.base.fuelLvl + '%', fuelFg: t.base.fuelLvl < 25 ? '#b45309' : '#0f172a', hasDriver: !!d, driverLine: d ? d.name.split(' ')[0] + ' • ' + (40 + d.ot).toFixed(1) + 'h/' : '', otTxt: d ? d.ot.toFixed(1) + 'h OT' : '', otFg: d && d.ot > 5 ? '#b45309' : '#4b5563', hasTag: !!tag, tag: tag ? tag[0] : '', tagBg: tag ? tag[1] : '', tagFg: tag ? tag[2] : '', bd: tag && tag[0] !== 'Committed' ? tag[2] : '#e3e7ed' };
    });
    const resCount = { avail: live.filter((t) => t.status === 'idle' && !C.used[t.id]).length, onCall: C.onCallFree.length };
    // Active breakdowns banner + Auto-Reroute Now (still needs a confirmation)
    const brk = live.filter((t) => (t.status === 'breakdown' || t.status === 'offline') && !t.recovered && loadOf[t.id]);
    const brkKeys = brk.map((t) => PL.recommended[loadOf[t.id]]).filter(Boolean);
    const autoBanner = { has: brk.length > 0, title: 'Active Breakdown' + (brk.length === 1 ? '' : 's') + ': ' + brk.length + ' Truck' + (brk.length === 1 ? '' : 's'), ids: brk.map((t) => t.id).join(', ') + ' — rerouting recommended', open: () => this.setState({ autoPend: true }), pend: !!s.autoPend && brkKeys.length > 0,
      list: brk.map((t) => { const k = PL.recommended[loadOf[t.id]]; return { id: t.id, load: '#' + loadOf[t.id], action: k ? PD.O[k].label : 'No feasible response: review manually' }; }),
      confirm: () => this.approveMany(brkKeys, 'Auto-reroute for active breakdowns.'), cancel: () => this.setState({ autoPend: false }) };

    // ================= FINANCE STRIP (revenue, profit and cash kept separate) =================
    const finance = {
      rev: '$' + int(fin.rev), revSub: 'Recognized on delivery, next ' + days + ' days' + (fin.deferred ? ' • $' + int(fin.deferred) + ' deferred to next period' : ''),
      profit: '$' + int(fin.profit), profitSub: 'Margin ' + pct(K.margin, 2) + ' • start of day $' + int(PL.start.fin.profit),
      cash: '$' + int(cash.closing), cashSub: 'Lowest $' + int(cash.min) + ' on ' + fT(cash.minT) + ' • goal ≥ ' + kMoney(goals.cash * 1000), cashFg: cash.min < goals.cash * 1000 ? '#b91c1c' : '#0f172a',
      flow: 'Opening $' + int(cash.opening) + ' − paid now $' + int(cash.now) + ' + receipts $' + int(cash.collections) + ' − payments $' + int(cash.payments) + ' = closing $' + int(cash.closing),
      rows: [{ when: fT(PD.N0), what: 'Opening balance', party: '', amt: '$' + int(cash.opening), bal: '$' + int(cash.opening), fg: '#0f172a', note: '' }, { when: fT(PD.N0), what: 'Cash costs paid now', party: 'Responses and roadside work', amt: '−$' + int(cash.now), bal: '$' + int(cash.opening - cash.now), fg: cash.now ? '#b91c1c' : '#4b5563', note: '' }]
        .concat(cash.events.map((e) => ({ when: fT(e.t), what: (e.kind === 'in' ? 'Receipt ' : 'Payment ') + e.id, party: e.party, amt: (e.kind === 'in' ? '+$' : '−$') + int(e.amt), bal: e.inPeriod ? '$' + int(e.bal) : 'After period', fg: e.kind === 'in' ? '#1d4f91' : '#0f172a', note: e.late ? 'Delayed ' + PD.DIS.payment.delayDays + ' days' : '' })))
    };

    // ================= INSIGHTS: answers computed from the current plan =================
    const goalBy = {}; goalRows.forEach((g) => { goalBy[g.k] = g; });
    const recTxt = (l) => { const k = PL.recommended[l.no]; const ev = k ? (PL.options[l.no] || []).filter((x) => x.k === k)[0] : null; return ev ? ev.o.label + ' (' + impactTxt(ev) + ')' : 'no feasible response; escalate'; };
    const INTENTS = [
      ['targets', 'Will we hit the 30, 60 and 90-day targets?', /target|30|60|90|deadline|month|quarter|plan to hit|on track/],
      ['otd', 'Why is on-time delivery at risk?', /on.?time|late|deliver|otd|service/],
      ['margin', 'What is driving the margin gap?', /margin|profit|cost|claim|penalt/],
      ['empty', 'Why are empty kilometres above target?', /empty|deadhead|km|kilomet|reposition/],
      ['cash', 'What happens to cash this week?', /cash|pay|invoice|receiv|collect|liquid/],
      ['capacity', 'Do we have enough trucks and drivers?', /capacity|truck|driver|resource|cover|spare|on.?call/],
      ['actions', 'Which decisions should I make first?', /first|priorit|decision|next|should|action/]
    ];
    const iq = s.insightQ || '', intent = (INTENTS.filter((x) => x[0] === iq)[0] || INTENTS.filter((x) => x[2].test(String(iq).toLowerCase()))[0] || [iq ? 'summary' : ''])[0];
    const answerFor = (k) => {
      const g = goalBy[k];
      if (k === 'otd' || k === 'margin' || k === 'empty' || k === 'cash') {
        const tr = tBy[k];
        const out = [tr.label + ' targets — ' + tLine(tr) + '.', 'Next ' + days + ' days (detailed plan): ' + g.predTxt + '. ' + 'Cause: ' + g.cause, 'Working backward: ' + tr.cells.filter((x) => x.status !== 'On track').map((x) => x.back).join(' ') + (tr.cells.every((x) => x.status === 'On track') ? tr.cells[0].back : '')];
        tr.cells.filter((x) => x.hasWhy).forEach((x) => out.push('Why the ' + x.d + '-day target is off track: ' + x.why));
        if (tr.acts.length) out.push('Actions required today: ' + tr.acts.map((a) => a.label + ' (' + a.effect + '; ' + a.cost + ')').join('; ') + '.');
        if (k === 'otd' && openL.length) out.push('Start with: ' + openL.slice().sort((a, b) => rankL(a) - rankL(b)).slice(0, 3).map((l) => '#' + l.no + ' — ' + recTxt(l)).join('; ') + '.');
        if (k === 'margin' || k === 'empty') { const lv = leversOpen.filter((x) => k === 'margin' ? x.dMargin > 0.005 : x.dEmpty < -0.005); if (lv.length) out.push('Network changes not yet approved: ' + lv.map((x) => x.label + ' (' + (k === 'margin' ? 'margin ' + sg(x.dMargin, 2, ' pts') : 'empty km ' + sg(x.dEmpty, 2, ' pts')) + ')').join('; ') + '.'); }
        if (k === 'cash') out.push('Revenue recognized in the period stays $' + int(fin.rev) + ' and operating profit $' + int(fin.profit) + '; only the timing of cash moves.');
        return out;
      }
      if (k === 'targets') return tSummary.map((x) => x.d + ' days (' + x.date + '): ' + x.on + ' of ' + x.n + ' targets on track, ' + x.risk + ' at risk, ' + x.off + ' off track.').concat(targetRows.filter((r) => r.worst !== 'On track').map((r) => r.label + ': ' + tLine(r) + '.' + (r.acts.length ? ' Today: ' + r.acts[0].label + ' (' + r.acts[0].effect + ').' : '')));
      if (k === 'capacity') return ['Capacity coverage targets — ' + tLine(tBy.cover) + '.', 'Fleet utilization targets — ' + tLine(tBy.util) + '.'].concat(tBy.cover.cells.concat(tBy.util.cells).filter((x) => x.hasWhy).map((x) => 'Why off track: ' + x.why)).concat(['Capacity coverage is ' + pct(K.cover) + ': ' + C.counts.covered + ' of ' + C.counts.planned + ' planned loads have a compatible truck and an eligible driver.', 'Available now: ' + (live.filter((t) => t.status === 'idle' && !C.used[t.id]).map((t) => t.id + ' (' + t.type.toLowerCase() + ')').join(', ') || 'no spare trucks') + '; on-call drivers free: ' + (C.onCallFree.join(', ') || 'none') + '.', 'Committed by decisions: ' + (Object.keys(C.used).filter((id) => C.used[id] !== 'unavailable').map((id) => id + ' → #' + C.used[id].split(':')[0]).join(', ') || 'none') + '. Removed from the plan: ' + (Object.keys(C.used).filter((id) => C.used[id] === 'unavailable').concat(Object.keys(s.unavail || {}).filter((n) => !B.byId[n] && s.unavail[n])).join(', ') || 'none') + '.', 'Fleet utilization right now: ' + pct(K.util, 0) + ' (' + K.active + ' of 50 trucks).']);
      if (k === 'actions') return paItems.length ? paItems.map((a) => a.n + '. ' + a.title + ': ' + a.action + ' — ' + a.deadline + ' (' + a.rem + '). Expected impact: ' + a.impact + '.') : ['No decisions are waiting.'];
      return ['30-day forecast: on-time ' + tBy.otd.cells[0].predTxt + ' (' + tStatus.otd[0].toLowerCase() + '), margin ' + tBy.margin.cells[0].predTxt + ' (' + tStatus.margin[0].toLowerCase() + '), empty km ' + tBy.empty.cells[0].predTxt + ' (' + tStatus.empty[0].toLowerCase() + '), lowest cash ' + tBy.cash.cells[0].predTxt + ' (' + tStatus.cash[0].toLowerCase() + ').', K.risk + ' loads need a decision. Ask about a specific goal for the causes.'];
    };
    const insights = {
      chips: INTENTS.map((x) => ({ label: x[1], on: intent === x[0], pick: () => this.setState({ insightQ: x[0], insightText: '' }), bg: intent === x[0] ? '#1e3a6e' : '#ffffff', fg: intent === x[0] ? '#ffffff' : '#1e3a6e' })),
      text: s.insightText || '', onText: (e) => this.setState({ insightText: e.target.value }), ask: () => { const t = (this.state.insightText || '').trim(); if (t) this.setState({ insightQ: t }); },
      has: !!intent, question: (INTENTS.filter((x) => x[0] === intent)[0] || [0, typeof iq === 'string' ? iq : ''])[1] || iq, answer: intent ? answerFor(intent) : [],
      basis: 'Calculated from the current plan at ' + fT(nowM) + ' (demo clock) • scenario: ' + (PL.disKeys.length ? PL.disKeys.map((k) => PD.DIS[k].label).join(', ') : 'no disruptions') + ' • ' + decisions.length + ' approved decision' + (decisions.length === 1 ? '' : 's') + ' • synthetic demo data'
    };

    // ================= REMOVE / RESTORE RESOURCES (scenario page) =================
    const toggleRes = (id) => () => { const on = !!(this.state.unavail || {})[id]; this.act((p) => ({ unavail: Object.assign({}, p.unavail, { [id]: !on }), optRun: false }), (on ? 'Restored to the plan: ' : 'Removed from the plan: ') + id, on ? 'info' : 'warn'); };
    const unav = s.unavail || {};
    resources.forEach((r) => { const t = LV[r.id]; r.canToggle = (t.status === 'idle' && !(C.used[r.id] && C.used[r.id] !== 'unavailable')) || !!unav[r.id]; r.toggle = toggleRes(r.id); r.toggleLabel = unav[r.id] ? 'Restore to plan' : 'Remove from plan'; if (unav[r.id]) { r.hasTag = true; r.tag = 'Removed from plan'; r.tagBg = '#eef0f3'; r.tagFg = '#374151'; r.bd = '#9ca3af'; } });
    const onCallCards = PD.onCall.map((n) => { const u = C.onCallUsed.indexOf(n) >= 0, x = !!unav[n]; return { id: n, statusLabel: x ? 'Removed' : u ? 'Committed' : 'On call', pillBg: x ? '#eef0f3' : u ? '#eef0f3' : 'rgba(108,179,227,.16)', pillFg: x ? '#374151' : u ? '#4b5563' : '#1d4f91', type: 'On-call driver • Toronto Hub', fuel: '13h driving available', canToggle: !u || x, toggle: toggleRes(n), toggleLabel: x ? 'Restore to plan' : 'Remove from plan' }; });
    resCount.avail = live.filter((t) => t.status === 'idle' && !C.used[t.id]).length; resCount.onCall = C.onCallFree.length;
    // ================= 30-DAY TARGET EFFECT OF THE TRUCKS-DOWN SCENARIO AND OF EACH LOAD RESPONSE =================
    const wiT0 = PL.TJ({ whatIf: { down: downIds } }).t, wiT1 = PL.TJ({ whatIf: { down: downIds, plan: WI.P1.plan } }).t;
    const wiTargets = TD.measures.filter((m) => m.k === 'otd' || m.k === 'margin' || m.k === 'cover' || m.k === 'cash').map((m) => ({ label: m.label, cur: fmtM(m, TC.w[0][m.k]), no: fmtM(m, wiT0.w[0][m.k]), opt: fmtM(m, wiT1.w[0][m.k]), t: tBy[m.k].cells[0].targetTxt }));
    if (cl) {
      const ref = Object.assign({}, s.applied || {}); if (cl.chosen && cl.risk) delete ref[cl.chosen.k];
      (PL.options[cl.no] || []).forEach((x, i) => {
        const o = cmp.opts[i]; if (!o) return; if (x.block) { o.tgt = ''; return; }
        const t = PL.TJ({ applied: Object.assign({}, ref, { [x.k]: { t: 9e15 } }) }).t;
        o.tgt = '30/60/90-day targets: ' + ['otd', 'margin', 'cash'].map((k) => { const m = TD.measures.filter((mm) => mm.k === k)[0]; return (k === 'cash' ? 'lowest cash' : m.label.toLowerCase()) + ' ' + DL.map((d, j) => k === 'cash' ? fmtGap(m, t.w[j][k] - TC.w[j][k]) : sg((m.up ? 1 : -1) * (t.w[j][k] - TC.w[j][k]), 2, ' pts')).join(' / '); }).join('; ');
      });
    }
    // ================= GLOBAL SEARCH AND ASK (top right, every page) =================
    const gq = (s.q || '').trim(), gl = gq.toLowerCase();
    const jump = (patch, scrollId) => () => { this.setState(Object.assign({ q: '', aiAns: null, toast: '' }, patch)); if (scrollId) this.scrollTo(scrollId); };
    const PAGE_NAMES = { caps: 'Capabilities', cc: 'Dashboard', kpi: 'KPIs', scen: 'Scenario Planning', map: 'Asset Map', fleet: 'Fleet Status', route: 'Route Optimization', fuel: 'Fuel & Costs', labour: 'Labour Management', dispatch: 'Live Dispatch', bid: 'Freight Bidding', tele: 'Telematics', driver: 'Driver Development', safety: 'Safety & Compliance', reports: 'Reports' };
    const idx = [];
    const add = (type, title, sub, hay, go, rank) => idx.push({ type, title, sub, hay: (title + ' ' + sub + ' ' + (hay || '')).toLowerCase(), go, rank: rank || 5 });
    Object.keys(PAGE_NAMES).forEach((k) => add('Page', PAGE_NAMES[k], 'Open page', k, jump({ page: k }), 1));
    targetRows.forEach((r) => add('Target', r.label, r.cells.map((x) => x.d + 'd ' + x.predTxt + ' vs ' + x.targetTxt + ' (' + x.status + ')').join(' • '), 'target goal 30 60 90 ' + r.k, jump({ page: 'cc' }, 'goals'), 2));
    C.loads.filter((l) => l.inH || l.risk).forEach((l) => add('Load', '#' + l.no + ' • ' + l.cust, l.from + ' → ' + l.to + ' • ' + l.status + ' • due ' + fT(l.due) + (l.newTruck || l.truck ? ' • ' + (l.newTruck || l.truck) : ''), l.no + ' ' + l.eq + ' ' + (l.driver || '') + ' ' + (l.issue ? l.issue.cause : ''), review(l.no), l.risk ? 2 : 4));
    live.forEach((t) => add('Truck', t.id + ' • ' + t.type, t.statusLabel + ' • ' + t.lane + (t.driver ? ' • ' + t.driver : '') + (t.load ? ' • ' + t.load : ''), t.make + ' ' + (t.note || ''), jump({ page: 'map', sel: t.id }), 3));
    drv.forEach((d) => add('Driver', d.name, (d.truck ? d.truck.id + ' • ' + d.truck.lane : d.onCall ? 'On call' : 'Off duty') + ' • safety ' + d.safety + ' • ' + d.ot.toFixed(1) + 'h overtime', 'driver', jump({ page: 'dispatch', dispatchTo: d.name }), 4));
    custRows.forEach((c2) => add('Customer', c2.name, c2.rev + ' a year • on-time ' + c2.otd + ' • ' + c2.health, 'customer shipper', jump({ page: 'kpi' }), 3));
    cash.events.filter((e) => !e.steady).forEach((e) => add(e.kind === 'in' ? 'Invoice' : 'Payment', e.id + ' • ' + e.party, (e.kind === 'in' ? 'Receipt ' : 'Payment ') + '$' + int(e.amt) + ' • ' + fT(e.t) + (e.late ? ' • paid late' : ''), 'cash invoice payable receivable', jump({ page: 'cc' }, 'finance'), 3));
    [[PD.SHOP.supplier, 'Maintenance supplier • releases ' + Object.keys(C.rel).map((k) => k + ' ' + fT(C.rel[k])).join(', ')], ['Northway Fuel', 'Fuel supplier • bi-weekly diesel'], ['Ridgeway Logistics', 'Partner carrier • reefer'], ['Huron Flatbed', 'Partner carrier • flatbed'], ['Quinte Freight', 'Partner carrier • dry van'], ['Muskoka Carriers', 'Partner carrier • dry van']].forEach((x) => add('Supplier', x[0], x[1], 'supplier partner carrier vendor', jump({ page: 'scen' }), 4));
    pkgRows.forEach((p) => add('Scenario', p.label, p.closes, p.what, jump({ page: 'scen' }, 'targetScen'), 3));
    Object.keys(PD.DIS).forEach((k) => add('Disruption', PD.DIS[k].label, PD.DIS[k].title + (dis[k] ? ' • active' : ''), 'disruption simulate', jump({ page: 'cc', showDis: true }, 'disrupt'), 4));
    planReports.forEach((r) => add('Report', r.name, r.live, 'report download csv', jump({ page: 'reports' }), 4));
    allReps.forEach((r) => add('Report', r.name, r.cat + ' • ' + r.freq, r.desc, jump({ page: 'reports', repQ: r.name }), 5));
    const toks = gl.split(/\s+/).filter(Boolean);
    const hits = gq.length < 2 ? [] : idx.filter((it) => toks.every((t) => it.hay.indexOf(t.replace(/[#?]/g, '')) >= 0)).sort((a, b) => a.rank - b.rank || (a.title.toLowerCase().indexOf(gl) === 0 ? -1 : 0)).slice(0, 8);
    // Questions: answered from the current model (entities first, then the Insights topics)
    const isQ = /\?$/.test(gq) || /^(why|what|how|which|when|where|who|will|do|does|is|are|can|should|show|explain)\b/i.test(gq);
    let qa = null;
    if (isQ && gq.length > 3) {
      const tm = /trk\s?0?(\d{2,3})/i.exec(gq), lm = /#?\b(4[4-6]\d\d)\b/.exec(gq);
      const dm = drv.filter((d) => gl.indexOf(d.name.toLowerCase()) >= 0 || gl.indexOf(d.name.split(' ')[1].toLowerCase() + ' ') >= 0 && gl.indexOf(d.name.split(' ')[0].toLowerCase()) >= 0)[0];
      const cm = custRows.filter((c2) => gl.indexOf(c2.name.toLowerCase().split(' ')[0]) >= 0 && c2.name !== '40 other shippers')[0];
      if (tm) { const id = 'TRK' + String(tm[1]).padStart(3, '0'), t = LV[id]; if (t) { const ld = C.loads.filter((l) => (l.newTruck || l.truck) === id && (l.inH || l.risk))[0]; qa = { lines: [id + ' (' + t.type + ', ' + t.make + ') is ' + t.statusLabel.toLowerCase() + ': ' + t.lane + '.', (t.driver ? 'Driver ' + t.driver + '. ' : 'No driver assigned. ') + (t.load ? 'Carrying ' + t.load + ' for ' + t.shipper + '. ' : '') + (t.note ? t.note + '.' : ''), ld ? 'Load #' + ld.no + ': ' + ld.status + ', due ' + fT(ld.due) + (ld.eta != null ? ', predicted ' + fT(ld.eta) : '') + '.' : 'No load in the current plan.', C.used[id] ? 'Committed by decision ' + C.used[id] + '.' : ''], go: jump({ page: 'map', sel: id }), goLabel: 'Show ' + id + ' on the map' }; } }
      if (!qa && lm && C.LB[lm[1]]) { const l = C.LB[lm[1]], rk = PL.recommended[l.no]; qa = { lines: ['Load #' + l.no + ' (' + l.cust + ', ' + l.from + ' → ' + l.to + ', ' + l.eq + ') is ' + l.status.toLowerCase() + '. Delivery due ' + fT(l.due) + (l.eta != null ? ', predicted ' + fT(l.eta) : ', arrival unknown') + '.', l.issue && l.risk ? 'Cause: ' + l.issue.cause + ' Decide by ' + fT(l.issue.act) + ' (' + fD(l.issue.act - nowM) + ').' : l.chosen ? 'Approved response: ' + l.chosen.label + '.' : 'No open issue.', rk ? 'Recommended: ' + PD.O[rk].label + '.' : ''], go: review(l.no), goLabel: 'Compare responses for #' + l.no }; }
      if (!qa && dm) { const d = dm; qa = { lines: [d.name + ': ' + (d.truck ? 'driving ' + d.truck.id + ' on ' + d.truck.lane : d.onCall ? 'on call at Toronto Hub' : 'off duty') + '.', 'Safety score ' + d.safety + ' (' + d.hb + ' hard brakes, ' + d.sp + ' speeding events in 30 days); ' + d.exp + ' years of experience; ' + d.ot.toFixed(1) + 'h overtime this week; idle ' + d.idle + ' min a day.', d.tr ? d.tr.course + ' training assigned.' : ''], go: jump({ page: 'dispatch', dispatchTo: d.name }), goLabel: 'Message ' + d.name }; }
      if (!qa && cm) { const ls = C.loads.filter((l) => l.cust === cm.name && (l.inH || l.risk)); qa = { lines: [cm.name + ': ' + cm.rev + ' revenue in the last 12 months (' + cm.shareTxt + ' of total), on-time ' + cm.otd + ', tender acceptance ' + cm.ten + ', claims ' + cm.cl + ' — ' + cm.health.toLowerCase() + '.', ls.length + ' loads in the current plan: ' + ls.filter((l) => l.risk).length + ' at risk' + (ls.filter((l) => l.risk).length ? ' (' + ls.filter((l) => l.risk).map((l) => '#' + l.no).join(', ') + ')' : '') + '.'], go: jump({ page: 'kpi' }), goLabel: 'Open the customer scorecard' }; }
      if (!qa) { const it = (INTENTS.filter((x) => x[2].test(gl))[0] || [null])[0]; if (it) qa = { lines: answerFor(it).slice(0, 4), go: jump({ page: 'cc', insightQ: it }, 'insights'), goLabel: 'Open the full answer in Insights' }; }
    }
    const ai = s.aiAns && s.aiAns.q === gq ? s.aiAns : null;
    const askAI = () => this.askAI(gq, () => {
      const lines = ['Demo clock: ' + fT(nowM) + '. Synthetic demo data.', 'Targets (30/60/90 days): ' + targetRows.map((r) => r.label + ' ' + tLine(r)).join(' | '), 'Next ' + days + ' days: ' + kpiCards.map((k) => k.label + ' ' + k.value).join('; ') + '; revenue $' + int(fin.rev) + ', profit $' + int(fin.profit) + ', lowest cash $' + int(cash.min) + '.', 'Loads needing a decision: ' + openL.map((l) => '#' + l.no + ' ' + l.cust + ' ' + l.from + '-' + l.to + ': ' + short(l) + '; recommended ' + (PL.recommended[l.no] ? PD.O[PL.recommended[l.no]].label : 'none')).join(' | '), 'Active disruptions: ' + (PL.disKeys.map((k) => PD.DIS[k].title).join('; ') || 'none'), 'Decisions approved: ' + (decisions.map((d) => d.label).join('; ') || 'none'), 'Fleet: ' + fc.moving + ' in transit, ' + fc.dock + ' at dock, ' + fc.idle + ' available, ' + fc.shop + ' in shop, ' + fc.breakdown + ' broken down, ' + fc.offline + ' offline. On-call drivers free: ' + (C.onCallFree.join(', ') || 'none') + '.', 'Target scenarios: ' + pkgRows.map((p) => p.label + ' — ' + p.closes + '; ' + p.cost).join(' | '), 'Customers: ' + custRows.map((c2) => c2.name + ' ' + c2.rev + ' on-time ' + c2.otd + ' ' + c2.health).join('; ')];
      return lines.join('\n');
    });
    const search = {
      q: s.q || '', on: (e) => this.setState({ q: e.target.value, aiAns: null }), clear: () => this.setState({ q: '', aiAns: null }), open: gq.length >= 2,
      hits: hits.map((h) => ({ type: h.type, title: h.title, sub: h.sub, go: h.go })), noHits: gq.length >= 2 && !hits.length && !qa, hasHits: hits.length > 0,
      isQ: !!qa, qaLines: qa ? qa.lines.filter(Boolean) : [], qaGo: qa ? qa.go : () => {}, qaGoLabel: qa ? qa.goLabel : '',
      canAI: isQ && gq.length > 3, aiLabel: ai && ai.status === 'loading' ? 'Asking…' : 'Ask Monifi AI', ask: askAI, aiHas: !!(ai && ai.text), aiText: ai ? ai.text : '', aiErr: ai && ai.status === 'error' ? ai.text : '', aiIsErr: !!(ai && ai.status === 'error'),
      enter: (e) => { if (e.key !== 'Enter') return; if (!qa && hits[0]) hits[0].go(); }
    };
    // ================= SCENARIO CHOOSER (Scenario Planning) =================
    const scSel = s.scenSel && pkgRows.some((p) => p.id === s.scenSel) ? s.scenSel : (pkgRows[0] || {}).id;
    const scale = { otd: 1, margin: 1, empty: 1, cover: 1, util: 1, cash: 0.02 };
    const scenCards = pkgRows.map((p) => {
      const a = PL.tActs.filter((x) => x.id === p.id)[0], on = p.id === scSel;
      const eff = TD.measures.map((m) => ({ m, x: a.d[m.k][2], w: Math.abs(a.d[m.k][2]) * scale[m.k] })).filter((e) => Math.abs(e.x) >= epsOf(e.m)).sort((u, v) => v.w - u.w).slice(0, 3)
        .map((e) => ({ txt: e.m.label.replace('Minimum cash balance', 'Lowest cash') + ' ' + (e.m.k === 'cash' ? cashTxt(e.x) : fmtGap(e.m, e.x)), fg: better(e.m, e.x) ? '#1d4f91' : '#b91c1c' }));
      const n = p.closes.indexOf('Closes:') === 0 ? p.closes.split(',').length : 0;
      return { id: p.id, label: p.label, what: p.what.split('. ')[0].replace(/\.$/, '') + '.', gaps: n ? 'Closes ' + n + ' target gap' + (n === 1 ? '' : 's') : 'Closes no gap on its own', eff, hasEff: eff.length > 0, noEff: !eff.length, effNote: '90-day effect', on, pick: () => this.setState({ scenSel: p.id, pend: null }), bd: on ? '#1e3a6e' : '#e3e7ed', bw: on ? '2px' : '1px', bg: on ? 'rgba(30,58,110,.04)' : '#ffffff' };
    });
    const selP = pkgRows.filter((p) => p.id === scSel)[0], selA = PL.tActs.filter((x) => x.id === scSel)[0];
    const scenDetail = selP ? {
      has: true, label: selP.label, what: selP.what, lead: selP.lead, closes: selP.closes, worsens: selP.worsens, hasWorsens: selP.hasWorsens, cost: selP.cost, trade: selP.trade,
      rows: TD.measures.map((m) => ({ label: m.label, cells: DL.map((d, i) => { const t = TGT[m.k][i], v = selA.t.w[i][m.k], ok = m.up ? v >= t - 1e-9 : v <= t + 1e-9, cur = tBy[m.k].cells[i]; return { d, now: cur.predTxt, nowSt: cur.status, nowFg: cur.pillFg, with: predFmt(m, v, t), withSt: ok ? 'Meets target' : 'Misses target', withFg: ok ? '#1d4f91' : '#b45309', target: cur.targetTxt }; }) })),
      pending: (s.pend || null) === scSel, approve: () => this.setState({ pend: scSel }), btnLabel: (s.pend || null) === scSel ? 'Selected — confirm below' : 'Approve and apply'
    } : { has: false, label: '', what: '', lead: '', closes: '', worsens: '', hasWorsens: false, cost: '', trade: '', rows: [], pending: false, approve: () => {}, btnLabel: '' };
    const appliedScen = decisions.filter((d) => /^(P:|R:)/.test(d.k) || d.k === 'P:routes').map((d) => d.label.split(':')[0]);
    const scenApplied = { has: appliedScen.length > 0, txt: 'Already applied: ' + appliedScen.join(', ') + '.' };
    const scenNone = pkgRows.length === 0;

    // ---------- Capabilities (live numbers where they exist) ----------
    const outcomes = [
      { value: '$457K/yr', label: 'Lane optimization potential', sub: '2,161 empty km and 232 driver hours saved per week' },
      { value: '$407K', label: 'Fuel savings potential', sub: 'With a 60% cut in idle time' },
      { value: money(otCostBase * 52 * 0.3), label: 'Overtime reduction potential', sub: 'With HOS-aware scheduling (30% less overtime)' },
      { value: '$1.0M/yr', label: 'Sharper freight bids', sub: '3 fewer tractors on the Northline Retail bid' }
    ];
    const Gp = (title, short, desc, color, tint, ink, items) => ({ title, short, desc, color, tint, ink, items: items.map((c) => Object.assign({}, c, { go: nav[c.k].go })) });
    const capGroups = [
      Gp('Real-time operations', 'Live ops', 'See and act on what is happening right now', '#2563eb', '#eff6ff', '#1d4ed8', [
        { k: 'cc', name: 'Dashboard', desc: 'Future goals, goals at risk, priority actions and the operational plan on one screen.', features: ['Editable targets: on track, at risk or unachievable', 'Responses compared and approved in one place', 'Operational plan with emerging conflicts'], metric: C.m.risk + ' loads', metricLabel: 'need a decision' },
        { k: 'kpi', name: 'KPI Scorecard', desc: 'Company and customer performance against target, with trends.', features: ['Operating ratio, revenue and cost per km', 'On-time, tender acceptance and claims by shipper', 'Week, month, quarter and year-to-date views'], metric: onT + ' of ' + allK.length, metricLabel: 'KPIs on target' },
        { k: 'map', name: 'Asset Map', desc: 'Every truck, breakdown and terminal on one live regional map.', features: ['Live truck positions across your lanes', 'Breakdowns flagged instantly', 'Terminal and cross-dock overlay'], metric: fc.total + ' trucks', metricLabel: 'tracked live' },
        { k: 'dispatch', name: 'Live Dispatch', desc: 'Reach every driver on the road in seconds.', features: ['Emergency, weather and general broadcasts', 'Message any driver directly', 'Locate drivers on the map'], metric: ds.onRoute + ' drivers', metricLabel: 'reachable right now' },
        { k: 'tele', name: 'Telematics', desc: 'Engine, fuel, emissions and reefer diagnostics for each truck.', features: ['GEOTAB-connected fleet health', 'Fault codes with severity', 'Failures predicted before they happen'], metric: B.trucks.filter((t) => t.predicted).length + ' failures', metricLabel: 'predicted early' }
      ]),
      Gp('Fleet & cost control', 'Cost', 'Know where every dollar goes', '#d97706', '#fffbeb', '#92400e', [
        { k: 'fleet', name: 'Fleet Status', desc: 'Utilization, cost per km and service schedule for every tractor.', features: ['Full fleet inventory', 'Cost per km by vehicle', 'Next-service and fault tracking'], metric: '$' + kpiCpm.toFixed(2), metricLabel: 'avg cost per km' },
        { k: 'fuel', name: 'Fuel & Costs', desc: 'Fuel spend against budget, idle waste and the least efficient vehicles.', features: ['Monthly spend vs budget', 'Top idle-time drivers', 'Highest fuel-use vehicles with fixes'], metric: '$407K', metricLabel: 'savings potential' },
        { k: 'labour', name: 'Labour Management', desc: 'Driver pay, overtime and hours-of-service in one view.', features: ['Regular vs overtime cost by month', 'Drivers near HOS limits to rebalance', 'Top performers as benchmarks'], metric: money(otCostBase * 52 * 0.3), metricLabel: 'OT reduction potential' },
        { k: 'reports', name: 'Reports', desc: 'Planning reports from the current scenario, plus standard trucking reports.', features: ['CSV downloads with period and assumptions', 'Print-friendly summary to save as PDF', 'HOS, DVIR, CSA and IFTA compliance reports'], metric: '5 + 19', metricLabel: 'planning and standard reports' }
      ]),
      Gp('Planning & optimization', 'AI planning', 'Let the system find the savings', '#1e3a6e', '#eef6fc', '#1e3a6e', [
        { k: 'route', name: 'Route Optimization', desc: 'Lane analysis that cuts empty kilometres, with before and after comparisons.', features: ['Savings by lane', 'Load consolidation opportunities', 'One-click apply'], metric: '$457K/yr', metricLabel: 'optimization potential' },
        { k: 'scen', name: 'Scenario Planning', desc: 'Simulate disruptions and compare the plan before and after your response.', features: ['Truck, driver, loading, route and urgent-order events', 'Plan before, during and after the response', 'Decision log with rationale'], metric: '5', metricLabel: 'disruption types' },
        { k: 'bid', name: 'Freight Bidding', desc: 'Size the fleet for a shipper RFP and price the bid against other carriers.', features: ['Standard vs optimized fleet sizing', 'Competing carrier tracking', 'Recommended rate range'], metric: '$1.0M/yr', metricLabel: 'saved on Northline bid' }
      ]),
      Gp('People & safety', 'People', 'Develop safer, more productive drivers', '#7c3aed', '#f5f3ff', '#6d28d9', [
        { k: 'driver', name: 'Driver Development', desc: 'Training progress and lane familiarity for every driver.', features: ['15-module training track', 'Lane familiarity scores', 'Onboarding progress'], metric: roster.length + ' drivers', metricLabel: 'in active training' },
        { k: 'safety', name: 'Safety & Compliance', desc: 'Driver safety scores with targeted training.', features: ['Hard braking and speeding events', 'Drivers below the safety threshold', 'Assign training in one click'], metric: (drv.reduce((a, d) => a + d.safety, 0) / drv.length).toFixed(0), metricLabel: 'avg safety score' }
      ])
    ];
    const steps = [{ n: 1, title: 'Start with future targets', desc: 'Set on-time, margin and empty-km goals for the planning period. Monifi predicts whether each one is on track, at risk or unachievable.' }, { n: 2, title: 'Work backward to today', desc: 'For every commitment, Monifi shows the departure time, truck and eligible driver needed, and flags conflicts before they become late loads.' }, { n: 3, title: 'Replan and approve', desc: 'When conditions change, compare practical responses and approve one. Every screen, KPI and report updates from the same plan.' }];

    return {
      clockDate, periodTxt, periodShort, runDemo, demoOn: demo > 0, demoSteps, demoStep, exitDemo: () => this.setState({ demo: 0 }),
      toggleDisPanel: () => { this.setState((p) => ({ showDis: !p.showDis || Object.keys(p.dis || {}).some((k) => p.dis[k]) })); this.scrollTo('disrupt'); }, showDisPanel: !!s.showDis || PL.disKeys.length > 0 || demo === 2,
      disOpts, hasDis: PL.disKeys.length > 0, noDis: PL.disKeys.length === 0, disActive, disImpact, kpiCards, goalRows, goalInputs, horizonVal: String(days), setHorizon: (e) => this.setState({ horizon: parseInt(e.target.value, 10) || 7 }),
      goActions: () => this.scrollTo('actions'), paItems, paSub, paEmpty: paItems.length === 0, lvPend, cmp, results, planFilters, planRows, planFoot,
      decisions, decisionsTop: decisions.slice(0, 3), noDecisions: decisions.length === 0, scenRows, capList,
      repPeriod, repScenario, repDecisions: String(decisions.length), repGoals, planReports, printSummary, assumptions, dl, riskCount: C.m.risk, hasRisk: C.m.risk > 0,
      gateBar: (() => { const g = s.gate && !(s.done || {})[s.gate] && this._gate ? this._gate[s.gate] : null; return g ? { has: true, title: g.title, confirm: () => g.run(), cancel: () => this.setState({ gate: null }) } : { has: false, title: '', confirm: () => {}, cancel: () => {} }; })(),
      userOpen: !!s.userOpen, toggleUser: () => this.setState((p) => ({ userOpen: !p.userOpen })),
      is, nav, clock, sideW: s.collapsed ? '64px' : '200px', sideMax: s.collapsed ? '64px' : '220px', labelDisplay: s.collapsed ? 'none' : 'flex',
      collapseIcon: s.collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6', toggleCollapse: () => this.setState((p) => ({ collapsed: !p.collapsed })),
      scenarioId: (this.props.env || {}).scenarioId || '', scenarioList: (this.props.env || {}).scenarios || [], showScenarioPicker: !s.collapsed && ((this.props.env || {}).scenarios || []).length > 1,
      pickScenario: (e) => { const env = this.props.env; if (env && env.pick && e.target.value !== env.scenarioId) env.pick(e.target.value); },
      showSaveNote: !s.collapsed && !!this.props.env, saveNote: (this.props.env || {}).saveAvailable ? 'Your progress is saved in this browser.' : 'Saving is unavailable in this browser window.',
      resetDemo: () => { this.setState(Object.assign(this.fresh(), { page: this.state.page, collapsed: this.state.collapsed, toast: 'Demo reset to the starting point' })); this.scrollTo('top'); },
      hasToast: !!s.toast, toast,
      outcomes, capGroups, steps,
      crit, ops, recs, alerts, alertCount: alerts.length, hasAlerts: alerts.length > 0, noAlerts: alerts.length === 0, activity, healthTiles, attnCount, ds, savingsTiles,
      geo: G.geo, mapCities: G.cities, mapRegions: G.regions, mapWaters: G.waters, mapShields: G.shields, mapTerminals: G.terminals,
      fleetLive: live, selTruck, truckList, fc, statusLegend,
      kpiPeriods, kpiSummary, kpiSections, custRows, maple, mapleRisk: !rec.TRK012, mapleOk: !!rec.TRK012, openTrk012: go('map', { sel: 'TRK012' }), recover012: recover('TRK012'),
      fleetKpis, fleetFilters, fleetRows,
      routeStats, lanes, opps, samples, runFull,
      recoverAll, impact, scenOpts, prios, optRun, optResult, noPrio: activeP === 0, runOpt: () => this.setState({ optRun: true }), optRes, resources, resCount, autoBanner, finance, insights, onCallCards, targetRows, tSummary, pkgRows, pkgPend, wiTargets, search, scenCards, scenDetail, scenApplied, scenNone,
      fuelBars, fuelKpis, idlers, idleBtn, mpgList,
      labBars, labKpis, otDrivers, rebalBtn, leaders,
      onRoute, msg: s.msg, onMsg: (e) => this.setState({ msg: e.target.value }), dispatchToTxt: to ? to + (truckOf[to] ? ' (' + truckOf[to].id + ')' : '') : 'All ' + ds.onRoute + ' drivers on route', hasDispatchTo: !!to, toAll: () => this.setState({ dispatchTo: '' }),
      sendEmergency: send('bad', 'Emergency: stop safely and call dispatch immediately.'), sendWeather: send('warn', 'Weather warning: snow squalls on the 401 east of Kingston. Reduce speed and add following distance.'), sendGeneral: send('info', 'Reminder: confirm your delivery appointment with dispatch 1 hour before arrival.'),
      messages, msgCount: messages.length, noMessages: messages.length === 0,
      bids, bid, bidSubmit,
      teleKpis, attnList, teleTruck, teleOpts, pickTele: (e) => this.setState({ teleId: e.target.value }),
      roster, rosterCount: roster.length, devKpis,
      safetyList, safetyCount: low.length, safeKpis, assignAllSafety: assignTraining(low.map((d) => d.name), 'Safety refresher'),
      repSummary, repCats, repList, repEmpty: repList.length === 0, repQ, onRepQ: (e) => this.setState({ repQ: e.target.value }), schedRows, schedCount: schedRows.length, exportsList, newReport
    };
  }
}
