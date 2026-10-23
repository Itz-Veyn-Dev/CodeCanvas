'use strict';
/* CodeCanvas renderer.
 * Pure helpers (migration, resize math) live in core.js (window.CC). */
const { uid, esc, migrate, computeResize, computeMove, contentExtent, nextPosition, containFit, minSize, defaultSize, SCHEMA_VERSION } = window.CC;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ data */
const defaults = [{ id: 'js', name: 'JavaScript', color: '#7c9cff' }, { id: 'web', name: 'Web Development', color: '#c58cff' }, { id: 'algo', name: 'Algorithms', color: '#63d6bb' }];
function makeSample() {
  const T = (content, x, y, w, h, type) => ({ id: uid(), type: type || 'text', content, x, y, w, h });
  return [
    { id: uid(), title: 'JavaScript — Arrays & Methods', notebookId: 'js', pinned: true, tags: ['JavaScript', 'Fundamentals'], createdAt: now(), updatedAt: now(), blocks: [
      T('Arrays store multiple values in one ordered collection. Each item has an index, starting at 0.', 30, 30, 420, 90),
      { id: uid(), type: 'code', language: 'javascript', content: 'const languages = ["JavaScript", "Python", "Rust"];\n\nlanguages.push("TypeScript");\nconsole.log(languages[0]); // JavaScript', x: 30, y: 160, w: 620, h: 210 },
      T('💡 push() adds to the end; unshift() adds to the beginning. Keep variable names descriptive.', 480, 40, 300, 100, 'tip')] },
    { id: uid(), title: 'How the DOM works', notebookId: 'web', pinned: false, tags: ['DOM', 'Web'], createdAt: now(), updatedAt: now(), blocks: [
      T('The Document Object Model represents a web page as a tree of objects.', 30, 30, 420, 80),
      { id: uid(), type: 'code', language: 'javascript', content: 'const heading = document.querySelector("h1");\nheading.textContent = "Hello, world!";', x: 30, y: 140, w: 620, h: 170 }] },
    { id: uid(), title: 'Algorithm flow — draft', notebookId: 'algo', pinned: false, tags: ['Algorithms'], createdAt: now(), updatedAt: now(), blocks: [
      T('Break the problem into small, testable steps before implementing the solution.', 30, 30, 420, 80)] }
  ];
}

let S = { notes: [], notebooks: defaults, active: null, openTabs: [], view: 'all', sort: 'recent', locale: 'en' };
// ui = transient state that is never persisted
const ui = { selectedId: null, lastActive: null, fullscreen: false, readOnly: false, clickWasSelected: false };
let saveTimer = null, saveChain = Promise.resolve(true), dirty = false;
let drawId = null, D = { strokes: [], undo: [], tool: 'pen', current: null, active: false };

const programmingLanguages=[['javascript','JavaScript'],['typescript','TypeScript'],['python','Python'],['java','Java'],['c','C'],['cpp','C++'],['csharp','C#'],['go','Go'],['rust','Rust'],['php','PHP'],['ruby','Ruby'],['swift','Swift'],['kotlin','Kotlin'],['dart','Dart'],['html','HTML'],['css','CSS'],['sql','SQL'],['json','JSON'],['yaml','YAML'],['bash','Bash / Shell'],['powershell','PowerShell'],['lua','Lua'],['r','R'],['scala','Scala'],['text','Plain text / فارسی']];
const fa={'New note':'جزوه جدید','WORKSPACE':'فضای کاری','All notes':'همه جزوه‌ها','Pinned':'سنجاق‌شده‌ها','Recently edited':'آخرین ویرایش‌ها','NOTEBOOKS':'دفترها','Stored on this device':'ذخیره‌شده روی این دستگاه','Your notes stay local.':'جزوه‌ها فقط روی دستگاهت می‌مانند.','Export backup':'خروجی پشتیبان','Import backup':'درون‌ریزی پشتیبان','My workspace':'فضای کاری من','Personal notebook':'دفتر شخصی','Workspace':'فضای کاری','All changes saved':'همه تغییرات ذخیره شد','YOUR KNOWLEDGE BASE':'پایگاه دانش تو','Ideas, code, and sketches — in one place.':'ایده‌ها، کدها و طرح‌ها؛ همه در یک‌جا.','Search notes…':'جست‌وجوی جزوه‌ها…','Recently edited⌄':'آخرین ویرایش⌄','Your next big idea starts here.':'ایده‌ی بزرگ بعدی از اینجا شروع می‌شود.','Select a note or create a fresh canvas.':'یک جزوه انتخاب کن یا جزوه‌ای تازه بساز.','Create your first note':'اولین جزوه‌ات را بساز','Pin':'سنجاق','Draw':'رسم','Delete':'حذف','Untitled note':'جزوه بدون عنوان','＋ Add tag':'＋ افزودن برچسب','INSERT':'افزودن','Text':'متن','Code block':'بلوک کد','Drawing':'طراحی','Divider':'جداکننده','＋ Add a block':'＋ افزودن بلوک','Drawing canvas':'بوم طراحی','Save drawing':'ذخیره طراحی','Add a tag':'افزودن برچسب','Keep related notes easy to find.':'جزوه‌های مرتبط را مرتب نگه دار.','Cancel':'لغو','Add tag':'افزودن برچسب','Copy code':'کپی کد','CODE BLOCK':'بلوک کد','Start writing your notes…':'نوشتن جزوه را شروع کن…','No notes found.':'جزوه‌ای پیدا نشد.','Try another search.':'عبارت دیگری را جست‌وجو کن.','An empty canvas, ready for your ideas.':'بوم خالی آماده‌ی ایده‌های توست.','Code copied':'کد کپی شد','New note created':'جزوه جدید ساخته شد','Tag added':'برچسب اضافه شد','Drawing saved':'طراحی ذخیره شد','Fullscreen':'تمام‌صفحه','Exit fullscreen':'خروج از تمام‌صفحه','Image':'تصویر','Table':'جدول','Note / Tip':'نکته','Edit drawing':'ویرایش طراحی','Press':'کلید','to exit fullscreen':'برای خروج از تمام‌صفحه','Select, then click to sketch a diagram or idea':'انتخاب کن، سپس کلیک کن تا طرح بکشی'};

function applyLocale() {
  const isFa = S.locale === 'fa';
  document.documentElement.lang = isFa ? 'fa' : 'en';
  document.documentElement.dir = isFa ? 'rtl' : 'ltr';
  $('#languageToggle').textContent = isFa ? 'English' : 'فارسی';
  $('#languageToggle').title = isFa ? 'Switch to English' : 'تغییر زبان برنامه به فارسی';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    // never translate or rewrite user content
    if (node.parentElement && node.parentElement.closest('[contenteditable],textarea,.table-grid,#title,.note-card,.note-tab,.line-numbers')) return;
    if (!node.__originalText) node.__originalText = node.nodeValue;
    const original = node.__originalText.trim();
    if (!original) return;
    if (isFa && fa[original]) node.nodeValue = node.__originalText.replace(original, fa[original]);
    else if (!isFa) node.nodeValue = node.__originalText;
  });
  $('#search').placeholder = isFa ? 'جست‌وجوی جزوه‌ها…' : 'Search notes…';
  $('#title').placeholder = isFa ? 'جزوه بدون عنوان' : 'Untitled note';
  $('#tagInput').placeholder = isFa ? 'مثلاً جاوااسکریپت، امتحان، پروژه' : 'e.g. JavaScript, exam, project';
}

const canvas = $('#canvas'), ctx = canvas.getContext('2d');
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.remove('hidden'); clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.add('hidden'), 2600); }
function date(s) { const d = Date.now() - new Date(s).getTime(); return d < 60000 ? 'just now' : d < 3600000 ? Math.floor(d / 60000) + 'm ago' : d < 86400000 ? Math.floor(d / 3600000) + 'h ago' : new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
const current = () => S.notes.find(n => n.id === S.active);
const nbname = id => S.notebooks.find(n => n.id === id)?.name || 'Unsorted';
const plain = n => (n.blocks || []).map(b => b.type === 'drawing' ? '[Drawing]' : (b.type === 'table' ? (b.rows || []).flat().join(' ') : b.content || '')).join(' ');

/* ------------------------------------------------------------ persistence */
const payload = () => ({ version: SCHEMA_VERSION, notes: S.notes, notebooks: S.notebooks, openTabs: S.openTabs || [], locale: S.locale });
function setSaveState(state) {
  const el = $('#saveState'); el.classList.toggle('saving', state === 'saving'); el.classList.toggle('error', state === 'error');
  el.innerHTML = '<i></i> ' + (state === 'saving' ? 'Saving…' : state === 'error' ? 'Save failed' : ui.readOnly ? 'Read-only (load failed)' : 'All changes saved');
}
/** Mark the model dirty and schedule a debounced autosave. */
function scheduleSave() { dirty = true; setSaveState('saving'); clearTimeout(saveTimer); saveTimer = setTimeout(save, 450); }
function changed(n) { if (n) n.updatedAt = now(); renderList(); scheduleSave(); }
/** Serialised save: saves never overlap and the latest model always wins. */
function save() {
  clearTimeout(saveTimer); saveTimer = null;
  if (ui.readOnly) return Promise.resolve(false); // protect unreadable data from being overwritten
  dirty = false;
  saveChain = saveChain.then(async () => {
    try { await window.codeCanvas.save(payload()); if (!dirty) setSaveState('saved'); return true; }
    catch (e) { dirty = true; setSaveState('error'); toast('Could not save notes: ' + e.message); return false; }
  });
  return saveChain;
}
/** Resolve once every pending edit has reached disk. */
async function flushSave() { if (saveTimer || dirty) return save(); return saveChain; }
window.addEventListener('beforeunload', () => { if (!ui.readOnly && (saveTimer || dirty)) { try { window.codeCanvas.save(payload()); } catch (e) { /* best effort */ } } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
window.addEventListener('blur', () => { if (I) endInteraction(true); flushSave(); });
window.codeCanvas.onBeforeClose(async () => {
  let ok = true;
  try { ok = await flushSave(); } catch (e) { ok = false; }
  if (ok === false && !ui.readOnly && !confirm('The latest changes could not be saved. Close anyway?')) return;
  window.codeCanvas.closeReady();
});

function applyData(data) {
  S.notes = data.notes; S.notebooks = data.notebooks.length ? data.notebooks : defaults;
  S.openTabs = data.openTabs; S.locale = data.locale;
  S.active = S.openTabs.find(id => S.notes.some(n => n.id === id)) || null; // same as the original init()
}
function showLoadError(res) {
  ui.readOnly = true;
  let bar = $('#loadError');
  if (!bar) { bar = document.createElement('div'); bar.id = 'loadError'; bar.className = 'load-error'; document.body.prepend(bar); }
  bar.textContent = 'Your saved notes could not be read, so autosave is disabled to protect them. ' + (res.message ? '(' + res.message + ') ' : '') + (res.corruptCopy ? 'A copy of the unreadable file was kept: ' + res.corruptCopy + '. ' : '') + 'You can import a backup to continue.';
  setSaveState('saved');
}
async function boot() {
  installResizers();
  let res;
  try { res = await window.codeCanvas.load(); } catch (e) { res = { status: 'error', message: e.message }; }
  if (res && (res.status === 'ok' || res.status === 'recovered')) {
    const needsMigration = (res.data.version || 0) < SCHEMA_VERSION;
    applyData(migrate(res.data));
    if (res.status === 'recovered') toast('Notes were restored from the last good backup.');
    if (needsMigration || res.status === 'recovered') scheduleSave();
  } else if (res && res.status === 'empty') {
    S.notes = migrate({ notes: makeSample() }).notes; S.active = null; scheduleSave();
  } else { showLoadError(res || {}); }
  if (S.locale === 'fa') applyLocale();
  render();
}

/* ----------------------------------------------------------- note creation */
function openCreateNote(nb) {
  const select = $('#noteLanguageSelect');
  select.innerHTML = programmingLanguages.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
  select.value = 'javascript';
  $('#noteTitleInput').value = '';
  $('#noteModal').dataset.notebookId = nb || S.notebooks[0]?.id || 'js';
  const faMode = S.locale === 'fa';
  $('#noteModalTitle').textContent = faMode ? 'ساخت جزوه جدید' : 'Create a new note';
  $('#noteModalSubtitle').textContent = faMode ? 'عنوان و زبان برنامه‌نویسی را انتخاب کن.' : 'Choose a title and programming language.';
  $('#noteModal').classList.remove('hidden');
  $('#noteTitleInput').placeholder = faMode ? 'مثلاً آرایه‌ها در جاوااسکریپت' : 'e.g. JavaScript arrays';
  $('#noteTitleInput').focus();
}
function createNoteFromForm(event) {
  event?.preventDefault();
  const title = $('#noteTitleInput').value.trim();
  const language = $('#noteLanguageSelect').value || 'text';
  const requestedNb = $('#noteModal').dataset.notebookId || 'js';
  const languageNotebook = language === 'html' || language === 'css' ? 'web' : (requestedNb === 'web' || requestedNb === 'algo' ? requestedNb : 'js');
  const nb = S.notebooks.some(x => x.id === languageNotebook) ? languageNotebook : (S.notebooks[0]?.id || 'js');
  const n = { id: uid(), title, notebookId: nb, programmingLanguage: language, pinned: false, tags: [], createdAt: now(), updatedAt: now(), blocks: [{ id: uid(), type: 'text', content: '', x: 30, y: 30, w: 420, h: 140 }] };
  S.notes.unshift(n); S.active = n.id; S.openTabs = [...new Set([...(S.openTabs || []), n.id])]; S.view = 'all';
  $('#noteModal').classList.add('hidden');
  save(); render(); $('#title').focus();
  toast(S.locale === 'fa' ? 'جزوه جدید ساخته شد' : 'New note created');
}

/* ------------------------------------------------------------ lists & tabs */
function visible() {
  const q = $('#search').value.trim().toLowerCase();
  let a = S.notes.filter(n => (S.view !== 'pinned' || n.pinned) && (S.view !== 'recent' || Date.now() - new Date(n.updatedAt) < 7 * 864e5) && (!S.view.startsWith('nb:') || n.notebookId === S.view.slice(3)) && (!q || (`${n.title} ${plain(n)} ${(n.tags || []).join(' ')} ${nbname(n.notebookId)}`).toLowerCase().includes(q)));
  a.sort((x, y) => S.sort === 'title' ? (x.title || '').localeCompare(y.title || '') : new Date(y.updatedAt) - new Date(x.updatedAt));
  if (S.view === 'all' || S.view === 'pinned') a.sort((x, y) => Number(y.pinned) - Number(x.pinned) || (S.sort === 'title' ? (x.title || '').localeCompare(y.title || '') : new Date(y.updatedAt) - new Date(x.updatedAt)));
  return a;
}
function renderTabs() {
  const host = $('#noteTabs'); if (!host) return;
  S.openTabs = (S.openTabs || []).filter(id => S.notes.some(n => n.id === id));
  if (S.active && !S.openTabs.includes(S.active)) S.openTabs.push(S.active);
  host.innerHTML = '';
  S.openTabs.forEach(id => {
    const n = S.notes.find(x => x.id === id); if (!n) return;
    const tab = document.createElement('div'); tab.className = 'note-tab' + (id === S.active ? ' active' : '');
    const name = document.createElement('button'); name.className = 'tab-name'; name.textContent = n.title || 'Untitled note'; name.title = n.title || 'Untitled note';
    name.onclick = () => { S.active = id; S.view = 'all'; render() };
    const close = document.createElement('button'); close.className = 'tab-close'; close.textContent = '×'; close.title = 'Close tab';
    close.onclick = e => { e.stopPropagation(); S.openTabs = S.openTabs.filter(x => x !== id); if (S.active === id) S.active = S.openTabs.at(-1) || null; save(); render() };
    tab.append(name, close); host.appendChild(tab);
  });
}
function renderNotebooks() {
  $('#notebooks').innerHTML = '';
  S.notebooks.forEach(n => {
    const b = document.createElement('button'); b.className = 'notebook ' + (S.view === 'nb:' + n.id ? 'active' : '');
    b.innerHTML = `<i class="nbdot" style="background:${esc(n.color)}"></i>${esc(n.name)}<small>${S.notes.filter(x => x.notebookId === n.id).length}</small>`;
    b.onclick = () => { S.view = 'nb:' + n.id; S.active = null; render() };
    $('#notebooks').appendChild(b);
  });
}
function renderList() {
  const a = visible();
  $('#allCount').textContent = S.notes.length; $('#pinCount').textContent = S.notes.filter(n => n.pinned).length; $('#count').textContent = a.length + ' notes'; $('#noteList').innerHTML = '';
  if (!a.length) { $('#noteList').innerHTML = '<div style="text-align:center;color:#748099;padding:30px 10px;font-size:11px">⌕<br><br>No notes found.<br>Try another search.</div>'; return; }
  a.forEach(n => {
    const d = document.createElement('div'); d.className = 'note-card ' + (n.id === S.active ? 'active' : '');
    const tag = n.tags?.[0] ? `<span class="tagmini">${esc(n.tags[0])}</span>` : '';
    d.innerHTML = `<h3>${n.pinned ? '<em>⌑</em>' : ''}${esc(n.title || 'Untitled note')}</h3><p>${esc(plain(n).replace(/\s+/g, ' ').trim() || 'An empty canvas, ready for your ideas.')}</p><div class="note-meta"><i style="background:${esc(S.notebooks.find(b => b.id === n.notebookId)?.color || '#7c9cff')}"></i>${esc(nbname(n.notebookId))} · ${date(n.updatedAt)} ${tag}</div>`;
    d.onclick = () => { if (S.active === n.id) return; S.active = n.id; S.openTabs = [...new Set([...(S.openTabs || []), n.id])]; save(); render() };
    $('#noteList').appendChild(d);
  });
}
function render() {
  renderNotebooks(); renderList(); renderTabs();
  const n = current(), has = !!n;
  $('#welcome').classList.toggle('hidden', has); $('#work').classList.toggle('hidden', !has);
  const names = { all: 'All notes', pinned: 'Pinned', recent: 'Recently edited' };
  const head = S.view.startsWith('nb:') ? nbname(S.view.slice(3)) : names[S.view] || 'All notes';
  $('#crumb').textContent = head; $('#listTitle').textContent = head;
  if (!has && ui.fullscreen) setFullscreen(false);
  if (n) {
    $('#title').value = n.title || '';
    $('#notebookLabel').textContent = (programmingLanguages.find(x => x[0] === n.programmingLanguage)?.[1] || nbname(n.notebookId));
    $('#updated').textContent = date(n.updatedAt).toUpperCase(); $('#created').textContent = 'Created ' + date(n.createdAt);
    $('#pin').textContent = n.pinned ? '⌑ Pinned' : '♧ Pin'; $('#pin').classList.toggle('on', n.pinned);
    $('#tag').textContent = n.tags?.length ? '# ' + n.tags.join(' · ') : '＋ Add tag';
    if (ui.lastActive !== S.active) { ui.selectedId = null; ui.lastActive = S.active; }
    renderBlocks(n); wordCount(n);
  } else { ui.lastActive = null; ui.selectedId = null; }
  if (S.locale === 'fa') applyLocale();
}
function wordCount(n) { const s = (n.title + ' ' + plain(n)).trim(); $('#words').textContent = (s ? s.split(/\s+/).length : 0) + ' words'; }

/* ====================================================================
 * Free canvas: element rendering
 * ==================================================================== */
const host = $('#blocks');
const HANDLE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const blockById = id => current()?.blocks.find(b => b.id === id);
const itemEl = id => host.querySelector(`.free-item[data-block-id="${CSS.escape(id)}"]`);
const LABELS = { text: 'TEXT', tip: 'NOTE / TIP', code: 'CODE', drawing: 'DRAWING', image: 'IMAGE', table: 'TABLE', divider: 'DIVIDER' };

function applyGeom(item, b) {
  item.style.left = b.x + 'px'; item.style.top = b.y + 'px';
  item.style.width = b.w + 'px'; if (b.h != null) item.style.height = b.h + 'px';
}
function updateExtent(n) {
  const e = contentExtent((n || current())?.blocks);
  host.style.minHeight = Math.max(900, e.h + 160) + 'px';
  host.style.minWidth = e.w > 0 ? (e.w + 80) + 'px' : '';
}
function applyZ(n) { n.blocks.forEach((b, i) => { const el = itemEl(b.id); if (el) el.style.zIndex = i + 1; }); }

function mkBtn(label, title, onClick, cls) {
  const x = document.createElement('button'); x.type = 'button'; x.className = cls || ''; x.textContent = label; if (title) x.title = title; x.addEventListener('click', onClick); return x;
}

/** Floating contextual bar: drag grip + type label + type controls + z-order/delete. Visible only when selected. */
function buildBar(n, b, extras) {
  const bar = document.createElement('div'); bar.className = 'item-bar';
  const grip = document.createElement('div'); grip.className = 'item-grip'; grip.title = 'Drag to move'; grip.textContent = '⠿ ' + (LABELS[b.type] || String(b.type).toUpperCase());
  bar.appendChild(grip);
  (extras || []).forEach(x => bar.appendChild(x));
  const acts = document.createElement('div'); acts.className = 'blockactions';
  acts.append(
    mkBtn('↑', 'Bring forward', () => { const i = n.blocks.indexOf(b); if (i < n.blocks.length - 1) { [n.blocks[i + 1], n.blocks[i]] = [n.blocks[i], n.blocks[i + 1]]; applyZ(n); changed(n); } }),
    mkBtn('↓', 'Send backward', () => { const i = n.blocks.indexOf(b); if (i > 0) { [n.blocks[i - 1], n.blocks[i]] = [n.blocks[i], n.blocks[i - 1]]; applyZ(n); changed(n); } }),
    mkBtn('Delete', 'Delete element', () => deleteBlock(n, b))
  );
  bar.appendChild(acts);
  return bar;
}
function deleteBlock(n, b) {
  const hasContent = (b.content && b.content.trim()) || (b.strokes && b.strokes.length) || b.url || (b.type === 'table' && b.rows.flat().some(Boolean));
  if (hasContent && !confirm('Delete this element?')) return;
  const at = n.blocks.indexOf(b); if (at < 0) return;
  n.blocks.splice(at, 1); if (ui.selectedId === b.id) ui.selectedId = null;
  itemEl(b.id)?.remove(); updateExtent(n); changed(n); wordCount(n);
}

function buildBody(n, b, extras, after) {
  const body = document.createElement('div'); body.className = 'item-body body-' + b.type;
  if (b.type === 'text' || b.type === 'tip') {
    const c = document.createElement('div'); c.className = 'blockcontent'; c.dataset.blockId = b.id;
    c.setAttribute('contenteditable', 'plaintext-only'); c.setAttribute('dir', 'auto'); c.setAttribute('role', 'textbox'); c.setAttribute('aria-multiline', 'true');
    c.dataset.placeholder = 'Start writing your notes…';
    c.style.color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '';
    c.style.fontSize = (Number(b.fontSize) || 14) + 'px'; c.style.fontWeight = Number(b.fontWeight) || 400; c.style.fontStyle = b.italic ? 'italic' : 'normal';
    c.textContent = b.content || '';
    c.addEventListener('input', () => {
      if (!c.textContent) c.replaceChildren(); // let the :empty placeholder come back
      b.content = c.innerText; delete b.html; // plain text is authoritative; stale legacy html must not resurface
      changed(n); wordCount(n);
    });
    c.addEventListener('keydown', ev => { if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); addBlock('text'); } });
    body.appendChild(c);
  } else if (b.type === 'code') {
    const sel = document.createElement('select'); sel.className = 'lang'; sel.title = 'Language';
    sel.innerHTML = programmingLanguages.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
    sel.value = programmingLanguages.some(x => x[0] === b.language) ? b.language : 'text';
    sel.addEventListener('change', () => { b.language = sel.value; changed(n); });
    const wrap = document.createElement('div'); wrap.className = 'code-editor';
    const gutter = document.createElement('pre'); gutter.className = 'line-numbers'; gutter.setAttribute('aria-hidden', 'true');
    const ta = document.createElement('textarea'); ta.className = 'codearea'; ta.spellcheck = false; ta.wrap = 'off'; ta.dir = 'ltr'; ta.placeholder = '// Write code here…';
    ta.setAttribute('autocomplete', 'off'); ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocorrect', 'off'); ta.setAttribute('aria-label', 'Code editor');
    ta.value = b.content || '';
    wrap.append(gutter, ta);
    const foot = document.createElement('div'); foot.className = 'codefoot'; foot.innerHTML = '<span>CODE BLOCK</span><span class="lines">1 line</span>';
    const lines = () => { const count = Math.max(1, ta.value.split('\n').length); foot.querySelector('.lines').textContent = count + (count === 1 ? ' line' : ' lines'); gutter.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n'); gutter.scrollTop = ta.scrollTop; };
    ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
    ta.addEventListener('input', () => { b.content = ta.value; changed(n); wordCount(n); lines(); });
    ta.addEventListener('keydown', e => codeKeydown(e, ta));
    body.append(wrap, foot);
    extras.push(sel, mkBtn('Copy code', 'Copy code to clipboard', async () => { try { await navigator.clipboard.writeText(ta.value); } catch { ta.select(); document.execCommand('copy'); } toast('Code copied'); }, 'bar-btn'));
    lines();
  } else if (b.type === 'drawing') {
    const cv = document.createElement('canvas'); cv.className = 'drawpreview';
    const empty = document.createElement('div'); empty.className = 'drawempty'; empty.innerHTML = '<div><b>✎</b>Select, then click to sketch a diagram or idea</div>';
    empty.hidden = !!(b.strokes && b.strokes.length);
    body.append(cv, empty);
    body.addEventListener('click', () => { if (ui.clickWasSelected) openDraw(b.id); }); // 1st click selects, 2nd click edits
    extras.push(mkBtn('Edit drawing', 'Open the drawing editor', () => openDraw(b.id), 'bar-btn'));
    drawObserver.observe(body); body.__block = b; body.__canvas = cv;
  } else if (b.type === 'image') {
    const stage = document.createElement('div'); stage.className = 'image-stage';
    const urlInput = document.createElement('input'); urlInput.className = 'image-url'; urlInput.placeholder = 'Paste an image URL (https://…)'; urlInput.value = b.url || ''; urlInput.setAttribute('aria-label', 'Image URL');
    const show = () => {
      stage.replaceChildren();
      if (b.url) {
        const im = document.createElement('img'); im.alt = b.alt || 'Note image'; im.draggable = false;
        im.onload = () => { // first load: match the element to the image's aspect ratio (once)
          if (!b.fitted && im.naturalWidth && im.naturalHeight) { b.fitted = true; b.h = Math.max(minSize('image').h, Math.round(b.w * im.naturalHeight / im.naturalWidth)); const el = itemEl(b.id); if (el) applyGeom(el, b); updateExtent(n); scheduleSave(); }
        };
        im.onerror = () => { stage.textContent = 'Could not load this image. Check the URL.'; };
        im.src = b.url; stage.appendChild(im);
      } else stage.textContent = 'Select this image and paste an image URL.';
    };
    urlInput.addEventListener('change', () => {
      const v = urlInput.value.trim();
      if (v && !/^(https:\/\/|data:image\/)/i.test(v)) { toast('Only https:// or data:image URLs are supported'); urlInput.value = b.url || ''; return; }
      b.url = v; b.fitted = false; changed(n); show();
    });
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); urlInput.blur(); } });
    body.appendChild(stage); extras.push(urlInput); show();
  } else if (b.type === 'table') {
    if (!Array.isArray(b.rows) || !b.rows.length) b.rows = [['Column 1', 'Column 2'], ['', '']];
    const grid = document.createElement('div'); grid.className = 'table-grid';
    const paint = () => {
      grid.replaceChildren();
      b.rows.forEach((row, ri) => {
        const line = document.createElement('div'); line.className = 'table-row';
        row.forEach((val, ci) => { const cell = document.createElement('input'); cell.value = val; cell.placeholder = `Cell ${ri + 1},${ci + 1}`; cell.dir = 'auto'; cell.addEventListener('input', () => { b.rows[ri][ci] = cell.value; changed(n); }); line.appendChild(cell); });
        grid.appendChild(line);
      });
    };
    body.appendChild(grid);
    extras.push(
      mkBtn('＋ Column', 'Add column', () => { b.rows = b.rows.map(r => [...r, '']); paint(); changed(n); }, 'bar-btn'),
      mkBtn('＋ Row', 'Add row', () => { b.rows.push(Array(Math.max(1, ...b.rows.map(r => r.length))).fill('')); paint(); changed(n); }, 'bar-btn')
    );
    paint();
  } else if (b.type === 'divider') {
    const line = document.createElement('div'); line.className = 'divider-line'; body.appendChild(line);
  } else {
    body.textContent = 'Unsupported element type “' + b.type + '” (kept in your data).'; body.classList.add('body-unknown');
  }
  return body;
}

function buildItem(n, b, i) {
  const item = document.createElement('div');
  item.className = 'free-item item-' + b.type + (b.type === 'tip' ? ' tipblock' : '') + (b.type === 'text' || b.type === 'tip' ? ' textblock' : '');
  item.dataset.blockId = b.id; item.style.zIndex = i + 1;
  const extras = [];
  const body = buildBody(n, b, extras);
  item.append(buildBar(n, b, extras), body);
  HANDLE_DIRS.forEach(d => { const h = document.createElement('div'); h.className = 'rz rz-' + d; h.dataset.dir = d; item.appendChild(h); });
  applyGeom(item, b);
  return item;
}

/** Re-render the canvas. Selection is restored by id so rerenders never lose it. */
function renderBlocks(n) {
  if (I) endInteraction(false);
  drawObserver.disconnect();
  const sc = $('.docscroll'), top = sc.scrollTop, left = sc.scrollLeft;
  host.replaceChildren();
  (n.blocks || []).forEach((b, i) => host.appendChild(buildItem(n, b, i)));
  host.appendChild(sizeTip());
  host.querySelectorAll('.body-drawing').forEach(paintDrawing); // paint now; the ResizeObserver handles later size changes
  // text/tip blocks migrated from v2 have no stored height: fit to content once
  (n.blocks || []).forEach(b => {
    if ((b.type === 'text' || b.type === 'tip') && b.h == null) {
      const el = itemEl(b.id); if (!el) return;
      el.style.height = 'auto';
      b.h = Math.min(600, Math.max(minSize(b.type).h, el.offsetHeight)); applyGeom(el, b); scheduleSave();
    }
  });
  if (ui.selectedId && !n.blocks.some(b => b.id === ui.selectedId)) ui.selectedId = null;
  if (ui.selectedId) itemEl(ui.selectedId)?.classList.add('selected');
  updateExtent(n); syncFormatTools();
  sc.scrollTop = top; sc.scrollLeft = left;
}

/* ---- drawing preview: scaled uniformly (never distorted) and re-rendered on resize ---- */
const LOGICAL_W = 1200, LOGICAL_H = 650; // the drawing modal's coordinate space
const drawObserver = new ResizeObserver(entries => entries.forEach(en => paintDrawing(en.target)));
function paintDrawing(body) {
  const cv = body.__canvas, b = body.__block; if (!cv || !b) return;
  const cw = Math.max(1, body.clientWidth), ch = Math.max(1, body.clientHeight), dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, cw, ch);
  const fit = containFit(LOGICAL_W, LOGICAL_H, cw, ch);
  c.translate(fit.ox, fit.oy); c.scale(fit.scale, fit.scale);
  drawAll(c, b.strokes || [], LOGICAL_W, LOGICAL_H);
}

/* ---- code editor keyboard handling (works with undo, IME and selections) ---- */
function editText(ta, from, to, text, selFrom, selTo) {
  ta.setSelectionRange(from, to);
  if (!document.execCommand('insertText', false, text)) { ta.setRangeText(text, from, to, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
  ta.setSelectionRange(selFrom, selTo);
}
function codeKeydown(e, ta) {
  if (e.isComposing || e.keyCode === 229) return; // IME composition (Persian, CJK …)
  const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd, IND = '  ';
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault(); // keep focus inside the editor
    const multi = v.slice(s, en).includes('\n');
    if (!multi && !e.shiftKey) { editText(ta, s, en, IND, s + IND.length, s + IND.length); return; }
    const ls = v.lastIndexOf('\n', s - 1) + 1; let le = v.indexOf('\n', en); if (le < 0) le = v.length;
    const block = v.slice(ls, le).split('\n');
    const out = e.shiftKey ? block.map(l => l.startsWith(IND) ? l.slice(IND.length) : l.replace(/^ /, '')) : block.map(l => IND + l);
    const text = out.join('\n'); editText(ta, ls, le, text, ls, ls + text.length);
  } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    const indent = (v.slice(v.lastIndexOf('\n', s - 1) + 1, s).match(/^[ \t]*/) || [''])[0];
    editText(ta, s, en, '\n' + indent, s + 1 + indent.length, s + 1 + indent.length);
  }
}

/* ====================================================================
 * Selection manager + pointer interactions (centralised, delegated)
 * ==================================================================== */
function select(id) {
  if (ui.selectedId === id) return;
  host.querySelector('.free-item.selected')?.classList.remove('selected');
  ui.selectedId = id || null;
  if (id) itemEl(id)?.classList.add('selected');
  syncFormatTools();
}
function syncFormatTools() {
  const b = blockById(ui.selectedId);
  const isText = b && (b.type === 'text' || b.type === 'tip');
  $('.format-tools')?.classList.toggle('inactive', !isText);
  if (isText) { $('#fontSize').value = String(Number(b.fontSize) || 14); $('#textColor').value = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '#d8deeb'; }
}
host.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const item = e.target.closest('.free-item');
  if (!item) { select(null); return; } // empty canvas
  const b = blockById(item.dataset.blockId); if (!b) return;
  ui.clickWasSelected = ui.selectedId === b.id;
  select(b.id);
  const rz = e.target.closest('.rz'), grip = e.target.closest('.item-grip');
  if (rz) startInteraction(e, item, b, 'resize', rz.dataset.dir, rz);
  else if (grip) startInteraction(e, item, b, 'move', null, grip);
});
$('.docscroll').addEventListener('pointerdown', e => { if (e.target === e.currentTarget) select(null); });

let I = null; // the one active drag/resize interaction
let sizeTipEl = null;
function sizeTip() { if (!sizeTipEl) { sizeTipEl = document.createElement('div'); sizeTipEl.className = 'size-tip hidden'; } return sizeTipEl; }
function startInteraction(e, item, b, kind, dir, handle) {
  if (I) endInteraction(true);
  e.preventDefault();
  try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  I = { kind, dir, item, b, handle, pid: e.pointerId, sx: e.clientX, sy: e.clientY, start: { x: b.x, y: b.y, w: b.w, h: b.h }, moved: false };
  document.body.classList.add('cc-interacting'); item.classList.add('interacting');
  handle.addEventListener('pointermove', onIMove);
  handle.addEventListener('pointerup', onIEnd); handle.addEventListener('pointercancel', onIEnd); handle.addEventListener('lostpointercapture', onIEnd);
}
function onIMove(e) {
  if (!I || e.pointerId !== I.pid) return;
  const dx = e.clientX - I.sx, dy = e.clientY - I.sy, { b, item } = I;
  if (dx || dy) I.moved = true;
  if (I.kind === 'move') { Object.assign(b, computeMove(I.start, dx, dy)); }
  else {
    Object.assign(b, computeResize(I.start, I.dir, dx, dy, { type: b.type, lockRatio: b.type === 'image' && !e.shiftKey }));
    const tip = sizeTip(); tip.textContent = `${b.w} × ${b.h} px`; tip.style.left = (b.x + b.w + 8) + 'px'; tip.style.top = (b.y + b.h + 8) + 'px'; tip.classList.remove('hidden');
  }
  applyGeom(item, b);
}
function onIEnd(e) { if (I && (!e || e.pointerId === I.pid || e.type === 'lostpointercapture')) endInteraction(true); }
function endInteraction(commit) {
  if (!I) return;
  const { handle, item, moved, pid } = I; I = null;
  handle.removeEventListener('pointermove', onIMove); handle.removeEventListener('pointerup', onIEnd); handle.removeEventListener('pointercancel', onIEnd); handle.removeEventListener('lostpointercapture', onIEnd);
  try { handle.releasePointerCapture?.(pid); } catch (err) { /* already released */ }
  document.body.classList.remove('cc-interacting'); item.classList.remove('interacting'); sizeTip().classList.add('hidden');
  const n = current();
  if (n) { updateExtent(n); if (commit && moved) changed(n); }
}

/* ---- adding elements ---- */
function addBlock(type) {
  const n = current(); if (!n) return;
  const def = defaultSize(type), pos = nextPosition(n.blocks);
  const b = { id: uid(), type, x: pos.x, y: pos.y, w: def.w, h: def.h, fontSize: 14, fontWeight: 400, italic: false };
  if (type === 'text' || type === 'tip' || type === 'code') b.content = '';
  if (type === 'code') b.language = n.programmingLanguage || 'javascript';
  if (type === 'drawing') b.strokes = [];
  if (type === 'table') b.rows = [['Column 1', 'Column 2'], ['', '']];
  if (type === 'image') b.url = '';
  n.blocks.push(b); changed(n); ui.selectedId = b.id; renderBlocks(n);
  const el = itemEl(b.id); el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (type === 'drawing') openDraw(b.id);
  else el?.querySelector('.blockcontent,.codearea,.image-url')?.focus();
}

/* ====================================================================
 * Fullscreen focus mode (in-app layout, not OS fullscreen)
 * ==================================================================== */
function setFullscreen(on) {
  if (on && !current()) return;
  const sc = $('.docscroll'), top = sc.scrollTop, left = sc.scrollLeft;
  ui.fullscreen = !!on; document.body.classList.toggle('note-fullscreen', ui.fullscreen);
  const btn = $('#fullscreenBtn'); btn.textContent = ui.fullscreen ? '⤡ Exit fullscreen' : '⤢ Fullscreen'; btn.setAttribute('aria-pressed', String(ui.fullscreen)); btn.classList.toggle('on', ui.fullscreen);
  const hint = $('#fsHint'); hint.classList.toggle('hidden', !ui.fullscreen); clearTimeout(setFullscreen.t); if (ui.fullscreen) setFullscreen.t = setTimeout(() => hint.classList.add('hidden'), 2800);
  requestAnimationFrame(() => { sc.scrollTop = top; sc.scrollLeft = left; });
  if (S.locale === 'fa') applyLocale();
}
$('#fullscreenBtn').onclick = () => setFullscreen(!ui.fullscreen);

/* ====================================================================
 * Drawing editor (modal) – unchanged behaviour
 * ==================================================================== */
function point(e) { const r = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; }
function drawAll(c, strokes, w, h) {
  c.clearRect(0, 0, w, h);
  strokes.forEach(s => {
    const p = (s.points || []).map(q => ({ x: q.x * w, y: q.y * h })); if (!p.length) return;
    c.save(); c.strokeStyle = s.color || '#7c9cff'; c.lineWidth = s.size || 3; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    if (s.tool === 'rect') c.strokeRect(p[0].x, p[0].y, p.at(-1).x - p[0].x, p.at(-1).y - p[0].y);
    else if (s.tool === 'ellipse') { c.ellipse((p[0].x + p.at(-1).x) / 2, (p[0].y + p.at(-1).y) / 2, Math.abs(p.at(-1).x - p[0].x) / 2, Math.abs(p.at(-1).y - p[0].y) / 2, 0, 0, Math.PI * 2); c.stroke(); }
    else {
      c.moveTo(p[0].x, p[0].y); p.slice(1).forEach(q => c.lineTo(q.x, q.y)); c.stroke();
      if (s.tool === 'arrow' && p.length > 1) { const a = p.at(-2), b = p.at(-1), ang = Math.atan2(b.y - a.y, b.x - a.x), head = 13 + (s.size || 3); c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - head * Math.cos(ang - .5), b.y - head * Math.sin(ang - .5)); c.moveTo(b.x, b.y); c.lineTo(b.x - head * Math.cos(ang + .5), b.y - head * Math.sin(ang + .5)); c.stroke(); }
    }
    c.restore();
  });
}
function redraw() { drawAll(ctx, D.strokes, canvas.width, canvas.height); }
function openDraw(id) { const n = current(), b = n?.blocks.find(x => x.id === id); if (!b) return; drawId = id; D.strokes = structuredClone(b.strokes || []); D.undo = []; D.current = null; $('#drawModal').classList.remove('hidden'); redraw(); }
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); D.active = true; const p = point(e); D.undo.push(structuredClone(D.strokes));
  if (D.tool === 'eraser') { D.strokes = D.strokes.filter(s => !(s.points || []).some(q => Math.hypot(q.x - p.x, q.y - p.y) < .025)); redraw(); return; }
  D.current = { tool: D.tool, color: $('#color').value, size: +$('#size').value, points: [p] };
});
canvas.addEventListener('pointermove', e => {
  if (!D.active || !D.current) return; const p = point(e); if (D.current.tool === 'pen') D.current.points.push(p); redraw();
  if (D.current.tool !== 'pen') {
    const s = D.current, a = s.points[0], w = canvas.width, h = canvas.height; ctx.save(); ctx.strokeStyle = s.color; ctx.lineWidth = s.size; ctx.setLineDash([5, 4]); ctx.beginPath();
    if (s.tool === 'rect') ctx.strokeRect(a.x * w, a.y * h, (p.x - a.x) * w, (p.y - a.y) * h);
    else if (s.tool === 'ellipse') { ctx.ellipse((a.x + p.x) * w / 2, (a.y + p.y) * h / 2, Math.abs(p.x - a.x) * w / 2, Math.abs(p.y - a.y) * h / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(p.x * w, p.y * h); ctx.stroke(); }
    ctx.restore();
  } else drawAll(ctx, [...D.strokes, D.current], canvas.width, canvas.height);
});
canvas.addEventListener('pointerup', e => {
  if (!D.active) return;
  if (D.current) { const p = point(e); if (D.current.tool !== 'pen') D.current.points.push(p); if (D.current.points.length === 1) D.current.points.push(p); D.strokes.push(D.current); }
  D.current = null; D.active = false; redraw();
});
$$('[data-tool]').forEach(b => b.onclick = () => { $$('[data-tool]').forEach(x => x.classList.toggle('chosen', x === b)); D.tool = b.dataset.tool; });
$('#undo').onclick = () => { if (D.undo.length) { D.strokes = D.undo.pop(); redraw(); } };
$('#clear').onclick = () => { D.undo.push(structuredClone(D.strokes)); D.strokes = []; redraw(); };
$('#saveDraw').onclick = () => {
  const n = current(), b = n?.blocks.find(x => x.id === drawId);
  if (b) { b.strokes = structuredClone(D.strokes); changed(n); ui.selectedId = b.id; renderBlocks(n); toast('Drawing saved'); }
  $('#drawModal').classList.add('hidden');
};
$('#closeDraw').onclick = () => $('#drawModal').classList.add('hidden');
$('#drawModal').onclick = e => { if (e.target.id === 'drawModal') $('#drawModal').classList.add('hidden'); };

/* ------------------------------------------------------------- misc UI */
function addTag() { const n = current(), tag = $('#tagInput').value.trim(); if (!n || !tag) return; n.tags = n.tags || []; if (!n.tags.some(x => x.toLowerCase() === tag.toLowerCase())) n.tags.push(tag); changed(n); render(); $('#tagModal').classList.add('hidden'); toast('Tag added'); }
$('#languageToggle').onclick = () => {
  S.locale = S.locale === 'fa' ? 'en' : 'fa'; scheduleSave(); render(); applyLocale();
  const faMode = S.locale === 'fa';
  $('#noteModalTitle').textContent = faMode ? 'ساخت جزوه جدید' : 'Create a new note';
  $('#noteModalSubtitle').textContent = faMode ? 'عنوان و زبان برنامه‌نویسی را انتخاب کن.' : 'Choose a title and programming language.';
  $('#noteTitleInput').placeholder = faMode ? 'مثلاً آرایه‌ها در جاوااسکریپت' : 'e.g. JavaScript arrays';
};
const openNewNote = () => openCreateNote(S.view.startsWith('nb:') ? S.view.slice(3) : undefined);
$('#newNote').onclick = openNewNote; $('#addNote').onclick = openNewNote; $('#firstNote').onclick = openNewNote;
$('#noteForm').addEventListener('submit', createNoteFromForm);
$('#closeNoteModal').onclick = $('#cancelNote').onclick = () => $('#noteModal').classList.add('hidden');

/* ---- text formatting: always acts on the *selected* element, by stable id ---- */
function selectedTextBlock() { const n = current(), b = blockById(ui.selectedId); return { n, b: b && (b.type === 'text' || b.type === 'tip') ? b : null }; }
function styleEl(b) { return itemEl(b.id)?.querySelector('.blockcontent'); }
$('#textColor').addEventListener('input', e => { const { n, b } = selectedTextBlock(); if (!b) return toast('Select a text element first'); b.color = e.target.value; const el = styleEl(b); if (el) el.style.color = b.color; changed(n); });
$('#fontSize').addEventListener('change', e => { const { n, b } = selectedTextBlock(); if (!b) return toast('Select a text element first'); b.fontSize = Number(e.target.value); const el = styleEl(b); if (el) el.style.fontSize = b.fontSize + 'px'; changed(n); });
function setTextStyle(prop, val) { const { n, b } = selectedTextBlock(); if (!b) return toast('Select a text element first'); b[prop] = val; const el = styleEl(b); if (el) { if (prop === 'fontWeight') el.style.fontWeight = val; if (prop === 'italic') el.style.fontStyle = val ? 'italic' : 'normal'; } changed(n); }
$('#boldText').addEventListener('click', () => { const { b } = selectedTextBlock(); setTextStyle('fontWeight', Number(b?.fontWeight) === 700 ? 400 : 700); });
$('#italicText').addEventListener('click', () => { const { b } = selectedTextBlock(); setTextStyle('italic', !b?.italic); });
$('#lightText').addEventListener('click', () => setTextStyle('fontWeight', 300));
$('#normalText').addEventListener('click', () => setTextStyle('fontWeight', 400));
// keep the element selected (and its caret) when a toolbar control is pressed
$$('.inserts button, .toolbar button').forEach(b => b.addEventListener('mousedown', e => { if (!e.target.closest('select,input')) e.preventDefault(); }));

$('#insertTip').addEventListener('click', () => addBlock('tip'));
$('#insertText').onclick = () => addBlock('text');
$('#insertCode').onclick = $('#insertCode2').onclick = () => addBlock('code');
$('#insertDraw').onclick = $('#insertDraw2').onclick = () => addBlock('drawing');
$('#insertDivider').onclick = () => addBlock('divider');
$('#insertImage').onclick = () => addBlock('image');
$('#insertTable').onclick = () => addBlock('table');
$('#addBlock').onclick = () => addBlock('text');
$('#title').oninput = () => { const n = current(); if (n) { n.title = $('#title').value; changed(n); renderTabs(); } };
$('#pin').onclick = () => { const n = current(); if (n) { n.pinned = !n.pinned; changed(n); render(); toast(n.pinned ? 'Note pinned' : 'Note unpinned'); } };
$('#delete').onclick = () => {
  const n = current(); if (!n) return; if (!confirm(`Delete "${n.title || 'Untitled note'}"?`)) return;
  const id = n.id; S.notes = S.notes.filter(x => x.id !== id); S.openTabs = (S.openTabs || []).filter(x => x !== id); S.active = S.openTabs.at(-1) || S.notes[0]?.id || null;
  save(); render(); toast('Note deleted');
};
$('#search').oninput = renderList; $('#focusSearch').onclick = () => $('#search').focus();
$('#sort').onclick = () => { S.sort = S.sort === 'recent' ? 'title' : 'recent'; $('#sort').textContent = S.sort === 'recent' ? 'Recently edited⌄' : 'Title A–Z⌄'; renderList(); };
$$('.nav[data-view]').forEach(b => b.onclick = () => { S.view = b.dataset.view; S.active = null; $$('.nav[data-view]').forEach(x => x.classList.toggle('active', x === b)); render(); });
$('#addNotebook').onclick = () => {
  const name = prompt('Name your notebook:'); if (!name?.trim()) return;
  if (S.notebooks.some(n => n.name.toLowerCase() === name.trim().toLowerCase())) return toast('Notebook already exists');
  S.notebooks.push({ id: uid(), name: name.trim(), color: ['#7c9cff', '#c58cff', '#63d6bb', '#eab879'][S.notebooks.length % 4] }); S.view = 'nb:' + S.notebooks.at(-1).id; S.active = null; save(); render();
};
$('#tag').onclick = () => { $('#tagInput').value = ''; $('#tagModal').classList.remove('hidden'); $('#tagInput').focus(); };
$('#closeTag').onclick = $('#cancelTag').onclick = () => $('#tagModal').classList.add('hidden');
$('#saveTag').onclick = addTag; $('#tagInput').onkeydown = e => { if (e.key === 'Enter') addTag(); };
$('#export').onclick = async () => { try { if (await window.codeCanvas.exportBackup(payload())) toast('Backup exported'); } catch (e) { toast('Export failed: ' + e.message); } };
$('#import').onclick = async () => {
  try {
    const d = await window.codeCanvas.importBackup(); if (!d) return;
    if (!confirm('Import will replace current notebook data. Continue?')) return;
    applyData(migrate(d)); S.active = null; S.view = 'all'; ui.readOnly = false; $('#loadError')?.remove();
    await save(); render(); toast('Backup imported');
  } catch (e) { toast('Import failed: ' + e.message); }
};
$('#exportMd').onclick = () => {
  const n = current(); if (!n) return;
  const out = [`# ${n.title || 'Untitled note'}`, '', `Notebook: ${nbname(n.notebookId)}`, ''];
  n.blocks.forEach(b => {
    if (b.type === 'text' || b.type === 'tip') out.push(b.content || '', '');
    else if (b.type === 'code') out.push('```' + (b.language || ''), b.content || '', '```', '');
    else if (b.type === 'divider') out.push('---', '');
    else if (b.type === 'image') out.push(b.url ? `![${b.alt || 'Image'}](${b.url})` : '[Empty image block]', '');
    else if (b.type === 'table' && b.rows?.length) out.push('| ' + b.rows[0].join(' | ') + ' |', '| ' + b.rows[0].map(() => '---').join(' | ') + ' |', ...b.rows.slice(1).map(r => '| ' + r.join(' | ') + ' |'), '');
    else out.push('> [Drawing canvas — sketch retained in CodeCanvas backup]', '');
  });
  const blob = new Blob([out.join('\n')], { type: 'text/markdown;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = (n.title || 'note').replace(/[<>:"/\\|?*]+/g, '-') + '.md'; a.click(); URL.revokeObjectURL(url); toast('Markdown exported');
};
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); openNewNote(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#search').focus(); $('#search').select(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); toast('Saved'); }
  if (e.key === 'Escape') {
    const modals = ['#drawModal', '#tagModal', '#noteModal'].map(s => $(s)).filter(m => !m.classList.contains('hidden'));
    if (modals.length) modals.forEach(m => m.classList.add('hidden'));
    else if (I) endInteraction(true);
    else if (ui.fullscreen) setFullscreen(false);
    else if (ui.selectedId && !e.target.closest?.('textarea,[contenteditable],input,select')) select(null);
  }
});

function installResizers() {
  const sidebar = $('.sidebar'), layout = $('.layout'), list = $('.listpanel'), sideHandle = $('#sidebarResizer'), listHandle = $('#listResizer');
  function drag(handle, move) {
    handle.addEventListener('pointerdown', e => {
      e.preventDefault(); handle.setPointerCapture(e.pointerId); document.body.classList.add('resizing');
      const onMove = ev => move(ev);
      const onUp = () => { document.body.classList.remove('resizing'); handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); handle.removeEventListener('pointercancel', onUp); };
      handle.addEventListener('pointermove', onMove); handle.addEventListener('pointerup', onUp); handle.addEventListener('pointercancel', onUp);
    });
  }
  const store = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* storage unavailable */ } };
  drag(sideHandle, e => { const w = Math.max(170, Math.min(360, e.clientX)); sidebar.style.width = w + 'px'; store('cc-sidebar-width', w); });
  drag(listHandle, e => { const r = layout.getBoundingClientRect(); const w = Math.max(200, Math.min(Math.min(560, r.width - 300), e.clientX - r.left)); list.style.width = w + 'px'; store('cc-list-width', w); });
  let sw = 0, lw = 0; try { sw = Number(localStorage.getItem('cc-sidebar-width')); lw = Number(localStorage.getItem('cc-list-width')); } catch (e) { /* ignore */ }
  if (sw >= 170 && sw <= 360) sidebar.style.width = sw + 'px';
  if (lw >= 200 && lw <= 560) list.style.width = lw + 'px';
}

boot();
