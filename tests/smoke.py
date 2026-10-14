"""Smoke test: loads every page, clicks around, reports console errors. Usage: python3 tests/smoke.py [base_url]"""
import sys, json
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
shots = sys.argv[2] if len(sys.argv) > 2 else None
PAGES = ['caps','cc','kpi','map','fleet','route','scen','fuel','labour','dispatch','bid','tele','driver','safety','reports']
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1440, 'height': 1000})
    pg.on('console', lambda m: errs.append(('console', m.text)) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(('pageerror', str(e))))
    pg.goto(base); pg.wait_for_selector('nav[aria-label=Main]', timeout=15000)
    print('loaded; render ms:', pg.evaluate('monifi._rt.lastMs'))
    for k in PAGES:
        pg.evaluate(f"monifi.setState({{page:'{k}'}})"); pg.wait_for_timeout(200)
        n = pg.evaluate("document.querySelectorAll('#app *').length"); h = pg.evaluate("document.querySelector('main')?.innerText.length")
        print(f'{k:9s} elements={n:5d} textlen={h}')
        if shots: pg.screenshot(path=f'{shots}/{k}.png', full_page=False)
    # real clicks through the nav
    for label in ['Dashboard','Scenario Planning','Reports','Capabilities']:
        pg.get_by_role('button', name=label, exact=False).first.click(); pg.wait_for_timeout(150)
    print('final page:', pg.evaluate('monifi.state.page'))
    b.close()
print('ERRORS:', json.dumps(errs, indent=1) if errs else 'none')
