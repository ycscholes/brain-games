import {
  createCountSizeTransformQuestion,
  createPositionShiftQuestion,
  createRowColumnMatrixQuestion,
  generatePatternSession,
  PATTERN_SESSION_LENGTH,
  scorePatternQuestion,
  type PatternQuestion,
} from "../../src/pages/pattern-completion/patterns";
import { getAwardedPoints } from "../../src/utils/trainingStorage";

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getStorageSync: jest.fn(),
    setStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
  },
}));

const getOptionIds = (question: PatternQuestion) => question.options.map((option) => option.id);

const expectValidQuestion = (question: PatternQuestion) => {
  const optionIds = getOptionIds(question);

  expect(question.options).toHaveLength(4);
  expect(optionIds).toContain(question.answer.id);
  expect(optionIds.filter((id) => id === question.answer.id)).toHaveLength(1);
  expect(new Set(optionIds).size).toBe(optionIds.length);
  expect(question.missingIndex).toBeGreaterThanOrEqual(0);
  expect(question.missingIndex).toBeLessThan(question.cells.length);
  expect(question.cells[question.missingIndex]).toBeNull();
  expect(question.columns).toBeGreaterThan(0);
  expect(question.hint.length).toBeGreaterThan(0);
  expect(question.ruleSummary.length).toBeGreaterThan(0);
  expect(question.explanation.length).toBeGreaterThan(0);
  expect(question.ruleCount).toBeGreaterThanOrEqual(1);
};

describe("pattern-completion multirule generation", () => {
  test("creates 8-question sessions for normal and hard difficulty", () => {
    expect(generatePatternSession("normal")).toHaveLength(PATTERN_SESSION_LENGTH);
    expect(generatePatternSession("hard")).toHaveLength(PATTERN_SESSION_LENGTH);
  });

  test("normal session includes the first-version rule families", () => {
    const families = new Set(generatePatternSession("normal").map((question) => question.family));

    expect(families).toEqual(
      new Set([
        "dual-attribute-sequence",
        "row-column-matrix",
        "count-size-transform",
        "position-shift",
      ]),
    );
  });

  test("hard session has at least six cases with two or more rules", () => {
    const hardSession = generatePatternSession("hard");

    expect(hardSession.filter((question) => question.ruleCount >= 2)).toHaveLength(8);
    expect(hardSession.filter((question) => question.ruleCount >= 3).length).toBeGreaterThanOrEqual(6);
  });

  test("every generated question has one unique answer, valid missing cell, hint, and explanation", () => {
    [...generatePatternSession("normal"), ...generatePatternSession("hard")].forEach(expectValidQuestion);
  });

  test("hard questions expose at least two partial-rule distractors when supported", () => {
    generatePatternSession("hard").forEach((question) => {
      expect(question.partialDistractorIds.length).toBeGreaterThanOrEqual(2);
      question.partialDistractorIds.forEach((id) => {
        expect(getOptionIds(question)).toContain(id);
        expect(id).not.toBe(question.answer.id);
      });
    });
  });
});

describe("pattern-completion rule families", () => {
  test("row-column matrix derives a visible answer from row and column position", () => {
    const question = createRowColumnMatrixQuestion(1, "hard");

    expect(question.layout).toBe("grid");
    expect(question.columns).toBe(3);
    expect(question.answer.shape).toBe("circle");
    expect(question.answer.colorName).toBe("amber");
    expect(question.answer.count).toBe(3);
  });

  test("position-shift derives the expected missing position", () => {
    const question = createPositionShiftQuestion(2, "hard");

    expect(question.family).toBe("position-shift");
    expect(question.missingIndex).toBe(3);
    expect(question.answer.position).toBe("top-right");
  });

  test("count-size transform derives the expected count and size", () => {
    const question = createCountSizeTransformQuestion(2, "hard");

    expect(question.family).toBe("count-size-transform");
    expect(question.missingIndex).toBe(2);
    expect(question.answer.count).toBe(2);
    expect(question.answer.size).toBe("small");
    expect(question.answer.position).toBe("top");
  });
});

describe("pattern-completion scoring", () => {
  test("wrong answers score zero", () => {
    expect(
      scorePatternQuestion({
        isCorrect: false,
        currentCombo: 4,
        elapsedMs: 1000,
        targetMs: 5000,
        hintUsed: true,
      }),
    ).toMatchObject({ score: 0, comboBonus: 0, speedBonus: 0 });
  });

  test("correct answers get base, capped combo, speed, and hint penalty", () => {
    expect(
      scorePatternQuestion({
        isCorrect: true,
        currentCombo: 4,
        elapsedMs: 1000,
        targetMs: 5000,
        hintUsed: true,
      }),
    ).toMatchObject({
      baseScore: 3,
      comboBonus: 1,
      speedBonus: 1,
      hintPenalty: 1,
      score: 4,
    });
  });

  test("hint penalty cannot reduce a correct case below one point", () => {
    expect(
      scorePatternQuestion({
        isCorrect: true,
        currentCombo: 0,
        elapsedMs: 9000,
        targetMs: 1000,
        hintUsed: true,
      }).score,
    ).toBe(2);
  });

  test("score economy fits ordinary normal and strong hard sessions", () => {
    expect(getAwardedPoints("pattern-completion", 30, "normal")).toBe(36);
    expect(getAwardedPoints("pattern-completion", 34, "normal")).toBe(40);
    expect(getAwardedPoints("pattern-completion", 34, "hard")).toBe(60);
    expect(getAwardedPoints("pattern-completion", 40, "hard")).toBe(60);
  });
});
