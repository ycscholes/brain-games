import {
  createNumberOrderQuestion,
  createNumberOrderSession,
  getNumberOrderPointCount,
  isCorrectTap,
  NUMBER_ORDER_TOTAL_QUESTIONS,
  scoreNumberOrderQuestion,
} from "../../src/pages/number-order/gameLogic";

describe("number-order game logic", () => {
  test("creates an 8-question session", () => {
    expect(createNumberOrderSession("normal")).toHaveLength(NUMBER_ORDER_TOTAL_QUESTIONS);
    expect(createNumberOrderSession("hard")).toHaveLength(NUMBER_ORDER_TOTAL_QUESTIONS);
  });

  test("normal questions use unique values and expected point counts", () => {
    for (let index = 0; index < NUMBER_ORDER_TOTAL_QUESTIONS; index += 1) {
      const question = createNumberOrderQuestion("normal", index);
      const values = question.points.map((point) => point.value);

      expect(question.points).toHaveLength(getNumberOrderPointCount("normal", index));
      expect(new Set(values).size).toBe(values.length);
      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(19);
      });
    }
  });

  test("hard questions use unique values and expected point counts", () => {
    for (let index = 0; index < NUMBER_ORDER_TOTAL_QUESTIONS; index += 1) {
      const question = createNumberOrderQuestion("hard", index);
      const values = question.points.map((point) => point.value);

      expect(question.points).toHaveLength(getNumberOrderPointCount("hard", index));
      expect(new Set(values).size).toBe(values.length);
      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(31);
      });
    }
  });

  test("answer IDs are sorted by ascending value", () => {
    const question = createNumberOrderQuestion("hard", 6);
    const valueById = new Map(question.points.map((point) => [point.id, point.value]));
    const answerValues = question.answerIds.map((id) => valueById.get(id));

    expect(answerValues).toEqual([...answerValues].sort((left, right) => Number(left) - Number(right)));
  });

  test("validates progressive tap order", () => {
    const question = createNumberOrderQuestion("normal", 2);
    const [firstId, secondId] = question.answerIds;

    expect(isCorrectTap(question, [firstId])).toBe(true);
    expect(isCorrectTap(question, [firstId, secondId])).toBe(true);
    expect(isCorrectTap(question, [secondId])).toBe(false);
  });

  test("scores full, partial, and wrong answers", () => {
    const question = createNumberOrderQuestion("normal", 4);
    const fullAnswer = question.answerIds;
    const partialAnswer = question.answerIds.slice(0, 2);
    const wrongAnswer = [question.answerIds[1]];

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
    expect(scoreNumberOrderQuestion({ question, tappedIds: wrongAnswer, currentCombo: 2 })).toMatchObject({
      correctCount: 0,
      allCorrect: false,
      score: 0,
    });
  });
});
