/* CodeCanvas core: pure, DOM-free helpers.
 * Loaded as a classic script in the renderer (exposes window.CC) and
 * required from Node for unit tests (module.exports). */
(function (root) {
  'use strict';

  const SCHEMA_VERSION = 3;
  const KNOWN_TYPES = ['text', 'tip', 'code', 'drawing', 'image', 'table', 'divider'];

  // Default and minimum sizes per element type (px).
  const DEFAULT_SIZE = {
    text: { w: 420, h: 140 },
    tip: { w: 420, h: 120 },
    code: { w: 620, h: 240 },
    drawing: { w: 480, h: 280 },
    image: { w: 360, h: 240 },
    table: { w: 460, h: 170 },
    divider: { w: 520, h: 20 },
    _other: { w: 320, h: 100 }
  };
  const MIN_SIZE = {
    text: { w: 120, h: 56 },
    tip: { w: 140, h: 64 },
    code: { w: 260, h: 140 },
    drawing: { w: 220, h: 140 },
    image: { w: 80, h: 60 },
    table: { w: 220, h: 90 },
    divider: { w: 60, h: 16 },
    _other: { w: 100, h: 50 }
  };
  const MAX_DIM = 5000;

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const defaultSize = type => DEFAULT_SIZE[type] || DEFAULT_SIZE._other;
  const minSize = type => MIN_SIZE[type] || MIN_SIZE._other;

  /** Bring a block's geometry into a valid state without touching content. */
  function normalizeGeometry(b, index) {
    const min = minSize(b.type), def = defaultSize(b.type);
    b.x = Math.max(0, num(b.x, 30));
    b.y = Math.max(0, num(b.y, 25 + index * 150));
    // w may legitimately be present in v2 data; h is new in v3 (null => auto-fit on first render for text).
    b.w = clamp(num(b.w, def.w), min.w, MAX_DIM);
    if (b.h == null || !Number.isFinite(b.h)) {
      if (b.type === 'text' || b.type === 'tip') b.h = null; // measured by the renderer
      else b.h = def.h;
    } else b.h = clamp(b.h, min.h, MAX_DIM);
    return b;
  }

  /**
   * Migrate any saved data (v1/v2/v3, or backup files) to the current schema.
   * Never throws on odd input and never drops user content: unknown block
   * types and unknown fields are preserved as-is.
   */
  function migrate(input) {
    const src = input && typeof input === 'object' ? input : {};
    const out = {
      version: SCHEMA_VERSION,
      notes: [],
      notebooks: [],
      openTabs: Array.isArray(src.openTabs) ? src.openTabs.filter(x => typeof x === 'string') : [],
      locale: src.locale === 'fa' ? 'fa' : 'en'
    };
    const seenNotes = new Set();
    (Array.isArray(src.notes) ? src.notes : []).forEach(raw => {
      if (!raw || typeof raw !== 'object') return;
      const n = Object.assign({}, raw);
      if (typeof n.id !== 'string' || !n.id || seenNotes.has(n.id)) n.id = uid() + seenNotes.size;
      seenNotes.add(n.id);
      n.title = typeof n.title === 'string' ? n.title : '';
      n.tags = Array.isArray(n.tags) ? n.tags.filter(t => typeof t === 'string') : [];
      n.pinned = !!n.pinned;
      n.createdAt = n.createdAt || new Date().toISOString();
      n.updatedAt = n.updatedAt || n.createdAt;
      const seenBlocks = new Set();
      n.blocks = (Array.isArray(n.blocks) ? n.blocks : []).filter(b => b && typeof b === 'object').map((rawB, i) => {
        const b = Object.assign({}, rawB);
        if (typeof b.id !== 'string' || !b.id || seenBlocks.has(b.id)) b.id = uid() + i;
        seenBlocks.add(b.id);
        if (typeof b.type !== 'string') b.type = 'text';
        if (b.type === 'code') { b.language = b.language || n.programmingLanguage || 'javascript'; b.content = typeof b.content === 'string' ? b.content : ''; }
        if (b.type === 'text' || b.type === 'tip') b.content = typeof b.content === 'string' ? b.content : '';
        if (b.type === 'drawing' && !Array.isArray(b.strokes)) b.strokes = [];
        if (b.type === 'table' && (!Array.isArray(b.rows) || !b.rows.length)) b.rows = [['Column 1', 'Column 2'], ['', '']];
        if (b.type === 'image') b.url = typeof b.url === 'string' ? b.url : '';
        return normalizeGeometry(b, i);
      });
      out.notes.push(n);
    });
    const seenNb = new Set();
    (Array.isArray(src.notebooks) ? src.notebooks : []).forEach(nb => {
      if (!nb || typeof nb.id !== 'string' || seenNb.has(nb.id)) return;
      seenNb.add(nb.id);
      out.notebooks.push(Object.assign({}, nb, { name: String(nb.name || 'Notebook'), color: nb.color || '#7c9cff' }));
    });
    out.openTabs = out.openTabs.filter(id => seenNotes.has(id));
    return out;
  }

  /**
   * Compute the new rectangle for a resize drag.
   * start: {x,y,w,h}; dir: n|s|e|w|ne|nw|se|sw; dx,dy: pointer delta in px.
   * opts: {type, lockRatio:boolean}. Result is clamped to min size, canvas origin and MAX_DIM.
   */
  function computeResize(start, dir, dx, dy, opts) {
    opts = opts || {};
    const min = minSize(opts.type);
    const hasE = dir.includes('e'), hasW = dir.includes('w'), hasN = dir.includes('n'), hasS = dir.includes('s');
    let w = start.w, h = start.h;
    if (hasE) w = start.w + dx;
    if (hasW) w = start.w - dx;
    if (hasS) h = start.h + dy;
    if (hasN) h = start.h - dy;

    const isCorner = (hasE || hasW) && (hasN || hasS);
    if (opts.lockRatio && isCorner && start.h > 0) {
      const ratio = start.w / start.h;
      // follow whichever axis moved proportionally further
      if (Math.abs(w - start.w) / start.w >= Math.abs(h - start.h) / start.h) h = w / ratio;
      else w = h * ratio;
    }

    // Anchor-aware clamping: the edge opposite to the dragged one stays fixed.
    const right = start.x + start.w, bottom = start.y + start.h;
    let lo = { w: min.w, h: min.h };
    if (opts.lockRatio && isCorner) {
      const ratio = start.w / start.h;
      lo = { w: Math.max(min.w, min.h * ratio), h: Math.max(min.h, min.w / ratio) };
    }
    w = clamp(w, lo.w, MAX_DIM);
    h = clamp(h, lo.h, MAX_DIM);
    let x = hasW ? right - w : start.x;
    let y = hasN ? bottom - h : start.y;
    // keep top-left inside the canvas (x,y >= 0) by shrinking from the dragged side
    if (x < 0) { w += x; if (opts.lockRatio && isCorner) h = w / (start.w / start.h); x = 0; }
    if (y < 0) { h += y; if (opts.lockRatio && isCorner) w = h * (start.w / start.h); y = 0; }
    if (hasN && opts.lockRatio && isCorner) y = bottom - h;
    if (hasW && opts.lockRatio && isCorner) x = right - w;
    w = Math.max(w, min.w); h = Math.max(h, min.h);
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }

  /** New position for a move drag; never negative. */
  function computeMove(start, dx, dy) {
    return { x: Math.max(0, Math.round(start.x + dx)), y: Math.max(0, Math.round(start.y + dy)) };
  }

  /** Canvas extent so every element is reachable by scrolling. */
  function contentExtent(blocks) {
    let w = 0, h = 0;
    (blocks || []).forEach(b => {
      w = Math.max(w, (b.x || 0) + (b.w || 0));
      h = Math.max(h, (b.y || 0) + (b.h || 0));
    });
    return { w, h };
  }

  /** Free spot for a newly inserted element: below the lowest existing one. */
  function nextPosition(blocks) {
    if (!blocks || !blocks.length) return { x: 30, y: 25 };
    const bottom = Math.max.apply(null, blocks.map(b => (b.y || 0) + (b.h || 140)));
    return { x: 30, y: bottom + 28 };
  }

  /** Letterbox a logical (lw x lh) drawing into a (cw x ch) box without distortion. */
  function containFit(lw, lh, cw, ch) {
    const s = Math.min(cw / lw, ch / lh);
    return { scale: s, w: lw * s, h: lh * s, ox: (cw - lw * s) / 2, oy: (ch - lh * s) / 2 };
  }

  const api = {
    SCHEMA_VERSION, KNOWN_TYPES, DEFAULT_SIZE, MIN_SIZE, MAX_DIM,
    uid, esc, clamp, defaultSize, minSize, normalizeGeometry, migrate,
    computeResize, computeMove, contentExtent, nextPosition, containFit
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CC = api;
})(typeof window !== 'undefined' ? window : globalThis);
