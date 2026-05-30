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
      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(19);
      });
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
      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(31);
      });
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
