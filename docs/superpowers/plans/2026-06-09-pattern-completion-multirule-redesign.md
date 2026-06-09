# Pattern Completion Multirule Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved option B redesign for `找规律` as an 8-case multirule reasoning game with sequence and matrix questions.

**Architecture:** Keep the game local to `src/pages/pattern-completion/`. `patterns.ts` owns pure question generation, distractors, metadata, and scoring; `index.tsx` owns page state, rendering, training records, and pet point calls; `index.scss` provides stable mobile layouts for sequence, grid, options, and reveal feedback.

**Tech Stack:** Taro 4, React 18, TypeScript, Sass, Jest.

---

### Task 1: Replace Pattern Logic

**Files:**
- Modify: `src/pages/pattern-completion/patterns.ts`
- Test: `tests/unit/patternCompletionPatterns.test.ts`

- [ ] Replace the old sequence/numeric generator with a layout-capable model:
  - `PatternLayout = "sequence" | "grid"`
  - `PatternRuleFamily = "dual-attribute-sequence" | "row-column-matrix" | "count-size-transform" | "position-shift"`
  - `PatternOption` stays visual-only for this redesign, with shape, color, size, count, and position attributes.
  - `PatternQuestion` exposes `cells`, `columns`, `missingIndex`, `ruleCount`, `partialDistractorIds`, `ruleSummary`, and optional `distractorExplanations`.

- [ ] Implement these factory functions and export them for tests:
  - `createDualAttributeSequenceQuestion(index, difficulty)`
  - `createRowColumnMatrixQuestion(index, difficulty)`
  - `createCountSizeTransformQuestion(index, difficulty)`
  - `createPositionShiftQuestion(index, difficulty)`

- [ ] Implement `generatePatternSession(difficulty)` with exactly 8 questions for both modes.

- [ ] Update scoring so combo bonus caps at `+1`, case maximum is `5`, wrong answers score `0`, and hint penalty cannot reduce a correct answer below `1`.

### Task 2: Update Tests

**Files:**
- Modify: `tests/unit/patternCompletionPatterns.test.ts`

- [ ] Replace old numeric-rule tests with generator tests for the four approved families.

- [ ] Add tests for:
  - 8 questions per session.
  - 4 options per question.
  - answer appears exactly once.
  - missing index is valid and maps to `null`.
  - hard mode has at least 6 questions with `ruleCount >= 2`.
  - hard questions expose at least 2 partial distractors.
  - row-column matrix derives the expected answer.
  - position-shift derives the expected position.
  - count-size derives the expected count and size.
  - scoring caps combo at 1 and keeps point caps aligned with `getAwardedPoints()`.

### Task 3: Update Page Rendering

**Files:**
- Modify: `src/pages/pattern-completion/index.tsx`

- [ ] Replace `sequence` usage with `cells`.

- [ ] Render `layout === "sequence"` as a row and `layout === "grid"` as a stable grid using `columns`.

- [ ] Render visual tokens with position, count, shape, color, and size.

- [ ] Update start-screen and result-screen copy to remove numeric-question accuracy and describe multirule cases.

- [ ] In reveal state, show `ruleSummary`, `explanation`, and selected distractor explanation when available.

### Task 4: Update Styles

**Files:**
- Modify: `src/pages/pattern-completion/index.scss`

- [ ] Add stable grid styles for `2x3` and `3x3` questions.

- [ ] Add token position styles for center, edges, and corners.

- [ ] Keep options readable on narrow screens without changing the scoring or state flow.

### Task 5: Update Points Documentation

**Files:**
- Modify: `docs/points-economy.md`

- [ ] Update the `pattern-completion` explanation to describe 8-case multirule reasoning, maximum session score `40`, and expected normal/hard point ranges.

### Task 6: Verify and Commit

**Files:**
- Stage only:
  - `src/pages/pattern-completion/patterns.ts`
  - `src/pages/pattern-completion/index.tsx`
  - `src/pages/pattern-completion/index.scss`
  - `tests/unit/patternCompletionPatterns.test.ts`
  - `docs/points-economy.md`
  - `docs/superpowers/plans/2026-06-09-pattern-completion-multirule-redesign.md`

- [ ] Run:

```bash
npm test -- --runTestsByPath tests/unit/patternCompletionPatterns.test.ts
npm run typecheck
npm run lint
```

- [ ] Commit with:

```bash
git commit -m "feat: redesign pattern completion gameplay"
```
