# Monifi trucking demo — complete source

All data is synthetic.

## Where to look
- `published/Main.dc.html` — the whole running demo in one file: page markup at the top, all logic in the `<script>` block (`class Component`). This is exactly what is published.
- `src/` — the pieces the published file is built from:
  - `eng.js` — the shared operating model: loads, trucks, disruptions, response options, revenue, profit and cash, and approvals.
  - `tg.js` — the 30/60/90-day targets, predictions, target scenarios and the 90-day cash schedule.
  - `vm.js` — what each page shows: KPI cards, goals, priority actions, scenario chooser, insights, search, and reports and CSVs.
  - `dash.html`, `scen.html`, `rep.html` — markup for the Dashboard, Scenario Planning and Reports pages.
  - `assemble.py` — builds `published/Main.dc.html` from `base/Main.v14.bak.html` plus the files above. The steps at the end add the menu order, search, the user button and the human-approval bar.
- `backup-v19/` — the unchanged version from before the 30/60/90-day targets were added.
- `tests/` — logic checks (`verify.js`, `verify_t.js`, `gate_t.js` for approvals) and browser tests (`ui*.js`). Results are in `tests/results/`.

## Rebuild and test
```
python3 src/assemble.py      # paths inside the script point at the working folder; adjust D at the top
python3 tests/run.py         # writes check.js from the built page
sh tests/mk.sh tests/verify.js
```
