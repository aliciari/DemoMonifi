"""Interaction test: input focus survives the 1-second clock tick, details stay open, select/number inputs, disruption + approval flow, reset."""
import sys
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
errs = []; ok = True
def check(name, cond, extra=''):
    global ok; ok &= bool(cond); print(('PASS ' if cond else 'FAIL ') + name, extra)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1440, 'height': 1000})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    pg.goto(base); pg.wait_for_selector('nav[aria-label=Main]')
    pg.get_by_role('button', name='Dashboard').first.click(); pg.wait_for_timeout(300)

    # 1. typing in search keeps focus + value across ticks
    s = pg.locator('input[type=search]').first; s.click(); s.type('TRK0', delay=30)
    pg.wait_for_timeout(2300)
    check('search keeps focus and text over clock ticks', pg.evaluate("document.activeElement.type==='search'") and s.input_value() == 'TRK0', s.input_value())
    check('search state updated', pg.evaluate("monifi.state.q") == 'TRK0')
    s.fill(''); pg.keyboard.press('Escape')

    # 2. <details> stays open across ticks
    d = pg.locator('details').first; d.locator('summary').click()
    pg.wait_for_timeout(2200)
    check('details stays open', d.evaluate('e=>e.open'))

    # 3. select horizon
    sel = pg.locator('main select').first; sel.select_option('14'); pg.wait_for_timeout(200)
    check('horizon select changed state', pg.evaluate('monifi.state.horizon') == 14, str(pg.evaluate('monifi.state.horizon')))

    # 4. target number input
    n = pg.locator('input[type=number]').first; before = n.input_value(); n.fill('93'); pg.wait_for_timeout(200)
    check('number target edit reaches state', pg.evaluate('JSON.stringify(monifi.state.targets)') != '{}', pg.evaluate('JSON.stringify(monifi.state.targets)')[:80])

    # 6. checkbox toggle (prio) on the dispatch / scen pages
    pg.evaluate("monifi.setState({page:'scen'})"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelectorAll('main details').forEach(d=>d.open=true)"); pg.wait_for_timeout(100)  # priorities live inside a collapsed <details>
    boxes = pg.locator('main input[type=checkbox]:visible')
    check('priority checkboxes present', boxes.count() == 4, str(boxes.count()))
    if boxes.count():
        was = pg.evaluate('JSON.stringify(monifi.state.prio)'); boxes.first.click(); pg.wait_for_timeout(200)
        check('checkbox toggles priority', pg.evaluate('JSON.stringify(monifi.state.prio)') != was)

    pg.evaluate("monifi.setState({page:'cc'})"); pg.wait_for_timeout(200)

    # 5. simulate disruption -> compare -> human approval gate -> decision recorded
    pg.get_by_role('button', name='Simulate disruption').click(); pg.wait_for_timeout(300)
    pg.locator('button:has-text("Truck unavailable")').first.click(); pg.wait_for_timeout(400)
    check('disruption simulated', pg.evaluate("monifi.state.dis.truck") is True)
    pg.get_by_role('button', name='Compare and approve').first.click(); pg.wait_for_timeout(400)
    gate = pg.locator('button:has-text("Approve as")')
    check('approval bar appears (human-in-the-loop)', gate.count() == 1)
    dec0 = len(pg.evaluate('monifi.state.decisions || []'))
    gate.first.click(); pg.wait_for_timeout(500)
    check('approving records a decision', len(pg.evaluate('monifi.state.decisions || []')) > dec0 or len(pg.evaluate('monifi.state.log')) > 0)

    # 5b. guided demo
    pg.get_by_role('button', name='Run Demo').click(); pg.wait_for_timeout(300)
    check('guided demo starts', pg.evaluate('monifi.state.demo') == 1)

    # 7. dispatch textarea typing
    pg.evaluate("monifi.setState({page:'dispatch'})"); pg.wait_for_timeout(300)
    t = pg.locator('textarea').first; t.click(); t.type('Hello team', delay=20); pg.wait_for_timeout(2200)
    check('textarea keeps text across ticks', t.input_value() == 'Hello team' and pg.evaluate("monifi.state.msg") == 'Hello team')

    # 8. report CSV download
    pg.evaluate("monifi.setState({page:'reports'})"); pg.wait_for_timeout(300)
    with pg.expect_download(timeout=5000) as dl:
        pg.get_by_role('button', name='Run now').first.click() if pg.get_by_role('button', name='Run now').count() else pg.locator('button:has-text("CSV")').first.click()
    check('report download works', dl.value.suggested_filename.endswith(('.csv', '.html')), dl.value.suggested_filename)

    # 9. reset demo
    pg.get_by_role('button', name='Reset demo').click(); pg.wait_for_timeout(300)
    check('reset clears log', len(pg.evaluate('monifi.state.log')) == 0)

    # 10. tick cost
    check('render under 150ms', pg.evaluate('monifi._rt.lastMs') < 150, f"{pg.evaluate('monifi._rt.lastMs'):.0f}ms")
    b.close()
print('page errors:', errs or 'none'); sys.exit(0 if ok and not errs else 1)
