# Traffic Escape Vehicle Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three visibly different two-cell vehicles and three visibly different three-cell vehicles, then ensure every generated board uses all six forms before any form repeats.

**Architecture:** Keep puzzle positions, movement, scoring, and solving separate from the visual identity by adding a length-compatible `appearance` field to `TrafficVehicle`. A deterministic appearance allocator assigns the three forms for each length before repeats. Remote-asset resolution accepts an appearance ID while the game page retains its CSS fallback if an image cannot load.

**Tech Stack:** Taro/React, TypeScript, Jest, CloudBase Storage, Codex built-in image generation.

---

### Task 1: Generate and prepare the five new vehicle assets

**Files:**
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-compact-van.png`
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-city-taxi.png`
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-city-bus.png`
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-box-truck.png`
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-stretch-sedan.png`

- [ ] **Step 1: Generate the compact van**

Use built-in `image_gen` with this prompt:

```text
Use case: stylized-concept
Asset type: two-cell vehicle sprite for a mobile traffic puzzle
Primary request: one cheerful cartoon compact van, clean side view facing right, visibly longer than tall but sized for a two-grid-cell slot
Style/medium: polished 2D game illustration, thick dark teal outline, rounded forms, soft highlights, no text
Scene/backdrop: genuinely transparent background
Color palette: warm orange body, cream roof, teal windows
Constraints: isolated single vehicle; no shadow beyond a subtle ground-contact shadow; no logo, watermark, letters, people, road, or scenery
```

- [ ] **Step 2: Generate the city taxi**

Use built-in `image_gen` with this prompt:

```text
Use case: stylized-concept
Asset type: two-cell vehicle sprite for a mobile traffic puzzle
Primary request: one cheerful cartoon city taxi, clean side view facing right, visibly longer than tall but sized for a two-grid-cell slot
Style/medium: polished 2D game illustration, thick dark teal outline, rounded forms, soft highlights, no text
Scene/backdrop: genuinely transparent background
Color palette: sunny yellow body, navy windows, small roof light with no letters
Constraints: isolated single vehicle; no logo, watermark, readable text, people, road, or scenery
```

- [ ] **Step 3: Generate the three large vehicles**

Issue three independent built-in `image_gen` calls with the following primary request substitutions, keeping the same transparent side-view, right-facing, thick-outline, no-text constraints as Task 1:

```text
one cheerful cartoon city bus, visibly long enough for a three-grid-cell slot, turquoise body, cream roof, wide windows
one cheerful cartoon box truck, visibly long enough for a three-grid-cell slot, cobalt cab, coral cargo box, wide simple wheels
one cheerful cartoon stretch sedan, visibly long enough for a three-grid-cell slot, violet body, pale roof, long window band
```

- [ ] **Step 4: Inspect and store the selected PNGs**

Use `view_image` on every generated output. Confirm transparent alpha, clear side profile, no text or watermark, and a 3:2-ish visual distinction between compact and long forms. Copy only selected outputs to the five listed workspace paths; do not replace the existing `vehicle-target.png`.

- [ ] **Step 5: Check asset inventory**

Run: `npm run assets:check`

Expected: `Asset backup check passed`.

- [ ] **Step 6: Commit the prepared assets**

```bash
git add asset-backups/cloudbase-images/games/traffic-escape/
git commit -m "feat: add traffic vehicle form assets"
```

### Task 2: Add appearance-aware types and remote asset resolution

**Files:**
- Modify: `src/pages/traffic-escape/gameLogic.ts:3-14`
- Modify: `src/config/remoteAssets.ts:20-31`
- Modify: `tests/unit/remoteAssets.test.ts`

- [ ] **Step 1: Write the failing resolver test**

Add assertions that `resolveTrafficVehicleUrl("compact-van")` resolves the compact-van CloudBase path and that `resolveTrafficVehicleUrl("city-bus")` resolves the city-bus path. The test must use the existing mocked `getTempFileURL` and assert each requested file ID ends in the expected asset path.

- [ ] **Step 2: Run the resolver test to verify it fails**

Run: `npm test -- tests/unit/remoteAssets.test.ts --runInBand`

Expected: FAIL because the new appearance identifiers are not accepted by the resolver.

- [ ] **Step 3: Add the appearance types and resolver map**

In `gameLogic.ts`, define and export:

```ts
export const TRAFFIC_VEHICLE_APPEARANCES = {
  2: ["sport", "compact-van", "city-taxi"],
  3: ["city-bus", "box-truck", "stretch-sedan"],
} as const;

export type TrafficVehicleAppearance =
  | (typeof TRAFFIC_VEHICLE_APPEARANCES)[2][number]
  | (typeof TRAFFIC_VEHICLE_APPEARANCES)[3][number];
```

Add `appearance: TrafficVehicleAppearance` to `TrafficVehicle`. In `remoteAssets.ts`, replace color-keyed vehicle paths with the six appearance keys and export `resolveTrafficVehicleUrl(appearance: TrafficVehicleAppearance, options?)`.

- [ ] **Step 4: Run the resolver test to verify it passes**

Run: `npm test -- tests/unit/remoteAssets.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit the resolver contract**

```bash
git add src/pages/traffic-escape/gameLogic.ts src/config/remoteAssets.ts tests/unit/remoteAssets.test.ts
git commit -m "feat: resolve traffic vehicles by appearance"
```

### Task 3: Allocate every appearance before repeats

**Files:**
- Modify: `src/pages/traffic-escape/gameLogic.ts:137-319`
- Modify: `tests/unit/trafficEscapeGameLogic.test.ts`

- [ ] **Step 1: Write the failing allocation tests**

Import `TRAFFIC_VEHICLE_APPEARANCES` and add a test that builds a six-vehicle fixture with three length-2 and three length-3 vehicles, applies `assignTrafficVehicleAppearances(vehicles, random)`, then asserts:

```ts
expect(new Set(twoCellAppearances)).toEqual(new Set(TRAFFIC_VEHICLE_APPEARANCES[2]));
expect(new Set(threeCellAppearances)).toEqual(new Set(TRAFFIC_VEHICLE_APPEARANCES[3]));
```

Add a second test with a fourth length-2 vehicle and assert its appearance belongs to `TRAFFIC_VEHICLE_APPEARANCES[2]`, while the first three remain unique.

- [ ] **Step 2: Run the allocation tests to verify they fail**

Run: `npm test -- tests/unit/trafficEscapeGameLogic.test.ts --runInBand`

Expected: FAIL because `assignTrafficVehicleAppearances` does not exist.

- [ ] **Step 3: Implement deterministic allocation**

Add `assignTrafficVehicleAppearances(vehicles, random)` that clones inputs, groups them by `length`, shuffles each corresponding `TRAFFIC_VEHICLE_APPEARANCES[length]` pool with the supplied random source, assigns the first three in order, then assigns each remaining vehicle from that same pool with `Math.floor(random() * pool.length)`. Force the target vehicle to `sport`, and rotate the remaining two-cell pool so the non-target cars still receive `compact-van` and `city-taxi` before any duplicate.

- [ ] **Step 4: Make generated and fallback puzzles include three cars of each length**

Update normal and hard solved layouts and all fixed fallback layouts to contain at least three length-2 and three length-3 vehicles. Preserve valid coordinates, orientations, and solution moves; apply `assignTrafficVehicleAppearances` to candidates and cloned fallback vehicles using the seeded random source.

- [ ] **Step 5: Run puzzle tests to verify they pass**

Run: `npm test -- tests/unit/trafficEscapeGameLogic.test.ts --runInBand`

Expected: PASS, including solvability, scripted solutions, and the new appearance coverage assertions.

- [ ] **Step 6: Commit deterministic allocation**

```bash
git add src/pages/traffic-escape/gameLogic.ts tests/unit/trafficEscapeGameLogic.test.ts
git commit -m "feat: vary traffic vehicle forms by length"
```

### Task 4: Render the selected appearance and verify the integrated game

**Files:**
- Modify: `src/pages/traffic-escape/index.tsx:60-75,217-250`
- Modify: `docs/points-economy.md:car section`

- [ ] **Step 1: Write the failing page-level mapping test**

Extend the remote-assets unit test to call the resolver for each value in `TRAFFIC_VEHICLE_APPEARANCES[2]` and `[3]`, asserting six non-empty URLs. This ensures the page has a complete image pool before rendering.

- [ ] **Step 2: Run the mapping test to verify it fails**

Run: `npm test -- tests/unit/remoteAssets.test.ts --runInBand`

Expected: FAIL until the sport form is mapped as a supported appearance alongside the new images.

- [ ] **Step 3: Update the page image cache**

Replace `TrafficVehicleColor` cache keys with `TrafficVehicleAppearance`. Load every appearance from the two appearance pools once in `useEffect`; render `vehicleImageUrls[vehicle.appearance]`, and clear only the failed appearance entry in `onError`. Keep the CSS color classes and existing window fallback for image failures.

- [ ] **Step 4: Document unchanged points behavior**

In the existing `车阵突围` entry of `docs/points-economy.md`, add one sentence that vehicle forms are visual-only and do not change scoring, difficulty multipliers, or shared point handling.

- [ ] **Step 5: Run focused tests to verify they pass**

Run: `npm test -- tests/unit/remoteAssets.test.ts tests/unit/trafficEscapeGameLogic.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit rendering integration**

```bash
git add src/pages/traffic-escape/index.tsx src/config/remoteAssets.ts tests/unit/remoteAssets.test.ts docs/points-economy.md
git commit -m "feat: render traffic vehicle forms"
```

### Task 5: Upload and final verification

**Files:**
- Verify: `asset-backups/cloudbase-images/games/traffic-escape/`
- Verify: `dist/pages/traffic-escape/index.*`

- [ ] **Step 1: Upload assets to CloudBase**

Run: `npm run assets:upload`

Expected: all five new `assets/games/traffic-escape/vehicle-*.png` files upload successfully.

- [ ] **Step 2: Run full automated verification**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build:weapp
npm run assets:check
npm run secrets:check -- --staged
git diff --check
```

Expected: every command exits 0; Taro may print its known `punycode` deprecation warning but must finish with `Compiled successfully`.

- [ ] **Step 3: Verify in WeChat Developer Tools**

Open the main checkout, compile, start both normal and hard games, and check that all three short and all three long silhouettes are visible, horizontal/vertical rotation is correct, selection remains visible, and a failed image still leaves a usable CSS vehicle.

- [ ] **Step 4: Commit final documentation if needed**

```bash
git status --short
```

Expected: clean worktree; do not create a commit for generated `dist/` files.
