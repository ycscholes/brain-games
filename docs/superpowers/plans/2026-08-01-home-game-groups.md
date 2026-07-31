# 首页游戏分组与排序 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使首页按全部游戏页的排序展示卡片，并展示指定的四项推理游戏。

**Architecture:** `ALL_GAME_ITEMS` 继续作为唯一的公开目录排序结果。新增首页分组配置，以游戏 ID 表达需要展示的类别及上限；首页从 `ALL_GAME_ITEMS` 过滤该配置，确保组内顺序与全部游戏一致，同时保留 `isHot` 对推荐权重的既有含义。

**Tech Stack:** TypeScript、React、Taro、Jest。

---

### Task 1: 先用目录测试定义首页分组契约

**Files:**

- Modify: `tests/unit/gameCatalog.test.ts`
- Test: `tests/unit/gameCatalog.test.ts`

- [ ] **Step 1: 写出失败测试**

在导入中加入 `HOME_GAME_GROUPS`，并追加以下测试：

```ts
test("defines home groups from the all-games ordering with four reasoning games", () => {
  expect(HOME_GAME_GROUPS.map((group) => group.id)).toEqual(["math", "memory", "reasoning"]);
  expect(HOME_GAME_GROUPS.find((group) => group.id === "reasoning")?.gameIds).toEqual([
    "hidato", "tents-camp", "netwalk", "traffic-escape",
  ]);
});
```

- [ ] **Step 2: 确认测试因缺少首页分组配置而失败**

运行：`npm test -- --runInBand tests/unit/gameCatalog.test.ts`

预期：测试失败，并提示 `HOME_GAME_GROUPS` 尚未导出。

### Task 2: 在目录中实现首页分组配置

**Files:**

- Modify: `src/config/gameCatalog.ts`
- Test: `tests/unit/gameCatalog.test.ts`

- [ ] **Step 1: 添加首页分组类型和配置**

在 `ALL_GAME_ITEMS` 之后添加：

```ts
export interface HomeGameGroup {
  id: GameCategoryId;
  gameIds: TrainingGameId[];
}

export const HOME_GAME_GROUPS: HomeGameGroup[] = [
  { id: "math", gameIds: ["mental-math", "twenty-four"] },
  { id: "memory", gameIds: ["digit-span", "rock-paper-scissors", "memory-challenge", "bird-count"] },
  { id: "reasoning", gameIds: ["hidato", "tents-camp", "netwalk", "traffic-escape"] },
];
```

- [ ] **Step 2: 派生已排序的首页卡片**

添加：

```ts
const HOME_GAME_IDS = new Set(HOME_GAME_GROUPS.flatMap((group) => group.gameIds));
export const HOME_GAME_ITEMS = ALL_GAME_ITEMS.filter((game) => HOME_GAME_IDS.has(game.id));
```

- [ ] **Step 3: 运行目标测试，确认通过**

运行：`npm test -- --runInBand tests/unit/gameCatalog.test.ts`

预期：`gameCatalog` 测试全部通过。

### Task 3: 让首页使用共享排序的首页目录

**Files:**

- Modify: `src/pages/index/index.tsx`
- Test: `tests/unit/gameCatalog.test.ts`

- [ ] **Step 1: 用 `HOME_GAME_ITEMS` 取代 `HOT_GAME_ITEMS`**

将首页目录导入和 `refreshDashboard` 中的映射改为：

```ts
import { HOME_GAME_ITEMS } from "../../config/gameCatalog";
const nextGames = HOME_GAME_ITEMS.map((game) => ({ ...game, summary: /* 保持现有摘要 */ }));
```

既有 `GAME_CATEGORIES` 分组渲染不变，因而按已排序的 `HOME_GAME_ITEMS` 显示。

- [ ] **Step 2: 再次运行目录测试**

运行：`npm test -- --runInBand tests/unit/gameCatalog.test.ts`

预期：推理组顺序为连数迷阵、帐篷营地、网络回路、车阵突围。

### Task 4: 完整验证并提交

**Files:**

- Modify: `src/config/gameCatalog.ts`
- Modify: `src/pages/index/index.tsx`
- Modify: `tests/unit/gameCatalog.test.ts`

- [ ] **Step 1: 运行完整校验**

运行：`npm test -- --runInBand tests/unit/gameCatalog.test.ts && npm run typecheck && npm run lint && npm run build:weapp && npm run secrets:check && git diff --check`

预期：全部成功；若构建只出现既有 `punycode` 弃用警告，不视为失败。

- [ ] **Step 2: 提交实现**

运行：`git add src/config/gameCatalog.ts src/pages/index/index.tsx tests/unit/gameCatalog.test.ts && git commit -m "feat: align home game group ordering"`

预期：只提交这三个实现文件。
