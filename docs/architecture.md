# Repository architecture

This is the durable architecture entry point for a new GPT session working on
`brain-games`. It describes the boundaries that exist today and the direction
for incremental cleanup. It does not replace the game-specific README files,
the [points economy](points-economy.md), or the
[repository cleanup checklist](repository-cleanup.md).

## Directory responsibilities

The current route implementation remains under `src/pages/`. The target tree
below is a navigation map for new work; it is intentionally incremental rather
than a requirement to move every existing file in one change.

The target boundaries are `src/pages/`, `src/domain/`,
`src/infrastructure/` and `src/shared/`; their responsibilities are shown in
the tree and dependency rule below.

```text
src/
  pages/                       Taro route entry modules and current game flows
  features/
    games/<game-id>/           game controller, views, components, pure rules
    pet/                       pet UI and custom-pet flows
    training-records/          training history UI
  domain/
    training/                  game ids, records, scoring and settlement contracts
    pet/                       pet entities, storage shapes and asset references
  infrastructure/
    cloudbase/                 CloudBase clients and repositories
    storage/                   Taro storage adapters
    audio/                     audio runtime services
  shared/
    components/                reusable presentation components
    hooks/                     reusable lifecycle hooks
    navigation/                typed routes and share metadata
  config/                      build/runtime manifests without UI dependencies
```

Routes are registered in `src/app.config.ts`. Game cards, categories, weights,
URLs and gauntlet eligibility are registered in
`src/config/gameCatalog.ts`. Share payloads are registered in
`src/utils/share.ts`. Current storage, scoring, pet and gauntlet helpers live
under `src/utils/`; do not invent a second storage key or reward path while
the incremental migration is in progress.

## Dependency direction

The allowed direction is:

```text
pages/features -> domain/shared -> infrastructure adapters
config         -> domain types
infrastructure -> domain types
domain         -> no page or component modules
```

Pages and feature controllers may compose domain rules, shared UI and
infrastructure adapters. Pure domain code must not import a Taro page, React
component or route module. `config` owns manifests and stable domain-facing
types, while CloudBase, storage and audio implementations stay behind
infrastructure boundaries. When a legacy module violates this direction, add
a characterization test and migrate its type/adapter in a small follow-up;
Task 11 documents the boundary and does not perform the broad migration.

## Game lifecycle: Traffic Escape reference

Traffic Escape is the reference for the lightweight three-surface flow named
`index/play/result`:

```text
index (start/catalog) -> play (active run) -> result (sealed result)
```

`src/pages/traffic-escape/run.ts` owns the game-specific serializable payload
and result type. `src/utils/gameFlowSession.ts` owns the generic local run
lifecycle. A run is stored under a key scoped by `gameId + runId`, and its
status moves from `active` exactly once to `settled` or `abandoned`.

- `index.tsx` selects the difficulty, reads the gauntlet preset when present,
  creates the run, and navigates to `play`.
- `play.tsx` reads and updates only an active run. On a solved puzzle it first
  calls `settleTrafficEscapeRun()`; only a non-null return may continue to
  reward, record, or navigate. This is the exactly-once settlement guard.
- `result.tsx` reads a settled run and renders the sealed result. It redirects
  invalid or active runs back to the start surface. Its home actions use
  replacement navigation, so a completed puzzle is not restored by Back.

The run payload is JSON-serializable local state, not a full puzzle encoded in
the URL and not transient React memory. Keep `runId` in the query only as the
lookup handle. `abandonGameRun()` is used for an interrupted active run.

## Settlement and gauntlet sequence

For an ordinary completed game, the canonical order is:

1. Compute the game score and call `getAwardedPoints()` from
   `src/utils/trainingStorage.ts`.
2. Mark the run settled (Traffic Escape uses
   `settleTrafficEscapeRun()`); stop if the result is null because another
   callback already settled it.
3. Call `addPointsToPet()` with the same game id, score, difficulty and reward
   policy.
4. Call `recordTrainingSession()` once with the raw score, awarded points,
   duration, mode/difficulty and outcome.

Pet points must remain on the shared `getAwardedPoints()` and
`addPointsToPet()` pipeline. Pages must not hand-roll difficulty multipliers,
caps or direct balance writes. The canonical rules and game-specific rates
are in [docs/points-economy.md](points-economy.md).

When a route is a game-gauntlet leg, call
`completeGauntletLegIfNeeded()` after the run is sealed and return immediately
when it handles the leg. A leg does not write an ordinary training record or
grant points independently. The gauntlet later sums its three leg awards,
uses an explicit reward policy with `maxPoints` equal to that sum, grants once,
and writes only the `game-gauntlet` record. This prevents double settlement.

Interrupted ordinary runs may record an `interrupted` session with zero score
and zero awarded points. Interrupted gauntlet legs report through the gauntlet
callback and do not create an ordinary record.

## CloudBase and remote assets

`src/services/user-data/cloud/` is the client boundary for CloudBase login,
snapshot reads and sync functions. It checks that `wx.cloud` and the configured
environment are available, initializes the client once, and applies a bounded
function timeout. Feature/domain code should depend on a repository or typed
service boundary rather than calling CloudBase directly.

Reusable or package-heavy images and audio have Git source backups under
`asset-backups/cloudbase-images/` and `asset-backups/cloudbase-audio/`.
`config/remote-assets.json` is the manifest for `petAssetVersion`,
`audioAssetVersion` and `trafficVehicleAssetVersion`; runtime paths in
`src/config/remoteAssets.ts` include those versioned values. Remote asset
replacement means a new versioned path, a client manifest/reference update,
`npm run assets:check`, and only when explicitly required
`npm run assets:upload`. Do not overwrite an existing CloudBase path to try to
beat CDN caching. This task performs no upload, deployment or publish action.

CloudBase environment ids, buckets, App IDs and secrets belong in ignored
`.env.*.local` or private project configuration. They must not be copied into
source, docs or commits. A local asset check or mock CloudBase response proves
code/config consistency only; it is not proof that a deployed function,
anonymous URL or production storage rule is live.

## Generated and historical files

Generated source is an output of an explicit generator, not a hand-edited
source of truth. For example,
`src/pages/traffic-escape/hardPuzzles.generated.ts` is generated by
`npm run traffic-escape:puzzles` from
`scripts/generate-traffic-escape-hard-puzzles.ts`; edit the generator and rerun
it when the certified bank changes. Generated files must retain their header
and should be reviewed as a complete output diff.

Historical plans/specs/reviews can explain decisions but are not runtime
contracts. Use current source, focused tests, this guide,
`docs/game-module-contract.md`, and `docs/points-economy.md` as the working
authority. The [cleanup checklist](repository-cleanup.md) records retained
external entries and completed cleanup evidence; do not turn it into a license
to delete user-owned output or active runtime assets.

## Verification commands and evidence boundaries

Use the smallest relevant command during development, then the phase gate:

```bash
npm test                              # fast/default Jest suite
npm run test:puzzle-certification    # explicit 36-puzzle/2,000-seed certification
npm run typecheck                    # TypeScript compilation without emit
npm run lint                         # ESLint plus repository rule validator
npm run assets:check                 # CloudBase asset backup/manifest check
npm run audio:check                  # CloudBase audio backup check
npm run secrets:check                # secret pattern scan
npm run build:weapp                  # package build only
npm run verify                       # fast suite + typecheck + lint + checks
git diff --check                     # whitespace/error marker check
```

`npm test` intentionally excludes the expensive certification suite. Run
`npm run test:puzzle-certification` when changing the Traffic Escape generator,
puzzle quality rules, or `hardPuzzles.generated.ts`; a release review should
include both suites. `npm run verify` is a local/static gate and does not upload
assets or deploy functions.

Build output proves that Taro produced a package. It is not live WeChat
Developer Tools evidence, a physical-device interaction check, a CloudBase
deployment proof, or a production CDN/cache proof. Report those live/device
checks separately and only when actually performed.
