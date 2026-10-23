import sys; sys.path.insert(0,'.')
from harness import *
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br = p.chromium.launch()
    pg = open_page(br, {'status':'empty'})
    print('notes in list:', pg.locator('.note-card').count())
    pg.locator('.note-card').first.click()
    pg.wait_for_selector('.free-item')
    print('items:', pg.locator('.free-item').count(), 'errors:', pg.__errors)
    print('rz visible (none selected):', pg.locator('.rz').first.is_visible(), ' bar visible:', pg.locator('.item-bar').first.is_visible())
    pg.screenshot(path='/home/claude/smoke1.png')
    br.close()
