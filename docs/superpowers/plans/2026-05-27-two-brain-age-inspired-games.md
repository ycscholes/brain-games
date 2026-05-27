# 两款 Brain Age 启发小游戏 实施计划

> **For Codex workers:** Implement this plan task-by-task. Use the checkbox (`- [ ]`) steps for tracking. Do not skip verification. Stage and commit only files related to this feature.

**Goal:** 在当前脑力训练合集里新增两款参考《川岛博士脑部锻炼》机制、但采用本项目本土化包装的小游戏：`星图排序` 和 `小剧场清点`。

**Design Spec:** `docs/superpowers/specs/2026-05-27-two-brain-age-inspired-games-design.md`

**Architecture:** 新增两个 Taro 页面，每个页面配一个纯逻辑模块。页面负责 UI、状态流、计时器、记录和积分写入；逻辑模块负责题目生成、答案校验、得分计算和难度参数，方便单元测试。

**Tech Stack:** Taro 4 + React 18 + TypeScript + Sass + Jest。

---

## 文件影响

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `src/pages/number-order/index.tsx` | 新建 | 星图排序页面 |
| `src/pages/number-order/index.scss` | 新建 | 星图排序样式 |
| `src/pages/number-order/index.config.ts` | 新建 | 星图排序页面配置 |
| `src/pages/number-order/gameLogic.ts` | 新建 | 星图排序纯逻辑 |
| `src/pages/head-count/index.tsx` | 新建 | 小剧场清点页面 |
| `src/pages/head-count/index.scss` | 新建 | 小剧场清点样式 |
| `src/pages/head-count/index.config.ts` | 新建 | 小剧场清点页面配置 |
| `src/pages/head-count/gameLogic.ts` | 新建 | 小剧场清点纯逻辑 |
| `src/app.config.ts` | 修改 | 注册两个页面 |
| `src/pages/index/index.tsx` | 修改 | 首页卡片、标题、分类、推荐池 |
| `src/pages/index/index.scss` | 修改 | 新卡片视觉类 |
| `src/utils/trainingStorage.ts` | 修改 | 新 gameId、积分倍率、清理存储键 |
| `docs/points-economy.md` | 修改 | 补充积分经济说明 |
| `tests/unit/numberOrderGameLogic.test.ts` | 新建 | 星图排序逻辑测试 |
| `tests/unit/headCountGameLogic.test.ts` | 新建 | 小剧场清点逻辑测试 |
| `tests/unit/trainingStorage.test.ts` | 修改或新建 | 覆盖新 gameId 积分倍率 |

---

## 任务 1: 接入公共训练 ID 和积分倍率

**文件：**
- 修改: `src/utils/trainingStorage.ts`
- 修改或新建: `tests/unit/trainingStorage.test.ts`

- [ ] **Step 1: 扩展 `TrainingGameId`**

加入：

```ts
| "number-order"
| "head-count"
```

- [ ] **Step 2: 扩展 `TRAINING_POINT_RATES`**

加入：

```ts
"number-order": 1,
"head-count": 1,
```

- [ ] **Step 3: 扩展数据清理键**

在 `clearProductData()` 中加入：

```ts
number_order_best_normal
number_order_best_hard
head_count_best_normal
head_count_best_hard
```

- [ ] **Step 4: 添加或更新测试**

覆盖：

- `getAwardedPoints("number-order", 40, "normal")` 返回正常积分。
- `getAwardedPoints("head-count", 40, "hard")` 应用困难倍率和上限。

- [ ] **Step 5: 运行相关测试**

```bash
npm test -- --runTestsByPath tests/unit/trainingStorage.test.ts
```

如果仓库没有该测试文件，先创建最小覆盖测试，再运行对应命令。

---

## 任务 2: 实现星图排序纯逻辑

**文件：**
- 新建: `src/pages/number-order/gameLogic.ts`
- 新建: `tests/unit/numberOrderGameLogic.test.ts`

- [ ] **Step 1: 定义类型和难度参数**

建议导出：

```ts
export type NumberOrderDifficulty = "normal" | "hard";
export interface NumberOrderPoint { id: string; value: number; x: number; y: number; }
export interface NumberOrderQuestion { id: string; points: NumberOrderPoint[]; answerIds: string[]; revealMs: number; }
```

参数要求：

- 普通：4-6 个数字，范围 1-19，展示时间更长。
- 困难：5-7 个数字，范围 1-31，展示时间更短。
- 单局固定 8 题。

- [ ] **Step 2: 实现题目生成**

生成函数应保证：

- 同题数字不重复。
- 点位不重复。
- `answerIds` 按数字升序排列，答案唯一。
- 题目难度随题号略微递增。

- [ ] **Step 3: 实现答案校验和计分**

建议导出：

```ts
export function isCorrectTap(question, tappedIds): boolean
export function scoreNumberOrderQuestion(params): number
```

计分要求：

- 每个正确点 `+1`。
- 整题全对 `+2`。
- 连续全对题有 combo bonus，单题最多 `+2`。

- [ ] **Step 4: 单元测试**

覆盖：

- 普通/困难每题数字唯一。
- `answerIds` 严格升序。
- 题目点位数量符合难度和题号参数。
- 全对、部分正确、错误点击的得分符合规则。
- combo bonus 不超过上限。

- [ ] **Step 5: 运行测试**

```bash
npm test -- --runTestsByPath tests/unit/numberOrderGameLogic.test.ts
```

---

## 任务 3: 实现星图排序页面

**文件：**
- 新建: `src/pages/number-order/index.tsx`
- 新建: `src/pages/number-order/index.scss`
- 新建: `src/pages/number-order/index.config.ts`

- [ ] **Step 1: 页面配置**

`index.config.ts` 设置导航标题为：

```ts
navigationBarTitleText: "星图排序"
```

- [ ] **Step 2: 实现页面状态机**

建议 phase：

```ts
"start" | "ready" | "revealing" | "answering" | "feedback" | "finished"
```

状态要求：

- start 页显示规则、最高分、普通/困难选择。
- revealing 阶段显示数字节点。
- answering 阶段隐藏数字，只保留可点击节点。
- feedback 阶段显示本题正确/错误和得分。
- finished 阶段显示总分、正确率、最高分、奖励积分。

- [ ] **Step 3: 写入积分和训练记录**

完成 8 题后：

```ts
const awardedPoints = getAwardedPoints("number-order", finalScore, rewardDifficulty)
addPointsToPet("number-order", finalScore, rewardDifficulty)
recordTrainingSession({
  gameId: "number-order",
  score: finalScore,
  awardedPoints,
  durationSeconds,
  difficulty: rewardDifficulty,
  outcome: "completed",
})
```

- [ ] **Step 4: 最高分存储**

使用：

- `number_order_best_normal`
- `number_order_best_hard`

页面进入时读取当前难度最高分，结算时按难度更新。

- [ ] **Step 5: 样式实现**

要求：

- 星图区域尺寸稳定，不因隐藏数字或反馈文字跳动。
- 节点点击区域足够大。
- 普通/困难切换与现有游戏风格一致。
- 不新增图片资源，使用 CSS、Text、View 表达星点和反馈。

---

## 任务 4: 实现小剧场清点纯逻辑

**文件：**
- 新建: `src/pages/head-count/gameLogic.ts`
- 新建: `tests/unit/headCountGameLogic.test.ts`

- [ ] **Step 1: 定义类型和难度参数**

建议导出：

```ts
export type HeadCountDifficulty = "normal" | "hard";
export interface HeadCountEvent { delta: number; direction: "enter" | "leave"; }
export interface HeadCountQuestion { id: string; initialCount: number; events: HeadCountEvent[]; answer: number; options: number[]; eventMs: number; }
```

参数要求：

- 普通：初始 1-5 人，3-4 段事件，每段 1-2 人。
- 困难：初始 2-8 人，4-6 段事件，每段 1-3 人。
- 单局固定 8 题。

- [ ] **Step 2: 实现事件生成**

生成函数应保证：

- 任意中间状态人数不为负。
- 最终答案在合理范围内。
- 困难模式允许连续进入或连续离开。

- [ ] **Step 3: 实现答案选项生成**

要求：

- 4 个数字选项。
- 正确答案只出现一次。
- 干扰项尽量接近答案。
- 选项顺序随机。

- [ ] **Step 4: 实现计分**

计分要求：

- 答对每题 `+5`。
- 快速答对 `+0` 到 `+2`。
- 连续答对 `+1`。
- 答错不得分。

- [ ] **Step 5: 单元测试**

覆盖：

- 普通/困难事件数量和变化量符合参数。
- 人数过程不会低于 0。
- 选项包含正确答案且只包含一次。
- 答对、答错、速度奖励、combo 奖励符合规则。

- [ ] **Step 6: 运行测试**

```bash
npm test -- --runTestsByPath tests/unit/headCountGameLogic.test.ts
```

---

## 任务 5: 实现小剧场清点页面

**文件：**
- 新建: `src/pages/head-count/index.tsx`
- 新建: `src/pages/head-count/index.scss`
- 新建: `src/pages/head-count/index.config.ts`

- [ ] **Step 1: 页面配置**

`index.config.ts` 设置导航标题为：

```ts
navigationBarTitleText: "小剧场清点"
```

- [ ] **Step 2: 实现页面状态机**

建议 phase：

```ts
"start" | "ready" | "playing-event" | "answering" | "feedback" | "finished"
```

状态要求：

- start 页显示规则、最高分、普通/困难选择。
- playing-event 阶段逐段播放进入/离开事件。
- answering 阶段展示四个稳定答案按钮。
- feedback 阶段展示正确答案和本题得分。
- finished 阶段展示总分、正确率、最高分、奖励积分。

- [ ] **Step 3: 写入积分和训练记录**

完成 8 题后：

```ts
const awardedPoints = getAwardedPoints("head-count", finalScore, rewardDifficulty)
addPointsToPet("head-count", finalScore, rewardDifficulty)
recordTrainingSession({
  gameId: "head-count",
  score: finalScore,
  awardedPoints,
  durationSeconds,
  difficulty: rewardDifficulty,
  outcome: "completed",
})
```

- [ ] **Step 4: 最高分存储**

使用：

- `head_count_best_normal`
- `head_count_best_hard`

页面进入时读取当前难度最高分，结算时按难度更新。

- [ ] **Step 5: 样式实现**

要求：

- 房间/舞台、左右门和人物 token 都用 CSS + Text/View 实现。
- 事件播放时不产生明显布局跳动。
- 四个答案按钮固定尺寸。
- 困难模式节奏更快但仍可读。

---

## 任务 6: 注册页面和首页入口

**文件：**
- 修改: `src/app.config.ts`
- 修改: `src/pages/index/index.tsx`
- 修改: `src/pages/index/index.scss`

- [ ] **Step 1: 注册页面**

在 `pages` 中加入：

```ts
"pages/number-order/index",
"pages/head-count/index",
```

位置建议放在现有训练页区域，宠物、设置、训练记录之前。

- [ ] **Step 2: 首页新增卡片**

在 `BASE_GAMES` 中加入：

```ts
{
  id: "number-order",
  title: "星图排序",
  badge: "记忆",
  cardClass: "card-number-order",
  url: "/pages/number-order/index",
  category: "memory",
  duration: "约 2 分钟",
  skill: "空间记忆",
  level: "标准",
}
```

```ts
{
  id: "head-count",
  title: "小剧场清点",
  badge: "专注",
  cardClass: "card-head-count",
  url: "/pages/head-count/index",
  category: "advanced",
  duration: "约 2 分钟",
  skill: "动态计数",
  level: "进阶",
}
```

- [ ] **Step 3: 更新 `GAME_TITLES`**

加入：

```ts
"number-order": "星图排序",
"head-count": "小剧场清点",
```

- [ ] **Step 4: 添加首页卡片样式**

新增 `card-number-order` 和 `card-head-count`，保持现有卡片视觉体系，但避免只用单一蓝紫或深色调。

- [ ] **Step 5: 手动检查首页行为**

确认：

- 两张卡片出现于对应分组。
- 搜索标题、badge、skill、分类都能命中。
- 推荐下一练能覆盖这两个 ID。

---

## 任务 7: 更新积分经济文档

**文件：**
- 修改: `docs/points-economy.md`

- [ ] **Step 1: 更新游戏转换率表**

加入：

| 游戏名称 | 基础转换率 | 普通积分范围 | 困难积分范围 | 说明 |
|---------|-------:|------------|---------|------|
| 星图排序 (`number-order`) | 1.0x | 约 20-40 | 约 30-60 | 空间工作记忆，困难封顶 |
| 小剧场清点 (`head-count`) | 1.0x | 约 20-40 | 约 30-60 | 动态计数与持续注意，困难封顶 |

- [ ] **Step 2: 更新 gameId 规范表**

补充：

- `number-order`
- `head-count`

- [ ] **Step 3: 更新测试说明**

补充新逻辑测试和积分倍率测试。

---

## 任务 8: 全量验证

- [ ] **Step 1: TypeScript 检查**

```bash
npm run typecheck
```

- [ ] **Step 2: 单元测试**

```bash
npm test
```

- [ ] **Step 3: 小程序构建**

```bash
npm run build:weapp
```

- [ ] **Step 4: Git 检查**

```bash
git status --short
git diff --name-only
```

确认只包含本功能相关文件。

---

## 任务 9: 最终验收清单

- [ ] 首页显示 `星图排序` 和 `小剧场清点`。
- [ ] `星图排序` 在「反应与记忆」分组。
- [ ] `小剧场清点` 在「进阶专注」分组。
- [ ] 两款游戏普通/困难都能完成 8 题并结算。
- [ ] 完成后训练记录新增，dashboard 累计训练更新。
- [ ] 完成后宠物积分增加，奖励积分符合 `getAwardedPoints`。
- [ ] 最高分按普通/困难分别保存并能重新读取。
- [ ] `number-order` 不生成重复数字。
- [ ] `head-count` 不生成负数人数路径。
- [ ] `head-count` 四个答案选项只有一个正确答案。
- [ ] `npm run typecheck` 通过。
- [ ] `npm test` 通过。
- [ ] `npm run build:weapp` 通过。

---

## 任务 10: Commit

- [ ] **Step 1: Stage 相关文件**

```bash
git add \
  src/pages/number-order \
  src/pages/head-count \
  src/app.config.ts \
  src/pages/index/index.tsx \
  src/pages/index/index.scss \
  src/utils/trainingStorage.ts \
  docs/points-economy.md \
  tests/unit/numberOrderGameLogic.test.ts \
  tests/unit/headCountGameLogic.test.ts \
  tests/unit/trainingStorage.test.ts
```

如果 `tests/unit/trainingStorage.test.ts` 是新建或实际未修改，按真实变更调整 `git add`。

- [ ] **Step 2: 提交**

```bash
git commit -m "feat: add two brain training games"
```

- [ ] **Step 3: 汇报**

汇报应包含：

- 已新增的两款游戏。
- 验证命令和结果。
- 提交 hash。
- 如有未完成项，明确列出命令、失败原因和受影响文件。
