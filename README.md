# Albert Enhancer

A Chrome extension that makes NYU Albert a little easier to use: fewer clicks, clearer course information, and a few tools to help with planning.

## What it does so far

### Little things that save clicks

- **Auto-select your semester tab**: Enter an Albert semester label, such as `Spring 2027`, in Settings → Default semester tab. The extension selects it when you open the shopping cart, and you can still switch tabs afterward. Leave it blank to turn this off; unavailable semesters leave the current tab alone.
- **Auto-select your School**: Set a default School for Course Search. Open the logged-in Course Search once so the extension can pick up the actual School options, then choose one in Settings.
- **Course abbreviation recognition**: Search with shortcuts like `ICS`, `DL`, `WAI`, or `POH`, and they expand into full course names, regardless of capitalization. Abbreviations in course information also get their full names added. You can add, edit, or disable your own shortcuts.
- **Press Enter to search**: Hit Enter in the course title / instructor keyword field or the course description field to search. Abbreviations are expanded along the way.
- **Copy Class Number**: Copy it right next to the course information, without hunting for the number again.
- **Session timeout helper**: Optionally click OK automatically when Albert warns that your session is about to expire. Off by default.

### Course details, schedules, and degree planning

- **Course highlights**: Pull out meeting times, locations, instructors, prerequisites, extra fees, and special rules. Also show recognized major / Core categories and time conflicts with the current schedule plan. Each kind of highlight can be toggled separately.
- **Schedule Lab**: Click `Add to Schedule Lab` in Albert to collect courses, browse candidate schedules and a weekly calendar, mark courses as required, lock or exclude sections, and rank plans with preferences like avoiding classes before 10 AM or on Fridays. You can also simulate getting a section, finding it full, or being waitlisted, explore alternatives, and undo changes.
- **Degree Planner (in development)**: An early planning board for manually adding courses and moving them between Taken / In Progress / Planned. The CS and Economics curriculum data has not been entered yet, so degree requirement coverage and prerequisite checks are not ready to rely on.
- **Settings and local data**: Includes a master switch, custom abbreviations, and highlight controls. Data stays in your browser, with options to export it or clear it all.

**Schedule Lab is still under development and very rough around the edges.** The features above are an early version, and linked lecture / recitation / lab combinations are not fully connected yet. Double-check imported courses and generated schedules, and treat it as an experiment for now. Simulated registration outcomes are local records only; the extension never enrolls, drops, swaps, or submits waitlist requests for you.

**Degree Planner is also still under development.** The interface is a starting point; CS and Economics data still needs to be added before it can provide useful degree progress checks.

## Development

```bash
npm install
npm run check
npm run dev
```

The production unpacked extension is written to `.output/chrome-mv3/` by `npm run build`.

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

CS and Economics curriculum data is still pending. Any existing rule scaffolding is preliminary and should not be treated as a complete curriculum dataset. Your matriculation-year NYU Bulletin remains the reference for degree requirements, with ambiguous advising and double-count rules to be confirmed with an advisor.
