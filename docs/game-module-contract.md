# Game module contract

This contract is the checklist for adding or changing a game without creating
a second route, reward or storage convention. It complements the repository
[architecture guide](architecture.md), the [points economy](points-economy.md)
and the [cleanup checklist](repository-cleanup.md).

## Required surfaces

Every public game module must have an auditable implementation for each item
below. Existing games may colocate these responsibilities in `src/pages/<id>/`
until an incremental extraction is approved, but a new change must preserve
the same boundaries.

| Surface | Authority and contract |
| --- | --- |
| route registration | Add the Taro route in `src/app.config.ts`; route names use the canonical page path and remain compatible with existing links. |
| catalog registration | Add the canonical item to `src/config/gameCatalog.ts`, including `id`, title, URL, category, duration, level, visibility, score display, recommendation weight and gauntlet eligibility. |
| share metadata | Add the page path and user-facing titles to `src/utils/share.ts`; use `usePageShare()` in the route that owns the share surface. |
| pure logic | Keep deterministic rules, generation, validation and scoring in `gameLogic.ts` or an equivalent domain file; keep them independent of Taro UI and storage where practical. |
| tests | Add focused Jest tests for generation, scoring, state transitions, boundaries and compatibility behavior; run the focused test before the broad suite. |
| points economy | Follow `docs/points-economy.md`; compute rewards with `getAwardedPoints()` and add them with `addPointsToPet()`, never with page-local multipliers or direct balance writes. |
| gauntlet | Register only if the game can accept the gauntlet preset and return its raw score, difficulty, mode and awarded points through `completeGauntletLegIfNeeded()`. A leg must not grant or record ordinary rewards. |
| result surface | Ordinary games own one clear result surface (or an explicitly documented inline result); score sharing and result-only actions belong there, not on the start/catalog screen. |

## Lifecycle and settlement ownership

For a multi-surface game, use `index` for start/catalog, `play` for active
interaction and `result` for a sealed result. Store a JSON-serializable run
payload behind a local `runId` when navigation or reload must survive page
recreation. Exactly one module owns settlement: it computes the score, calls
the shared points conversion, atomically transitions the active run to settled,
then performs ordinary reward/record work only when that transition succeeds.

Traffic Escape is the reference implementation:

- `src/pages/traffic-escape/run.ts` defines the payload/result boundary;
- `src/utils/gameFlowSession.ts` scopes storage by `gameId + runId` and allows
  `active -> settled|abandoned` only once;
- `index.tsx`, `play.tsx` and `result.tsx` own start, active play and sealed
  rendering respectively;
- `play.tsx` calls `settleTrafficEscapeRun()` before
  `addPointsToPet()`/`recordTrainingSession()` and redirects to result with
  replacement navigation;
- a gauntlet route calls `completeGauntletLegIfNeeded()` and returns when it
  handles the leg, leaving final aggregate settlement to the gauntlet.

Do not settle from both a page effect and a button callback. Do not award based
on a result-page mount. If a run is already settled/abandoned, the second
attempt must be a no-op. Back, duplicate taps and route remounts must not
restore an active completed puzzle or grant again.

## IDs, modes, storage and compatibility

Use the long canonical `gameId` values in `src/utils/trainingStorage.ts` and
`src/config/gameCatalog.ts`. Existing aliases such as `memory`, `rps`, `mot`
and `pattern` are compatibility data; do not remove or rename them while
migrating. Preserve existing storage keys, serialized fields, route query
parameters and historical records unless a migration with tests is explicitly
approved.

For games with modes, define the mode format in the game module and record it
consistently in the training record. A gauntlet preset supplies mode/difficulty
from its session; the child route must not reopen an independent selection UI.
Keep game score semantics separate from pet awarded points: caps and
conversion rates must not change the displayed/raw game score.

## Assets and generated outputs

Use versioned remote paths from `config/remote-assets.json` for package-heavy
CloudBase assets and keep source backups in `asset-backups/cloudbase-*`. A
replacement requires a new version, client reference update, `npm run
assets:check`, and an explicit upload only when the task asks for refreshing
the remote copy. Same-path overwrite is not a cache-safe release process.

Generated files can be committed runtime inputs, but they are not edited by
hand. Update their generator script, run the named generation command, inspect
the full diff, and run the generator's focused tests. In particular,
`hardPuzzles.generated.ts` is produced by
`npm run traffic-escape:puzzles`; full certification is separate from the fast
suite.

## Validation checklist

Before committing a game change, run the focused logic/route tests and the
relevant checks. At minimum, use:

```bash
npx jest tests/unit/<game-or-contract>.test.ts --runInBand
npm run typecheck
npm run lint
npm test
```

When puzzle generation or quality changes, also run:

```bash
npm run test:puzzle-certification
```

The aggregate `npm run verify` command is the fast static gate and includes
asset/audio/secrets checks plus `git diff --check`. `npm run build:weapp`
validates package generation only. Neither build nor Jest is live evidence of
WeChat Developer Tools, a physical device, CloudBase production state, remote
CDN freshness or a published release; record those as separate evidence only
after performing them.
