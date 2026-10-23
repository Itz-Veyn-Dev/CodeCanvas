# CodeCanvas

**Your programming notes, drawn your way.**

A dark, local-first Windows notebook concept for programming classes. Keep notes, code snippets, and sketches together in one workspace.

## Features
- Dark developer-focused UI
- Notes, notebooks, search, pinning and tags
- Free canvas: text, code, drawing, tip/note, divider, image and table elements positioned anywhere, overlapping allowed
- Every element is resizable (8 handles, live `w × h px` indicator, per-type minimum sizes); move and resize controls and the element toolbar appear only for the selected element
- Per-note fullscreen focus mode (in-app, not OS fullscreen) – button in the note toolbar, `Esc` to leave
- Code blocks with language selector, Tab / Shift+Tab indentation, auto-indent, line numbers and copy button
- Drawing canvas: pen, line, arrow, rectangle, ellipse, eraser, color, size, undo and clear
- Autosaving local JSON storage
- Import/export JSON backup
- Export notes as Markdown
- Keyboard shortcuts: `Ctrl+N`, `Ctrl+K`, `Ctrl+S`
- Electron security defaults: `contextIsolation` enabled, `nodeIntegration` disabled

## Run
Requirements: Node.js (the version your Electron 38 install requires) and npm. Windows is the primary target; the app code itself is cross-platform.

```bash
npm install
npm start
```

Build a Windows installer:

```bash
npm run dist
```

The installer is generated in `release/`.

## Privacy
Notes are stored locally in Electron's application data directory. There is no account or server. Local notes are not encrypted; do not store passwords or API keys in them.

## Fonts
The UI prefers bundled Vazirmatn WOFF2 files in `assets/`, then falls back to system fonts. Code uses JetBrains Mono/Cascadia Code/Consolas fallbacks. Bundle licensed font files for offline font availability.

## Status
Early functional prototype. PDF export and a richer document editor can be added in future versions. Test backups before storing important notes.


### Recent fixes
- Replaced the browser prompt with a dedicated Create Note dialog and language dropdown.
- Added draggable sidebar and note-list splitters; widths are remembered locally.


## Pro features in this build
- Open-note tabs with close/switch controls; tab list is saved in local notebook data.
- Text, code, drawing, image-URL, divider and editable table blocks.
- Code editor line numbers, Tab indentation, Enter auto-indent, and synchronized scrolling.
- Per-text-block color control in the insert toolbar.
- Full JSON backup includes notes, notebooks, drawing data, and open tabs; Markdown export supports images and tables.


## Using the canvas (v3)
| Action | How |
|---|---|
| Select an element | Click it. Only one element is selected at a time. |
| Deselect | Click empty canvas, or press `Esc` (when not typing). |
| Move | Drag the grip (`⠿ TYPE`) on the floating bar above the selected element. Text areas, code editors and tables are never draggable themselves, so selecting/typing is unaffected. |
| Resize | Drag any corner or edge handle. Images keep their aspect ratio on corners (hold `Shift` for free resize). |
| Edit a drawing | Select it, then click it again (or use **Edit drawing** on its bar). |
| Layer order | `↑` / `↓` on the bar bring forward / send backward. |
| Fullscreen note | **⤢ Fullscreen** in the note toolbar; `Esc` or the same button exits. |

Code editor keys: `Tab` / `Shift+Tab` indent / outdent (single line or selection), `Enter` keeps indentation, `Ctrl+Z` undo works across all of these.

## Development
```bash
npm run check   # node --check on every JS file + Node unit tests (migration, resize math, storage)
npm test        # unit tests only
python3 test/e2e/run.py   # browser-level tests of the UI (needs: pip install playwright && playwright install chromium)
```
The browser tests drive the real renderer in Chromium with a mocked `window.codeCanvas`; they do not start Electron. See `TESTING.md` for exactly what was and was not verified. Data-format changes are described in `MIGRATION.md`, and all changes in `CHANGELOG.md`.

## Data safety
- Saves are atomic (temp file + rename) and the previous good file is kept as `notebook.json.bak`.
- If `notebook.json` cannot be read, a copy is kept as `notebook.corrupt-<time>.json`, the `.bak` is tried, and if nothing is readable the app starts **read-only** (autosave disabled) instead of overwriting your data.
- Pending edits are flushed when the window closes (main ↔ renderer handshake, 4 s safety timeout).
