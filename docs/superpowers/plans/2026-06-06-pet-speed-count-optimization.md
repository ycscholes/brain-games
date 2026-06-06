# Pet Speed Count Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the pet speed count scene so pets blend into the farm strip, appear across the full scroll length on ground areas, and only start after pet images are preloaded.

**Architecture:** Keep the feature inside `src/pages/bird-count`: game logic owns stable generated pet coordinates and moods, while the page owns loading state and image preloading. CSS changes are scoped to speed-count pet tokens so yard-count visuals keep their existing framed style.

**Tech Stack:** Taro React, TypeScript, Jest unit tests, SCSS, existing cloud pet image resolver.

---

### Task 1: Grounded Pet Placement

**Files:**
- Modify: `src/pages/bird-count/gameLogic.ts`
- Test: `tests/unit/birdCountGameLogic.test.ts`

- [ ] Replace the old row-offset x/y generation with segmented x placement across the full strip and y placement in the lower farm area.
- [ ] Add tests that generated pets reach the later half of the scroll and never appear in the sky band.

### Task 2: Embedded Pet Visuals

**Files:**
- Modify: `src/pages/bird-count/index.scss`

- [ ] Remove the background, border, and large shadow from `.pet-count-token`.
- [ ] Preserve `.yard-pet-token`, `.moving-yard-pet`, and target prompt styling.
- [ ] Keep a subtle ground shadow under speed pets for readability.

### Task 3: Speed Image Preload Gate

**Files:**
- Modify: `src/pages/bird-count/index.tsx`

- [ ] Add a `loading` phase used only after starting speed mode.
- [ ] Resolve and preload each unique speed pet image plus the target idle images before the first question begins.
- [ ] Show a compact loading animation and progress text while preloading.
- [ ] Fall back after preload failures by continuing with cached/resolved sprites instead of blocking the game.

### Task 4: Verification

**Files:**
- Test: `tests/unit/birdCountGameLogic.test.ts`

- [ ] Run `npm test -- --runInBand tests/unit/birdCountGameLogic.test.ts tests/unit/headCountGameLogic.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build:weapp`.
- [ ] Run `npm run build:h5`.
- [ ] Smoke test H5 speed mode and confirm loading, full-strip distribution, ground-only placement, and frameless speed pets.
