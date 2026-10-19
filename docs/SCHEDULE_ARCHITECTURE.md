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

This pipeline is connected to Albert search imports. `sectionGroups.ts` reads the current course/term's ordered primary + REC/LAB blocks and produces explicit component requirements and compatibility rules. `sectionPicker.ts` retains user-selected alternatives (one per required type in a final schedule); `plannerImport.ts` builds complete options and persists one merged update through `mergeEnrollmentOptions`. Single-component imports retain legacy option IDs. Re-adding a group replaces its legacy standalone imports without removing other primary-section bundles.

The observed Albert layout and limits are documented in the [Albert README](../src/adapters/albert/README.md). Classification uses `Component:`, never position alone, instructor, or native button presence. The adapter's ordered-block convention is not a universal catalog linkage rule. Filters that could hide components block import until cleared. Unknown/unreadable linked rows do not permit incomplete imports. A new layout or explicit multi-level linkage must be normalized in the adapter before invoking the builder.

The course-data Provider is still not connected to an entrypoint and decodes already-formed options. Meeting overlap belongs to `courses/meetings.ts`; the builder does not import schedule.

## Terms

- **Section** — one real catalog/Albert component, such as `LEC001`, `REC011`, or `LAB003`.
- **Component** — the role a section plays: lecture, recitation, lab, seminar, workshop, discussion, or other.
- **EnrollmentOption** — one complete legal way to enroll in one course, such as `LEC001 + REC011`. It is the solver's atomic choice.
- **Schedule** — a complete timetable containing at most one EnrollmentOption for each selected course.

`buildEnrollmentOptions` consumes a normalized `RawCourseOffering`. Component requirements describe cardinality; directed compatibility rules describe legal linkage. It merges component meetings, rejects internally conflicting bundles, and creates deterministic IDs from sorted section IDs.

Compatibility rules are exhaustive for the component types they link. A multi-component offering whose compatibility is `unknown` produces no options, because assuming a Cartesian product could create invalid enrollment combinations. A provider must explicitly report `known` compatibility before an unrestricted combination is allowed.

Component requirements/preferences and component registration outcomes filter or rank generated options. They do not replace exact EnrollmentOption lock/exclude state: requiring `LEC001` keeps every legal option containing that lecture, while locking `LEC001 + REC012` selects that exact bundle.

Planner schema v2 adds optional component display metadata and section-level registration state. The migration preserves legacy option IDs and accepts older single-section options without component metadata.
