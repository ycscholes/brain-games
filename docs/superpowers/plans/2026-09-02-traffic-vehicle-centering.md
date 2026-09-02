# Traffic Vehicle Centering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center each regenerated vehicle image inside its existing occupied grid cells without changing the vehicle container, grid occupancy, click target, or selection outline.

**Architecture:** Use the atlas slot's measured `visibleBounds` to compute normalized center offsets. Return those offsets as CSS custom properties from the atlas style helpers and apply them to both the color image layer and the black grid-hiding mask. Keep the existing crop dimensions and rotation rules unchanged.

**Tech Stack:** Taro React, TypeScript, SCSS, Jest.

---

### Task 1: Define centering style data and regression tests

**Files:**
- Modify: `src/pages/traffic-escape/vehicleAtlas.ts`
- Test: `tests/unit/trafficVehicleAtlas.test.ts`

- [x] **Step 1: Add a typed centering style contract and failing expectations**

Extend the crop style with numeric CSS custom properties representing the slot-center correction, and assert that the style for a representative two-cell and three-cell slot returns the expected values from `visibleBounds`.

- [x] **Step 2: Run the focused test and verify the new expectation fails**

Run: `npx jest tests/unit/trafficVehicleAtlas.test.ts --runInBand`
Expected: the new centering-style assertions fail because the style has no centering variables yet.

- [x] **Step 3: Implement the minimal centering calculation**

Calculate `(512 - (left + right) / 2) / 1024 * 100` and `(slotHeight / 2 - (top + bottom) / 2) / slotHeight * 100`, return them as CSS custom properties, and preserve the existing background crop fields.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `npx jest tests/unit/trafficVehicleAtlas.test.ts --runInBand`
Expected: all traffic atlas tests pass.

### Task 2: Apply centering to both atlas layers

**Files:**
- Modify: `src/pages/traffic-escape/index.scss`

- [x] **Step 1: Use the calculated position in the image and mask positioning**

Apply the horizontal and vertical corrections to the atlas layer's background position while preserving the existing horizontal/vertical viewport sizes and rotation transforms. Both `.traffic-vehicle-atlas-viewport` and `.traffic-vehicle-atlas-mask` receive the same correction because both use the shared style object.

- [x] **Step 2: Run the focused tests and static checks**

Run: `npx jest tests/unit/trafficVehicleAtlas.test.ts tests/unit/remoteAssets.test.ts --runInBand && npm run typecheck && npm run lint`
Expected: all tests and checks pass.

### Task 3: Verify and commit

**Files:**
- Include only the modified atlas source, SCSS, and unit test files in the commit.

- [x] **Step 1: Run the project verification commands**

Run: `npm test -- --runInBand && npm run typecheck && npm run lint && npm run build:weapp && npm run secrets:check && git diff --check`
Expected: every command exits successfully.

- [x] **Step 2: Commit the scoped change**

Run: `git add src/pages/traffic-escape/vehicleAtlas.ts src/pages/traffic-escape/index.scss tests/unit/trafficVehicleAtlas.test.ts && git diff --cached --check && git commit -m "fix: center traffic vehicle atlas images"`
Expected: the commit succeeds and unrelated worktree files remain unstaged.
