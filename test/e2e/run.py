"""Browser-level tests of the renderer (Chromium via Playwright, mocked Electron IPC).
Run:  python3 test/e2e/run.py      (needs: pip install playwright && playwright install chromium)"""
import sys, json, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from harness import *
from playwright.sync_api import sync_playwright

PASS, FAIL = [], []
DLG = {'accept': True}
def check(name, cond, detail=''):
    (PASS if cond else FAIL).append(name)
    print(('PASS  ' if cond else 'FAIL  ') + name + ((' -- ' + str(detail)) if (detail and not cond) else ''))

def attach_dialogs(pg):
    pg.on('dialog', lambda d: d.accept() if DLG['accept'] else d.dismiss())

def new_note(pg, title='T'):
    pg.click('#newNote'); pg.fill('#noteTitleInput', title); pg.click('#createNoteSubmit')
    pg.wait_for_selector('.free-item')

def item(pg, i): return pg.locator('.free-item').nth(i)
def geom(pg, bid):
    n = pg.evaluate("S.notes.find(n=>n.id===S.active)")
    return next(b for b in n['blocks'] if b['id'] == bid)
def drag(pg, frm, to, steps=8):
    pg.mouse.move(*frm); pg.mouse.down(); pg.mouse.move(*to, steps=steps); pg.mouse.up()
def handle_center(pg, bid, d):
    b = pg.locator(f'.free-item[data-block-id="{bid}"] .rz-{d}').bounding_box()
    return (b['x'] + b['width']/2, b['y'] + b['height']/2)
def reveal(pg, bid):
    pg.evaluate("id=>{select(id);const e=document.querySelector(`.free-item[data-block-id=\"${id}\"]`);const sc=document.querySelector('.docscroll');const r=e.getBoundingClientRect(),s=sc.getBoundingClientRect();sc.scrollTop+= (r.top-s.top)-120; sc.scrollLeft+=Math.max(0,(r.left-s.left)-80)}", bid)
    pg.wait_for_timeout(30)
def ids(pg): return pg.evaluate("S.notes.find(n=>n.id===S.active).blocks.map(b=>b.id)")

with sync_playwright() as p:
    br = p.chromium.launch()

    # ---------------------------------------------------------------- 1. boot / first run
    pg = open_page(br, {'status': 'empty'})
    check('first run seeds sample notes', pg.locator('.note-card').count() == 3)
    pg.close()

    # ---------------------------------------------------------------- 2. create note with every element type
    pg = open_page(br, {'status': 'empty'}); attach_dialogs(pg)
    new_note(pg, 'Everything')
    for sel in ['#insertCode', '#insertDraw']:
        pg.click(sel)
        if sel == '#insertDraw':
            pg.wait_for_selector('#drawModal:not(.hidden)')
            cb = box(pg, '#canvas'); drag(pg, (cb['x']+100, cb['y']+100), (cb['x']+400, cb['y']+300)); pg.click('#saveDraw')
    for sel in ['#insertTip', '#insertDivider', '#insertImage', '#insertTable']: pg.click(sel)
    types = pg.evaluate("S.notes.find(n=>n.id===S.active).blocks.map(b=>b.type)")
    check('all 7 element types can be inserted', types == ['text','code','drawing','tip','divider','image','table'], types)
    check('no page errors during setup', not [e for e in pg.__errors if 'ERR_FILE_NOT_FOUND' not in e], pg.__errors)

    # ---------------------------------------------------------------- 3. selection model
    pg.click('#blocks', position={'x': 5, 'y': 5})
    check('click empty canvas deselects everything', pg.locator('.free-item.selected').count() == 0)
    check('no handles/bars visible when nothing selected', pg.locator('.rz:visible').count() == 0 and pg.locator('.item-bar:visible').count() == 0)
    bids = ids(pg)
    pg.locator(f'.free-item[data-block-id="{bids[0]}"] .blockcontent').click()
    check('clicking an element selects it (one only)', pg.locator('.free-item.selected').count() == 1)
    check('selected element shows 8 resize handles + bar', pg.locator('.free-item.selected .rz:visible').count() == 8 and pg.locator('.free-item.selected .item-bar:visible').count() == 1)
    pg.locator(f'.free-item[data-block-id="{bids[1]}"] .codearea').click()
    check('selecting another element moves selection (still one)', pg.locator('.free-item.selected').count() == 1 and pg.locator('.free-item.selected').get_attribute('data-block-id') == bids[1])
    # clicking a toolbar button keeps selection
    pg.click('#boldText')
    check('format toolbar click does not deselect', pg.locator('.free-item.selected').count() == 1)
    pg.click('.docscroll', position={'x': 3, 'y': 300})
    check('click on scroll-area background deselects', pg.locator('.free-item.selected').count() == 0)

    # ---------------------------------------------------------------- 4. resize every element type
    MINS = {'text':(120,56),'code':(260,140),'drawing':(220,140),'tip':(140,64),'divider':(60,16),'image':(80,60),'table':(220,90)}
    n = pg.evaluate("S.notes.find(n=>n.id===S.active).blocks.map(b=>({id:b.id,type:b.type}))")
    for b in n:
        bid, t = b['id'], b['type']
        el = pg.locator(f'.free-item[data-block-id="{bid}"]')
        el.scroll_into_view_if_needed()
        # select via its body edge (divider/image bodies have no text to click)
        reveal(pg, bid)
        before = geom(pg, bid)
        sx, sy = handle_center(pg, bid, 'se'); drag(pg, (sx, sy), (sx + 90, sy + 60))
        after = geom(pg, bid)
        if t == 'image':
            r0, r1 = before['w']/before['h'], after['w']/after['h']
            check(f'resize se grows {t} and keeps aspect ratio', after['w'] > before['w'] and abs(r0-r1) < 0.05, (before, after))
        else:
            check(f'resize se grows {t} (+90,+60)', after['w'] == before['w']+90 and after['h'] == before['h']+60, (before, after))
        # DOM matches model
        bb = el.bounding_box()
        check(f'{t}: DOM size equals stored size', abs(bb['width']-after['w']) < 1.5 and abs(bb['height']-after['h']) < 1.5, (bb, after))
        # shrink far below minimum from nw: must clamp, opposite corner stays anchored
        a = geom(pg, bid); right, bottom = a['x']+a['w'], a['y']+a['h']
        sx, sy = handle_center(pg, bid, 'nw'); drag(pg, (sx, sy), (sx + 2000, sy + 2000))
        c = geom(pg, bid); mw, mh = MINS[t]
        check(f'{t}: shrink clamps to min {mw}x{mh}', c['w'] >= mw and c['h'] >= mh and c['w'] <= mw+1 and c['h'] <= mh+1 or (t=='image' and c['w']>=mw and c['h']>=mh), c)
        check(f'{t}: anchor edge fixed while shrinking', c['x']+c['w'] == right and c['y']+c['h'] == bottom, (c, right, bottom))
        # restore a usable size for later tests
        sx, sy = handle_center(pg, bid, 'se'); drag(pg, (sx, sy), (sx + 260, sy + 140))
    # edge handles
    bid = bids[0]; reveal(pg, bid)
    g0 = geom(pg, bid); x, y = handle_center(pg, bid, 'e'); drag(pg, (x, y), (x + 50, y))
    g1 = geom(pg, bid); check('east edge handle changes width only', g1['w'] == g0['w']+50 and g1['h'] == g0['h'] and g1['x'] == g0['x'])
    x, y = handle_center(pg, bid, 'n'); drag(pg, (x, y), (x, y - 20)); g2 = geom(pg, bid)
    check('north edge handle changes height + y', g2['h'] == g1['h']+20 and g2['y'] == g1['y']-20 and g2['w'] == g1['w'])
    # resizing must not move unrelated elements
    before_all = {b: (geom(pg, b)['x'], geom(pg, b)['y']) for b in bids[1:]}
    x, y = handle_center(pg, bid, 'se'); drag(pg, (x, y), (x + 40, y + 40))
    check('resizing one element does not move others', all((geom(pg, b)['x'], geom(pg, b)['y']) == v for b, v in before_all.items()))
    # size indicator appears during resize
    x, y = handle_center(pg, bid, 'se'); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x+30, y+30, steps=4)
    tip_vis = pg.locator('.size-tip').is_visible(); tip_txt = pg.locator('.size-tip').inner_text(); pg.mouse.up()
    check('size indicator shown while resizing (w × h px)', tip_vis and ' × ' in tip_txt and tip_txt.endswith('px'), tip_txt)
    check('size indicator hidden after resize', not pg.locator('.size-tip').is_visible())
    # resize interaction not stuck when pointer released far outside
    x, y = handle_center(pg, bid, 'se'); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x+10, y+10); pg.mouse.move(1400, 880, steps=3); pg.mouse.up(); pg.mouse.move(600, 500)
    g = geom(pg, bid); pg.mouse.move(700, 600)
    check('interaction ends on pointerup outside window area (not stuck)', geom(pg, bid) == g and not pg.evaluate("document.body.classList.contains('cc-interacting')"))

    # ---------------------------------------------------------------- 5. moving only via grip
    reveal(pg, bids[1]); g0 = geom(pg, bids[1])
    gb = pg.locator(f'.free-item[data-block-id="{bids[1]}"] .item-grip').bounding_box()
    drag(pg, (gb['x']+15, gb['y']+8), (gb['x']+15+70, gb['y']+8+40))
    g1 = geom(pg, bids[1]); check('grip drag moves element by delta', g1['x'] == g0['x']+70 and g1['y'] == g0['y']+40, (g0, g1))
    check('moving keeps size', g1['w'] == g0['w'] and g1['h'] == g0['h'])
    ta = pg.locator(f'.free-item[data-block-id="{bids[1]}"] .codearea'); tb = ta.bounding_box()
    pg.fill(f'.free-item[data-block-id="{bids[1]}"] .codearea', 'line one\nline two\nline three')
    g0 = geom(pg, bids[1]); drag(pg, (tb['x']+30, tb['y']+15), (tb['x']+200, tb['y']+40))
    check('dragging inside code editor selects text, does not move element', (geom(pg, bids[1])['x'], geom(pg, bids[1])['y']) == (g0['x'], g0['y']))
    sel_len = pg.evaluate("(()=>{const t=document.querySelector('.codearea');return t.selectionEnd-t.selectionStart})()")
    check('text selection by mouse drag works in code editor', sel_len > 0, sel_len)
    # x/y never negative
    reveal(pg, bids[1]); gb = pg.locator(f'.free-item[data-block-id="{bids[1]}"] .item-grip').bounding_box()
    drag(pg, (gb['x']+15, gb['y']+8), (gb['x']-2000, gb['y']-2000))
    g = geom(pg, bids[1]); check('element cannot be dragged to negative coordinates', g['x'] == 0 and g['y'] == 0, g)
    # put it back somewhere reasonable
    reveal(pg, bids[1]); gb = pg.locator(f'.free-item[data-block-id="{bids[1]}"] .item-grip').bounding_box()
    drag(pg, (gb['x']+15, gb['y']+8), (gb['x']+15+60, gb['y']+8+300))

    # ---------------------------------------------------------------- 6. code editor typing
    cid = bids[1]; sel = f'.free-item[data-block-id="{cid}"] .codearea'
    pg.fill(sel, ''); pg.click(sel); pg.keyboard.type('function f() {')
    pg.keyboard.press('Enter'); pg.keyboard.press('Tab'); pg.keyboard.type('return 1;'); pg.keyboard.press('Enter'); pg.keyboard.press('Backspace'); pg.keyboard.press('Backspace'); pg.keyboard.type('}')
    val = pg.input_value(sel)
    check('typing, Enter (auto-indent), Tab and Backspace work', val == 'function f() {\n  return 1;\n}', repr(val))
    check('Tab keeps focus inside editor', pg.evaluate("document.activeElement.classList.contains('codearea')"))
    pg.keyboard.press('Control+A'); pg.keyboard.press('Control+C'); pg.keyboard.press('End'); pg.keyboard.press('Control+End'); pg.keyboard.press('Enter'); pg.keyboard.press('Control+V')
    val2 = pg.input_value(sel); check('select-all, copy, paste work', val2.count('function f()') == 2, repr(val2))
    pg.keyboard.press('Control+Z'); check('undo works after paste', pg.input_value(sel).count('function f()') == 1)
    pg.fill(sel, 'a\nb\nc'); pg.keyboard.press('Control+A'); pg.keyboard.press('Tab')
    check('Tab on multi-line selection indents every line', pg.input_value(sel) == '  a\n  b\n  c', repr(pg.input_value(sel)))
    pg.keyboard.press('Shift+Tab'); check('Shift+Tab outdents', pg.input_value(sel) == 'a\nb\nc')
    pg.keyboard.press('Control+X'); check('cut works', pg.input_value(sel) == '')
    pg.keyboard.type('x = 1'); pg.keyboard.press('Home'); pg.keyboard.press('ArrowRight'); pg.keyboard.type('Y')
    check('keyboard navigation (Home/arrows) works', pg.input_value(sel) == 'xY = 1')
    # many lines: scrolling + line numbers
    pg.fill(sel, '\n'.join(f'line {i}' for i in range(60)))
    pg.locator(sel).evaluate("t=>{t.scrollTop=200;t.dispatchEvent(new Event('scroll'))}")
    gs = pg.locator(f'.free-item[data-block-id="{cid}"] .line-numbers').evaluate("g=>g.scrollTop")
    check('code editor scrolls and gutter follows', gs > 100, gs)
    check('line counter updates', '60 lines' in pg.locator(f'.free-item[data-block-id="{cid}"] .codefoot').inner_text())
    # typing after resizing
    sx, sy = handle_center(pg, cid, 'se'); drag(pg, (sx, sy), (sx - 120, sy - 40)); pg.fill(sel, ''); pg.click(sel); pg.keyboard.type('after resize')
    check('typing still works after resizing code block', pg.input_value(sel) == 'after resize')
    check('code textarea fills resized element', abs(pg.locator(sel).bounding_box()['width'] - (geom(pg, cid)['w'] - 42)) < 60)
    # Persian typing (IME-free insertText)
    pg.fill(sel, ''); pg.click(sel); pg.keyboard.insert_text('سلام دنیا'); check('Persian text can be entered', pg.input_value(sel) == 'سلام دنیا')
    pg.fill(sel, 'const final = 42;\nreturn final;')

    # ---------------------------------------------------------------- 7. text element
    tid = bids[0]; tsel = f'.free-item[data-block-id="{tid}"] .blockcontent'
    pg.click(tsel); pg.keyboard.press('Control+A'); pg.keyboard.type('Hello'); pg.keyboard.press('Enter'); pg.keyboard.type('World')
    check('text typing + Enter produces 2 lines in model', geom(pg, tid)['content'].replace('\r','').strip('\n').split('\n')[:2] == ['Hello','World'], repr(geom(pg, tid)['content']))
    pg.fill('#fontSize', '') if False else pg.select_option('#fontSize', '22')
    check('font size applies to selected text element only', geom(pg, tid)['fontSize'] == 22 and geom(pg, cid).get('fontSize') in (14, None))
    pg.click(tsel); pg.keyboard.press('Control+A'); pg.keyboard.press('Delete')
    check('text placeholder returns when emptied', pg.evaluate("(s=>document.querySelector(s).childNodes.length)", tsel) == 0)
    pg.keyboard.insert_text('Persisted text پایدار')

    # ---------------------------------------------------------------- 8. fullscreen
    sc = pg.locator('.docscroll')
    reveal(pg, bids[0]); st0 = sc.evaluate("e=>e.scrollTop"); g0 = geom(pg, bids[0]); title0 = pg.input_value('#title')
    w0 = pg.locator('.editor').bounding_box()['width']
    pg.click('#fullscreenBtn')
    check('fullscreen hides sidebar, list panel, header, tabs', not any(pg.locator(s).is_visible() for s in ['.sidebar', '.listpanel', 'main > header', '#noteTabs']))
    check('fullscreen keeps note toolbar visible', pg.locator('.toolbar').is_visible() and pg.locator('#fullscreenBtn').is_visible())
    check('fullscreen widens the editor', pg.locator('.editor').bounding_box()['width'] > w0 + 300)
    check('fullscreen preserves selection/element/scroll', pg.locator('.free-item.selected').count() == 1 and geom(pg, bids[0]) == g0 and abs(sc.evaluate("e=>e.scrollTop") - st0) < 2)
    check('OS fullscreen not triggered', pg.evaluate("document.fullscreenElement === null"))
    pg.keyboard.press('Escape')
    check('Escape exits fullscreen', pg.locator('.sidebar').is_visible() and not pg.evaluate("document.body.classList.contains('note-fullscreen')"))
    check('exit restores layout and keeps data', pg.locator('.editor').bounding_box()['width'] == w0 and geom(pg, bids[0]) == g0 and pg.input_value('#title') == title0)
    pg.click('#fullscreenBtn'); pg.click('#fullscreenBtn'); check('button toggles fullscreen off', pg.locator('.sidebar').is_visible())

    # ---------------------------------------------------------------- 9. drawing preserved/undistorted on resize
    did = bids[2]; reveal(pg, did)
    def ink(): return pg.locator(f'.free-item[data-block-id="{did}"] canvas.drawpreview').evaluate("""c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0,minx=1e9,maxx=-1,miny=1e9,maxy=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(d[(y*c.width+x)*4+3]>0){n++;minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y)}}return {n,w:maxx-minx,h:maxy-miny}}""")
    i0 = ink(); strokes0 = pg.evaluate("S.notes.find(n=>n.id===S.active).blocks.find(b=>b.id===arguments[0])".replace('arguments[0]', json.dumps(did)))['strokes']
    sx, sy = handle_center(pg, did, 'se'); drag(pg, (sx, sy), (sx + 200, sy + 120)); i1 = ink()
    sx, sy = handle_center(pg, did, 'se'); drag(pg, (sx, sy), (sx - 120, sy - 20)); i2 = ink()
    strokes1 = pg.evaluate("S.notes.find(n=>n.id===S.active).blocks.find(b=>b.id===arguments[0])".replace('arguments[0]', json.dumps(did)))['strokes']
    check('drawing has ink before resize', i0['n'] > 50, i0)
    check('empty-drawing placeholder hidden once strokes exist', not pg.locator(f'.free-item[data-block-id="{did}"] .drawempty').is_visible())
    check('drawing strokes data unchanged by resizing', strokes0 == strokes1 and len(strokes0) == 1)
    check('drawing still rendered after enlarge/shrink', i1['n'] > 50 and i2['n'] > 50, (i1, i2))
    ar0, ar1 = i0['w']/max(1,i0['h']), i1['w']/max(1,i1['h'])
    check('drawing is scaled uniformly (aspect ratio not distorted)', abs(ar0-ar1)/ar0 < 0.08, (ar0, ar1))
    # re-open editor via second click, add stroke
    pg.locator(f'.free-item[data-block-id="{did}"] .body-drawing').click(position={'x': 20, 'y': 20})
    check('click on selected drawing opens editor', pg.locator('#drawModal:not(.hidden)').count() == 1)
    check('editor loads existing strokes', pg.evaluate("D.strokes.length") == 1)
    pg.keyboard.press('Escape'); check('Escape closes drawing modal (and not fullscreen)', pg.locator('#drawModal.hidden').count() == 1)

    # ---------------------------------------------------------------- 10. table + image + divider specifics
    tbl = bids[6]; reveal(pg, tbl)
    pg.locator(f'.free-item[data-block-id="{tbl}"] .item-bar button:has-text("Row")').click(); pg.locator(f'.free-item[data-block-id="{tbl}"] .item-bar button:has-text("Column")').click()
    cell = pg.locator(f'.free-item[data-block-id="{tbl}"] .table-row').nth(1).locator('input').nth(0); cell.fill('cell-A'); cell.press('Tab')
    check('table: add row/column + edit cell after resize', geom(pg, tbl)['rows'][1][0] == 'cell-A' and len(geom(pg, tbl)['rows']) == 3 and len(geom(pg, tbl)['rows'][0]) == 3, geom(pg, tbl)['rows'])
    pg.click('#insertImage'); img = ids(pg)[-1]; reveal(pg, img)
    pg.locator(f'.free-item[data-block-id="{img}"] .image-url').fill('http://insecure.example/x.png'); pg.locator(f'.free-item[data-block-id="{img}"] .image-url').press('Enter')
    check('image: non-https URL rejected', geom(pg, img)['url'] == '')
    tiny = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="red"/></svg>'
    pg.locator(f'.free-item[data-block-id="{img}"] .image-url').fill(tiny); pg.locator(f'.free-item[data-block-id="{img}"] .image-url').press('Enter')
    pg.wait_for_function("id=>{const b=S.notes.find(n=>n.id===S.active).blocks.find(b=>b.id===id);return b.fitted===true}", arg=img)
    gi = geom(pg, img); check('image: element fitted to image aspect (2:1) on first load', abs(gi['w']/gi['h'] - 2) < 0.05, gi)
    dv = bids[4]; reveal(pg, dv); gd = geom(pg, dv)
    check('divider has a visible line and resizable width', pg.locator(f'.free-item[data-block-id="{dv}"] .divider-line').is_visible() and gd['w'] >= 60)

    # ---------------------------------------------------------------- 11. z-order + delete
    n0 = len(ids(pg)); reveal(pg, bids[3])
    pg.locator(f'.free-item[data-block-id="{bids[3]}"] .item-bar button[title="Send backward"]').click()
    check('send backward reorders model', ids(pg).index(bids[3]) == 2)
    DLG['accept'] = True
    pg.locator(f'.free-item[data-block-id="{bids[3]}"] .item-bar button:has-text("Delete")').click()
    check('delete removes element', len(ids(pg)) == n0 - 1 and pg.locator(f'.free-item[data-block-id="{bids[3]}"]').count() == 0)

    # ---------------------------------------------------------------- 12. autosave debounce + flush on close
    pg.evaluate("window.__saves.length=0")
    pg.click(f'.free-item[data-block-id="{cid}"] .codearea'); pg.keyboard.type(' // end')
    check('save is debounced (not immediate)', pg.evaluate("window.__saves.length") == 0)
    pg.evaluate("window.__triggerClose()"); pg.wait_for_function("() => window.__closeReady===1", timeout=3000)
    check('close handshake flushes pending edit before confirming', 'final' in json.dumps(last_saved(pg)) and ' // end' in json.dumps(last_saved(pg)))
    pg.evaluate("window.__failSave=true"); pg.keyboard.type('!'); DLG.update(accept=False)
    pg.evaluate("window.__closeReady=0; window.__triggerClose()"); pg.wait_for_timeout(600)
    check('failed save at close asks user instead of silently closing', pg.evaluate("window.__closeReady") == 0)
    pg.evaluate("window.__failSave=false")
    pg.evaluate("flushSave()"); saved = last_saved(pg)

    # ---------------------------------------------------------------- 13. restart: everything restored
    snapshot = pg.evaluate("S.notes.find(n=>n.id===S.active)"); active_id = snapshot['id']
    pg2 = open_page(br, {'status': 'ok', 'data': saved})
    pg2.evaluate("id=>{S.active=id;render()}", active_id); pg2.wait_for_selector('.free-item')
    snap2 = pg2.evaluate("S.notes.find(n=>n.id===S.active)")
    def strip(b): return {k: v for k, v in b.items()}
    a = {b['id']: strip(b) for b in snapshot['blocks']}; b2 = {b['id']: strip(b) for b in snap2['blocks']}
    check('restart: same element ids/types', a.keys() == b2.keys())
    check('restart: positions & sizes identical', all((a[i]['x'], a[i]['y'], a[i]['w'], a[i]['h']) == (b2[i]['x'], b2[i]['y'], b2[i]['w'], b2[i]['h']) for i in a))
    check('restart: content/code/drawing/table/image/format identical', all(a[i] == b2[i] for i in a))
    cb = pg2.locator(f'.free-item[data-block-id="{cid}"] .codearea').input_value(); check('restart: code text restored exactly in editor', cb == a[cid]['content'] and 'final' in cb, cb)
    check('restart: text restored in element', pg2.locator(f'.free-item[data-block-id="{tid}"] .blockcontent').inner_text().strip() == 'Persisted text پایدار')
    ink2 = pg2.locator(f'.free-item[data-block-id="{did}"] canvas.drawpreview').evaluate("c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n}")
    check('restart: drawing renders again', ink2 > 50, ink2)
    check('restart: DOM box matches stored geometry', all(abs(pg2.locator(f'.free-item[data-block-id="{i}"]').bounding_box()['width'] - a[i]['w']) < 1.5 for i in a))
    check('restart: nothing selected, no controls shown', pg2.locator('.free-item.selected').count() == 0 and pg2.locator('.rz:visible').count() == 0)
    check('restart: no page errors', not [e for e in pg2.__errors if 'ERR_FILE_NOT_FOUND' not in e], pg2.__errors)
    pg2.close(); pg.close()

    # ---------------------------------------------------------------- 14. legacy v2 data migration
    legacy = {'version': 2, 'notes': [{'id': 'n1', 'title': 'Old', 'notebookId': 'js', 'tags': [], 'createdAt': '2025-01-01T00:00:00.000Z', 'updatedAt': '2025-01-01T00:00:00.000Z', 'blocks': [
        {'id': 'a', 'type': 'text', 'content': 'legacy text with a fairly long body ' * 6, 'html': '<div>legacy</div>', 'x': 40, 'y': 50, 'w': 300},
        {'id': 'b', 'type': 'code', 'language': 'python', 'content': 'print(1)'},
        {'id': 'c', 'type': 'drawing', 'strokes': [{'tool': 'line', 'color': '#fff', 'size': 3, 'points': [{'x': .1, 'y': .1}, {'x': .9, 'y': .9}]}]},
        {'id': 'd', 'type': 'weird-future-type', 'payload': 7}]}], 'notebooks': [{'id': 'js', 'name': 'JavaScript', 'color': '#7c9cff'}], 'openTabs': ['n1']}
    pg = open_page(br, {'status': 'ok', 'data': legacy}); pg.wait_for_selector('.free-item')
    check('legacy v2 note opens in tab and renders all blocks', pg.locator('.free-item').count() == 4)
    m = pg.evaluate("S.notes[0].blocks")
    check('migration keeps content, language, strokes, unknown fields', m[0]['content'].startswith('legacy text') and m[1]['language'] == 'python' and len(m[2]['strokes']) == 1 and m[3]['payload'] == 7)
    check('migration gives every block geometry (x,y,w,h)', all(all(isinstance(b[k], (int, float)) for k in 'xywh') for b in m), m)
    check('legacy text height is fitted to content once', m[0]['h'] >= 56)
    check('unknown element type is preserved and shown as placeholder', 'Unsupported element' in pg.locator('.body-unknown').inner_text())
    pg.wait_for_function("() => window.__saves.length>0", timeout=3000); s = last_saved(pg)
    check('migrated data saved as version 3', s['version'] == 3)
    pg.close()

    # ---------------------------------------------------------------- 15. corrupt data never overwritten
    pg = open_page(br, {'status': 'error', 'message': 'Unexpected token', 'corruptCopy': 'C:/x/notebook.corrupt-1.json'})
    check('load failure shows banner', pg.locator('#loadError').count() == 1 and 'corrupt' in pg.locator('#loadError').inner_text())
    pg.click('#newNote'); pg.fill('#noteTitleInput', 'x'); pg.click('#createNoteSubmit'); pg.keyboard.press('Control+S'); pg.wait_for_timeout(900)
    check('after load failure NOTHING is written (no silent overwrite)', pg.evaluate("window.__saves.length") == 0)
    pg.close()

    # ---------------------------------------------------------------- 16. Persian UI + RTL canvas
    pg = open_page(br, {'status': 'empty'}); pg.locator('.note-card').first.click(); pg.wait_for_selector('.free-item')
    pg.click('#languageToggle')
    check('Persian mode: RTL document', pg.evaluate("document.documentElement.dir") == 'rtl')
    check('Persian mode: canvas stays LTR so x offsets/scroll are correct', pg.evaluate("getComputedStyle(document.querySelector('#blocks')).direction") == 'ltr')
    g0 = pg.locator('.free-item').first.bounding_box(); pg.locator('.free-item').first.locator('.blockcontent').click()
    sx, sy = handle_center(pg, pg.locator('.free-item').first.get_attribute('data-block-id'), 'se'); drag(pg, (sx, sy), (sx+50, sy+30))
    g1 = pg.locator('.free-item').first.bounding_box(); check('Persian mode: resize works', abs(g1['width'] - g0['width'] - 50) < 2)
    pg.click('#fullscreenBtn'); check('Persian mode: fullscreen works', not pg.locator('.sidebar').is_visible()); pg.keyboard.press('Escape')
    pg.close()

    # ---------------------------------------------------------------- 17. canvas scroll reach
    pg = open_page(br, {'status': 'empty'}); new_note(pg, 'far')
    bid = ids(pg)[0]; reveal(pg, bid); gb = pg.locator(f'.free-item[data-block-id="{bid}"] .item-grip').bounding_box()
    drag(pg, (gb['x']+15, gb['y']+8), (gb['x']+15+900, gb['y']+8+500))
    sx, sy = handle_center(pg, bid, 'se'); drag(pg, (sx, sy), (sx+300, sy+300))
    ext = pg.evaluate("(()=>{const h=document.querySelector('#blocks');const g=S.notes.find(n=>n.id===S.active).blocks[0];return {minW:parseFloat(h.style.minWidth),right:g.x+g.w,minH:parseFloat(h.style.minHeight),bottom:g.y+g.h}})()")
    check('canvas extent grows so far-away elements are scrollable', ext['minW'] >= ext['right'] and ext['minH'] >= ext['bottom'], ext)
    pg.close()
    br.close()

print(f'\n{len(PASS)} passed, {len(FAIL)} failed')
for f in FAIL: print('  FAILED:', f)
sys.exit(1 if FAIL else 0)
