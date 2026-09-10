# Repository Architecture Cleanup Design

## 1. Goal

Turn the current repository into a compact, reliable, GPT-friendly Taro project whose validation commands are trustworthy, runtime architecture is easy to navigate, generated and historical artifacts are clearly separated, and every retained tracked file has an active purpose.

The work follows six ordered phases:

1. restore trustworthy lint and test gates;
2. separate fast unit tests from expensive puzzle certification;
3. remove confirmed dead files and local artifacts;
4. replace historical planning noise with durable architecture documentation;
5. correct pet-domain dependencies and centralize game settlement;
6. split the largest route components without changing gameplay.

Each phase must leave the repository in a working, independently committed state. Existing untracked Official Account material is outside the cleanup scope.

## 2. Scope and invariants

### In scope

- ESLint configuration and lint coverage.
- The stale result-sharing regression test.
- Jest command structure and Traffic Escape certification tests.
- Confirmed unused source, obsolete asset variants, broken skill links, transient reports, and regenerable local directories.
- A concise architecture guide and a durable game-module contract.
- Pet domain types and asset metadata currently owned by page modules.
- A shared game-settlement service for the existing points, gauntlet, pet, and training-record sequence.
- Incremental decomposition of the largest route components and unreadable one-line JSX.

### Out of scope

- New games, scoring changes, difficulty changes, reward changes, visual redesign, CloudBase uploads, cloud-function deployment, publishing, pushing, or rewriting every page into a new framework.
- Deleting `output/official-account/hidato/` or `output/official-account/memory-challenge/`.
- Deleting the active Traffic Escape atlas backup, pet runtime assets, environment files, or private WeChat project configuration.
- Major dependency upgrades. Dependency migration is a separate project after the validation baseline is trustworthy.

### Behavioral invariants

- Game scores, difficulty mappings, modes, storage keys, historical aliases, and points caps remain unchanged.
- Pet points continue to flow through `getAwardedPoints()` and `addPointsToPet()`.
- Gauntlet legs continue to settle through `completeGauntletLegIfNeeded()` and must not independently grant points or write ordinary training records.
- Traffic Escape retains the `index/play/result` flow, serialized local run state, exactly-once settlement, and replacement navigation semantics.
- Remote asset URLs remain versioned. No CloudBase-backed production path is overwritten or uploaded by this work.
- Existing user-owned untracked files remain untouched and unstaged.

## 3. Chosen approach

### Considered approaches

1. **Minimal cleanup only:** remove obvious files and repair the currently failing test. This is low risk but leaves false-green lint, inverted dependencies, repeated settlement logic, and oversized pages.
2. **Incremental architecture cleanup:** repair gates first, clean proven waste, document boundaries, then migrate domain and page structure in small tested batches. This gives the best balance of safety, readability, and future GPT maintenance.
3. **Full feature-oriented rewrite:** immediately move all games into a new directory hierarchy and replace every page flow. This would create a large regression surface and conflict with the goal of preserving mature gameplay.

The chosen approach is option 2. Every structural migration starts with characterization tests and uses compatibility re-exports where needed so that one commit never requires a repository-wide rewrite.

## 4. Target architecture

```text
src/
  pages/                       Taro route entry modules; thin composition only
  features/
    games/<game-id>/           game controller, views, components, pure logic
    pet/                       pet UI and custom-pet UI flows
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
    navigation/                typed route and share metadata
  config/                      build/runtime manifests without UI dependencies
```

This task does not move every file into the final tree. It establishes the dependency direction and migrates the two cross-cutting domains that currently create the greatest maintenance risk: pet data and game settlement. Route components stay under `src/pages/` until each one is intentionally decomposed.

Allowed dependency direction:

```text
pages/features -> domain/shared -> infrastructure adapters
config         -> domain types
infrastructure -> domain types
domain         -> no page or component modules
```

## 5. Phase design

### Phase 1: Trustworthy validation gates

- Consolidate ESLint into one configuration. The resulting config must carry the Taro React rules, React Hooks rules, TypeScript rules, and targeted overrides for Node.js scripts, Jest tests, and CommonJS cloud functions.
- Remove the shadow configuration so `npm run lint:code` can no longer pass with zero rules.
- Add a regression check that asserts important rules such as `react-hooks/rules-of-hooks` are present in the printed configuration.
- Update the result-sharing coverage model so each ordinary game declares its actual result surface. Traffic Escape must point at `traffic-escape/result.tsx`, not its start route.
- Do not weaken assertions merely to restore green status.

### Phase 2: Fast tests and explicit certification

- Keep `npm test` focused on deterministic unit and integration checks that normally complete in seconds.
- Validate representative Traffic Escape puzzles and the serialized generated-bank shape in the default suite.
- Move full 36-puzzle BFS certification and the 2,000-seed generator scan behind `npm run test:puzzle-certification` or an equivalent explicit command.
- Add an aggregate `npm run verify` command that runs fast tests, typecheck, lint, asset/audio checks, secrets, and whitespace checks without deploying or uploading.
- Document when the expensive certification command is mandatory: puzzle generator changes, puzzle quality-rule changes, or replacement of `hardPuzzles.generated.ts`.

### Phase 3: Evidence-backed cleanup

Tracked deletions:

- unused `src/hooks/useAudioFeedback.ts`;
- unreferenced `scripts/fixtures/custom-pet-user-reference-dog.jpg`, including its unnecessary EXIF-bearing test material;
- unreferenced `asset-backups/cloudbase-images/pets/food-steak.png`;
- obsolete pose reference sheets after removing the matching asset-check entry;
- unused app-icon design variants while retaining the two selected app icons;
- non-runtime `pet-sheet-preview.png` after removing the matching asset-check entry;
- stale `.trae` planning document and the lone tracked `.superpowers/sdd` task report;
- broken duplicate repository skill-link farms and their lock/settings files when no active repository command depends on them;
- obsolete `CLAUDE.MD`, whose instructions describe an unavailable legacy Codex MCP workflow.

Local-only cleanup may remove ignored caches and build products, but it must not be included in Git commits. `node_modules/` may be removed only after all verification that needs the installed dependency tree, or followed by `npm ci` before further work.

Every tracked deletion must be preceded by a repository-wide reference search. Paired manifest/script edits and focused tests must happen in the same commit.

### Phase 4: Durable documentation

- Add `docs/architecture.md` as the single entry point for directory responsibilities, dependency direction, game lifecycle, settlement, remote assets, CloudBase boundaries, generated files, and validation commands.
- Add a concise game-module contract covering route registration, catalog registration, share metadata, pure logic, tests, points economy, gauntlet behavior, and result surfaces.
- Update the root README to link to the architecture guide and distinguish fast verification from puzzle certification.
- Extract still-valid decisions from historical `docs/superpowers/plans`, `docs/superpowers/specs`, and `docs/reviews` into durable documents.
- Delete only completed historical documents. Keep this cleanup design and its implementation plan until the work finishes; at final cleanup, retain the design as the rationale and remove the execution plan if all tasks are complete.

### Phase 5: Domain and settlement boundaries

- Move pet entity types, sprite mood types, and asset-reference types out of `src/pages/pet/` into `src/domain/pet/`.
- Keep temporary compatibility exports only where they reduce the size of individual commits; remove them before the phase closes.
- Ensure `src/config`, `src/services`, and `src/utils` no longer import from `src/pages`.
- Introduce a typed settlement service accepting the canonical game id, raw score, difficulty, duration, mode, outcome, and optional existing reward policy.
- The service computes awarded points once, attempts gauntlet settlement first, and only for ordinary games grants pet points and writes the training record.
- Migrate games in small groups with characterization tests. Traffic Escape is migrated only after its existing exactly-once run settlement tests remain green.

### Phase 6: Route readability

- Add formatting enforcement and expand one-line JSX before extracting components.
- Split the largest route files by responsibility, starting with Traffic Escape formatting, Music Theory, Memory Challenge, Bird Count, Pet, Pattern Completion, and Mental Math.
- Prefer view components and hooks colocated with their route. Pure game rules remain in `gameLogic.ts` or an equivalent domain file.
- Do not introduce a generic game-page framework. Share only stable pieces such as start/result layout, difficulty selection, and settlement integration.
- Keep each route entry focused on parameter reading, controller composition, lifecycle hooks, and rendering.

## 6. Testing strategy

Each behavior change or refactor follows red-green-refactor:

1. add or adjust the smallest characterization/regression test;
2. run it and confirm the expected failure;
3. implement the minimum change;
4. run the focused test and related suite;
5. run the current phase gate before committing.

Final verification must include:

```text
npm test
npm run test:puzzle-certification
npm run typecheck
npm run lint
npm run assets:check
npm run audio:check
npm run secrets:check
npm run build:weapp
git diff --check
```

The build proves package generation only. It is not evidence of live WeChat Developer Tools or physical-device behavior.

## 7. Commit and rollback strategy

- Use one or more scoped commits per phase; never mix user-owned `output/` files into a commit.
- Record the current HEAD before each delegated task. Reviews compare that exact base to the task head.
- No force pushes, merges, CloudBase uploads, deployments, or publication actions are part of this work.
- If a structural batch fails its focused or phase gate, revert only that batch's new changes rather than weakening tests or expanding scope.

## 8. Completion criteria

The cleanup is complete when:

- ESLint reports meaningful React, Hooks, TypeScript, Node, and Jest rules and passes with zero warnings;
- the default suite is green and fast, while full puzzle certification is explicit and green;
- all approved deletion candidates are gone, all retained large assets have documented owners, and ignored local artifacts are absent or intentionally retained;
- no config, service, utility, infrastructure, or domain module imports from `src/pages`;
- game settlement uses one tested shared orchestration boundary;
- the selected large route files are formatted and decomposed without gameplay, score, reward, storage, or navigation changes;
- `docs/architecture.md` is sufficient for a new GPT session to locate the correct module and validation command without reading historical plans;
- the full verification gate passes and task commits contain no unrelated files.
