# In-app browser checks

Build with `npm run build`, then serve the repository with `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --strictPort`.

Open `http://127.0.0.1:5178/tests/browser/semester-bridge.html` in the ChatGPT in-app browser. This uses the sanitized semester fixture, the built MAIN-world script, and the source term adapter. It checks automatic selection, retry after bridge startup, preserving manual choices, reopening, and blank/unavailable preferences without launching Chrome or accessing extension storage.

The fixture mirrors Albert's `IS.SSS.ShopCartTermSelect`, `makeTablesResponsivePostLoad`, and `DisplayToggleButton` call sequence, verified on the live page on 2026-10-19. This harness checks DOM integration; it does not install the extension or verify Chrome's isolated-world CSP and storage integration. Those remain covered by `tests/e2e/extension.spec.ts` when running a local extension browser is authorized.
