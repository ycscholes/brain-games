# 音符小探险 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增“音符小探险”进阶儿童乐理游戏，完成“8 道基础选择题 → 4 道高音谱号拖放识谱题”的短局学习闭环，并完整接入训练记录、宠物积分、分享和大闯关。

**Architecture:** 题库、五线谱离散位置、拖放命中和计分放入无 Taro 依赖的纯逻辑模块；页面只管理阶段、手势、反馈和既有结算管线。所有奖励仍通过共享训练存储和宠物积分服务，闯关子局由现有汇总器接管。

**Tech Stack:** Taro 4、React 18、TypeScript、Sass、Jest、既有 Taro touch 事件与共享训练/宠物服务。

---

## 文件与职责

| 文件 | 操作 | 职责 |
| --- | --- | --- |
| `src/pages/music-theory/gameLogic.ts` | 新建 | 题库、章节元数据、题目选择、五线谱槽位、坐标命中、答案判定、计分。 |
| `src/pages/music-theory/index.tsx` | 新建 | 开始/答题/拖放/结算页面状态，触摸与点击回退，调用共享服务。 |
| `src/pages/music-theory/index.scss` | 新建 | 星空绘本主题、CSS 五线谱、拖放卡片、缩放与 reduced-motion 样式。 |
| `src/pages/music-theory/index.config.ts` | 新建 | 页面标题与小程序分享开关。 |
| `tests/unit/musicTheoryGameLogic.test.ts` | 新建 | 纯逻辑题库、识谱、拖放、提示、计分回归。 |
| `src/utils/trainingStorage.ts` | 修改 | `music-theory` gameId、1.0x 转换率、清理键。 |
| `src/config/gameCatalog.ts` | 修改 | 进阶目录、标题、全量游戏、闯关候选和首页不展示策略。 |
| `src/app.config.ts` | 修改 | 注册页面路由。 |
| `src/utils/share.ts` | 修改 | 注册页面路径及分享标题。 |
| `tests/unit/trainingStorage.test.ts` | 修改 | 奖励倍率与数据清理覆盖。 |
| `tests/unit/gameCatalog.test.ts` | 修改 | 目录、首页和闯关候选数量/顺序断言。 |
| `tests/unit/gameGauntlet.test.ts` | 修改 | 包含新单项游戏并维持三关唯一抽样。 |
| `docs/game-candidate-pool.md` | 修改 | 增加五候选 0–10 筛选、选择“音符小探险”的理由和适配记录。 |
| `docs/points-economy.md` | 修改 | 增加玩法、得分、普通/困难积分范围和共享奖励约束。 |

### Task 1: 记录候选筛选与积分契约

**Files:**
- Modify: `docs/game-candidate-pool.md`
- Modify: `docs/points-economy.md`

- [ ] **Step 1: 写入五候选筛选表**

为“音符小探险、节奏拍手、旋律阶梯、键盘寻音、乐谱拼图”分别给出可玩性、落地性、项目适配性 0–10 分和一句理由，明确“音符小探险”是唯一选定项。写明它不是单步视觉搜索，而是概念理解与空间映射两步训练。

- [ ] **Step 2: 写入积分经济说明**

新增表格行：`音符小探险 (music-theory) | 1.0x | 约 24-40 | 约 36-60`。正文定义固定 `8 + 4` 题、普通上限 40、困难游戏分上限 50、提示每次扣 2 游戏分，以及必须使用共享奖励管线。

- [ ] **Step 3: 检查文档一致性**

Run: `rg -n "音符小探险|music-theory|8.*4|1\.0x" docs/game-candidate-pool.md docs/points-economy.md`

Expected: 两份文档均出现相同 gameId、题量和奖励倍率，没有相互冲突的上限描述。

### Task 2: 建立可测试的乐理与五线谱领域模型

**Files:**
- Create: `src/pages/music-theory/gameLogic.ts`
- Test: `tests/unit/musicTheoryGameLogic.test.ts`

- [ ] **Step 1: 先写失败的领域测试**

创建测试并先导入尚不存在的模块。测试必须包含以下可观察契约：

```ts
expect(selectMusicTheoryQuestions("normal", "seed-a")).toHaveLength(8);
expect(new Set(selectMusicTheoryQuestions("normal", "seed-a").map((question) => question.id)).size).toBe(8);
expect(getStaffSlotForNote("C4")).toMatchObject({ kind: "ledger-line" });
expect(getStaffSlotForNote("G5")).toMatchObject({ kind: "above-space" });
expect(resolveStaffDrop(slots, { x: 120, y: 96 })).toBe("staff-e4");
expect(resolveStaffDrop(slots, { x: -1, y: -1 })).toBeNull();
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- --runTestsByPath tests/unit/musicTheoryGameLogic.test.ts`

Expected: FAIL，原因是 `../../src/pages/music-theory/gameLogic` 尚不存在。

- [ ] **Step 3: 实现最小领域模块**

定义以下导出并只实现首版范围：

```ts
export type MusicTheoryTopic = "rhythm" | "note" | "scale" | "staff";
export type MusicTheoryPhase = "quiz" | "staff-placement";
export type StaffSlotKind = "ledger-line" | "line" | "space" | "above-space";
export function selectMusicTheoryQuestions(difficulty: TrainingDifficulty, seed?: string): MusicTheoryQuestion[];
export function createStaffPlacementLevels(difficulty: TrainingDifficulty, seed?: string): StaffPlacementLevel[];
export function getStaffSlotForNote(note: string): StaffSlot;
export function resolveStaffDrop(slots: StaffDropSlot[], point: StaffPoint): string | null;
export function evaluateMusicTheoryScore(input: MusicTheoryScoreInput): number;
```

题库只允许确认范围内的高音谱号 C4–G5 与节拍/音符/音阶/五线谱知识；`resolveStaffDrop` 必须以槽位矩形判断而非像素相等；`completed: false` 时得分为 0。

- [ ] **Step 4: 扩展逻辑测试至完整边界**

覆盖：四主题均存在、普通/困难题目不重复、四道放置题目标唯一、C4–G5 每个位置映射正确、相邻线间不误判、越界返回 `null`、提示扣分、普通不超过 40、困难不超过 50、未完成为 0。

- [ ] **Step 5: 运行通过测试**

Run: `npm test -- --runTestsByPath tests/unit/musicTheoryGameLogic.test.ts`

Expected: PASS，所有领域规则不依赖 Taro 或页面组件。

### Task 3: 实现页面的两段式学习与可访问拖放

**Files:**
- Create: `src/pages/music-theory/index.tsx`
- Create: `src/pages/music-theory/index.scss`
- Create: `src/pages/music-theory/index.config.ts`

- [ ] **Step 1: 建立页面和配置骨架**

设置 `navigationBarTitleText: "音符小探险"`、`enableShareAppMessage: true`、`enableShareTimeline: true`。页面在 `start`、`playing`、`finished` 之间切换，并在 `playing` 中使用 `MusicTheoryPhase`，初始为 `quiz`。

- [ ] **Step 2: 实现选择题阶段**

显示当前题号 `1 / 8`、主题标签、题干、四个大触摸选项和结果说明。答题后锁定本题，正确/错误均展示 `explanation`；下一题按钮才进入下一题。第八题结束后将阶段切到 `staff-placement`。

- [ ] **Step 3: 实现五线谱与拖放阶段**

用 CSS 渲染高音谱号、五条线、C4–G5 的离散可放置槽。音符卡通过 `onTouchStart`、`onTouchMove`、`onTouchEnd` 更新拖拽视觉，并以 `resolveStaffDrop()` 判定结束坐标。同步实现回退输入：先点击音符卡，再点击槽位，与拖放使用相同的判定函数。

- [ ] **Step 4: 实现儿童反馈与提示**

正确时播放 `playCorrect` 并显示“音名 + 位置”；错误时播放 `playWrong`、保留题目；提示只高亮目标槽、增加 `hintCount` 并扣分。所有动作复用现有 `playTap`、`playComplete` 和 `useAmbientMusic`，不新增音频文件。

- [ ] **Step 5: 实现 CSS 绘本主题与无障碍约束**

使用渐变、圆形、伪元素和 Unicode 符号构成星空音乐岛，不添加图片依赖。为 `.music-theory-page` 定义窄屏安全边距、最小触摸尺寸、非颜色反馈，并加入：

```scss
@media (prefers-reduced-motion: reduce) {
  .music-theory-page *, .music-theory-page *::before, .music-theory-page *::after {
    animation-duration: 0.01ms;
    transition-duration: 0.01ms;
  }
}
```

- [ ] **Step 6: 手动验证页面行为**

Run: `npm run build:weapp`

Expected: 编译成功；在微信开发者工具中确认开始页、8 题转场、4 题拖放、点选回退、错误重试、提示和结算均可完成。

### Task 4: 接入共享奖励、训练记录、贴图和大闯关

**Files:**
- Modify: `src/pages/music-theory/index.tsx`
- Modify: `src/utils/trainingStorage.ts`
- Modify: `tests/unit/trainingStorage.test.ts`

- [ ] **Step 1: 扩展训练 gameId 和奖励倍率**

将 `"music-theory"` 加入 `TrainingGameId`、`TRAINING_POINT_RATES`（值为 `1`）和数据清理的最高分键集合。测试应断言：

```ts
expect(getAwardedPoints("music-theory", 40, "normal")).toBe(40);
expect(getAwardedPoints("music-theory", 50, "hard")).toBe(60);
```

- [ ] **Step 2: 写入常规结算管线**

页面完成后先计算：

```ts
const awardedPoints = getAwardedPoints("music-theory", score, difficulty);
```

然后对非闯关局依次调用 `addPointsToPet("music-theory", score, difficulty)` 与 `recordTrainingSession({ gameId: "music-theory", score, awardedPoints, durationSeconds, difficulty, mode: "music-island-a", outcome: "completed" })`。最高分键使用 `music_theory_best_${difficulty}`。

- [ ] **Step 3: 接入闯关和成绩贴图**

完成时先调用 `completeGauntletLegIfNeeded()`；返回 `true` 时立即结束函数。普通结算页包含：

```tsx
<StickerShareButton
  gameTitle="音符小探险"
  score={finalScore}
  pagePath="pages/music-theory/index"
  isGauntlet={isGauntletPreset}
/>
```

这保证闯关子局不单独发奖、写记录、刷新最高分或展示贴图。

- [ ] **Step 4: 运行奖励与页面逻辑测试**

Run: `npm test -- --runTestsByPath tests/unit/musicTheoryGameLogic.test.ts tests/unit/trainingStorage.test.ts`

Expected: PASS；普通/困难奖励、上限、提示扣分和记录数据均符合文档。

### Task 5: 注册路由、目录、分享和闯关候选

**Files:**
- Modify: `src/app.config.ts`
- Modify: `src/config/gameCatalog.ts`
- Modify: `src/utils/share.ts`
- Modify: `tests/unit/gameCatalog.test.ts`
- Modify: `tests/unit/gameGauntlet.test.ts`

- [ ] **Step 1: 注册页面与分享路径**

在 `app.config.ts` pages 中新增 `pages/music-theory/index`，并在 `SHARE_PAGE_PATHS` 和 `SHARE_PAGE_CONTENT` 中新增同名键。分享文案使用“来玩音符小探险，认识节拍和五线谱”。

- [ ] **Step 2: 注册目录游戏项**

在 `GAME_CATALOG` 新增：

```ts
{
  id: "music-theory",
  title: "音符小探险",
  badge: "乐理",
  cardClass: "card-music-theory",
  url: "/pages/music-theory/index",
  category: "reasoning",
  duration: "约 3 分钟",
  skill: "乐理识谱",
  level: "进阶",
  isHot: false,
  showInAllGames: true,
  canAppearInGauntlet: true,
  showBestScore: true,
  recommendationWeight: 1,
  gauntletModeWeight: 1,
}
```

加入 `GAME_TITLE_MAP`；加入 reasoning 的 all-games 优先级。不要加入 `HOME_GAME_GROUPS`，避免改变首页既定容量。

- [ ] **Step 3: 更新目录和闯关断言**

在 `gameCatalog.test.ts` 断言全量列表含 `music-theory`、首页 reasoning 列表不含它、闯关池含它且候选总数由 18 调整为 19。在 `gameGauntlet.test.ts` 断言抽样保持三项互异，`music-theory` 使用仅带共享 `difficulty` 的默认预设。

- [ ] **Step 4: 运行目录与闯关测试**

Run: `npm test -- --runTestsByPath tests/unit/gameCatalog.test.ts tests/unit/gameGauntlet.test.ts`

Expected: PASS；新游戏可从目录、分享与闯关使用，且不改变首页展示集合。

### Task 6: 全量验证、审查和提交

**Files:**
- Modify: 本计划列出的所有实现、测试与文档文件

- [ ] **Step 1: 运行全量单测**

Run: `npm test`

Expected: PASS；无既有游戏、训练存储、目录或闯关回归。

- [ ] **Step 2: 运行静态与小程序验证**

Run: `npm run typecheck && npm run lint && npm run build:weapp && npm run secrets:check && git diff --check`

Expected: 所有命令成功；若 `build:weapp` 仅输出 `punycode` deprecation warning 但显示 `Compiled successfully`，记录为非阻塞警告。

- [ ] **Step 3: 执行手动验收**

在微信开发者工具的窄屏模拟器和真实触摸设备各完成一局普通和困难模式，检查拖放与点击回退、文字可读性、安全区、reduced motion、结算、贴图入口和闯关回跳。

- [ ] **Step 4: 提交实现**

Run: `git add docs/game-candidate-pool.md docs/points-economy.md src/pages/music-theory src/utils/trainingStorage.ts src/config/gameCatalog.ts src/app.config.ts src/utils/share.ts tests/unit/musicTheoryGameLogic.test.ts tests/unit/trainingStorage.test.ts tests/unit/gameCatalog.test.ts tests/unit/gameGauntlet.test.ts && git commit -m "feat: add music theory adventure"`

Expected: 仅暂存本功能相关文件并产生一个可回溯提交。

## 最终验收清单

- [ ] 目录显示“音符小探险”，分类为推理、等级为进阶；可从全部游戏、推荐和游戏大闯关进入，但不改变首页既定游戏集合。
- [ ] 每局严格先完成 8 道选择题，再完成 4 道五线谱放置题；题目覆盖节拍、音符、音阶和五线谱。
- [ ] 首版只出现高音谱号 C4–G5；低音谱号、升降号、调号、录音和真实音频听辨均不存在于界面和题库。
- [ ] 拖到目标线/间才正确；相邻槽、谱外松手与取消手势不误判；点选音符后点槽位的回退操作与拖放判定一致。
- [ ] 正确、错误和提示都有非颜色文字反馈；提示仅高亮并扣分；reduced motion 下动画降低。
- [ ] 普通最高 40、困难最高 50 游戏分，宠物积分经 `getAwardedPoints()`、`addPointsToPet()` 和 `recordTrainingSession()` 共享管线处理，普通/困难积分封顶为 40/60。
- [ ] 闯关子局不重复记录、发奖、刷新最高分或显示成绩贴图；普通局只在微信原生发表成功后沿用既有贴图奖励规则。
- [ ] `musicTheoryGameLogic.test.ts`、训练存储、目录、闯关和全量测试通过；`typecheck`、`lint`、`build:weapp`、`secrets:check`、`git diff --check` 均通过。
