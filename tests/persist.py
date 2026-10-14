"""Persistence + scenario tests. Usage: python3 tests/persist.py [base_url]  (site must be served)"""
import sys, json, re
from playwright.sync_api import sync_playwright
base = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/')
ok = True
def check(name, cond, extra=''):
    global ok; ok &= bool(cond); print(('PASS ' if cond else 'FAIL ') + name, extra)
def boot(ctx, url):
    pg = ctx.new_page(); pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    pg.goto(url); pg.wait_for_selector('nav[aria-label=Main]', timeout=15000); pg.wait_for_timeout(300); return pg
def elapsed(pg): return pg.evaluate('Date.now() - monifi.state.startMs')
def closing_cash(pg):
    pg.evaluate("monifi.setState({page:'cc'})"); pg.wait_for_timeout(200)
    return pg.evaluate("(document.body.innerText.match(/Closing cash\\s*\\n?\\s*(\\$-?[\\d,]+)/)||[])[1]")

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1440, 'height': 1000})

    # ---- 1. a session survives a reload
    pg = boot(ctx, base)
    pg.get_by_role('button', name='Dashboard').first.click(); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Simulate disruption').click(); pg.locator('button:has-text("Route delay")').first.click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Compare and approve').first.click(); pg.wait_for_timeout(300)
    pg.locator('button:has-text("Approve as")').first.click(); pg.wait_for_timeout(300)
    pg.evaluate("monifi.setState({page:'cc'})"); pg.wait_for_timeout(200)
    pg.locator('input[type=number]').first.fill('93'); pg.wait_for_timeout(200)
    pg.evaluate("monifi.setState({page:'fuel'})"); pg.wait_for_timeout(900)   # autosave debounce
    before = pg.evaluate("JSON.stringify({dis:monifi.state.dis, dec:monifi.state.decisions.length, applied:Object.keys(monifi.state.applied).length, t:monifi.state.targets, page:monifi.state.page, log:monifi.state.log.length})")
    check('state to save is non-trivial', json.loads(before)['dec'] > 0 and json.loads(before)['dis'].get('route'), before[:120])
    stored = pg.evaluate("localStorage.getItem('monifi:session:toronto-baseline')")
    check('session written to localStorage', stored and json.loads(stored)['state']['page'] == 'fuel')
    check('transient keys not stored', all(k not in json.loads(stored)['state'] for k in ['now', 'toast', 'gate', 'startMs']))
    e1 = elapsed(pg); pg.close()
    pg.context  # keep ctx alive (same localStorage)
    import time; time.sleep(3)
    pg = boot(ctx, base)
    after = pg.evaluate("JSON.stringify({dis:monifi.state.dis, dec:monifi.state.decisions.length, applied:Object.keys(monifi.state.applied).length, t:monifi.state.targets, page:monifi.state.page, log:monifi.state.log.length})")
    check('reload restores disruptions, decisions, targets, page', before == after, after[:100])
    e2 = elapsed(pg)
    check('demo clock resumes (does not jump by the 3s away)', 0 <= e2 - e1 < 2500, f'{e1}ms -> {e2}ms')
    pg.evaluate("monifi.setState({page:'cc'})"); pg.wait_for_timeout(200)
    check('edited target visible in UI after reload', pg.locator('input[type=number]').first.input_value() == '93')
    check('no toast about cleared session', 'saved session was cleared' not in pg.evaluate('document.body.innerText'))
    check('save note shown', 'saved in this browser' in pg.evaluate('document.body.innerText'))
    cash_base = closing_cash(pg); pg.close()

    # ---- 2. #page= beats the saved page
    pg = boot(ctx, base + '#page=map'); check('#page= overrides saved page', pg.evaluate('monifi.state.page') == 'map'); pg.close()

    # ---- 3. scenario picker: separate sessions per scenario
    pg = boot(ctx, base)
    sel = pg.locator('select[aria-label="Choose scenario data set"]')
    check('scenario picker lists 2 scenarios', sel.locator('option').count() == 2)
    sel.select_option('tight-cash'); pg.wait_for_url(re.compile('scenario=tight-cash')); pg.wait_for_selector('nav[aria-label=Main]'); pg.wait_for_timeout(400)
    check('switched to tight-cash', 'scenario=tight-cash' in pg.url and pg.evaluate('monifi.props.env.scenarioId') == 'tight-cash')
    check('tight-cash starts clean (baseline session not leaked)', pg.evaluate("Object.keys(monifi.state.dis).length") == 0 and pg.evaluate('monifi.state.decisions.length') == 0)
    cash_tight = closing_cash(pg)
    check('scenario data changes the numbers', cash_tight and cash_tight != cash_base, f'{cash_base} vs {cash_tight}')
    pg.evaluate("monifi.setState({page:'bid'})"); pg.wait_for_timeout(900)
    pg.close()
    pg = boot(ctx, base)   # no ?scenario -> remembers last used
    check('remembers last scenario', pg.evaluate('monifi.props.env.scenarioId') == 'tight-cash' and pg.evaluate('monifi.state.page') == 'bid')
    pg.locator('select[aria-label="Choose scenario data set"]').select_option('toronto-baseline'); pg.wait_for_url(re.compile('scenario=toronto-baseline')); pg.wait_for_selector('nav[aria-label=Main]'); pg.wait_for_timeout(400)
    check('baseline session still intact after switching back (and you stay on the same page)', pg.evaluate('monifi.state.decisions.length') > 0 and pg.evaluate("monifi.state.page") == 'bid')
    pg.close()

    # ---- 4. Reset demo clears the saved progress
    pg = boot(ctx, base + '?scenario=toronto-baseline')
    pg.get_by_role('button', name='Reset demo').click(); pg.wait_for_timeout(900); pg.close()
    pg = boot(ctx, base + '?scenario=toronto-baseline')
    check('reset then reload = fresh', pg.evaluate('monifi.state.decisions.length') == 0 and pg.evaluate('Object.keys(monifi.state.dis).length') == 0); pg.close()

    # ---- 5. editing the scenario data invalidates the saved session (instead of loading it against changed data)
    pg = boot(ctx, base + '?scenario=toronto-baseline')
    pg.evaluate("monifi.setState({page:'kpi', teleId:'TRK003'})"); pg.wait_for_timeout(900); pg.close()
    pg = ctx.new_page()
    def tweak(route):
        r = route.fetch(); d = json.loads(r.text()); d['opening'] = 610000; route.fulfill(response=r, body=json.dumps(d))
    pg.route('**/toronto-baseline/finance.json', tweak)
    pg.goto(base + '?scenario=toronto-baseline'); pg.wait_for_selector('nav[aria-label=Main]'); pg.wait_for_timeout(400)
    check('changed data discards old session', pg.evaluate('monifi.state.teleId') != 'TRK003' and 'saved session was cleared' in pg.evaluate('document.body.innerText'))
    pg.close()

    # ---- 6. corrupted saved value is ignored
    pg = ctx.new_page(); pg.goto(base); pg.evaluate("localStorage.setItem('monifi:session:toronto-baseline','{not json')"); pg.close()
    pg = boot(ctx, base + '?scenario=toronto-baseline'); check('corrupt save ignored, app still starts', pg.evaluate('monifi.state.decisions.length') == 0 and not pg.errors); pg.close()

    # ---- 7. bad scenario data: broken JSON shows a readable error; dangling references only warn
    pg = ctx.new_page(); pg.route('**/toronto-baseline/trucks.json', lambda r: r.fulfill(status=200, body='[{"id": "TRK001",'))
    pg.goto(base + '?scenario=toronto-baseline'); pg.wait_for_selector('.boot-error'); txt = pg.inner_text('.boot-error')
    check('broken JSON -> readable error naming the file', 'trucks.json' in txt and 'not valid JSON' in txt, txt[:90].replace('\n', ' ')); pg.close()
    pg = ctx.new_page(); warns = []; pg.on('console', lambda m: warns.append(m.text) if m.type == 'warning' else None)
    def bad_ref(route):
        r = route.fetch(); d = json.loads(r.text()); d['loads'][0]['truck'] = 'TRK999'; route.fulfill(response=r, body=json.dumps(d))
    pg.route('**/toronto-baseline/loads.json', bad_ref)
    pg.goto(base + '?scenario=toronto-baseline'); pg.wait_for_selector('nav[aria-label=Main]'); pg.wait_for_timeout(300)
    check('dangling reference -> console warning, app still runs', any('TRK999' in w for w in warns), str(warns)[:120]); pg.close()

    # ---- 8. storage blocked (private mode style): app works, note says so
    ctx2 = b.new_context(); ctx2.add_init_script("Storage.prototype.setItem = function(){ throw new Error('blocked'); }")
    pg = boot(ctx2, base); pg.get_by_role('button', name='Dashboard').first.click(); pg.wait_for_timeout(600)
    check('storage blocked: app runs, no errors', not pg.errors and pg.evaluate('monifi.state.page') == 'cc')
    check('storage blocked: user is told', 'Saving is unavailable' in pg.evaluate('document.body.innerText')); pg.close()
    b.close()
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
