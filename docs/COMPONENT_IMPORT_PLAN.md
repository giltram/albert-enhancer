# Linked component import

## Scope and observed source

Verified in the independent browser against Spring 2027 NYU Shanghai search:
- CSCI-SHU 360: lecture 001 / class 18019, recitation 002 / 18020; lecture 003 / 18021, recitation 004 / 18022.
- CSCI-SHU 11: lecture 001 / 18025, laboratories 002–007 / 18026–18031. Lab instructors differ from the lecture.
- Logged search presents ordered `SELECT_CLASS_row` entries inside a per-term `SELECT_CLASS` scrollarea. Each entry explicitly reports `Component:`. Linked recitations/labs follow their primary lecture until the next primary section. No association ID is exposed in these inspected rows.

## Implementation

1. Normalize this layout into a primary section and typed auxiliary choice groups, scoped to its course and term. Never classify by index, instructor, matching times, or the absence of Select Class.
2. One child per required type: auto-add. Multiple: accessible multi-select dialog, initially keeping all options, with time/instructor/location and guidance to eliminate only impossible choices. Require at least one per type.
3. Use the existing enrollment-option builder for complete bundles, requiring exactly one of each present auxiliary type. Store alternatives as separate options, never as simultaneous meetings.
4. Persist a single merged update; replace obsolete standalone imports for the selected group while preserving other lecture bundles. Hide linked auxiliary Add buttons.
5. Remove the builder's reverse dependency on schedule by putting the meeting-overlap primitive alongside meeting types; retain the schedule export for compatibility.
6. Verify both observed courses in isolated extension browsers, plus both auxiliary types, cancellation, missing metadata, filtered results, legacy standalone upgrades, repeat/add races, and solver cardinality. Update architecture docs.

## Source limits

The ordered-block convention is an Albert adapter assumption, not a universal catalog rule. Component-affecting filters can hide part of a block, so import must ask the user to clear them first. Unrecognized/orphan auxiliary rows must never become standalone enrollment options. A different layout or explicit future linkage requires updating this adapter and its fixtures, not the solver.

## Completed verification

- Native Related Sections checked in the independent in-app browser: Machine Learning lecture 003 requires only recitation 004 / 18022; programming lecture 001 requires one of labs 002–007 / 18026–18031. No cart submission or enrollment was performed.
- Production extension built successfully. ESLint and TypeScript checks passed; all 94 unit tests passed.
- All 9 existing browser tests and 10 linked-component browser scenarios passed in isolated Chromium extension profiles (17 together, then all 10 component scenarios after adding the last two cases).
- Browser checks include one/two/all six retained labs, automatic own recitation for both ML lectures, combined REC+LAB requirements, cancellation/Escape/focus, incomplete filters, changed search results, rapid imports, and internally conflicting components. Screenshots were visually inspected.
- TypeScript-resolved import audit: 63 source files and 10 module nodes, no file or module cycles. `core/courses` has no dependencies outside courses.
- Remaining limits: the documented Albert ordered-block source convention; no cross-document storage transaction. No new dependency or storage schema was introduced.
