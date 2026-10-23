# Changelog

## 1.1.0 — Free-canvas update (data schema v3)

### Bugs fixed
- **Saved notes were never loaded and could be overwritten on close.** `src/renderer/app.js` assigned `onclick` handlers to `#insertImage` and `#insertTable`, which did not exist in `index.html`. The resulting `TypeError` aborted the script, so the startup `init()` at the end of the file never ran: no notes were loaded, and the `beforeunload` save wrote an empty notebook over the stored one. Fixed by adding the two buttons and rewriting start-up.
- **Everything wired after that line was dead** (new-note shortcut `Ctrl+N`, `Ctrl+K`, `Ctrl+S`, title editing, pin, delete, search, notebook/tag/import/export buttons, text-colour control). Fixed by the same change.
- **Load failure silently replaced user data with sample notes** and autosave would then persist them. Now a failed load starts read-only with a visible banner; unreadable files are copied aside; `.bak` recovery is attempted.
- Remote `https://` images could never display (CSP `img-src` allowed only `'self' data:`). `https:` added; only `https://` and `data:image/` URLs are accepted.
- Text-colour handler was registered twice and the second one picked a block by DOM index; formatting now targets the selected element by id.
- Elements could not be made wider than the canvas (`max-width: calc(100% - 24px)`) and far-away elements were unreachable; the canvas now grows with its content.
- Code editor hardening: Enter/Tab are ignored during IME composition (Persian/CJK input), edits use the native undo stack, native textarea resize grip removed (it competed with element resizing), editor fills the element and scrolls with its line numbers.
- Persian (RTL) mode broke the canvas coordinate system; the canvas is now always LTR while text uses `dir="auto"`.
- Locale choice was not persisted; it is now.
- `applyLocale` could translate user content that equalled a UI string; user content is now skipped.
- Drawing placeholder text stayed visible on top of existing strokes.

### Features
- Every element type is resizable with 8 handles, minimum sizes, anchored opposite edge, live `w × h px` indicator, pointer capture (no stuck drags).
- Drawing previews scale uniformly (letterboxed) so strokes are never distorted; stroke data is untouched by resizing.
- Images auto-fit to their natural aspect ratio on first load and keep it on corner resize.
- Selection model: one selected element; grip, handles and contextual bar shown only for it; click empty canvas to deselect.
- Fullscreen focus mode for the open note (+ `Esc`).
- Persisted geometry for all elements (`x, y, w, h`), canvas extent computed from content.
- Flush-on-close handshake, serialised debounced saves, `.bak` rotation, atomic writes.
- Image and Table insert buttons (blocks existed, buttons did not).
- Unit tests, browser tests, `npm run check`.

### Behaviour changes to be aware of
- Text/tip elements store plain text (`contenteditable="plaintext-only"`; pasting is plain). Legacy `html` is kept in the file until that element is edited, then removed so stale markup cannot reappear.
- Selected-drawing click opens the editor (first click selects).
- Divider no longer deletes on click; select it and use **Delete**.
- `↑`/`↓` are now layer order (bring forward / send backward).
- Deleting a non-empty element asks for confirmation.
- CSP now allows `https:` images (loading a remote image makes a network request).
