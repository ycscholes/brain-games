# 音符小探险儿童优先改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用低识字 UI 与可靠真拖拽让儿童完成音符放置。

**Architecture:** 保持纯逻辑中的坐标换算与判定，页面只保存拖拽视觉状态；以 CSS 提供可关闭的温和反馈。

**Tech Stack:** Taro、React、TypeScript、Sass、Jest。

**Spec:** `docs/superpowers/specs/2026-08-28-music-theory-child-first-design.md`

## Global Constraints

- 不改变共享积分、题库和闯关契约。
- 游戏内可见文案优先为 2–4 个汉字。
- 不新增位图资源或依赖；reduced-motion 必须生效。

---

### Task 1: 拖拽状态与坐标回归

**Files:**
- Modify: `tests/unit/musicTheoryGameLogic.test.ts`
- Modify: `src/pages/music-theory/gameLogic.ts`
- Modify: `src/pages/music-theory/index.tsx`

- [ ] **Step 1: 写失败测试**

```ts
expect(toStaffLocalPoint({ x: 120, y: 260 }, { left: 20, top: 180 })).toEqual({ x: 100, y: 80 });
expect(resolveStaffDrop(getAllStaffSlots(), { x: 100, y: 80 })).toBe("staff-c4");
```

- [ ] **Step 2: 验证红测**

Run: `npm test -- --runTestsByPath tests/unit/musicTheoryGameLogic.test.ts`
Expected: FAIL until the selected release point converts to staff-local coordinates.

- [ ] **Step 3: 实现最小修复**

Use measured `.staff` bounds for start/move/end, preserve the latest local point, and render a `drag-ghost` from that point. Release outside a slot must retain the level and show a short retry message.

- [ ] **Step 4: 验证绿测**

Run: `npm test -- --runTestsByPath tests/unit/musicTheoryGameLogic.test.ts`
Expected: PASS.

### Task 2: 儿童优先文案与温柔动效

**Files:**
- Modify: `src/pages/music-theory/index.tsx`
- Modify: `src/pages/music-theory/index.scss`

- [ ] **Step 1: 替换屏幕内长文案**

Use short labels such as `选音符`、`放这里`、`对了`、`再试`、`提示` and icon-led topic markers; do not remove the accessible `aria-label` equivalents where Taro supports them.

- [ ] **Step 2: 加入 CSS 状态动画**

Implement `target-breathe`, `success-stars`, `shake-once`, and drag-ghost styles. The animations are state-triggered rather than permanent except the target’s gentle pulse, and all are disabled by the existing reduced-motion query.

- [ ] **Step 3: 验证小程序构建**

Run: `npm run typecheck && npm run lint && npm run build:weapp`
Expected: all commands succeed.

### Task 3: 全量验证和提交

**Files:**
- Modify: files above

- [ ] **Step 1: 执行全量验证**

Run: `npm test && npm run secrets:check && git diff --check`
Expected: all checks pass.

- [ ] **Step 2: 提交**

Run: `git add docs/superpowers/specs/2026-08-28-music-theory-child-first-design.md docs/superpowers/plans/2026-08-28-music-theory-child-first.md src/pages/music-theory tests/unit/musicTheoryGameLogic.test.ts && git commit -m "feat: simplify music theory child interaction"`
Expected: only task files are included.
