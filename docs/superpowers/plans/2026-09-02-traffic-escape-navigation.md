# 车阵突围页面优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the black footer from the traffic escape start page and provide a safe return-to-home action during gameplay.

**Architecture:** Keep the existing single-page `phase` state model. Add a small pure helper for the interruption payload so the return action remains testable, then let the page perform the existing points/record/gauntlet side effects and reset its runtime state. Use the current light start-screen background as the page background source of truth.

**Tech Stack:** Taro React, TypeScript, Sass, Jest.

---

### Task 1: Test the interruption payload

**Files:**
- Create: `src/pages/traffic-escape/navigation.ts`
- Create: `tests/unit/trafficEscapeNavigation.test.ts`

- [x] Add a pure `createTrafficEscapeInterruption` helper that accepts difficulty, elapsed seconds, move count, and hint count, and returns the score input plus awarded points using shared scoring functions.
- [x] Add tests for a normal interrupted round and a zero/negative elapsed-time input clamped to one second.
- [x] Run `npx jest tests/unit/trafficEscapeNavigation.test.ts --runInBand`; confirm the new import/helper test fails before implementation.
- [x] Implement the minimal helper and rerun the focused test until it passes.

### Task 2: Add gameplay return action and unify the start background

**Files:**
- Modify: `src/pages/traffic-escape/index.tsx`
- Modify: `src/pages/traffic-escape/index.scss`

- [x] Add `backToStart` to record an in-progress round as `interrupted`, delegate gauntlet runs through `completeGauntletLegIfNeeded`, reset runtime state, and set `phase` to `start`.
- [x] Render a compact `返回首页` action in the playing HUD with an accessible label.
- [x] Change the root and start-screen background declarations so the start page fills the viewport with one consistent light color, including the bottom safe-area/padding region.
- [x] Keep the result-page navigation unchanged.

### Task 3: Verify and commit

**Files:**
- Modify only the files above plus the new test/helper and plan document.

- [x] Run focused traffic escape tests, full `npm test`, `npm run typecheck`, `npm run lint`, `npm run build:weapp`, `npm run secrets:check`, and `git diff --check`.
- [x] Stage only task-related files and commit with `feat: polish traffic escape navigation`.
