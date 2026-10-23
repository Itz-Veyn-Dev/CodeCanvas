"""Shared helpers for the browser-level (Chromium via Playwright) renderer tests.
The Electron main process is NOT started: window.codeCanvas is replaced by an
in-memory mock that behaves like preload.js/main.js (load/save/flush-on-close)."""
import json, pathlib
INDEX = (pathlib.Path(__file__).resolve().parents[2] / 'src' / 'index.html').as_uri()

MOCK = """
(() => {
  const init = %s;           // what notes:load returns
  window.__saves = [];       // every payload passed to save()
  window.__failSave = false;
  window.__closeReady = 0;
  let beforeClose = null;
  window.codeCanvas = {
    load: async () => init,
    save: async d => { if (window.__failSave) throw new Error('disk full'); window.__saves.push(JSON.parse(JSON.stringify(d))); return true; },
    exportBackup: async () => true, importBackup: async () => null,
    onBeforeClose: cb => { beforeClose = cb; },
    closeReady: () => { window.__closeReady++; }
  };
  window.__triggerClose = () => beforeClose && beforeClose();
})();
"""

def open_page(browser, load_result, viewport=(1480, 900)):
    ctx = browser.new_context(viewport={'width': viewport[0], 'height': viewport[1]})
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append('console.error: ' + m.text) if m.type == 'error' else None)
    page.add_init_script(MOCK % json.dumps(load_result))
    page.goto(INDEX)
    page.wait_for_selector('#noteList')
    page.__errors = errors
    return page

def last_saved(page):
    return page.evaluate('window.__saves.length ? window.__saves[window.__saves.length-1] : null')

def box(page, sel):
    b = page.locator(sel).first.bounding_box()
    assert b, 'no box for ' + sel
    return b
