/* Start-up
 *  1. pick a scenario:   ?scenario=<id>  →  last used  →  index.json "default"
 *  2. load + check its JSON files (js/data.js)
 *  3. restore the saved session for that scenario, if any (js/persist.js)
 *  4. mount the Component from js/app.js into #app
 * Deep links: index.html?scenario=tight-cash#page=cc   (page keys: see PAGE_KEYS)
 */
(function () {
  var PAGE_KEYS = ['caps', 'cc', 'kpi', 'map', 'fleet', 'route', 'scen', 'fuel', 'labour', 'dispatch', 'bid', 'tele', 'driver', 'safety', 'reports'];
  var app = document.getElementById('app');

  function fail(err) {
    console.error(err);
    var box = document.createElement('div'); box.className = 'boot-error';
    var b = document.createElement('b'); b.textContent = 'The simulation could not start.';
    var pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; pre.style.margin = '8px 0 0'; pre.textContent = String((err && err.message) || err);
    box.appendChild(b); box.appendChild(pre); app.textContent = ''; app.appendChild(box);
  }

  function hashPage() {
    var m = /(?:^#|&)page=([a-z]+)/.exec(location.hash);
    return m && PAGE_KEYS.indexOf(m[1]) >= 0 ? m[1] : null;
  }

  if (location.protocol === 'file:') {
    app.innerHTML = '<div class="boot-error"><b>Open this through a web server, not by double-clicking the file.</b><br>' +
      'Browsers block file loading from <code>file://</code>. In this folder run <code>python3 -m http.server 8000</code> ' +
      'and open <a href="http://localhost:8000/">http://localhost:8000/</a>. (On GitHub Pages it just works.)</div>';
    return;
  }

  var qs = new URLSearchParams(location.search);

  MonifiData.listScenarios().then(function (index) {
    var ids = index.scenarios.map(function (s) { return s.id; });
    var want = qs.get('scenario') || MonifiPersist.lastScenario();
    var id = ids.indexOf(want) >= 0 ? want : index.default;
    if (want && id !== want) console.warn('[monifi] unknown scenario "' + want + '", using "' + id + '"');

    return MonifiData.loadScenario(id).then(function (loaded) {
      if (loaded.warnings.length) {
        console.groupCollapsed('[monifi] scenario "' + id + '": ' + loaded.warnings.length + ' warning(s)');
        loaded.warnings.forEach(function (w) { console.warn(w); });
        console.groupEnd();
      }

      var store = MonifiPersist.create({ scenarioId: id, fingerprint: loaded.fingerprint });
      var saved = store.load();
      var logicRef = null;

      var env = {
        scenarioId: id,
        scenarios: index.scenarios,
        saveAvailable: store.available,
        pick: function (next) {                       // switching scenario = reload with that scenario's data + its own saved session
          store.flush(logicRef);
          var page = logicRef && logicRef.state.page;
          location.href = location.pathname + '?scenario=' + encodeURIComponent(next) + (page ? '#page=' + page : '');
        },
        forget: function () { store.clear(); }
      };

      return DC.mount({
        root: app, template: 'templates/app.html', component: Component,
        props: { startPage: 'Capabilities', data: loaded.data, env: env },
        beforeMount: function (logic) {
          logicRef = logic;
          if (saved && saved.state) store.restoreInto(logic, saved);
          var start = hashPage();                      // an explicit #page= in the URL wins over the saved page
          if (start) logic.state.page = start;
          if (saved && saved.discarded === 'data') logic.state.toast = 'This scenario’s data files changed since your last visit, so the saved session was cleared.';
          if (saved && saved.discarded === 'version') logic.state.toast = 'The simulation was updated, so the saved session was cleared.';
        }
      }).then(function (rt) {
        window.monifi = rt.logic;                      // console helper: monifi.state, monifi.setState({...})
        var lastPage = null;
        DC.onRender = function (logic) {
          store.touch(logic);                          // autosave
          var p = logic.state.page;                    // keep the URL in step with the page
          if (p && p !== lastPage) { lastPage = p; try { history.replaceState(null, '', location.search + '#page=' + p); } catch (e) {} window.scrollTo(0, 0); }
        };
        window.addEventListener('hashchange', function () { var p = hashPage(); if (p) rt.logic.setState({ page: p, toast: '' }); });
        window.addEventListener('pagehide', function () { store.flush(rt.logic); });
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') store.flush(rt.logic); });
        window.monifiStore = store;
      });
    });
  }).catch(fail);
})();
