import {
  createArithmeticQuestion,
  createFibonacciQuestion,
  createIncreasingDifferenceQuestion,
  createInterleavedQuestion,
  generatePatternSession,
  PATTERN_SESSION_LENGTH,
  scorePatternQuestion,
  type NumericPatternOption,
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

const getNumericAnswer = (question: PatternQuestion) => question.answer as NumericPatternOption;

describe("pattern-completion question generation", () => {
  test("creates 8-question sessions for normal and hard difficulty", () => {
    expect(generatePatternSession("normal")).toHaveLength(PATTERN_SESSION_LENGTH);
    expect(generatePatternSession("hard")).toHaveLength(PATTERN_SESSION_LENGTH);
  });

  test("normal session follows the expected family distribution", () => {
    const session = generatePatternSession("normal");

    expect(session.slice(0, 2).map((question) => question.kind)).toEqual(["visual", "visual"]);
    expect(session.slice(2, 4).map((question) => question.kind)).toEqual(["numeric", "numeric"]);
    expect(session.slice(4, 6).every((question) => question.family === "dual-sync")).toBe(true);
    expect(session.slice(6).map((question) => question.family)).toEqual(["odd-even", "size-count"]);
  });

  test("hard session includes numeric logic in the middle and advanced families later", () => {
    const session = generatePatternSession("hard");

    expect(session.slice(2, 5).every((question) => question.kind === "numeric")).toBe(true);
    expect(session.slice(5).map((question) => question.family)).toEqual([
      "size-count",
      "missing-position",
      "shape-cycle",
    ]);
  });

  test("every generated question has one answer option, unique options, hint, and explanation", () => {
    [...generatePatternSession("normal"), ...generatePatternSession("hard")].forEach((question) => {
      const optionIds = getOptionIds(question);

      expect(optionIds).toContain(question.answer.id);
      expect(optionIds.filter((id) => id === question.answer.id)).toHaveLength(1);
      expect(new Set(optionIds).size).toBe(optionIds.length);
      expect(question.missingIndex).toBeGreaterThanOrEqual(0);
      expect(question.missingIndex).toBeLessThan(question.sequence.length);
      expect(question.sequence[question.missingIndex]).toBeNull();
      expect(question.hint.length).toBeGreaterThan(0);
      expect(question.explanation.length).toBeGreaterThan(0);
    });
  });
});

describe("pattern-completion numeric rules", () => {
  test("arithmetic progression produces the expected answer", () => {
    const question = createArithmeticQuestion(2, "normal");
    const visibleValues = question.sequence
      .filter((cell): cell is NumericPatternOption => cell?.type === "number")
      .map((cell) => cell.value);
    const step = visibleValues[1] - visibleValues[0];

    expect(getNumericAnswer(question).value).toBe(visibleValues[visibleValues.length - 1] + step);
  });

  test("increasing-difference question exposes a middle missing value", () => {
    const question = createIncreasingDifferenceQuestion(3, "hard");

    expect(question.missingIndex).toBe(3);
    expect(getNumericAnswer(question).value).toBe(15);
  });

  test("fibonacci-like question uses previous two values", () => {
    const question = createFibonacciQuestion(1, "normal");
    const cells = question.sequence;
    const first = cells[0] as NumericPatternOption;
    const second = cells[1] as NumericPatternOption;
    const third = cells[2] as NumericPatternOption;

    expect(third.value).toBe(first.value + second.value);
    expect(getNumericAnswer(question).value).toBe(13);
  });

  test("interleaved numeric question has a unique answer option", () => {
    const question = createInterleavedQuestion(2);
    const optionIds = getOptionIds(question);

    expect(question.missingIndex).toBe(3);
    expect(optionIds.filter((id) => id === question.answer.id)).toHaveLength(1);
    expect(new Set(optionIds).size).toBe(optionIds.length);
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
      comboBonus: 2,
      speedBonus: 1,
      hintPenalty: 1,
      score: 5,
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

  test("ordinary normal scores do not trivially hit the pet point cap", () => {
    expect(getAwardedPoints("pattern-completion", 30, "normal")).toBe(36);
    expect(getAwardedPoints("pattern-completion", 34, "normal")).toBe(40);
    expect(getAwardedPoints("pattern-completion", 38, "hard")).toBe(60);
  });
});
