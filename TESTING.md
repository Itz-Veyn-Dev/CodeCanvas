# Testing report (v1.1.0)

## Environment
Linux sandbox, Node 22, Chromium via Playwright. **No network, Electron not installed, so the app was never launched in Electron.**

## Passed
| Check | Result |
|---|---|
| `node --check` on all JS files (`npm run check`) | pass |
| Node unit tests: migration (v2→v3, garbage input, duplicate ids, idempotence), resize math (all 8 directions, min sizes for every type, anchoring, aspect lock, MAX_DIM, no negative origin), storage (round-trip, `.bak`, corrupt-file recovery, corrupt + no backup ⇒ error not empty, invalid payload refused, atomic write, pre-v3 copy) | 22/22 pass |
| Browser tests (`python3 test/e2e/run.py`, real renderer in Chromium, mocked `window.codeCanvas`) | 112/112 pass |

Browser tests cover: inserting all 7 element types; selection/deselection (no handles or bars when nothing selected, one selection only, toolbar clicks keep selection); resizing every element type (growth, minimum clamp, fixed anchor edge, DOM size = stored size, image aspect lock, edge handles, other elements untouched, size indicator, no stuck interaction); moving only via the grip, no negative coordinates; code editor typing, Enter auto-indent, Tab/Shift+Tab, copy/cut/paste/undo, navigation, scrolling and gutter, typing after resize, Persian text entry; mouse text selection in the editor does not move the element; text element editing/format; fullscreen enter/exit/Esc, layout and scroll preserved, no OS fullscreen; drawing stays undistorted and strokes unchanged after resizing; table/image/divider specifics; z-order and delete; debounced autosave and flush-on-close handshake (incl. failed-save prompt); simulated restart restoring ids, geometry, content, drawing and formatting; legacy v2 migration; corrupt-load ⇒ read-only with no writes; Persian/RTL mode; canvas scroll extent.

The same suite was used to confirm the original defects (script abort on missing `#insertImage`, notes not loaded, empty notebook written on close).

## NOT performed (could not be, or only partly)
- `npm install`, `npm start`: not run (no network/Electron). **The app was not runtime-tested inside Electron.**
- Windows installer (`npm run dist`, NSIS): not built. `package.json` `build.files` was updated to include `storage.js`; no installer was produced or verified.
- Main-process close handshake (`main.js`, `preload.js`): reviewed only. The storage module it uses is unit-tested; the renderer side of the handshake is tested against a mock.
- "Restart" test is simulated: a second page is loaded from the last saved payload, not a real process restart through the real disk IPC.
- Real IME / Persian keyboard layouts (only programmatic text insertion tested), touch and stylus, HiDPI scaling, macOS/Linux, loading a real remote `https://` image (offline; `data:` image tested).
- Original report "typing in some code blocks fails": **not reproduced** in headless Chromium on the original code (basic typing worked there). Fixed everything found on that path (see CHANGELOG), but the exact cause on your machine is unconfirmed; please report if it persists.
- Bundled Vazirmatn fonts (`assets/`) are missing from the zip; UI falls back to system fonts (pre-existing).
