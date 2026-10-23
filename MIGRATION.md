# Migration notes (schema v2 → v3)

Nothing needs to be done by hand. On first start of 1.1.0:

1. If `notebook.json` has `version < 3`, `storage.js` copies it **once** to `notebook.pre-v3.json` (never overwritten) before anything is rewritten.
2. The renderer runs `migrate()` (`src/renderer/core.js`), which:
   - adds `x, y, w, h` to every element that lacks them (defaults per type; text/tip height is measured from content on first render),
   - repairs duplicate or missing ids, fills `language`/`strokes`/`rows`/`url` defaults,
   - drops open-tab ids that no longer exist,
   - keeps every other field, including unknown element types and legacy `html`,
   - writes `version: 3` and the UI `locale`.
3. Backup files (`Import backup`) of any older version go through the same `migrate()`.

The userData folder is `%APPDATA%\codecanvas` on Windows. To roll back, quit the app and copy `notebook.pre-v3.json` over `notebook.json` (1.0.0 ignores the extra fields).
