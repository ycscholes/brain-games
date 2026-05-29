# 找规律玩法刷新实施计划

> **For Codex workers:** Implement task-by-task. Keep commits scoped. Do not include unrelated existing worktree changes. Run verification before committing implementation.

**Goal:** 将 `找规律` 从固定题库答题升级为动态生成的“规律侦探”玩法：先观察作答，再揭示规律；加入数字规律、提示、连击和更合理的难度曲线，同时保持现有积分体系。

**Design Spec:** `docs/superpowers/specs/2026-05-30-pattern-completion-gameplay-design.md`

**Architecture:** 保持页面目录 `src/pages/pattern-completion/` 不变。`patterns.ts` 承担纯逻辑生成、答案唯一性、提示、解释、计分；`index.tsx` 承担 UI 状态、计时、存储、积分和训练记录；`index.scss` 做页面样式增强。

**Tech Stack:** Taro 4 + React 18 + TypeScript + Sass + Jest。

---

## 文件影响

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `src/pages/pattern-completion/patterns.ts` | 重写/扩展 | 动态题目生成、数字规律、解释、提示、计分 |
| `src/pages/pattern-completion/index.tsx` | 修改 | 新回合流程、提示、揭示态、结算统计 |
| `src/pages/pattern-completion/index.scss` | 修改 | 数字题、缺口、提示按钮、规律卡片、连击反馈 |
| `tests/unit/patternCompletionPatterns.test.ts` | 新建 | 生成器、答案唯一、数字规则、计分测试 |
| `docs/points-economy.md` | 可选修改 | 仅当需要补充说明新玩法分数范围时修改，不改转换率 |

---

## 任务 1: 建立纯逻辑模型和计分函数

**文件：**
- 修改: `src/pages/pattern-completion/patterns.ts`
- 新建: `tests/unit/patternCompletionPatterns.test.ts`

- [ ] **Step 1: 定义题目类型**

添加或替换为统一题型结构：

```ts
export type PatternQuestionKind = "visual" | "numeric";
export type PatternRuleFamily =
  | "color-cycle"
  | "shape-cycle"
  | "dual-sync"
  | "odd-even"
  | "size-count"
  | "missing-position"
  | "numeric-sequence";
```

题目结构至少包含：

- `id`
- `kind`
- `family`
- `difficulty`
- `sequence`
- `missingIndex`
- `answer`
- `options`
- `hint`
- `explanationTitle`
- `explanation`

- [ ] **Step 2: 保留现有视觉 token 兼容**

现有页面使用 `PatternOption`、`shape`、`colorName`、`colorHex`、`label`。重写时优先保留这些字段，减少页面迁移成本。

- [ ] **Step 3: 添加数字 token**

数字题需要支持渲染数字格。建议用联合类型区分：

```ts
type PatternCell =
  | { type: "visual"; option: PatternOption }
  | { type: "number"; value: number; label: string };
```

- [ ] **Step 4: 实现计分 helper**

按 spec 实现：

- 答对基础 `+3`
- 连击奖励 `+1` 起，单题最高 `+2`
- 快速答对 `+0~1`
- 使用线索 `-1`
- 答对题最低 `+1`
- 答错 `+0`

导出纯函数，便于页面和测试共用。

- [ ] **Step 5: 添加第一批测试**

覆盖：

- 答错为 0 分。
- 答对基础分为 3。
- combo bonus capped at 2。
- hint penalty 不会把答对题降到 0。
- speed bonus 只给答对题。

- [ ] **Step 6: 运行测试**

```bash
npm test -- --runTestsByPath tests/unit/patternCompletionPatterns.test.ts
```

---

## 任务 2: 实现视觉规律生成器

**文件：**
- 修改: `src/pages/pattern-completion/patterns.ts`
- 修改: `tests/unit/patternCompletionPatterns.test.ts`

- [ ] **Step 1: 实现基础视觉模板**

覆盖：

- `color-cycle`
- `shape-cycle`
- `dual-sync`

要求：

- 可生成最后缺口题。
- 选项包含正确答案。
- 选项不重复。
- 正确答案唯一。
- 解释文本简短明确。

- [ ] **Step 2: 实现进阶视觉模板**

覆盖：

- `odd-even`
- `size-count`
- `missing-position`

要求：

- `missing-position` 支持中间缺口。
- `odd-even` 的解释明确提示奇偶位分别观察。
- `size-count` 不依赖过小视觉差异，移动端可读。

- [ ] **Step 3: 实现干扰项生成**

干扰项应接近但不等于正确答案：

- 同形不同色
- 同色不同形
- 错误循环中的相邻项
- 奇偶轨混淆项

- [ ] **Step 4: 添加视觉生成测试**

覆盖：

- 每题恰好一个正确答案。
- `options` 不重复。
- `missingIndex` 在序列范围内。
- 普通模式前两题只使用基础视觉或基础数字模板。
- 困难模式允许更早出现进阶模板。

---

## 任务 3: 实现数字规律生成器

**文件：**
- 修改: `src/pages/pattern-completion/patterns.ts`
- 修改: `tests/unit/patternCompletionPatterns.test.ts`

- [ ] **Step 1: 实现基础数字模板**

覆盖：

- 等差
- 等比，小倍率、小数字
- 小型斐波那契/类斐波那契

普通模式约束：

- 数字保持较小。
- 序列长度短。
- 只考一层规律。

- [ ] **Step 2: 实现进阶数字模板**

覆盖：

- 差值递增
- 奇偶位交错子序列
- 交替加减
- 平方数/三角数

困难模式约束：

- 可以多看一步，但不能变成大数心算。
- 干扰项接近答案但不能制造多解。

- [ ] **Step 3: 实现数字解释**

示例：

- `每次都加 3`
- `差值依次为 +2、+3、+4`
- `每一项等于前两项之和`
- `奇数位和偶数位分别递增`

- [ ] **Step 4: 添加数字生成测试**

覆盖：

- 等差题答案正确。
- 差值递增题答案正确。
- 类斐波那契题答案正确。
- 交错子序列题答案唯一。
- 数字选项不重复，且包含正确答案。

---

## 任务 4: 实现 session 生成和难度分布

**文件：**
- 修改: `src/pages/pattern-completion/patterns.ts`
- 修改: `tests/unit/patternCompletionPatterns.test.ts`

- [ ] **Step 1: 实现 `generatePatternSession`**

建议签名：

```ts
export function generatePatternSession(difficulty: TrainingDifficulty): PatternQuestion[];
```

生成 8 题。

- [ ] **Step 2: 普通模式分布**

实现 spec 分布：

- 1-2: 基础图形
- 3-4: 基础数字
- 5-6: 双维图形
- 7-8: 进阶混合

- [ ] **Step 3: 困难模式分布**

实现 spec 分布：

- 1-2: 进阶图形
- 3-5: 数字逻辑
- 6-8: 双轨/缺失位置/强干扰

- [ ] **Step 4: 生成失败降级**

每个模板生成失败时有限重试。重试失败后降级到同难度内更简单模板，避免页面空题。

- [ ] **Step 5: 添加 session 测试**

覆盖：

- 普通/困难都生成 8 题。
- 分布符合预期。
- 每题都有 hint 和 explanation。
- 全 session 无明显重复题。

---

## 任务 5: 改造页面状态流

**文件：**
- 修改: `src/pages/pattern-completion/index.tsx`

- [ ] **Step 1: 调整 phase**

从现有 `start | playing | finished` 调整为：

```ts
type Phase = "start" | "playing" | "reveal" | "finished";
```

- [ ] **Step 2: 使用动态 session**

开始游戏时调用 `generatePatternSession(rewardDifficulty)`，保存为本局题目。不要继续使用固定 `PATTERN_QUESTION_BANK`。

- [ ] **Step 3: 添加回合状态**

新增：

- `remainingHints`
- `hintUsedForCurrent`
- `currentCombo`
- `longestCombo`
- `caseScores`
- `selectedOptionId`
- `lastAnswerCorrect`
- `kindStats`

- [ ] **Step 4: 实现线索按钮**

点击后：

- 本局剩余线索 `-1`
- 当前题标记 `hintUsedForCurrent = true`
- 显示当前题 `hint`
- 不揭示答案
- 已选答案后不可再使用线索

- [ ] **Step 5: 实现答题后 reveal**

选择答案后：

- 计算本题得分。
- 更新正确数、combo、最长 combo、数字题统计。
- 进入 `reveal`。
- 展示正确/错误、得分明细、规律解释。
- 用户点击下一题再前进。

- [ ] **Step 6: 完成结算**

第 8 题 reveal 后点击完成，写入：

- `addPointsToPet("pattern-completion", finalScore, rewardDifficulty)`
- `recordTrainingSession(...)`
- best score

保持 `getAwardedPoints("pattern-completion", finalScore, rewardDifficulty)` 口径。

---

## 任务 6: 更新界面和样式

**文件：**
- 修改: `src/pages/pattern-completion/index.tsx`
- 修改: `src/pages/pattern-completion/index.scss`

- [ ] **Step 1: 更新开始页文案**

说明：

- 每局 8 个规律案件。
- 先观察作答，答后揭示规律。
- 每局 2 次线索。
- 分数由正确、连击、速度和线索使用决定。

- [ ] **Step 2: 渲染视觉题和数字题**

保留现有图形 token，同时新增数字 cell 样式。

要求：

- 序列行尺寸稳定。
- 缺口位置清晰。
- 数字题在小屏幕可读。

- [ ] **Step 3: 添加揭示卡片**

揭示态显示：

- `识破规律` 或 `差一点`
- 本题得分
- combo 变化
- 正确答案
- 规律标签和解释

- [ ] **Step 4: 更新结果页**

展示：

- 总分
- 识破案件数
- 最长连击
- 使用线索数
- 数字题正确率
- 获得宠物积分

- [ ] **Step 5: 样式检查**

确保：

- 不使用新图片。
- 不让说明文字挤压主要答题区。
- 小屏幕不重叠。
- 视觉保持当前橙色主题，但不要过重。

---

## 任务 7: 验证和提交

- [ ] **Step 1: 运行单元测试**

```bash
npm test -- --runTestsByPath tests/unit/patternCompletionPatterns.test.ts
```

- [ ] **Step 2: 运行类型检查**

```bash
npm run typecheck
```

- [ ] **Step 3: 如有必要运行 lint**

```bash
npm run lint
```

- [ ] **Step 4: 检查积分口径**

确认实现中没有修改：

- `TRAINING_POINT_RATES["pattern-completion"]`
- `MAX_POINTS_PER_SESSION`
- `HARD_MAX_POINTS_PER_SESSION`

确认结算仍调用：

```ts
getAwardedPoints("pattern-completion", finalScore, rewardDifficulty)
```

- [ ] **Step 5: 检查 git diff**

只包含本任务相关文件，不包含已有宠物图片、宠物页、心算页等无关改动。

- [ ] **Step 6: 提交**

建议提交信息：

```bash
git commit -m "feat: refresh pattern completion gameplay"
```

---

## Acceptance Checklist

- [ ] 每局为 8 个动态生成题，不再是固定 10 题。
- [ ] 答题前不显示规律说明。
- [ ] 答题后有规律揭示卡片。
- [ ] 包含视觉规律和数字规律。
- [ ] 普通/困难模式题型分布符合 spec。
- [ ] 每题答案唯一。
- [ ] 每局 2 次线索，线索不直接给答案。
- [ ] 计分符合 `+3` 基础、combo、速度、线索扣分规则。
- [ ] 宠物积分仍由现有 `getAwardedPoints` 统一计算。
- [ ] 结果页显示总分、识破案件数、最长连击、线索使用、数字题正确率。
- [ ] 新增单元测试覆盖生成、数字规则、答案唯一、计分和经济边界。
- [ ] 验证命令通过。
