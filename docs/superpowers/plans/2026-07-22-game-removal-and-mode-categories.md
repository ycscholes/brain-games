# 游戏下线与玩法分类 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove 逻辑破译 and 大小迷阵 completely, then group every remaining game by its core gameplay mode.

**Architecture:** `src/config/gameCatalog.ts` owns categories and ordering. Both game-list pages derive sections from that data, so no grouping component needs new state or branching. Retired games must disappear from typed catalogs, runtime registries, pages, sharing, styling, tests, and reward documentation; existing persisted records remain untouched.

**Tech Stack:** Taro, React, TypeScript, Jest, Sass.

---

### Task 1: Define the new catalog contract in tests

**Files:**
- Modify: `tests/unit/gameCatalog.test.ts`
- Modify: `tests/unit/trainingStorage.test.ts`

- [ ] **Step 1: Import and assert category display order**

Add `GAME_CATEGORIES` to the catalog test imports and assert:

```ts
expect(GAME_CATEGORIES).toEqual([
  { id: "math", title: "计算与数理" },
  { id: "memory", title: "记忆与反应" },
  { id: "reasoning", title: "推理" },
  { id: "language", title: "语言" },
  { id: "challenge", title: "综合挑战" },
]);
```

- [ ] **Step 2: Update retired-game and category assertions**

Replace assertions that the all-games and gauntlet lists contain `code-breaker` and `inequality-grid` with `not.toContain` assertions. Change the candidate length to 17. Assert `pattern-completion` and `traffic-escape` are `reasoning`, and `game-gauntlet` is `challenge`.

- [ ] **Step 3: Remove the two retired IDs from reward assertions**

Rename the shared 1x conversion test to omit `code-breaker` and `inequality-grid`, delete their four direct expectations, and delete both IDs from the typical-performance rewards array.

- [ ] **Step 4: Run the focused tests and confirm failure**

Run `npx jest tests/unit/gameCatalog.test.ts tests/unit/trainingStorage.test.ts --runInBand`.

Expected: FAIL because the current catalog still uses `daily` and `advanced`, includes both games, and has 19 gauntlet candidates.

- [ ] **Step 5: Commit the red tests**

Run `git add tests/unit/gameCatalog.test.ts tests/unit/trainingStorage.test.ts && git commit -m "test: define retired games and mode categories"`.

### Task 2: Implement catalog and reward-registry changes

**Files:**
- Modify: `src/config/gameCatalog.ts`
- Modify: `src/utils/trainingStorage.ts`

- [ ] **Step 1: Replace the category type and category list**

```ts
export type GameCategoryId = "math" | "memory" | "reasoning" | "language" | "challenge";

export const GAME_CATEGORIES: Array<{ id: GameCategoryId; title: string }> = [
  { id: "math", title: "计算与数理" },
  { id: "memory", title: "记忆与反应" },
  { id: "reasoning", title: "推理" },
  { id: "language", title: "语言" },
  { id: "challenge", title: "综合挑战" },
];
```

- [ ] **Step 2: Assign the remaining catalog records by core mode**

Set `mental-math` and `twenty-four` to `math`; set `digit-span`, `rock-paper-scissors`, `color-trap`, `number-order`, `memory-challenge`, `multiple-object-tracking`, and `bird-count` to `memory`; set `pattern-completion`, `spatial-rotation`, `triad-match`, `hidato`, `tents-camp`, `sumplete-grid`, and `traffic-escape` to `reasoning`; set `word-scramble` to `language`; set `game-gauntlet` to `challenge`.

- [ ] **Step 3: Delete both retired games from the catalog and typed registries**

Delete their `GAME_CATALOG` and `GAME_TITLE_MAP` entries. Delete `"code-breaker"` and `"inequality-grid"` from `TrainingGameId` and `TRAINING_POINT_RATES`. Do not migrate or erase local history, since training-record rendering already falls back to the raw historical ID.

- [ ] **Step 4: Run focused tests and confirm green**

Run `npx jest tests/unit/gameCatalog.test.ts tests/unit/trainingStorage.test.ts --runInBand`.

Expected: PASS.

- [ ] **Step 5: Commit catalog changes**

Run `git add src/config/gameCatalog.ts src/utils/trainingStorage.ts && git commit -m "feat: organize games by gameplay mode"`.

### Task 3: Remove retired pages and user-facing registrations

**Files:**
- Modify: `src/app.config.ts`
- Modify: `src/utils/share.ts`
- Modify: `src/styles/game-list.scss`
- Delete: `src/pages/code-breaker/index.tsx`
- Delete: `src/pages/code-breaker/index.scss`
- Delete: `src/pages/code-breaker/gameLogic.ts`
- Delete: `src/pages/inequality-grid/index.tsx`
- Delete: `src/pages/inequality-grid/index.scss`
- Delete: `src/pages/inequality-grid/gameLogic.ts`
- Delete: `tests/unit/codeBreakerGameLogic.test.ts`
- Delete: `tests/unit/inequalityGridGameLogic.test.ts`

- [ ] **Step 1: Remove page and sharing entries**

Delete both `pages/code-breaker/index` and `pages/inequality-grid/index` entries from `src/app.config.ts`, `SHARE_PAGE_PATHS`, and `SHARE_PAGE_CONTENT`.

- [ ] **Step 2: Remove unused card styles**

Delete `.card-code-breaker`, `.card-inequality-grid`, `.card-code-breaker .game-badge`, and `.card-inequality-grid .game-badge` from `src/styles/game-list.scss`.

- [ ] **Step 3: Delete isolated modules and tests**

Delete the two page directories and the two listed game-logic test files.

- [ ] **Step 4: Prove all production and test references are gone**

Run `rg -n "code-breaker|inequality-grid|逻辑破译|大小迷阵" src`.

Expected: no output and exit status 1.

- [ ] **Step 5: Commit the complete removal**

Run `git add src/app.config.ts src/utils/share.ts src/styles/game-list.scss src/pages/code-breaker src/pages/inequality-grid tests/unit/codeBreakerGameLogic.test.ts tests/unit/inequalityGridGameLogic.test.ts && git commit -m "feat: remove retired logic games"`.

### Task 4: Align text and points documentation

**Files:**
- Modify: `src/pages/all-games/index.tsx`
- Modify: `docs/points-economy.md`

- [ ] **Step 1: Replace stale browsing-copy**

Replace the all-games summary line with:

```tsx
<Text className="summary-copy">按计算、记忆、推理、语言与综合挑战浏览训练。</Text>
```

- [ ] **Step 2: Remove retired rules from points-economy documentation**

Delete each retired game’s conversion-table row, ID-standard row, and detailed gameplay/reward paragraph. Preserve every remaining scoring rule.

- [ ] **Step 3: Scan all maintained sources for stale references**

Run `rg -n "code-breaker|inequality-grid|逻辑破译|大小迷阵" src docs --glob '!docs/superpowers/specs/2026-07-22-game-removal-and-mode-categories-design.md' --glob '!docs/superpowers/plans/2026-07-22-game-removal-and-mode-categories.md'`.

Expected: no output and exit status 1.

- [ ] **Step 4: Commit content alignment**

Run `git add src/pages/all-games/index.tsx docs/points-economy.md && git commit -m "docs: remove retired game reward rules"`.

### Task 5: Verify the integrated removal and regrouping

**Files:**
- Verify only: all files changed in Tasks 1–4

- [ ] **Step 1: Run relevant unit tests**

Run `npx jest tests/unit/gameCatalog.test.ts tests/unit/gameGauntlet.test.ts tests/unit/trainingStorage.test.ts --runInBand`.

Expected: PASS.

- [ ] **Step 2: Run project checks**

Run `npm run typecheck`, then `npm run lint`, then `npm run build:weapp`, then `npm run secrets:check`, then `git diff --check`.

Expected: every command exits 0. A successful build may include the existing non-blocking `punycode` warning.

- [ ] **Step 3: Confirm a clean handoff**

Run `git status --short`.

Expected: no uncommitted task changes; if verification required a fix, stage only that fix and commit it before handoff.
