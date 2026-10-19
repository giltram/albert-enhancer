# Albert Enhancer

Albert Enhancer is a Chrome extension for understanding NYU courses, exploring feasible schedules, preparing backups, and supporting registration decisions. It never enrolls, drops, swaps, waitlists, or submits registration actions.

## Development

```bash
npm install
npm run check
npm run dev
```

The production unpacked extension is written to `.output/chrome-mv3/` by `npm run build`.

In Settings → Default semester tab, enter a label such as `Spring 2027` to select that shopping-cart semester whenever Albert opens. Manual tab changes are preserved afterward. Leave the setting blank to disable it; unavailable semesters leave the current tab unchanged.

## Architecture

Start with the [project architecture and diagrams](docs/architecture.md) for runtime boundaries, module dependencies, data flows, contracts, and known integration gaps. The [core](src/core/README.md) and [Albert adapter](src/adapters/albert/README.md) READMEs explain their local interfaces and invariants.

- `src/core/` contains platform-independent course, solver, ranking, registration, and curriculum logic.
- `src/features/` contains configurable campus, abbreviation, highlighting, and settings behavior.
- `src/adapters/albert/` is the only layer that reads or changes Albert DOM.
- `src/adapters/nyu-course-data/` owns the course-provider boundary. NYU does not expose a documented stable JSON API, so its transport is injected and strictly decoded.
- `src/storage/` owns extension-local persistence.
- `src/entrypoints/` contains WXT background, content (isolated and MAIN worlds), popup, settings, Schedule Lab, and Degree Planner entrypoints.

The [schedule architecture](docs/SCHEDULE_ARCHITECTURE.md) defines how raw linked course components become atomic enrollment options without adding lecture/recitation logic to the solver.

## Privacy and safety

- Data is stored locally with `chrome.storage.local` through WXT storage.
- No academic data is uploaded by default.
- No remote code is loaded.
- Host access is limited to NYU HTTPS pages.
- Fixture capture copies only parser-relevant course/campus DOM and redacts NetIDs, student IDs, email addresses, GPA, and grade-shaped labels.
- Registration status detection is display-only and resolves ambiguity to `unknown`.

## Curriculum provenance

The initial NYU Shanghai CS and Economics declarations target the 2026–27 NYU Bulletin. Ambiguous advising and double-count rules are marked for manual verification instead of being guessed. A student's matriculation-year bulletin remains authoritative.
