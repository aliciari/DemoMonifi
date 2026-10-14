/*
 * Session persistence (localStorage)
 * ---------------------------------------------------------------------------
 * Saves what the user has done in the simulation (approvals, edited targets,
 * simulated disruptions, messages, current page, ...) so a reload picks up
 * where they left off.
 *
 *  - One saved session per scenario:  localStorage["monifi:session:<scenarioId>"]
 *  - The demo clock is saved as "time elapsed", so it resumes where it stopped
 *    instead of racing ahead while the tab was closed.
 *  - If the scenario's JSON files changed since the session was saved (their
 *    fingerprint differs) or STATE_VERSION was bumped, the old session is
 *    discarded rather than loaded against data it no longer matches.
 *  - Everything is wrapped in try/catch: private windows, blocked storage and a
 *    full quota just mean "not saved", never an error.
 *
 * Bump STATE_VERSION whenever the shape of the state in app.js -> fresh() changes
 * in a way old saves can't cope with.
 */
(function (global) {
  'use strict';

  var STATE_VERSION = 1;
  var PREFIX = 'monifi:session:';
  var LAST_KEY = 'monifi:lastScenario';

  // State that should NOT survive a reload: derived clock value, transient UI, in-flight prompts.
  var TRANSIENT = ['now', 'startMs', 'toast', 'aiAns', 'dl', 'gate', 'pend', 'cmp', 'q', 'autoPend'];

  function storage() {
    try { var s = global.localStorage; var k = '__monifi_probe__'; s.setItem(k, '1'); s.removeItem(k); return s; }
    catch (e) { return null; }
  }

  function create(opts) {
    var ls = storage();
    var key = PREFIX + opts.scenarioId;
    var lastJSON = null, timer = null;

    function snapshot(state) {
      var out = {};
      Object.keys(state).forEach(function (k) { if (TRANSIENT.indexOf(k) < 0) out[k] = state[k]; });
      return out;
    }

    var api = {
      available: !!ls,

      // Returns { state, elapsedMs } | { discarded: 'data' | 'version' } | null
      load: function () {
        if (!ls) return null;
        try {
          var raw = ls.getItem(key); if (!raw) return null;
          var rec = JSON.parse(raw);
          if (!rec || rec.v !== STATE_VERSION) { ls.removeItem(key); return { discarded: 'version' }; }
          if (rec.fp !== opts.fingerprint) { ls.removeItem(key); return { discarded: 'data' }; }
          return { state: rec.state || {}, elapsedMs: Math.max(0, +rec.elapsedMs || 0) };
        } catch (e) { try { ls.removeItem(key); } catch (e2) {} return null; }
      },

      // Write now (always refreshes the elapsed clock).
      save: function (logic) {
        if (!ls || !logic) return false;
        try {
          var st = logic.state;
          var rec = { v: STATE_VERSION, scenario: opts.scenarioId, fp: opts.fingerprint, savedAt: new Date().toISOString(),
            elapsedMs: Math.max(0, Date.now() - (st.startMs || Date.now())), state: snapshot(st) };
          ls.setItem(key, JSON.stringify(rec));
          ls.setItem(LAST_KEY, opts.scenarioId);
          return true;
        } catch (e) { return false; }   // quota exceeded / blocked
      },

      // Call after every render: saves shortly after something other than the clock changed.
      touch: function (logic) {
        if (!ls) return;
        var json; try { json = JSON.stringify(snapshot(logic.state)); } catch (e) { return; }
        if (json === lastJSON) return;
        lastJSON = json;
        clearTimeout(timer);
        timer = setTimeout(function () { api.save(logic); }, 400);
      },

      flush: function (logic) { clearTimeout(timer); if (ls && logic) api.save(logic); },

      clear: function () { try { if (ls) ls.removeItem(key); } catch (e) {} },

      // Apply a loaded session onto a freshly built Component (before first render).
      restoreInto: function (logic, loaded) {
        if (!loaded || !loaded.state) return false;
        var known = Object.assign({ page: null, collapsed: false }, logic.fresh()), st = loaded.state, patch = {};
        Object.keys(st).forEach(function (k) { if (k in known && TRANSIENT.indexOf(k) < 0) patch[k] = st[k]; });   // ignore keys the app no longer has
        patch.startMs = Date.now() - loaded.elapsedMs;                                                           // resume the demo clock
        patch.now = new Date();
        logic.state = Object.assign({}, logic.state, patch);
        lastJSON = JSON.stringify(snapshot(logic.state));
        return true;
      }
    };
    return api;
  }

  function lastScenario() { var ls = storage(); try { return ls ? ls.getItem(LAST_KEY) : null; } catch (e) { return null; } }

  global.MonifiPersist = { create: create, lastScenario: lastScenario, STATE_VERSION: STATE_VERSION };
})(window);
