# 行为保持型全仓重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变玩法、积分、训练记录、闯关协议、路由或视觉设计的前提下，降低 Farm Count 的维护复杂度，修复本地缓存崩溃风险，并完成全仓计时器审查与目录文档校验。

**Architecture:** 最高分缓存读取成为一个页面无关的纯函数；定时器队列由可单测的工厂和轻量 React hook 组成。Farm Count 页面保留状态、奖励和闯关编排，只将开始、进行和结果 JSX 分离为无副作用展示组件。README 继续是人工维护的总览，但由单元测试强制覆盖公开目录的每个标题。

**Tech Stack:** Taro 4、React 18、TypeScript 5、Jest 29、SCSS。

---

## 文件结构

- 新增 `src/pages/rock-paper-scissors/highScoreStorage.ts`：安全读取和更新逆向猜拳最高分的纯存储边界。
- 新增 `src/pages/bird-count/timerQueue.ts`：可测试的延迟计时器注册与清理工厂。
- 新增 `src/pages/bird-count/useTimerQueue.ts`：在卸载时清理队列的 React 包装层。
- 新增 `src/pages/bird-count/components/FarmCountStartPanel.tsx`：仅渲染开始设置界面。
- 新增 `src/pages/bird-count/components/FarmCountPlayArea.tsx`：仅渲染速度清点/农场进出场景、选项与反馈。
- 新增 `src/pages/bird-count/components/FarmCountResult.tsx`：仅渲染结算内容与现有回调入口。
- 修改 `src/pages/bird-count/index.tsx`：保留会话、计分、训练记录和闯关状态编排，接入组件与计时器队列。
- 修改 `src/pages/rock-paper-scissors/index.tsx`：使用安全最高分存储函数。
- 修改 `README.md`：补全与 `GAME_CATALOG` 一致的公开游戏表。
- 新增 `tests/unit/rockPaperScissorsHighScore.test.ts`、`tests/unit/timerQueue.test.ts`、`tests/unit/readmeGameCatalog.test.ts`：行为回归覆盖。
- 新增 `docs/reviews/2026-07-29-timer-lifecycle-audit.md`：逐页记录延迟计时器审查结果。
- 新增 `docs/reviews/2026-07-29-game-experience-ui-recommendations.md`：不改变代码的体验与交互建议。

### Task 1: 逆向猜拳最高分缓存安全边界

**Files:**
- Create: `tests/unit/rockPaperScissorsHighScore.test.ts`
- Create: `src/pages/rock-paper-scissors/highScoreStorage.ts`
- Modify: `src/pages/rock-paper-scissors/index.tsx:44-106`

- [ ] **Step 1: 写出失败的缓存读取测试**

```ts
import { readRockPaperScissorsHighScore } from "../../src/pages/rock-paper-scissors/highScoreStorage";

describe("rock-paper-scissors high-score storage", () => {
  test.each(["{", "[]", JSON.stringify({ score: "12" }), JSON.stringify({})])(
    "returns null for invalid stored value %p",
    (raw) => expect(readRockPaperScissorsHighScore(raw)).toBeNull(),
  );

  test("returns the existing score record without changing valid data", () => {
    expect(readRockPaperScissorsHighScore(JSON.stringify({ score: 24, achievedAt: "2026-07-29T00:00:00.000Z" }))).toEqual({
      score: 24,
      achievedAt: "2026-07-29T00:00:00.000Z",
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest tests/unit/rockPaperScissorsHighScore.test.ts --runInBand`

Expected: FAIL，因为 `highScoreStorage` 尚不存在。

- [ ] **Step 3: 实现纯解析函数**

```ts
export interface RockPaperScissorsHighScore {
  score: number;
  achievedAt: string;
}

export function readRockPaperScissorsHighScore(raw: string): RockPaperScissorsHighScore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RockPaperScissorsHighScore>;
    return typeof parsed.score === "number" && Number.isFinite(parsed.score) && typeof parsed.achievedAt === "string"
      ? { score: parsed.score, achievedAt: parsed.achievedAt }
      : null;
  } catch {
    return null;
  }
}
```

Replace the page-local `HighScoreRecord` with the exported type, replace the direct `JSON.parse(record)` in `getCurrentHighScore()` with `readRockPaperScissorsHighScore(record)`, and keep all existing keys, score comparison, write payloads and state updates unchanged.

- [ ] **Step 4: 运行聚焦回归测试**

Run: `npx jest tests/unit/rockPaperScissorsHighScore.test.ts tests/unit/trainingStorage.test.ts --runInBand`

Expected: PASS。

- [ ] **Step 5: 提交该独立修复**

```bash
git add src/pages/rock-paper-scissors/highScoreStorage.ts src/pages/rock-paper-scissors/index.tsx tests/unit/rockPaperScissorsHighScore.test.ts
git commit -m "fix: guard reverse rps high-score cache"
```

### Task 2: 可验证的 Farm Count 延迟计时器队列

**Files:**
- Create: `tests/unit/timerQueue.test.ts`
- Create: `src/pages/bird-count/timerQueue.ts`
- Create: `src/pages/bird-count/useTimerQueue.ts`
- Modify: `src/pages/bird-count/index.tsx:261-288,320-324`

- [ ] **Step 1: 写出队列取消行为的失败测试**

```ts
import { createTimerQueue } from "../../src/pages/bird-count/timerQueue";

test("clears every pending callback and forgets cleared timers", () => {
  jest.useFakeTimers();
  const callback = jest.fn();
  const queue = createTimerQueue();
  queue.schedule(callback, 100);
  queue.schedule(callback, 200);
  queue.clear();
  jest.advanceTimersByTime(200);
  expect(callback).not.toHaveBeenCalled();
  expect(queue.pendingCount()).toBe(0);
  jest.useRealTimers();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest tests/unit/timerQueue.test.ts --runInBand`

Expected: FAIL，因为 `createTimerQueue` 尚不存在。

- [ ] **Step 3: 实现计时器队列与 React 清理包装**

```ts
export function createTimerQueue() {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  return {
    schedule(callback: () => void, delay: number) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
      return timer;
    },
    clear() {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    },
    pendingCount() {
      return timers.size;
    },
  };
}
```

`useTimerQueue.ts` creates the queue once with `useRef`, returns it, and runs `queue.clear()` from a cleanup-only `useEffect`. In Farm Count, replace `timersRef`, `clearTimers`, and `schedule` with the hook’s `clear` and `schedule` methods. Preserve every existing delay constant and every `clearTimers()` call location.

- [ ] **Step 4: 运行聚焦计时与游戏逻辑测试**

Run: `npx jest tests/unit/timerQueue.test.ts tests/unit/birdCountGameLogic.test.ts tests/unit/headCountGameLogic.test.ts --runInBand`

Expected: PASS。

- [ ] **Step 5: 提交计时器边界**

```bash
git add src/pages/bird-count/timerQueue.ts src/pages/bird-count/useTimerQueue.ts src/pages/bird-count/index.tsx tests/unit/timerQueue.test.ts
git commit -m "refactor: isolate farm count timer cleanup"
```

### Task 3: 拆分 Farm Count 展示层而不迁移业务状态

**Files:**
- Create: `src/pages/bird-count/components/FarmCountStartPanel.tsx`
- Create: `src/pages/bird-count/components/FarmCountPlayArea.tsx`
- Create: `src/pages/bird-count/components/FarmCountResult.tsx`
- Modify: `src/pages/bird-count/index.tsx:686-1060`
- Test: `tests/unit/birdCountGameLogic.test.ts`

- [ ] **Step 1: 为现有两种玩法补充行为锁定断言**

Append this test to `tests/unit/birdCountGameLogic.test.ts`:

```ts
test("keeps the speed-mode session and wrong-answer scoring invariant", () => {
  (["normal", "hard"] as const).forEach((difficulty) => {
    expect(createBirdCountSession(difficulty)).toHaveLength(BIRD_COUNT_TOTAL_QUESTIONS);
  });
  expect(scoreBirdCountQuestion({
    selectedAnswer: 2,
    correctAnswer: 3,
    answerMs: 1,
    currentCombo: 99,
  })).toMatchObject({ correct: false, score: 0 });
});
```

Append this test to `tests/unit/headCountGameLogic.test.ts`:

```ts
test("keeps the yard-mode session and correct-answer scoring invariant", () => {
  expect(createHeadCountSession("normal", "slow")).toHaveLength(HEAD_COUNT_TOTAL_QUESTIONS);
  expect(createHeadCountSession("hard", "fast")).toHaveLength(HEAD_COUNT_TOTAL_QUESTIONS);
  expect(scoreHeadCountQuestion({
    selectedAnswer: 4,
    correctAnswer: 4,
    answerMs: 2600,
    currentCombo: 0,
  })).toMatchObject({ correct: true, score: 3 });
});
```

Keep these assertions in pure game-logic tests; do not introduce component-rendering dependencies.

- [ ] **Step 2: 运行测试确认当前保护网通过**

Run: `npx jest tests/unit/birdCountGameLogic.test.ts tests/unit/headCountGameLogic.test.ts --runInBand`

Expected: PASS；该步骤记录重排 JSX 前的行为基线。

- [ ] **Step 3: 创建无副作用展示组件并替换页面内联 JSX**

`FarmCountStartPanel` receives `mode`, difficulty values, `best`, `isGauntletPreset`, the four existing selection callbacks and `onStart`; it renders the exact current start-screen hierarchy and class names.

`FarmCountPlayArea` receives derived questions/results, phase, display values, pet pool, option list and `onAnswer`; it renders the current status row, yard scene, speed scene, answer options and feedback with unchanged text, conditions and class names.

`FarmCountResult` receives score, mode/difficulty labels, accuracy, combo, awarded points, `isNewBest`, `onBack` and `onRestart`; it renders the existing result card unchanged.

The page remains the only owner of `useState`, `useRef`, `startGame`, answer handlers, preloading, `getAwardedPoints`, `addPointsToPet`, `recordTrainingSession`, and `completeGauntletLegIfNeeded`.

- [ ] **Step 4: 运行编译级与逻辑回归检查**

Run: `npx jest tests/unit/birdCountGameLogic.test.ts tests/unit/headCountGameLogic.test.ts --runInBand && npm run typecheck && npm run lint`

Expected: all commands exit 0.

- [ ] **Step 5: 提交展示层拆分**

```bash
git add src/pages/bird-count/index.tsx src/pages/bird-count/components/FarmCountStartPanel.tsx src/pages/bird-count/components/FarmCountPlayArea.tsx src/pages/bird-count/components/FarmCountResult.tsx tests/unit/birdCountGameLogic.test.ts tests/unit/headCountGameLogic.test.ts
git commit -m "refactor: split farm count presentation"
```

### Task 4: 全仓延迟计时器生命周期审查

**Files:**
- Create: `docs/reviews/2026-07-29-timer-lifecycle-audit.md`
- Inspect: every `src/pages/**/index.tsx` reported by `rg -l 'setTimeout\\(' src/pages`

- [ ] **Step 1: 生成待审页面清单**

Run: `rg -l --glob 'index.tsx' 'setTimeout\\(' src/pages | sort`

Expected: a deterministic list including `bird-count`, `color-trap`, `digit-span`, `hidato`, `memory-challenge`, `mental-math`, `multiple-object-tracking`, `number-order`, `rock-paper-scissors`, `spatial-rotation`, `tents-camp`, `triad-match`, `twenty-four` and `word-scramble`.

- [ ] **Step 2: 对每页记录实际清理证据**

For each listed page, document the timer mechanism, its cancellation trigger, unmount cleanup status, and action. Use only `keep`, `migrate to queue`, or `separate follow-up required` as action values. Record exact source line numbers after the refactor; do not infer behavior from file names.

- [ ] **Step 3: 保持审查为只读边界**

Do not modify a page solely because it uses `setTimeout`. The completed Farm Count migration in Tasks 2-3 is the only cross-page timer refactor in this plan. Mark a page `separate follow-up required` only when the source proves a missing cancellation path; its repair requires its own behavior baseline and design approval.

- [ ] **Step 4: 验证审查不会扩大行为范围**

Run: `npm test && npm run typecheck && npm run lint`

Expected: all commands exit 0; no score, reward, record or gauntlet tests change their expected values.

- [ ] **Step 5: 提交计时器审查记录**

```bash
git add docs/reviews/2026-07-29-timer-lifecycle-audit.md
git commit -m "refactor: document game timer lifecycle"
```

### Task 5: 目录文档一致性与体验建议

**Files:**
- Create: `tests/unit/readmeGameCatalog.test.ts`
- Modify: `README.md:8-25`
- Create: `docs/reviews/2026-07-29-game-experience-ui-recommendations.md`

- [ ] **Step 1: 写出 README 公开目录覆盖的失败测试**

```ts
import fs from "fs";
import path from "path";
import { ALL_GAME_ITEMS } from "../../src/config/gameCatalog";

test("README lists every public catalog game", () => {
  const readme = fs.readFileSync(path.resolve(process.cwd(), "README.md"), "utf8");
  ALL_GAME_ITEMS.forEach((game) => {
    expect(readme).toContain(`| ${game.title} |`);
    expect(readme).toContain(`| ${game.url} |`);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest tests/unit/readmeGameCatalog.test.ts --runInBand`

Expected: FAIL，因为 README 尚未列出当前全部公开目录项。

- [ ] **Step 3: 补全 README 并写入体验建议**

Update the existing game table with every `ALL_GAME_ITEMS` entry, retaining the current columns and route notation. Add a row for each public game and do not list compatibility-only `head-count` as a separate public catalog item.

The recommendation document must contain this exact ranked content:

| Priority | Surface | Recommendation | Acceptance signal |
| --- | --- | --- | --- |
| P1 | 首页与全部游戏 | 在卡片上统一露出时长、训练能力与难度，并保持分类色只承担分组作用 | 用户可不进入详情页区分玩法与预计投入 |
| P1 | 开始页 | 在主按钮上方统一展示本局模式、难度与积分档；闯关预设保持只读 | 开始前无需猜测奖励或设置来源 |
| P1 | 游戏中 | 为加载、倒计时、错误与重放状态提供一致的短文案和不可重复点击反馈 | 任何等待状态都有可见解释且不重复记分 |
| P2 | 结算页 | 固定显示成绩、正确率、最佳连击、积分和下一步动作的顺序 | 玩家能在一次扫视中理解本局结果 |
| P2 | 横向可用性 | 审计点击目标、颜色对比、远程宠物图加载失败与弱网占位 | 关键操作在小屏和资源失败时仍可完成 |

State explicitly that this document is a proposal only and does not authorize any interaction or visual changes in this refactor.

- [ ] **Step 4: 运行文档与目录测试**

Run: `npx jest tests/unit/readmeGameCatalog.test.ts tests/unit/gameCatalog.test.ts --runInBand && git diff --check`

Expected: PASS and no whitespace errors.

- [ ] **Step 5: 提交文档一致性与建议**

```bash
git add README.md tests/unit/readmeGameCatalog.test.ts docs/reviews/2026-07-29-game-experience-ui-recommendations.md
git commit -m "docs: align game catalog and experience recommendations"
```

### Task 6: 最终回归与手动 Farm Count 检查

**Files:**
- Verify only: all files changed in Tasks 1-5

- [ ] **Step 1: 运行完整自动化验证**

Run: `npm test && npm run typecheck && npm run lint && npm run build:weapp && npm run secrets:check && git diff --check`

Expected: all commands exit 0. The known `punycode` deprecation warning is acceptable only when the WeApp build ends with `Compiled successfully`.

- [ ] **Step 2: 在微信开发者工具或实际小程序预览中检查 Farm Count**

Verify speed and yard modes for: start, normal/hard selection, resource loading, correct answer, wrong answer/replay, final result, replay, back to settings, and gauntlet preset entry. For each path, compare score, awarded points and returned navigation with the pre-refactor behavior.

- [ ] **Step 3: 检查提交和工作树边界**

Run: `git status --short --branch && git log --oneline -5`

Expected: only the planned commits are present and the worktree is clean. If a verification-only adjustment is needed, stage only its exact files and commit it with `test: complete refactor regression coverage`.
