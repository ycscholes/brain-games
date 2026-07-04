import {
  COLOR_TRAP_COLORS,
  COLOR_TRAP_TOTAL_QUESTIONS,
  createColorTrapQuestion,
  createColorTrapSession,
  getColorTrapTimeLimitMs,
  scoreColorTrapQuestion,
} from "../../src/pages/color-trap/gameLogic";

describe("color-trap game logic", () => {
  test("creates 8-question normal and hard sessions", () => {
    expect(createColorTrapSession("normal")).toHaveLength(COLOR_TRAP_TOTAL_QUESTIONS);
    expect(createColorTrapSession("hard")).toHaveLength(COLOR_TRAP_TOTAL_QUESTIONS);
  });

  test("questions always use conflicting word and ink colors with four options", () => {
    createColorTrapSession("normal").forEach((question, index) => {
      expect(question.id).toBeTruthy();
      expect(question.wordColor.id).not.toBe(question.inkColor.id);
      expect(question.options).toHaveLength(COLOR_TRAP_COLORS.length);
      expect(question.options.map((option) => option.id)).toContain(question.answer);
      expect(question.timeLimitMs).toBe(getColorTrapTimeLimitMs("normal", index));
    });
  });

  test("hard mode uses tighter timing and clamps out-of-range indexes", () => {
    const hardQuestion = createColorTrapQuestion("hard", 99);

    expect(hardQuestion.id).toBe("color-trap-hard-8");
    expect(hardQuestion.timeLimitMs).toBe(2900);
    expect(getColorTrapTimeLimitMs("hard", 99)).toBe(2900);
    expect(getColorTrapTimeLimitMs("hard", 0)).toBeLessThan(getColorTrapTimeLimitMs("normal", 0));
  });

  test("scores correct answers with speed and combo bonuses", () => {
    expect(scoreColorTrapQuestion({
      selectedColorId: "red",
      correctColorId: "red",
      answerMs: 1200,
      currentCombo: 2,
    })).toEqual({
      correct: true,
      speedBonus: 1,
      comboBonus: 1,
      score: 5,
    });

    expect(scoreColorTrapQuestion({
      selectedColorId: "blue",
      correctColorId: "red",
      answerMs: 900,
      currentCombo: 4,
    })).toEqual({
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    });
  });
});
