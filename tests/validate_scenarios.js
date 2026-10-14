#!/usr/bin/env node
// Checks every scenario folder listed in data/scenarios/index.json. Usage: node tests/validate_scenarios.js
const fs = require('fs'), path = require('path');
const { FILES, validate } = require('../js/data.js');
const root = path.join(__dirname, '..', 'data', 'scenarios');
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
let bad = 0;
index.scenarios.forEach((s) => {
  const dir = path.join(root, s.id), d = {};
  try { FILES.forEach((f) => { d[f] = JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8')); }); }
  catch (e) { console.log('FAIL ' + s.id + ': ' + e.message); bad++; return; }
  const r = validate(d);
  console.log((r.errors.length ? 'FAIL ' : 'ok   ') + s.id + '  (' + r.errors.length + ' errors, ' + r.warnings.length + ' warnings)');
  r.errors.forEach((m) => console.log('   error: ' + m)); r.warnings.forEach((m) => console.log('   warn:  ' + m));
  if (r.errors.length) bad++;
});
if (index.scenarios.every((s) => s.id !== index.default)) { console.log('FAIL index.json: default "' + index.default + '" is not listed'); bad++; }
process.exit(bad ? 1 : 0);
