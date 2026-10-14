/*
 * Scenario loader + checker
 * ---------------------------------------------------------------------------
 * A scenario is a folder of JSON files: data/scenarios/<id>/
 *
 *   scenario.json     name, clock (start date + minute), economics, on-call drivers, goal levers
 *   drivers.json      the driver roster
 *   trucks.json       the fleet (position/route, status, telemetry, faults, predictions)
 *   loads.json        explicit loads (+ $/km for auto-generated ones)
 *   responses.json    the response options offered for each at-risk load
 *   disruptions.json  the "Simulate disruption" buttons, spare-truck recovery plans, shop release times
 *   finance.json      opening cash, customer payment terms, receivables, payables
 *   targets.json      30/60/90-day measures, model parameters, approvable packages
 *
 * Register a scenario by adding it to data/scenarios/index.json.
 * Works in the browser (window.MonifiData) and in Node (module.exports) so the
 * same checker runs from tests/validate_scenarios.js.
 */
(function (root) {
  'use strict';

  var FILES = ['scenario', 'drivers', 'trucks', 'loads', 'responses', 'disruptions', 'finance', 'targets'];

  // Truck and load numbers the app's code refers to directly (guided demo steps, explainer text,
  // approval packages). A scenario can drop them, but those parts of the demo will then be empty or off.
  var ANCHOR_TRUCKS = ['TRK001', 'TRK002', 'TRK003', 'TRK004', 'TRK006', 'TRK009', 'TRK011', 'TRK012', 'TRK015', 'TRK016', 'TRK018', 'TRK019', 'TRK020', 'TRK025', 'TRK027', 'TRK029', 'TRK031', 'TRK037', 'TRK038', 'TRK040', 'TRK042', 'TRK049'];
  var ANCHOR_LOADS = ['4466', '4471', '4474', '4490', '4502', '4545', '4546', '4562', '4577', '4620'];

  function hash(str) { // small, stable fingerprint used to detect edited scenario files
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  /* ------------------------------------------------------------ checker -- */
  function validate(d) {
    var errors = [], warnings = [];
    function err(m) { errors.push(m); }
    function warn(m) { warnings.push(m); }
    function set(arr, key) { var o = {}; (arr || []).forEach(function (x) { o[x[key]] = x; }); return o; }
    function dupes(arr, key, what) {
      var seen = {}; (arr || []).forEach(function (x) { if (seen[x[key]]) err(what + ' "' + x[key] + '" appears twice'); seen[x[key]] = 1; });
    }

    var sc = d.scenario || {};
    if (!sc.clock || !Array.isArray(sc.clock.date) || typeof sc.clock.startMinute !== 'number') err('scenario.json: clock needs { "date": [year, monthIndex, day], "startMinute": number }');
    if (!sc.economics) err('scenario.json: economics is missing');
    if (!Array.isArray(d.trucks) || !d.trucks.length) err('trucks.json: needs at least one truck');
    if (!Array.isArray(d.drivers) || !d.drivers.length) err('drivers.json: needs at least one driver');
    if (errors.length) return { errors: errors, warnings: warnings };

    dupes(d.trucks, 'id', 'truck'); dupes(d.drivers, 'name', 'driver');
    var T = set(d.trucks, 'id'), D = set(d.drivers, 'name');
    var explicit = (d.loads && d.loads.loads) || [];
    dupes(explicit, 'no', 'load');
    var L = set(explicit, 'no');
    d.trucks.forEach(function (t) { if (t.load) L[String(t.load).replace('#', '')] = L[String(t.load).replace('#', '')] || { generated: true }; });

    d.trucks.forEach(function (t) {
      if (t.driver && !D[t.driver]) warn('trucks.json: ' + t.id + ' has driver "' + t.driver + '" who is not in drivers.json');
      if (!t.at && !(t.route && t.route.length)) warn('trucks.json: ' + t.id + ' has neither "at" nor "route", so it will not appear on the map');
    });
    explicit.forEach(function (l) {
      if (l.truck && !T[l.truck]) warn('loads.json: load ' + l.no + ' uses truck ' + l.truck + ' which is not in trucks.json');
      if (l.driver && !D[l.driver]) warn('loads.json: load ' + l.no + ' uses driver "' + l.driver + '" who is not in drivers.json');
    });
    (d.responses || []).forEach(function (o) {
      var id = o.no + ':' + o.kind;
      if (!L[o.no]) warn('responses.json: option ' + id + ' is for load ' + o.no + ' which does not exist');
      ['truck', 'freeTruck', 'shopTruck'].forEach(function (k) { if (o[k] && !T[o[k]]) warn('responses.json: option ' + id + ' ' + k + ' ' + o[k] + ' is not in trucks.json'); });
      if (o.move && o.move.truck && !T[o.move.truck]) warn('responses.json: option ' + id + ' move.truck ' + o.move.truck + ' is not in trucks.json');
    });
    var keys = {}; (d.responses || []).forEach(function (o) { var k = o.no + ':' + o.kind; if (keys[k]) err('responses.json: duplicate option ' + k); keys[k] = 1; });

    var dis = d.disruptions || {};
    Object.keys(dis.disruptions || {}).forEach(function (k) {
      var x = dis.disruptions[k];
      if (x.load && !L[x.load]) warn('disruptions.json: "' + k + '" refers to load ' + x.load + ' which does not exist');
      if (x.truck && !T[x.truck]) warn('disruptions.json: "' + k + '" refers to truck ' + x.truck + ' which does not exist');
    });
    Object.keys(dis.recoveryPlans || {}).forEach(function (k) {
      var p = dis.recoveryPlans[k];
      if (!T[k]) warn('disruptions.json: recoveryPlans has truck ' + k + ' which does not exist');
      if (p.spare && !T[p.spare]) warn('disruptions.json: recovery plan for ' + k + ' uses spare truck ' + p.spare + ' which does not exist');
      if (p.driver && !D[p.driver]) warn('disruptions.json: recovery plan for ' + k + ' uses driver "' + p.driver + '" who is not in drivers.json');
    });
    (sc.onCall || []).forEach(function (n) { if (!D[n]) warn('scenario.json: onCall driver "' + n + '" is not in drivers.json'); });

    var fin = d.finance || {};
    var custs = {}; explicit.forEach(function (l) { if (l.cust) custs[l.cust] = 1; });
    Object.keys(custs).forEach(function (c) { if (fin.terms && fin.terms[c] == null) warn('finance.json: no payment terms for customer "' + c + '" (used by loads.json)'); });

    var ms = {}; ((d.targets && d.targets.measures) || []).forEach(function (m) { if (ms[m.k]) err('targets.json: duplicate measure "' + m.k + '"'); ms[m.k] = 1; });

    ANCHOR_TRUCKS.forEach(function (id) { if (!T[id]) warn('app code refers to truck ' + id + ', which this scenario does not have (the related demo steps will be empty)'); });
    ANCHOR_LOADS.forEach(function (no) { if (!L[no]) warn('app code refers to load ' + no + ', which this scenario does not have (the related demo steps will be empty)'); });
    return { errors: errors, warnings: warnings };
  }

  /* ------------------------------------------------------------ loading -- */
  function getJSON(url, fetchFn) {
    return fetchFn(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Could not load ' + url + ' (' + r.status + ')');
      return r.text();
    }).then(function (text) {
      try { return { text: text, json: JSON.parse(text) }; }
      catch (e) { throw new Error(url + ' is not valid JSON: ' + e.message); }
    });
  }

  function listScenarios(base, fetchFn) {
    return getJSON((base || 'data/scenarios/') + 'index.json', fetchFn || root.fetch.bind(root)).then(function (r) { return r.json; });
  }

  function loadScenario(id, base, fetchFn) {
    base = base || 'data/scenarios/'; fetchFn = fetchFn || root.fetch.bind(root);
    var dir = base + id + '/';
    return Promise.all(FILES.map(function (f) { return getJSON(dir + f + '.json', fetchFn); })).then(function (parts) {
      var data = {}, all = '';
      FILES.forEach(function (f, i) { data[f] = parts[i].json; all += parts[i].text; });
      // loads.json holds { genericRates, loads }; keep that shape for the app.
      var res = validate(data);
      if (res.errors.length) throw new Error('Scenario "' + id + '" has problems:\n - ' + res.errors.join('\n - '));
      return { id: id, data: data, fingerprint: hash(all), warnings: res.warnings };
    });
  }

  var api = { FILES: FILES, validate: validate, loadScenario: loadScenario, listScenarios: listScenarios, hash: hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MonifiData = api;
})(typeof window !== 'undefined' ? window : globalThis);
