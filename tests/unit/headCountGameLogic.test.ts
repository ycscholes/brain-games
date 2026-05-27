import {
  createHeadCountOptions,
  createHeadCountQuestion,
  createHeadCountSession,
  getHeadCountEventCount,
  HEAD_COUNT_TOTAL_QUESTIONS,
  scoreHeadCountQuestion,
} from "../../src/pages/head-count/gameLogic";

describe("head-count game logic", () => {
  test("creates an 8-question session", () => {
    expect(createHeadCountSession("normal")).toHaveLength(HEAD_COUNT_TOTAL_QUESTIONS);
    expect(createHeadCountSession("hard")).toHaveLength(HEAD_COUNT_TOTAL_QUESTIONS);
  });

  test("normal questions stay within event and delta limits", () => {
    for (let index = 0; index < HEAD_COUNT_TOTAL_QUESTIONS; index += 1) {
      const question = createHeadCountQuestion("normal", index);

      expect(question.initialCount).toBeGreaterThanOrEqual(1);
      expect(question.initialCount).toBeLessThanOrEqual(5);
      expect(question.events).toHaveLength(getHeadCountEventCount("normal", index));
      question.events.forEach((event) => {
        expect(event.delta).toBeGreaterThanOrEqual(1);
        expect(event.delta).toBeLessThanOrEqual(2);
      });
    }
  });

  test("hard questions stay within event and delta limits", () => {
    for (let index = 0; index < HEAD_COUNT_TOTAL_QUESTIONS; index += 1) {
      const question = createHeadCountQuestion("hard", index);

      expect(question.initialCount).toBeGreaterThanOrEqual(2);
      expect(question.initialCount).toBeLessThanOrEqual(8);
      expect(question.events).toHaveLength(getHeadCountEventCount("hard", index));
      question.events.forEach((event) => {
        expect(event.delta).toBeGreaterThanOrEqual(1);
        expect(event.delta).toBeLessThanOrEqual(3);
      });
    }
  });

  test("generated population path never becomes negative", () => {
    for (let index = 0; index < 50; index += 1) {
      const question = createHeadCountQuestion(index % 2 === 0 ? "normal" : "hard", index);
      let count = question.initialCount;

      question.events.forEach((event) => {
        count += event.direction === "enter" ? event.delta : -event.delta;
        expect(count).toBeGreaterThanOrEqual(0);
        expect(event.afterCount).toBe(count);
      });
      expect(question.answer).toBe(count);
    }
  });

  test("options include the correct answer once", () => {
    for (let answer = 0; answer <= 12; answer += 1) {
      const options = createHeadCountOptions(answer);

      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options.filter((option) => option === answer)).toHaveLength(1);
    }
  });

  test("scores correct, fast, combo, and wrong answers", () => {
    expect(scoreHeadCountQuestion({
      selectedAnswer: 4,
      correctAnswer: 4,
      answerMs: 1200,
      currentCombo: 2,
    })).toEqual({
      correct: true,
      speedBonus: 2,
      comboBonus: 1,
      score: 8,
    });

    expect(scoreHeadCountQuestion({
      selectedAnswer: 4,
      correctAnswer: 4,
      answerMs: 2600,
      currentCombo: 0,
    })).toMatchObject({
      correct: true,
      speedBonus: 1,
      comboBonus: 0,
      score: 6,
    });

    expect(scoreHeadCountQuestion({
      selectedAnswer: 3,
      correctAnswer: 4,
      answerMs: 800,
      currentCombo: 5,
    })).toEqual({
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    });
  });
});
