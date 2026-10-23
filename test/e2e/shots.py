import sys; sys.path.insert(0,'.')
from harness import *
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br = p.chromium.launch()
    pg = open_page(br, {'status':'empty'}); pg.locator('.note-card').first.click(); pg.wait_for_selector('.free-item')
    pg.click('#insertDraw'); pg.wait_for_selector('#drawModal:not(.hidden)')
    cb = box(pg,'#canvas'); pg.mouse.move(cb['x']+200,cb['y']+150); pg.mouse.down(); pg.mouse.move(cb['x']+700,cb['y']+400,steps=10); pg.mouse.up(); pg.click('#saveDraw')
    pg.click('#insertImage'); pg.click('#insertTable')
    pg.locator('.free-item .codearea').first.click()
    pg.locator('.docscroll').evaluate("e=>e.scrollTop=330")
    pg.screenshot(path='/home/claude/shot_code_selected.png')
    pg.locator('.docscroll').evaluate("e=>e.scrollTop=700")
    pg.screenshot(path='/home/claude/shot_lower.png')
    pg.click('#fullscreenBtn'); pg.locator('.docscroll').evaluate("e=>e.scrollTop=0")
    pg.screenshot(path='/home/claude/shot_fullscreen.png')
    br.close()
