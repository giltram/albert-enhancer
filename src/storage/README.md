# Local persistence

Architecture entry point: [docs/architecture.md](../../docs/architecture.md).

- `planner.ts`, `degreePlan.ts`, `settings.ts`, `campuses.ts` own the four WXT storage items. Planner and degree consumers read/watch these items; production writes go through commands.
- `commands.ts`: `updatePlanner`, `updateDegree`, `sendStorageCommand`. Clients send serializable actions, never entire page snapshots. A rejected save throws and must be displayed to the user.
- `mutations.ts`: pure `PlannerMutation` / `DegreeMutation` reducers. Depends only on core and `plannerData.ts`.
- `writer.ts`: `createStorageWriter` is instantiated exactly once by background. One promise queue owns planner, degree and clear-local-data operations across all tabs/frames. Each action reads the latest value and acknowledges only after saving. Failure does not poison the queue. Background validates the extension sender and keeps the asynchronous message response open until completion.
- `plannerData.ts`: schema normalization, term validation, option merge and course removal. No browser dependency. Optional schema-v2 `term` is null for legacy/unidentified data; IDs and history remain intact. A nonempty plan cannot accept a different or unidentified semester. Reimporting another primary keeps course order stable for calendar colors.
- `settings.ts`: export reads all items; delete sends a clear command through the same queue. Settings/campus values are independent records with direct writes; planner/degree snapshot writes from UI or adapters are forbidden.

The queue coordinates protocol participants; Chrome storage itself is not transactional, and direct external storage writes are outside this guarantee. UI subscribes before refreshing its startup read (`entrypoints/shared/useStoredValue.ts`). Save acknowledgments do not replace local data snapshots; watch delivers the latest stored state.

Tests: `tests/storage/planner.test.ts`, `writer.test.ts`, `tests/entrypoints/plannerPage.test.ts`, and the cross-page browser test in `tests/e2e/extension.spec.ts`.
