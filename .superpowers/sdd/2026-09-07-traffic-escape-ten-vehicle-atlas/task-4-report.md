# Task 4 TDD Report: Version remote resolution and record the invariant

Date: 2026-09-07

## Scope

Task 4 only: version the Traffic Escape vehicle atlas mapping from `v5` to `v6`, update the remote-resolution regression expectation, and document the visual-only vehicle pool invariant. No CloudBase upload, gameplay change, reward change, or `output/` change was made.

## Red stage

Changed the focused test expectation first:

```text
cloud://test-env.test-bucket/assets/games/traffic-escape/v6/vehicle-atlas.png
```

Command:

```text
npm test -- --runInBand tests/unit/remoteAssets.test.ts
```

Result: expected failure. The suite reported 15 passing tests and one failure. The failure was isolated to the atlas request assertion: runtime still requested the v5 path while the test expected v6. The request count remained exactly one.

## Implementation

- Set `trafficVehicleAssetVersion` to `v6` in `config/remote-assets.json`.
- Updated `tests/unit/remoteAssets.test.ts` to assert the v6 CloudBase file ID.
- Updated `docs/points-economy.md` to record that each vehicle length has five visual forms, same-length forms do not repeat until the visual pool is exhausted, and the target remains the red `sport` vehicle. The documentation explicitly states that visual form does not change vehicle geometry, puzzle solution, game score, or pet points.

## Green stage

Focused command:

```text
npm test -- --runInBand tests/unit/remoteAssets.test.ts
```

Result: PASS — 1 suite, 16 tests. The atlas resolver made exactly one CloudBase URL request with the v6 file ID.

Full command:

```text
npm test
```

Result: PASS — 47 suites, 383 tests.

## Self-review

`git diff --check` passed. The diff is limited to the requested manifest, focused test expectation, and points-economy paragraph. The pre-existing untracked `output/` directory was not staged or modified. No CloudBase upload was run.
