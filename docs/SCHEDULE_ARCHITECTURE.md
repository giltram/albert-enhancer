# Schedule architecture

See the [project architecture](architecture.md) for runtime boundaries and module dependencies, and the [core README](../src/core/README.md) for public interfaces and invariants.

Albert Enhancer keeps catalog normalization separate from timetable search:

```text
Raw Sections
    ↓
EnrollmentOption Builder
    ↓
valid EnrollmentOption[]
    ↓
Schedule Solver
    ↓
ScheduleCandidate[]
```

This is the implemented builder/solver contract, not yet the end-to-end Albert import path. `adapters/albert/enhancePage.ts` currently wraps each imported section as a single-section EnrollmentOption and writes it directly to planner storage; it does not call `buildEnrollmentOptions` or produce `RawCourseOffering`. The course-data Provider is also not connected to an entrypoint and currently decodes already-formed options rather than calling the builder. Schedule Lab can consume multi-component options when they are present in storage, as exercised by the E2E fixture, but this does not establish valid linkage for sections imported individually from Albert.

## Terms

- **Section** — one real catalog/Albert component, such as `LEC001`, `REC011`, or `LAB003`.
- **Component** — the role a section plays: lecture, recitation, lab, seminar, workshop, discussion, or other.
- **EnrollmentOption** — one complete legal way to enroll in one course, such as `LEC001 + REC011`. It is the solver's atomic choice.
- **Schedule** — a complete timetable containing at most one EnrollmentOption for each selected course.

`buildEnrollmentOptions` consumes a normalized `RawCourseOffering`. Component requirements describe cardinality; directed compatibility rules describe legal linkage. It merges component meetings, rejects internally conflicting bundles, and creates deterministic IDs from sorted section IDs.

Compatibility rules are exhaustive for the component types they link. A multi-component offering whose compatibility is `unknown` produces no options, because assuming a Cartesian product could create invalid enrollment combinations. A provider must explicitly report `known` compatibility before an unrestricted combination is allowed.

Component requirements/preferences and component registration outcomes filter or rank generated options. They do not replace exact EnrollmentOption lock/exclude state: requiring `LEC001` keeps every legal option containing that lecture, while locking `LEC001 + REC012` selects that exact bundle.

Planner schema v2 adds optional component display metadata and section-level registration state. The migration preserves legacy option IDs and accepts older single-section options without component metadata.
