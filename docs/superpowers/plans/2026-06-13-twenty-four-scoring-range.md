# 24 点计分与数字范围 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 24 点单题得分提高到 2 分，并保证所有题面数字都在 0 至 10。

**Architecture:** 将页面中的纯游戏逻辑提取到同目录 `gameLogic.ts`，用导出常量统一约束数字范围和单题分值。页面分别维护解题数与游戏得分，训练记录和共享宠物积分管线继续使用游戏得分。

**Tech Stack:** TypeScript、React、Taro、Jest

---

### Task 1: 为游戏规则添加失败测试

**Files:**
- Create: `tests/unit/twentyFourGameLogic.test.ts`

- [ ] **Step 1: 编写规则测试**

测试 `POINTS_PER_SOLVED_ROUND === 2`，通过 mock `Math.random()` 验证边界 0 和 10，并批量验证 `generateRound()` 只生成 `0..10` 的可解题目。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest tests/unit/twentyFourGameLogic.test.ts --runInBand`

Expected: FAIL，因为 `src/pages/twenty-four/gameLogic.ts` 尚不存在。

### Task 2: 提取纯逻辑并满足规则

**Files:**
- Create: `src/pages/twenty-four/gameLogic.ts`
- Modify: `src/pages/twenty-four/index.tsx`

- [ ] **Step 1: 创建纯逻辑模块**

导出 `MIN_CARD_VALUE = 0`、`MAX_CARD_VALUE = 10`、`POINTS_PER_SOLVED_ROUND = 2`、`solveTwentyFour()`、`generateRound()` 和 `evaluateExpression()`。

- [ ] **Step 2: 页面改用纯逻辑模块**

删除页面内重复实现；普通和困难均调用 `generateRound()`；正确答案增加 2 游戏分及 1 解题数；提示题保持不计分。

- [ ] **Step 3: 运行逻辑测试**

Run: `npx jest tests/unit/twentyFourGameLogic.test.ts --runInBand`

Expected: PASS。

### Task 3: 同步界面和积分文档

**Files:**
- Modify: `src/pages/twenty-four/index.tsx`
- Modify: `src/pages/twenty-four/README.md`
- Modify: `docs/points-economy.md`
- Modify: `tests/unit/trainingStorage.test.ts`

- [ ] **Step 1: 更新用户文案**

规则说明每题 2 分且数字范围为 0 至 10；游戏中显示“当前得分”，结算同时显示解题数和游戏得分。

- [ ] **Step 2: 更新积分经济与测试样例**

记录 24 点每题 2 分、基础转换率 2.0x，以及普通/困难奖励范围；积分测试用新的典型游戏分验证共享管线。

### Task 4: 验证并提交

**Files:**
- Test: `tests/unit/twentyFourGameLogic.test.ts`
- Test: `tests/unit/trainingStorage.test.ts`

- [ ] **Step 1: 运行相关测试**

Run: `npx jest tests/unit/twentyFourGameLogic.test.ts tests/unit/trainingStorage.test.ts --runInBand`

Expected: PASS。

- [ ] **Step 2: 运行静态检查**

Run: `npm run typecheck && npm run lint`

Expected: 两条命令均退出 0。

- [ ] **Step 3: 创建任务提交**

仅暂存本计划列出的文件并提交，不包含工作区中的无关改动。
