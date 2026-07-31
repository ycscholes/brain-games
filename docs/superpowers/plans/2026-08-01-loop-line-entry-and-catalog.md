# 环线谜踪入口与目录统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一环线谜踪的开始页与目录卡片，并固定推理游戏顺序。

**Architecture:** 开始阶段复用 24 点的通用入口语义；游玩和结算流程保持不变。目录以 `ALL_GAME_ITEMS` 为唯一排序来源。

**Tech Stack:** Taro React、TypeScript、SCSS、Jest。

---

### Task 1: 锁定推理目录顺序

**Files:**
- Modify: `tests/unit/gameCatalog.test.ts:37-44`
- Modify: `src/config/gameCatalog.ts:368-376`

- [x] **Step 1: Write the failing test**

```ts
expect(idsFor("reasoning").slice(0, 5)).toEqual([
  "hidato", "tents-camp", "loop-line", "traffic-escape", "netwalk",
]);
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/gameCatalog.test.ts`  
Expected: FAIL because netwalk currently precedes loop-line.

- [x] **Step 3: Write minimal implementation**

Set catalogue priorities to `hidato: 0`, `tents-camp: 1`, `loop-line: 2`, `traffic-escape: 3`, and `netwalk: 4`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/gameCatalog.test.ts`  
Expected: PASS.

### Task 2: 使用通用入口骨架重构开始页

**Files:**
- Modify: `src/pages/loop-line/index.tsx:181-221`
- Modify: `src/pages/loop-line/index.scss:1-58`

- [x] **Step 1: Replace the start markup**

Use `start-screen`, `header-section`, `rules-card`, `summary-card`, `floating-start-action`, and `floating-start-spacer`. Retain title, best score, three rules, difficulty selection, and gauntlet auto-start behavior.

- [x] **Step 2: Apply start-only SCSS**

Replace the dark hero, radar, rule card, and start-button styling with light start-state styles. Do not change `.loop-line-play`, `.loop-line-board`, or `.loop-line-finished` visuals.

- [x] **Step 3: Verify start-state contracts**

Run: `npm run typecheck`  
Expected: PASS with existing `startGame`, `difficulty`, `best`, and `isGauntletPreset` usage retained.

### Task 3: 移除目录专属覆盖并完成回归

**Files:**
- Modify: `src/styles/game-list.scss:314-318,529-532`

- [x] **Step 1: Remove loop-line overrides**

Delete `.card-loop-line` background and badge-color overrides so shared card styling applies.

- [x] **Step 2: Run full verification**

Run: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build:weapp`, `npm run secrets:check`, and `git diff --check`.

- [x] **Step 3: Commit**

Stage only this plan, test, catalog, loop-line page, and shared card style; commit as `fix: align loop line entry and catalog`.
