import {
  NUMBER_ORDER_TOTAL_QUESTIONS,
  createNumberOrderQuestion,
  createNumberOrderSession,
  createRouteReplayText,
  getNumberOrderPlaybackInterval,
  getNumberOrderPointCount,
  getNumberOrderSequenceLength,
  isCorrectPathPrefix,
  scoreNumberOrderQuestion,
  type NumberOrderPoint,
  type NumberOrderQuestion,
} from "../../src/pages/number-order/gameLogic";

function makeQuestion(answerIds: string[]): NumberOrderQuestion {
  const points: NumberOrderPoint[] = [
    { id: "star-a", value: 1, x: 20, y: 20, colorGroup: "teal", brightness: "bright" },
    { id: "star-b", value: 2, x: 40, y: 20, colorGroup: "gold", brightness: "bright" },
    { id: "star-c", value: 3, x: 60, y: 20, colorGroup: "teal", brightness: "bright" },
    { id: "star-d", value: 4, x: 80, y: 20, colorGroup: "gold", brightness: "bright" },
  ];

  return {
    id: "fixture-star-echo",
    points,
    answerIds,
    revealMs: 3200,
    playbackIntervalMs: 800,
    routeRule: {
      id: "star-echo",
      title: "星链回响",
      shortLabel: "回响",
      description: "按刚才闪现的星链顺序依次点亮。",
      complexity: "basic",
    },
    replayText: createRouteReplayText({ points, answerIds }),
  };
}

function expectQuestionIntegrity(question: NumberOrderQuestion) {
  const pointIds = question.points.map((point) => point.id);
  const pointIdSet = new Set(pointIds);

  expect(pointIdSet.size).toBe(pointIds.length);
  expect(question.answerIds.length).toBeGreaterThan(0);
  question.answerIds.forEach((id) => {
    expect(pointIdSet.has(id)).toBe(true);
  });
  expect(new Set(question.answerIds).size).toBe(question.answerIds.length);
  expect(question.routeRule.id).toBe("star-echo");
  expect(question.routeRule.title).toBe("星链回响");
  expect(question.routeRule.description).toContain("闪现");
  expect(question.replayText).toContain("星链回响");
  expect(question.replayText).not.toMatch(/升序|降序|奇偶|双色|亮度|排序/);
}

describe("number-order game logic", () => {
  test("creates 8-question normal and hard sessions", () => {
    expect(createNumberOrderSession("normal")).toHaveLength(NUMBER_ORDER_TOTAL_QUESTIONS);
    expect(createNumberOrderSession("hard")).toHaveLength(NUMBER_ORDER_TOTAL_QUESTIONS);
  });

  test("normal questions use 4-6 stars, 3-5 step sequences, and slower cadence", () => {
    const questions = createNumberOrderSession("normal");
    const sessionPointIds = new Set<string>();

    questions.forEach((question, index) => {
      expect(question.points).toHaveLength(getNumberOrderPointCount("normal", index));
      expect(question.points.length).toBeGreaterThanOrEqual(4);
      expect(question.points.length).toBeLessThanOrEqual(6);
      expect(question.answerIds).toHaveLength(getNumberOrderSequenceLength("normal", index));
      expect(question.answerIds.length).toBeGreaterThanOrEqual(3);
      expect(question.answerIds.length).toBeLessThanOrEqual(5);
      expect(question.playbackIntervalMs).toBe(getNumberOrderPlaybackInterval("normal", index));
      expect(question.playbackIntervalMs).toBeGreaterThanOrEqual(730);
      expect(question.revealMs).toBe(question.playbackIntervalMs * question.answerIds.length);
      expectQuestionIntegrity(question);

      question.points.forEach((point) => {
        expect(sessionPointIds.has(point.id)).toBe(false);
        sessionPointIds.add(point.id);
      });
    });
  });

  test("hard questions use 5-8 stars, 4-7 step sequences, and faster cadence", () => {
    createNumberOrderSession("hard").forEach((question, index) => {
      expect(question.points).toHaveLength(getNumberOrderPointCount("hard", index));
      expect(question.points.length).toBeGreaterThanOrEqual(5);
      expect(question.points.length).toBeLessThanOrEqual(8);
      expect(question.answerIds).toHaveLength(getNumberOrderSequenceLength("hard", index));
      expect(question.answerIds.length).toBeGreaterThanOrEqual(4);
      expect(question.answerIds.length).toBeLessThanOrEqual(7);
      expect(question.playbackIntervalMs).toBe(getNumberOrderPlaybackInterval("hard", index));
      expect(question.playbackIntervalMs).toBeLessThanOrEqual(720);
      expect(question.revealMs).toBe(question.playbackIntervalMs * question.answerIds.length);
      expectQuestionIntegrity(question);
    });
  });

  test("generated question sequence ids all come from its points", () => {
    const question = createNumberOrderQuestion("hard", 7);
    const pointIds = new Set(question.points.map((point) => point.id));

    expect(question.answerIds).toHaveLength(7);
    question.answerIds.forEach((id) => {
      expect(pointIds.has(id)).toBe(true);
    });
  });

  test("validates full paths and rejects first-step errors", () => {
    const question = makeQuestion(["star-b", "star-d", "star-a", "star-c"]);

    expect(isCorrectPathPrefix(question, ["star-b"])).toBe(true);
    expect(isCorrectPathPrefix(question, ["star-b", "star-d", "star-a", "star-c"])).toBe(true);
    expect(isCorrectPathPrefix(question, ["star-d"])).toBe(false);
  });

  test("detects middle errors after the correct prefix", () => {
    const question = makeQuestion(["star-b", "star-d", "star-a", "star-c"]);

    expect(isCorrectPathPrefix(question, ["star-b", "star-d"])).toBe(true);
    expect(isCorrectPathPrefix(question, ["star-b", "star-a"])).toBe(false);
  });

  test("scores completed echoes with combo bonus and gives no direct point awards for misses", () => {
    const question = makeQuestion(["star-b", "star-d", "star-a", "star-c"]);

    expect(scoreNumberOrderQuestion({
      question,
      tappedIds: question.answerIds,
      currentCombo: 3,
    })).toMatchObject({
      correctCount: 4,
      allCorrect: true,
      comboBonus: 1,
      score: 5,
    });
    expect(scoreNumberOrderQuestion({
      question,
      tappedIds: ["star-b", "star-a"],
      currentCombo: 3,
    })).toMatchObject({
      correctCount: 1,
      allCorrect: false,
      comboBonus: 0,
      score: 0,
    });
    expect(scoreNumberOrderQuestion({
      question,
      tappedIds: ["star-d"],
      currentCombo: 3,
    })).toMatchObject({
      correctCount: 0,
      allCorrect: false,
      comboBonus: 0,
      score: 0,
    });
  });

  test("strong normal and hard sessions land in target score bands", () => {
    const normalScore = createNumberOrderSession("normal").reduce((total, question, combo) => {
      return total + scoreNumberOrderQuestion({ question, tappedIds: question.answerIds, currentCombo: combo }).score;
    }, 0);
    const hardScore = createNumberOrderSession("hard").reduce((total, question, combo) => {
      return total + scoreNumberOrderQuestion({ question, tappedIds: question.answerIds, currentCombo: combo }).score;
    }, 0);

    expect(normalScore).toBeGreaterThanOrEqual(24);
    expect(normalScore).toBeLessThanOrEqual(40);
    expect(hardScore).toBeGreaterThanOrEqual(32);
    expect(hardScore).toBeLessThanOrEqual(45);
  });

  test("replay text uses star echo language without sorting-rule wording", () => {
    const question = makeQuestion(["star-b", "star-d", "star-a"]);

    expect(question.replayText).toBe("星链回响：2 -> 4 -> 1");
    expect(question.replayText).not.toMatch(/升序|降序|奇偶|双色|亮度|排序/);
  });
});
