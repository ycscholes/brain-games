# Number Order Star Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `星图排序` as a rule-driven `星路探索` game with route rules, visible path feedback, replay explanations, and score ranges aligned with the existing pet points economy.

**Architecture:** Keep the feature inside `src/pages/number-order/`. Put deterministic route generation, answer ordering, replay copy, and scoring in pure functions in `gameLogic.ts`; keep timers, storage, training records, and rendering in `index.tsx`; keep visual refresh in `index.scss`.

**Tech Stack:** Taro 4, React 18, TypeScript, Sass, Jest.

---

## File Structure

- Modify `src/pages/number-order/gameLogic.ts`: route rule metadata, generated clue fields, rule-aware answer ordering, replay text, and scoring helpers.
- Modify `tests/unit/numberOrderGameLogic.test.ts`: rule-order fixtures, generation coverage, scoring behavior, and score economy shape.
- Modify `src/pages/number-order/index.tsx`: new labels, path rendering, feedback panel, best combo, completed routes, and mastered-rule summary.
- Modify `src/pages/number-order/index.scss`: star-route UI, path segments, clue styling, start preview, replay panel, and result metrics.
- No image assets are required. If visual QA during implementation proves a generated bitmap is necessary, dispatch a separate subagent for that asset and keep the generated asset task isolated from logic/UI commits.

---

### Task 1: Route Rule Model And Tests

**Files:**
- Modify: `tests/unit/numberOrderGameLogic.test.ts`
- Modify: `src/pages/number-order/gameLogic.ts`

- [ ] **Step 1: Replace the unit test file with route-rule coverage**

Replace `tests/unit/numberOrderGameLogic.test.ts` with:

```ts
import {
  NUMBER_ORDER_ROUTE_RULES,
  NUMBER_ORDER_TOTAL_QUESTIONS,
  createNumberOrderQuestion,
  createNumberOrderSession,
  getNumberOrderPointCount,
  getRouteAnswerIds,
  isCorrectTap,
  scoreNumberOrderQuestion,
  type NumberOrderPoint,
  type NumberOrderQuestion,
} from "../../src/pages/number-order/gameLogic";

function makeQuestion(ruleId: NumberOrderQuestion["routeRule"]["id"], points: NumberOrderPoint[]): NumberOrderQuestion {
  const routeRule = NUMBER_ORDER_ROUTE_RULES[ruleId];
  return {
    id: `fixture-${ruleId}`,
    points,
    answerIds: getRouteAnswerIds(points, routeRule),
    revealMs: 2000,
    routeRule,
    replayText: "",
  };
}

const fixturePoints: NumberOrderPoint[] = [
  { id: "a", value: 8, x: 20, y: 20, colorGroup: "gold", brightness: "normal" },
  { id: "b", value: 3, x: 40, y: 20, colorGroup: "teal", brightness: "bright" },
  { id: "c", value: 12, x: 60, y: 20, colorGroup: "gold", brightness: "bright" },
  { id: "d", value: 5, x: 80, y: 20, colorGroup: "teal", brightness: "normal" },
];

describe("number-order game logic", () => {
  test("creates an 8-question session", () => {
    expect(createNumberOrderSession("normal")).toHaveLength(NUMBER_ORDER_TOTAL_QUESTIONS);
    expect(createNumberOrderSession("hard")).toHaveLength(NUMBER_ORDER_TOTAL_QUESTIONS);
  });

  test("normal questions use expected point count, route rules, and reveal range", () => {
    const questions = createNumberOrderSession("normal");

    questions.forEach((question, index) => {
      const values = question.points.map((point) => point.value);

      expect(question.points).toHaveLength(getNumberOrderPointCount("normal", index));
      expect(new Set(values).size).toBe(values.length);
      expect(question.revealMs).toBeGreaterThanOrEqual(1800);
      expect(question.revealMs).toBeLessThanOrEqual(2400);
      expect(question.routeRule.title).toBeTruthy();
      expect(question.routeRule.description).toBeTruthy();
      expect(question.replayText).toBeTruthy();
    });

    expect(questions[0].routeRule.id).toBe("ascending");
    expect(questions[1].routeRule.id).toBe("ascending");
  });

  test("hard questions use expected point count, route rules, and reveal range", () => {
    createNumberOrderSession("hard").forEach((question, index) => {
      const values = question.points.map((point) => point.value);

      expect(question.points).toHaveLength(getNumberOrderPointCount("hard", index));
      expect(new Set(values).size).toBe(values.length);
      expect(question.revealMs).toBeGreaterThanOrEqual(1400);
      expect(question.revealMs).toBeLessThanOrEqual(2000);
      expect(question.routeRule.title).toBeTruthy();
      expect(question.replayText).toBeTruthy();
    });
  });

  test("route rules produce expected answer order", () => {
    expect(makeQuestion("ascending", fixturePoints).answerIds).toEqual(["b", "d", "a", "c"]);
    expect(makeQuestion("descending", fixturePoints).answerIds).toEqual(["c", "a", "d", "b"]);
    expect(makeQuestion("odd-even", fixturePoints).answerIds).toEqual(["b", "d", "a", "c"]);
    expect(makeQuestion("color-route", fixturePoints).answerIds).toEqual(["b", "d", "a", "c"]);
    expect(makeQuestion("brightness-route", fixturePoints).answerIds).toEqual(["b", "c", "d", "a"]);
  });

  test("validates progressive tap order", () => {
    const question = makeQuestion("descending", fixturePoints);
    const [firstId, secondId] = question.answerIds;

    expect(isCorrectTap(question, [firstId])).toBe(true);
    expect(isCorrectTap(question, [firstId, secondId])).toBe(true);
    expect(isCorrectTap(question, [secondId])).toBe(false);
  });

  test("scores full, partial, and wrong route attempts", () => {
    const question = makeQuestion("brightness-route", fixturePoints);
    const fullAnswer = question.answerIds;
    const partialAnswer = question.answerIds.slice(0, 2);
    const wrongLaterAnswer = [question.answerIds[0], question.answerIds[2]];
    const wrongFirstAnswer = [question.answerIds[1]];

    expect(scoreNumberOrderQuestion({ question, tappedIds: fullAnswer, currentCombo: 3 })).toMatchObject({
      correctCount: question.answerIds.length,
      allCorrect: true,
      comboBonus: 2,
      score: question.answerIds.length + 4,
    });
    expect(scoreNumberOrderQuestion({ question, tappedIds: partialAnswer, currentCombo: 2 })).toMatchObject({
      correctCount: 2,
      allCorrect: false,
      comboBonus: 0,
      score: 2,
    });
    expect(scoreNumberOrderQuestion({ question, tappedIds: wrongLaterAnswer, currentCombo: 2 })).toMatchObject({
      correctCount: 1,
      allCorrect: false,
      comboBonus: 0,
      score: 1,
    });
    expect(scoreNumberOrderQuestion({ question, tappedIds: wrongFirstAnswer, currentCombo: 2 })).toMatchObject({
      correctCount: 0,
      allCorrect: false,
      score: 0,
    });
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```sh
npm test -- tests/unit/numberOrderGameLogic.test.ts
```

Expected: FAIL because `NUMBER_ORDER_ROUTE_RULES`, `getRouteAnswerIds`, `routeRule`, and `replayText` do not exist yet.

- [ ] **Step 3: Replace `gameLogic.ts` with route-rule implementation**

Replace `src/pages/number-order/gameLogic.ts` with:

```ts
import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type NumberOrderDifficulty = TrainingDifficulty;
export type NumberOrderRouteRuleId = "ascending" | "descending" | "odd-even" | "color-route" | "brightness-route";
export type NumberOrderColorGroup = "teal" | "gold";
export type NumberOrderBrightness = "bright" | "normal";

export interface NumberOrderRouteRule {
  id: NumberOrderRouteRuleId;
  title: string;
  shortLabel: string;
  description: string;
  complexity: "basic" | "medium" | "advanced";
}

export interface NumberOrderPoint {
  id: string;
  value: number;
  x: number;
  y: number;
  colorGroup: NumberOrderColorGroup;
  brightness: NumberOrderBrightness;
}

export interface NumberOrderQuestion {
  id: string;
  points: NumberOrderPoint[];
  answerIds: string[];
  revealMs: number;
  routeRule: NumberOrderRouteRule;
  replayText: string;
}

export interface NumberOrderQuestionResult {
  correctCount: number;
  allCorrect: boolean;
  score: number;
  comboBonus: number;
}

export const NUMBER_ORDER_TOTAL_QUESTIONS = 8;

export const NUMBER_ORDER_ROUTE_RULES: Record<NumberOrderRouteRuleId, NumberOrderRouteRule> = {
  ascending: {
    id: "ascending",
    title: "升序星路",
    shortLabel: "升序",
    description: "按数字从小到大点亮。",
    complexity: "basic",
  },
  descending: {
    id: "descending",
    title: "降序星路",
    shortLabel: "降序",
    description: "按数字从大到小点亮。",
    complexity: "medium",
  },
  "odd-even": {
    id: "odd-even",
    title: "奇偶星路",
    shortLabel: "奇偶",
    description: "先奇数升序，再偶数升序。",
    complexity: "medium",
  },
  "color-route": {
    id: "color-route",
    title: "双色星路",
    shortLabel: "双色",
    description: "先青色星，再金色星；组内升序。",
    complexity: "advanced",
  },
  "brightness-route": {
    id: "brightness-route",
    title: "亮度星路",
    shortLabel: "亮度",
    description: "先高亮星，再普通星；组内升序。",
    complexity: "advanced",
  },
};

const REVEAL_MS: Record<NumberOrderDifficulty, number[]> = {
  normal: [2400, 2320, 2240, 2140, 2040, 1960, 1880, 1800],
  hard: [2000, 1920, 1840, 1740, 1640, 1560, 1480, 1400],
};

const POINT_COUNT_STEPS: Record<NumberOrderDifficulty, number[]> = {
  normal: [4, 4, 5, 5, 5, 6, 6, 6],
  hard: [5, 5, 6, 6, 6, 7, 7, 7],
};

const MAX_VALUE: Record<NumberOrderDifficulty, number> = {
  normal: 19,
  hard: 31,
};

const NORMAL_RULE_STEPS: NumberOrderRouteRuleId[] = [
  "ascending",
  "ascending",
  "descending",
  "odd-even",
  "descending",
  "color-route",
  "brightness-route",
  "odd-even",
];

const HARD_RULE_STEPS: NumberOrderRouteRuleId[] = [
  "descending",
  "odd-even",
  "color-route",
  "brightness-route",
  "ascending",
  "odd-even",
  "color-route",
  "brightness-route",
];

const NORMAL_POSITIONS = [
  { x: 18, y: 18 },
  { x: 50, y: 14 },
  { x: 78, y: 24 },
  { x: 24, y: 48 },
  { x: 63, y: 48 },
  { x: 38, y: 76 },
  { x: 76, y: 76 },
];

const HARD_POSITIONS = [
  { x: 16, y: 16 },
  { x: 44, y: 12 },
  { x: 72, y: 18 },
  { x: 28, y: 40 },
  { x: 58, y: 42 },
  { x: 84, y: 52 },
  { x: 18, y: 74 },
  { x: 48, y: 78 },
  { x: 76, y: 80 },
];

function clampQuestionIndex(questionIndex: number) {
  return Math.max(0, Math.min(NUMBER_ORDER_TOTAL_QUESTIONS - 1, questionIndex));
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function takeUniqueNumbers(count: number, maxValue: number) {
  return shuffle(Array.from({ length: maxValue }, (_, index) => index + 1)).slice(0, count);
}

function getRouteRuleId(difficulty: NumberOrderDifficulty, questionIndex: number) {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  return (difficulty === "hard" ? HARD_RULE_STEPS : NORMAL_RULE_STEPS)[safeQuestionIndex];
}

function byValueAscending(left: NumberOrderPoint, right: NumberOrderPoint) {
  return left.value - right.value;
}

function byValueDescending(left: NumberOrderPoint, right: NumberOrderPoint) {
  return right.value - left.value;
}

function groupRank(point: NumberOrderPoint, routeRule: NumberOrderRouteRule) {
  if (routeRule.id === "odd-even") {
    return point.value % 2 === 1 ? 0 : 1;
  }

  if (routeRule.id === "color-route") {
    return point.colorGroup === "teal" ? 0 : 1;
  }

  if (routeRule.id === "brightness-route") {
    return point.brightness === "bright" ? 0 : 1;
  }

  return 0;
}

export function getNumberOrderPointCount(difficulty: NumberOrderDifficulty, questionIndex: number) {
  return POINT_COUNT_STEPS[difficulty][clampQuestionIndex(questionIndex)];
}

export function getRouteAnswerIds(points: NumberOrderPoint[], routeRule: NumberOrderRouteRule) {
  if (routeRule.id === "descending") {
    return [...points].sort(byValueDescending).map((point) => point.id);
  }

  return [...points]
    .sort((left, right) => {
      const groupDelta = groupRank(left, routeRule) - groupRank(right, routeRule);
      return groupDelta === 0 ? byValueAscending(left, right) : groupDelta;
    })
    .map((point) => point.id);
}

export function getRouteValues(question: NumberOrderQuestion) {
  const valueById = new Map(question.points.map((point) => [point.id, point.value]));
  return question.answerIds.map((id) => valueById.get(id)).filter((value): value is number => typeof value === "number");
}

export function createRouteReplayText(question: Pick<NumberOrderQuestion, "points" | "answerIds" | "routeRule">) {
  const valueById = new Map(question.points.map((point) => [point.id, point.value]));
  const routeValues = question.answerIds
    .map((id) => valueById.get(id))
    .filter((value): value is number => typeof value === "number")
    .join(" -> ");
  return `${question.routeRule.description} 正确路线：${routeValues}`;
}

export function createNumberOrderQuestion(
  difficulty: NumberOrderDifficulty,
  questionIndex: number,
): NumberOrderQuestion {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  const pointCount = getNumberOrderPointCount(difficulty, safeQuestionIndex);
  const routeRule = NUMBER_ORDER_ROUTE_RULES[getRouteRuleId(difficulty, safeQuestionIndex)];
  const values = takeUniqueNumbers(pointCount, MAX_VALUE[difficulty]);
  const positions = shuffle(difficulty === "hard" ? HARD_POSITIONS : NORMAL_POSITIONS).slice(0, pointCount);
  const points = values.map((value, index) => ({
    id: `q${safeQuestionIndex + 1}-p${index + 1}`,
    value,
    x: positions[index].x,
    y: positions[index].y,
    colorGroup: index % 2 === 0 ? "teal" as const : "gold" as const,
    brightness: index < Math.ceil(pointCount / 2) ? "bright" as const : "normal" as const,
  }));
  const answerIds = getRouteAnswerIds(points, routeRule);
  const question = {
    id: `number-order-${difficulty}-${safeQuestionIndex + 1}`,
    points,
    answerIds,
    revealMs: REVEAL_MS[difficulty][safeQuestionIndex],
    routeRule,
    replayText: "",
  };

  return {
    ...question,
    replayText: createRouteReplayText(question),
  };
}

export function createNumberOrderSession(difficulty: NumberOrderDifficulty) {
  return Array.from({ length: NUMBER_ORDER_TOTAL_QUESTIONS }, (_, index) =>
    createNumberOrderQuestion(difficulty, index),
  );
}

export function getCorrectTapCount(question: NumberOrderQuestion, tappedIds: string[]) {
  let correctCount = 0;

  for (let index = 0; index < tappedIds.length; index += 1) {
    if (tappedIds[index] !== question.answerIds[index]) {
      break;
    }
    correctCount += 1;
  }

  return correctCount;
}

export function isCorrectTap(question: NumberOrderQuestion, tappedIds: string[]) {
  if (tappedIds.length > question.answerIds.length) {
    return false;
  }

  return getCorrectTapCount(question, tappedIds) === tappedIds.length;
}

export function scoreNumberOrderQuestion(params: {
  question: NumberOrderQuestion;
  tappedIds: string[];
  currentCombo: number;
}): NumberOrderQuestionResult {
  const correctCount = getCorrectTapCount(params.question, params.tappedIds);
  const allCorrect = correctCount === params.question.answerIds.length &&
    params.tappedIds.length === params.question.answerIds.length;
  const comboBonus = allCorrect ? Math.min(2, Math.max(0, params.currentCombo)) : 0;
  const score = correctCount + (allCorrect ? 2 : 0) + comboBonus;

  return {
    correctCount,
    allCorrect,
    comboBonus,
    score,
  };
}
```

- [ ] **Step 4: Run the focused logic test**

Run:

```sh
npm test -- tests/unit/numberOrderGameLogic.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```sh
git add src/pages/number-order/gameLogic.ts tests/unit/numberOrderGameLogic.test.ts
git commit -m "feat: add star route number order logic"
```

Expected: commit includes only the two files above.

---

### Task 2: Gameplay State And Route Rendering

**Files:**
- Modify: `src/pages/number-order/index.tsx`

- [ ] **Step 1: Update imports and feedback timing**

In `src/pages/number-order/index.tsx`, change the game logic import to include `getRouteValues`:

```ts
import {
  createNumberOrderSession,
  getRouteValues,
  NUMBER_ORDER_TOTAL_QUESTIONS,
  scoreNumberOrderQuestion,
  type NumberOrderQuestion,
  type NumberOrderQuestionResult,
} from "./gameLogic";
```

Change feedback timing:

```ts
const FEEDBACK_MS = 1500;
```

- [ ] **Step 2: Add route summary state**

After `const [combo, setCombo] = useState(0);`, add:

```ts
const [bestCombo, setBestCombo] = useState(0);
const [masteredRules, setMasteredRules] = useState<string[]>([]);
```

After `const answerProgress = ...`, add:

```ts
const routeValues = currentQuestion ? getRouteValues(currentQuestion) : [];
const routeValueText = routeValues.join(" -> ");
const masteredRuleText = masteredRules.length > 0 ? masteredRules.join(" / ") : "继续探索";
```

- [ ] **Step 3: Reset new state in start and back actions**

In `startGame`, after `setCombo(0);`, add:

```ts
setBestCombo(0);
setMasteredRules([]);
```

In `backToStart`, after `setCombo(0);`, add:

```ts
setBestCombo(0);
setMasteredRules([]);
```

- [ ] **Step 4: Track best combo and mastered rules when settling a chart**

Inside `settleQuestion`, after `const nextCombo = result.allCorrect ? combo + 1 : 0;`, add:

```ts
const nextBestCombo = Math.max(bestCombo, nextCombo);
const nextMasteredRules = result.allCorrect && !masteredRules.includes(currentQuestion.routeRule.shortLabel)
  ? [...masteredRules, currentQuestion.routeRule.shortLabel]
  : masteredRules;
```

After `setCombo(nextCombo);`, add:

```ts
setBestCombo(nextBestCombo);
setMasteredRules(nextMasteredRules);
```

Add `bestCombo` and `masteredRules` to the `settleQuestion` dependency array.

- [ ] **Step 5: Update start screen copy and preview markup**

Replace the hero copy and rule lines with:

```tsx
<Text className="hero-copy">记住星点线索，按航线规则点亮星路。</Text>
<View className="route-preview" aria-hidden>
  <View className="preview-line preview-line-one" />
  <View className="preview-line preview-line-two" />
  <Text className="preview-star preview-star-one">4</Text>
  <Text className="preview-star preview-star-two">9</Text>
  <Text className="preview-star preview-star-three">12</Text>
  <Text className="preview-star preview-star-four">18</Text>
</View>
```

Replace the `训练规则` block lines with:

```tsx
<Text className="rule-line">1. 看清数字、颜色和亮度线索。</Text>
<Text className="rule-line">2. 线索隐藏后，按当前航线规则点亮。</Text>
<Text className="rule-line">3. 回放会展示正确星路和本题得分。</Text>
```

Replace difficulty card copy with:

```tsx
{renderDifficultyCard("normal", "规则逐步加入 · 观察时间更宽")}
{renderDifficultyCard("hard", "多规则混合 · 星点更多")}
```

- [ ] **Step 6: Update prompt card copy**

Replace the prompt title expression with:

```tsx
{phase === "ready"
  ? "准备观察星图"
  : phase === "revealing"
    ? currentQuestion.routeRule.title
    : phase === "answering"
      ? `点亮第 ${answerProgress} 颗星`
      : lastResult?.allCorrect
        ? "星路完成"
        : "星路中断"}
```

Replace the prompt copy expression with:

```tsx
{phase === "answering"
  ? currentQuestion.routeRule.description
  : phase === "feedback"
    ? `${currentQuestion.replayText} · 本题 +${lastResult?.score ?? 0}`
    : "保持专注，星点线索马上隐藏"}
```

- [ ] **Step 7: Add route path rendering helpers inside the star board**

Inside the star-board `<View>`, before mapping `currentQuestion.points`, add:

```tsx
{tappedIds.slice(1).map((pointId, index) => {
  const fromPoint = currentQuestion.points.find((point) => point.id === tappedIds[index]);
  const toPoint = currentQuestion.points.find((point) => point.id === pointId);
  if (!fromPoint || !toPoint) {
    return null;
  }

  const deltaX = toPoint.x - fromPoint.x;
  const deltaY = toPoint.y - fromPoint.y;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

  return (
    <View
      key={`${fromPoint.id}-${toPoint.id}`}
      className="route-segment route-segment-player"
      style={{
        left: `${fromPoint.x}%`,
        top: `${fromPoint.y}%`,
        width: `${length}%`,
        transform: `rotate(${angle}deg)`,
      }}
    />
  );
})}
{phase === "feedback" ? currentQuestion.answerIds.slice(1).map((pointId, index) => {
  const fromPoint = currentQuestion.points.find((point) => point.id === currentQuestion.answerIds[index]);
  const toPoint = currentQuestion.points.find((point) => point.id === pointId);
  if (!fromPoint || !toPoint) {
    return null;
  }

  const deltaX = toPoint.x - fromPoint.x;
  const deltaY = toPoint.y - fromPoint.y;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

  return (
    <View
      key={`answer-${fromPoint.id}-${toPoint.id}`}
      className="route-segment route-segment-answer"
      style={{
        left: `${fromPoint.x}%`,
        top: `${fromPoint.y}%`,
        width: `${length}%`,
        transform: `rotate(${angle}deg)`,
      }}
    />
  );
}) : null}
```

- [ ] **Step 8: Update star node classes and labels**

Inside the point map, replace `wrongTap` with:

```ts
const expectedPrefix = currentQuestion.answerIds.slice(0, tappedIds.length);
const wrongTap = phase === "feedback" && tapped && !expectedPrefix.includes(point.id);
const shouldShowValue = phase === "revealing" || phase === "feedback";
```

Replace the `className` and inner text with:

```tsx
className={`star-node star-node-${point.colorGroup} star-node-${point.brightness} ${tapped ? "star-node-tapped" : ""} ${wrongTap ? "star-node-wrong" : ""}`}
```

```tsx
<Text className="star-node-text">{shouldShowValue ? point.value : tapped ? "✓" : ""}</Text>
```

- [ ] **Step 9: Add feedback route panel below the board**

After the star-board closing `</View>`, add:

```tsx
{phase === "feedback" ? (
  <View className="route-replay-card">
    <Text className="route-replay-label">正确星路</Text>
    <Text className="route-replay-values">{routeValueText}</Text>
  </View>
) : null}
```

- [ ] **Step 10: Update result metrics**

In the result grid, replace the final combo item value/label with:

```tsx
<Text className="result-value">{bestCombo}</Text>
<Text className="result-label">最佳连击</Text>
```

Add two more result items before the buttons:

```tsx
<View className="result-item">
  <Text className="result-value">{correctQuestions}/{NUMBER_ORDER_TOTAL_QUESTIONS}</Text>
  <Text className="result-label">完成航线</Text>
</View>
<View className="result-item result-item-wide">
  <Text className="result-value result-value-small">{masteredRuleText}</Text>
  <Text className="result-label">掌握规则</Text>
</View>
```

- [ ] **Step 11: Run typecheck**

Run:

```sh
npm run typecheck
```

Expected: PASS.

- [ ] **Step 12: Commit Task 2**

Run:

```sh
git add src/pages/number-order/index.tsx
git commit -m "feat: render star route number order flow"
```

Expected: commit includes only `src/pages/number-order/index.tsx`.

---

### Task 3: Star Route Styling

**Files:**
- Modify: `src/pages/number-order/index.scss`

- [ ] **Step 1: Replace visual styles for start preview, board, routes, clues, and result metrics**

In `src/pages/number-order/index.scss`, add these styles after `.best-pill`:

```scss
.route-preview {
  position: relative;
  height: 156px;
  margin-top: 24px;
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(22, 78, 99, 0.92)),
    #0f172a;
  overflow: hidden;
}

.preview-star {
  position: absolute;
  z-index: 2;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.78);
  background: #fef3c7;
  color: #172033;
  font-size: 21px;
  line-height: 1;
  font-weight: 900;
  box-shadow: 0 0 22px rgba(251, 191, 36, 0.38);
}

.preview-star-one {
  left: 12%;
  top: 56%;
}

.preview-star-two {
  left: 38%;
  top: 26%;
}

.preview-star-three {
  left: 62%;
  top: 48%;
}

.preview-star-four {
  left: 82%;
  top: 20%;
}

.preview-line {
  position: absolute;
  z-index: 1;
  height: 5px;
  border-radius: 999px;
  background: rgba(45, 212, 191, 0.82);
  transform-origin: 0 50%;
}

.preview-line-one {
  left: 18%;
  top: 66%;
  width: 30%;
  transform: rotate(-29deg);
}

.preview-line-two {
  left: 44%;
  top: 43%;
  width: 28%;
  transform: rotate(22deg);
}
```

Replace the `.star-board` block with:

```scss
.star-board {
  position: relative;
  height: 620px;
  border-radius: 30px;
  overflow: hidden;
  background:
    radial-gradient(circle at 22% 26%, rgba(251, 191, 36, 0.18), transparent 18%),
    radial-gradient(circle at 78% 74%, rgba(45, 212, 191, 0.18), transparent 22%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 64, 93, 0.96) 58%, rgba(12, 74, 110, 0.92) 100%);
  box-shadow: 0 22px 42px rgba(31, 41, 55, 0.22);
}
```

Add route and clue styles before `.star-node`:

```scss
.route-segment {
  position: absolute;
  z-index: 1;
  height: 8px;
  border-radius: 999px;
  transform-origin: 0 50%;
  pointer-events: none;
}

.route-segment-player {
  background: rgba(45, 212, 191, 0.9);
  box-shadow: 0 0 18px rgba(45, 212, 191, 0.46);
}

.route-segment-answer {
  height: 4px;
  background: rgba(251, 191, 36, 0.92);
  box-shadow: 0 0 18px rgba(251, 191, 36, 0.36);
}
```

Replace `.star-node` through `.star-board-answering .star-node` with:

```scss
.star-node {
  position: absolute;
  z-index: 3;
  width: 86px;
  height: 86px;
  margin-left: -43px;
  margin-top: -43px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.68);
  background: rgba(226, 246, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 24px rgba(125, 211, 252, 0.42),
    inset 0 2px 0 rgba(255, 255, 255, 0.82);
}

.star-node-gold {
  background: rgba(254, 243, 199, 0.94);
  box-shadow:
    0 0 24px rgba(251, 191, 36, 0.4),
    inset 0 2px 0 rgba(255, 255, 255, 0.82);
}

.star-node-bright {
  border-color: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 0 32px rgba(255, 255, 255, 0.42),
    0 0 26px rgba(45, 212, 191, 0.4),
    inset 0 2px 0 rgba(255, 255, 255, 0.88);
}

.star-node-tapped {
  background: #14b8a6;
  border-color: rgba(204, 251, 241, 0.94);
}

.star-node-wrong {
  background: #ef4444;
  border-color: rgba(254, 226, 226, 0.94);
}

.star-node-text {
  font-size: 31px;
  line-height: 1;
  font-weight: 900;
  color: #0f172a;
}

.star-node-tapped .star-node-text,
.star-node-wrong .star-node-text {
  color: #fff;
  font-size: 24px;
}

.star-board-answering .star-node {
  background: rgba(226, 246, 255, 0.42);
}

.star-board-answering .star-node-gold {
  background: rgba(254, 243, 199, 0.42);
}
```

Add replay and result text styles before `.result-card`:

```scss
.route-replay-card {
  padding: 22px 24px;
  border-radius: 22px;
  border: 1px solid rgba(251, 191, 36, 0.24);
  background: rgba(255, 251, 235, 0.9);
  box-shadow: 0 14px 26px rgba(53, 73, 98, 0.08);
}

.route-replay-label,
.route-replay-values {
  display: block;
}

.route-replay-label {
  font-size: 24px;
  line-height: 1.2;
  font-weight: 900;
  color: #92400e;
}

.route-replay-values {
  margin-top: 8px;
  font-size: 31px;
  line-height: 1.25;
  font-weight: 900;
  color: #172033;
}

.result-item-wide {
  grid-column: span 2;
}

.result-value-small {
  font-size: 28px;
}
```

- [ ] **Step 2: Run style-adjacent checks**

Run:

```sh
npm run lint
npm run typecheck
```

Expected: both PASS.

- [ ] **Step 3: Commit Task 3**

Run:

```sh
git add src/pages/number-order/index.scss
git commit -m "style: refresh number order star route ui"
```

Expected: commit includes only `src/pages/number-order/index.scss`.

---

### Task 4: Build Verification And Economy Sanity Check

**Files:**
- Modify only if a prior task produced a compile or lint error in touched files.

- [ ] **Step 1: Run focused unit tests**

Run:

```sh
npm test -- tests/unit/numberOrderGameLogic.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run all unit tests**

Run:

```sh
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```sh
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```sh
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Run WeChat build**

Run:

```sh
npm run build:weapp
```

Expected: build exits 0 and writes the normal Taro build output.

- [ ] **Step 6: Inspect git status before final commit**

Run:

```sh
git status --short
```

Expected: no uncommitted changes from this feature. Existing unrelated worktree changes may still appear; do not stage them.

If a verification command required a small fix in files from Tasks 1-3, commit only those files:

```sh
git add src/pages/number-order/gameLogic.ts src/pages/number-order/index.tsx src/pages/number-order/index.scss tests/unit/numberOrderGameLogic.test.ts
git commit -m "fix: verify number order star route refresh"
```

Expected: commit contains only number-order files and its unit test.

---

## Self-Review

- Spec coverage: Task 1 covers route rules, difficulty progression, replay text, scoring, and score-economy shape. Task 2 covers start screen copy, play flow, path rendering, replay card, best combo, completed route count, and mastered rules. Task 3 covers star board, path styling, clue styling, and result metric layout. Task 4 covers verification.
- Completion-marker scan: The plan contains no unresolved markers. The only conditional work is the explicit verification-fix path in Task 4.
- Type consistency: Route rule ids, `NumberOrderQuestion.routeRule`, `NumberOrderPoint.colorGroup`, `NumberOrderPoint.brightness`, `getRouteAnswerIds`, and `getRouteValues` are defined in Task 1 before being used by Task 2.
