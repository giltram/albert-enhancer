# Manual checkpoint 1 — real Albert integration

Run only after `npm run check` passes.

1. Build with `npm run build` and load `.output/chrome-mv3/` as an unpacked extension.
2. Open Albert Course Search and several real course/section pages.
3. Confirm campus auto-selection uses the selected exact campus and preserves the current value when absent.
4. Confirm built-in and one custom abbreviation.
5. Check time, location, instructor, prerequisite, fee/rule (when provided), degree classification, and conflict priority.
6. Add a section to Schedule Lab and verify its course, section, class number, and meetings.
7. Navigate among several Albert pages and watch for duplicates or noticeable slowdown.

Report only incorrect fields, visual priority problems, duplicate/missing UI, slowdown, and unintuitive steps. Capture a sanitized fixture for each parser defect so it becomes a regression test.
