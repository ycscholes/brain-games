# Traffic Escape Ten-Vehicle Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two two-cell and two three-cell Traffic Escape vehicle appearances, including one pink two-cell sports car, with a v6 five-column remote atlas and unchanged gameplay economics.

**Architecture:** `gameLogic.ts` owns the length-specific pools; `vehicleAtlas.ts` maps names to a five-column atlas; the generic page renderer reuses each crop for both color and mask. The remote manifest advances the single atlas URL from v5 to v6.

**Tech Stack:** TypeScript, React/Taro, Jest, SCSS, CloudBase Storage, Codex image generation.

---

## Global constraints

- Follow `docs/superpowers/specs/2026-09-07-traffic-escape-ten-vehicle-atlas-design.md`.
- Add appearances only: do not alter puzzle pools, layouts, movement, collision, BFS, difficulty, score, rewards, `getAwardedPoints()`, `addPointsToPet()`, or `src/config/gameCatalog.ts`.
- Target stays red `sport`; `pink-sport` is a non-target appearance.
- Do not touch or stage the pre-existing untracked `output/` directory.
- Store the final resource at the existing backup path but upload only to `assets/games/traffic-escape/v6/vehicle-atlas.png`; never overwrite v5.

## File structure

- `src/pages/traffic-escape/gameLogic.ts`, `tests/unit/trafficEscapeGameLogic.test.ts`: appearance names and assignment invariants.
- `src/pages/traffic-escape/vehicleAtlas.ts`, `tests/unit/trafficVehicleAtlas.test.ts`, `src/pages/traffic-escape/index.scss`, `src/pages/traffic-escape/index.tsx`: five-column crop and presentation.
- `asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png`: transparent v6 5×2 atlas.
- `config/remote-assets.json`, `tests/unit/remoteAssets.test.ts`, `docs/points-economy.md`: v6 resolution and economy documentation.

### Task 1: Expand the appearance contract

**Files:**
- Modify: `tests/unit/trafficEscapeGameLogic.test.ts:1-105`
- Modify: `src/pages/traffic-escape/gameLogic.ts:5-66`

- [ ] **Step 1: Write failing tests for the complete five-item pools and target invariant.**

```ts
expect(TRAFFIC_VEHICLE_APPEARANCES[2]).toEqual([
  "sport", "compact-van", "city-taxi", "pink-sport", "offroad-suv",
]);
expect(TRAFFIC_VEHICLE_APPEARANCES[3]).toEqual([
  "city-bus", "box-truck", "stretch-sedan", "camper-rv", "tanker-truck",
]);
expect(assigned.find((vehicle) => vehicle.isTarget)?.appearance).toBe("sport");
expect(assigned.filter((vehicle) => vehicle.appearance === "pink-sport")).toHaveLength(1);
```

Use five fixture vehicles per length. For generated puzzles, assert the two-cell set equals its pool; assert three-cell appearances are distinct and every value belongs to its five-item pool.

- [ ] **Step 2: Run the focused test.**

Run: `npm test -- --runInBand tests/unit/trafficEscapeGameLogic.test.ts`

Expected: FAIL because the new names are absent.

- [ ] **Step 3: Implement the exact pool extension, retaining the existing assignment algorithm.**

```ts
export const TRAFFIC_VEHICLE_APPEARANCES = {
  2: ["sport", "compact-van", "city-taxi", "pink-sport", "offroad-suv"],
  3: ["city-bus", "box-truck", "stretch-sedan", "camper-rv", "tanker-truck"],
} as const;
```

Keep `target.appearance = "sport"` and pool-first/no-repeat behavior. Do not change puzzle definitions or difficulty constants.

- [ ] **Step 4: Verify and commit.**

Run: `npm test -- --runInBand tests/unit/trafficEscapeGameLogic.test.ts`

Expected: PASS.

```bash
git add src/pages/traffic-escape/gameLogic.ts tests/unit/trafficEscapeGameLogic.test.ts
git commit -m "feat: expand traffic escape vehicle appearances"
```

### Task 2: Generalize crop rendering to five columns

**Files:**
- Modify: `tests/unit/trafficVehicleAtlas.test.ts:1-78`
- Modify: `src/pages/traffic-escape/vehicleAtlas.ts:1-104`
- Modify: `src/pages/traffic-escape/index.scss:352-377`
- Modify: `src/pages/traffic-escape/index.tsx:45-47`

- [ ] **Step 1: Add failing atlas tests for the fourth and fifth columns.**

```ts
expect(getTrafficVehicleAtlasSlot("pink-sport", 2)).toMatchObject({ column: 3, row: "two-cell", x: 2304, y: 0, width: 768, height: 384 });
expect(getTrafficVehicleAtlasSlot("tanker-truck", 3)).toMatchObject({ column: 4, row: "three-cell", x: 3072, y: 384, width: 768, height: 256 });
expect(() => getTrafficVehicleAtlasSlot("pink-sport", 3)).toThrow("does not belong to a 3-cell vehicle");
expect(getTrafficVehicleAtlasCropStyle("offroad-suv", 2, "https://cdn.example/v6.png").backgroundSize).toBe("500% auto");
expect(getTrafficVehicleAtlasMaskStyle("camper-rv", 3, "https://cdn.example/v6.png")).toEqual({
  ...getTrafficVehicleAtlasCropStyle("camper-rv", 3, "https://cdn.example/v6.png"), filter: "brightness(0)",
});
```

- [ ] **Step 2: Run the focused test.**

Run: `npm test -- --runInBand tests/unit/trafficVehicleAtlas.test.ts`

Expected: FAIL because the slots and 500% crop size are absent.

- [ ] **Step 3: Implement five-column metadata and crop arithmetic.**

```ts
const ATLAS_COLUMN_COUNT = 5;
const ATLAS_SLOT_WIDTH = 768;
const TWO_CELL_SLOT_HEIGHT = 384;
const THREE_CELL_SLOT_HEIGHT = 256;
const ATLAS_THREE_CELL_ROW_Y = TWO_CELL_SLOT_HEIGHT;
```

Expand `column` to `0 | 1 | 2 | 3 | 4`; add `pink-sport` and `offroad-suv` at x `2304`/`3072` on the upper row, and `camper-rv`/`tanker-truck` at those positions on the lower row. Change `backgroundSize` and both SCSS layer declarations to `"500% auto"`; use `ATLAS_COLUMN_COUNT - 1` for horizontal free space and `slot.column * 100 / (ATLAS_COLUMN_COUNT - 1)` for base X. Preserve the `length === 3 ? -5 : 0` correction and shared mask implementation. Change the normal copy to `"6×6 · 十种车型随机登场"`.

- [ ] **Step 4: Verify and commit.**

Run: `npm test -- --runInBand tests/unit/trafficVehicleAtlas.test.ts`

Expected: PASS.

```bash
git add src/pages/traffic-escape/vehicleAtlas.ts src/pages/traffic-escape/index.scss src/pages/traffic-escape/index.tsx tests/unit/trafficVehicleAtlas.test.ts
git commit -m "feat: render traffic escape five-column atlas"
```

### Task 3: Generate, assemble, and measure the v6 atlas

**Files:**
- Modify: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png`
- Modify: `src/pages/traffic-escape/vehicleAtlas.ts`
- Modify: `tests/unit/trafficVehicleAtlas.test.ts`

- [ ] **Step 1: Create the four new subjects with the built-in image generator.**

Generate only horizontally right-facing rounded, high-saturation vehicles matching the present atlas: a pink sports car, teal off-road SUV, purple-blue camper RV, and lime tanker truck. Use a flat chroma-key background, no text, watermark, extra vehicle, or red target replacement.

- [ ] **Step 2: Remove chroma key and assemble the transparent `3840 × 640` image.**

Use the project image-asset workflow. Arrange the fixed columns as `sport`, `compact-van`, `city-taxi`, `pink-sport`, `offroad-suv` on the `768 × 384` upper row; `city-bus`, `box-truck`, `stretch-sedan`, `camper-rv`, `tanker-truck` on the `768 × 256` lower row. Keep each centered, no opaque edge pixels, and save to the existing backup path.

- [ ] **Step 3: Measure and test the completed PNG.**

Programmatically inspect all ten slots and use their actual alpha rectangles as `visibleBounds` in source and test expectations. Verify RGBA, transparent corners, non-empty alpha in every slot, no chroma-key field, and 6×6-board-scale legibility. Do not change the fixed slot dimensions, x positions, or three-cell correction.

- [ ] **Step 4: Verify and commit.**

Run: `npm run assets:check && npm test -- --runInBand tests/unit/trafficVehicleAtlas.test.ts`

Expected: PASS.

```bash
git add asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png src/pages/traffic-escape/vehicleAtlas.ts tests/unit/trafficVehicleAtlas.test.ts
git commit -m "feat: add traffic escape v6 vehicle atlas"
```

### Task 4: Version remote resolution and record the invariant

**Files:**
- Modify: `config/remote-assets.json:1-5`
- Modify: `tests/unit/remoteAssets.test.ts:20-90`
- Modify: `docs/points-economy.md:88`

- [ ] **Step 1: Change the test expectation to v6.**

```ts
const TRAFFIC_ATLAS_FILE_ID = "cloud://test-env.test-bucket/assets/games/traffic-escape/v6/vehicle-atlas.png";
```

- [ ] **Step 2: Run the focused test.**

Run: `npm test -- --runInBand tests/unit/remoteAssets.test.ts`

Expected: FAIL while the manifest remains v5.

- [ ] **Step 3: Set the manifest version and document the visual-only pool.**

```json
"trafficVehicleAssetVersion": "v6"
```

Update the points-economy paragraph to say there are five visual forms per length, same-length forms do not repeat until their pool is exhausted, the target remains red `sport`, and visual form never changes geometry, solution, score, or pet points.

- [ ] **Step 4: Verify and commit.**

Run: `npm test -- --runInBand tests/unit/remoteAssets.test.ts`

Expected: PASS with exactly one CloudBase atlas URL request.

```bash
git add config/remote-assets.json tests/unit/remoteAssets.test.ts docs/points-economy.md
git commit -m "docs: record traffic escape vehicle pool"
```

### Task 5: Run release checks and publish v6

**Files:**
- Verify: all Task 1-4 files

- [ ] **Step 1: Run the complete local validation.**

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build:weapp
npm run secrets:check
git diff --check
```

Expected: each command exits 0; a Taro `punycode` warning is acceptable only if compilation succeeds.

- [ ] **Step 2: Upload only the new remote path after all checks pass.**

Run: `npm run assets:upload -- games/traffic-escape/vehicle-atlas.png`

Expected: confirm `assets/games/traffic-escape/v6/vehicle-atlas.png` exists; v5 remains unchanged.

- [ ] **Step 3: Inspect normal and hard boards in WeChat Developer Tools.**

Confirm the 10 forms rotate across generated boards; new two- and three-cell subjects are centered horizontally and vertically; mask and color overlap; click spans, selection, hint pulse, fallback outline, and red target priority remain unchanged.

- [ ] **Step 4: Commit a correction only when validation required one.**

```bash
git status --short
git add asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png src/pages/traffic-escape/gameLogic.ts src/pages/traffic-escape/vehicleAtlas.ts src/pages/traffic-escape/index.scss src/pages/traffic-escape/index.tsx tests/unit/trafficEscapeGameLogic.test.ts tests/unit/trafficVehicleAtlas.test.ts config/remote-assets.json tests/unit/remoteAssets.test.ts docs/points-economy.md
git commit -m "fix: polish traffic escape v6 atlas"
```

Do not create an empty commit or add `output/`.
