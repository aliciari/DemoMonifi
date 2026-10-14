# Monifi — interactive trucking operations simulation

A static, no-build web app: runs on GitHub Pages as-is. **All data is synthetic.**

The simulation is one shared operating model (50 trucks, 57 drivers, 41 loads, disruptions, response options,
revenue / profit / cash, 30-60-90-day targets, human approvals) that feeds 15 pages. Change a target, simulate a
disruption, approve a response — every page recalculates.

## Run it

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/
```

Opening `index.html` by double-click will not work (browsers block `file://` loading). On GitHub Pages it just works.

Deep links: `index.html?scenario=tight-cash#page=cc` opens the Dashboard in the *Tight cash* scenario. Page keys: `caps cc kpi map fleet route scen fuel labour dispatch bid tele driver safety reports`.
In the browser console, `monifi.state` shows the live state and `monifi.setState({...})` changes it.

## Publish on GitHub Pages

1. Push this folder to a GitHub repo (branch `main`).
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) deploys on every push. (Or choose "Deploy from a branch" → `main` / root — `.nojekyll` is already here.)

## Where to change what

| I want to… | Edit |
|---|---|
| Change what a page looks like | `templates/pages/<page>.html` (markup + `{{bindings}}`) |
| Change the sidebar, header, approval bar, toast | `templates/app.html` |
| Change the data: trucks, drivers, loads, response options, disruptions, cash, targets | the JSON files in `data/scenarios/<id>/` (see below). No code. |
| Change the simulation maths: plan, costs, cash, disruptions, response options | `js/app.js` → `pdata()`, `engine()`, `planner()` |
| Change how the 30-60-90 projections are computed | `js/app.js` → `tdata()`, `traj()`, `cashFlow()` (their *inputs* are in `targets.json`) |
| Change what is shown on a page (KPI cards, lists, labels, handlers) | `js/app.js` → `renderVals()` . Everything a template binds to is a key of the object it returns |
| Change the starting state / what Reset restores | `js/app.js` → `fresh()` (if the shape changes, bump `STATE_VERSION` in `js/persist.js`) |
| Change map geography | `js/app.js` → `geo()` (line 53) |
| Colours / fonts | inline `style=` in the templates (navy `#1e3a6e`, blue `#6cb3e3`); `css/base.css` for globals |
| Logo | replace `assets/monifi-logo.svg` (**currently a placeholder** — the original logo file was not in the zip) |

## Scenarios (data lives in JSON)

Each scenario is a folder in `data/scenarios/<id>/`; `data/scenarios/index.json` lists them for the picker in the sidebar
(`?scenario=<id>` also selects one). Two ship with the project: `toronto-baseline` and `tight-cash` (same fleet, slower-paying
customers, less opening cash, which drives a very different cash story).

| File | What it holds |
|---|---|
| `scenario.json` | name, **clock** (start date + opening minute of the day), **economics** (fleet size, km/day, empty share, $/km, base operating margin `mf`), on-call drivers, the "goal levers" |
| `drivers.json` | the 57 drivers: experience, safety score, hard-braking/speeding events, idle %, overtime, HOS hours, training progress, … |
| `trucks.json` | the 50 trucks: type/make/year, status, route or fixed position, load, telemetry (mpg, fuel, oil, DEF, tyres…), fault codes, predicted failures |
| `loads.json` | explicit loads (in transit and planned) plus `genericRates`. Any truck that carries a load but has no entry here gets a load generated automatically |
| `responses.json` | the response options offered for each at-risk load (spare truck, partner, reschedule…): ETA, extra cost, checks, side effects |
| `disruptions.json` | the "Simulate disruption" buttons, spare-truck recovery plans, shop release times |
| `finance.json` | opening cash, customer payment terms, receivables, payables |
| `targets.json` | the 30/60/90-day measures and their default targets, model parameters, and the approvable packages |

**Times** are minutes since midnight of the scenario's first day (`645` = 10:45 AM on day 0, `1440` = next midnight).
Coordinates are `[longitude, latitude]`.

**Make a new scenario:** copy a folder, rename it, edit the JSON, add one line to `index.json`. Then:

```bash
node tests/validate_scenarios.js     # checks every cross-reference (loads → trucks, options → loads, drivers, customers…)
```

The same checks run in the browser every time a scenario loads; problems show up as warnings in the console
(and broken JSON shows a readable error naming the file instead of a blank page).

> **One limit to know about.** The demo's *story* (the guided "Run Demo" steps, explainer text, the approval packages) names
> a few specific trucks and loads directly in `js/app.js` (e.g. TRK012, load 4471). A scenario can change any number
> about them freely, but if it removes those IDs, the validator warns and the related steps will be empty. Making those
> references data-driven is the natural next refactor.

## Saved sessions (localStorage)

Whatever you do in the simulation (approvals, simulated disruptions, edited targets, messages, current page…) is saved in the
browser automatically and restored on reload. Details:

* One saved session **per scenario** (`monifi:session:<id>`); switching scenarios never mixes them. The sidebar says so.
* The demo clock is saved as *time elapsed*, so it resumes where you left off rather than racing ahead while the tab was closed.
* If a scenario's JSON files changed since the session was saved, the old session is **discarded** (with a notice) instead of
  being applied to data it no longer matches. Same if `STATE_VERSION` in `js/persist.js` is bumped. This keeps editing the JSON painless.
* **Reset demo** wipes progress for the current scenario. A `#page=` in the URL beats the saved page.
* If the browser blocks storage (private window, full quota) the app just works without saving, and says so.
* Console helpers: `monifiStore.clear()` forgets the current scenario's session; `localStorage.clear()` forgets everything.

## Template language (tiny)

```html
{{kpi.value}}                                 <!-- text or attribute binding, dotted paths -->
<sc-if value="{{hasDis}}"> … </sc-if>         <!-- show when truthy -->
<sc-for list="{{truckList}}" as="r"> {{r.id}} </sc-for>   <!-- loop; r$index is also available -->
<button onClick="{{r.click}}">                <!-- handler: a function in renderVals() -->
<!--@include pages/foo.html-->                 <!-- include another file -->
```

`js/runtime.js` is the small engine behind this (it replaces the original `support.js`). It re-renders on every
`setState` and once a second for the demo clock, and patches the DOM with [morphdom](https://github.com/patrick-steele-idem/morphdom)
(vendored, MIT) so typing, focus, scroll position and open `<details>` survive updates.

## Differences from the original export

* `support.js` (the host runtime) and the logo image were not in the zip. `js/runtime.js` is a from-scratch replacement and the logo is a placeholder.
* **Downloads** (CSV reports, printable summary) now trigger real browser downloads. Previously they went through the host's download API.
* **"Ask Monifi AI"** used the host's built-in model access, which doesn't exist on a static site. It now shows a polite "not switched on" message. To enable it, set
  `window.MONIFI_CONFIG.askAI = async (prompt) => answerText` in `index.html` and point it at your own backend. (Never put an API key in client-side code.)
* The fleet, loads, response options, disruptions, finance and targets used to be literals inside `js/app.js` (`base()`, `pdata()`, `tdata()`). They now load from `data/scenarios/`. Pseudo-random values (driver stats, truck telemetry) were written out as fixed numbers, and truck cost-per-mile is rounded to 4 decimals. A frozen-clock comparison of all 15 pages and a scripted session showed no visible difference from the earlier build.
* `reference/original-Main.dc.html` is the untouched published file from the zip, for comparison. The zip's `src/` + `assemble.py` build pipeline is not used here: `js/app.js` and `templates/` are the source of truth now.

## Tests

Needs Python + Playwright (`pip install playwright && playwright install chromium`), with the site served on port 8765:

```bash
python3 -m http.server 8765 &
python3 tests/smoke.py        # loads all 15 pages, clicks the nav, reports JS errors
python3 tests/flows.py        # typing/focus across ticks, dropdowns, checkboxes, disruption → approval, downloads, reset
python3 tests/persist.py      # reload restores a session, per-scenario sessions, data-change discard, blocked storage, bad JSON
node tests/validate_scenarios.js   # cross-reference check on every scenario folder (no browser needed)
```
(The Google Fonts request fails in sandboxes with no internet; the app falls back to the system font and that error is ignored by the tests.)

## Ideas for taking it further

* Make the story references data-driven (a `story` section in `scenario.json` naming the hero trucks/loads) so a scenario can drop TRK012 & co.
* Move the map geography (`geo()` in `js/app.js`) to `data/geo/*.json` so scenarios can run in other regions.
* A scenario editor page (forms over these JSON files) and "export my session" / "import session" buttons.
