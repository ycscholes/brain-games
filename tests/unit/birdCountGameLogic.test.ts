import {
  BIRD_COUNT_TOTAL_QUESTIONS,
  createBirdCountOptions,
  createBirdCountQuestion,
  createBirdCountSession,
  getBirdCountRevealMs,
  getBirdCountTarget,
  scoreBirdCountQuestion,
} from "../../src/pages/bird-count/gameLogic";

describe("bird-count game logic", () => {
  test("creates 8-question normal and hard sessions", () => {
    expect(createBirdCountSession("normal")).toHaveLength(BIRD_COUNT_TOTAL_QUESTIONS);
    expect(createBirdCountSession("hard")).toHaveLength(BIRD_COUNT_TOTAL_QUESTIONS);
  });

  test("normal questions use 4-8 birds and slower reveal timing", () => {
    createBirdCountSession("normal").forEach((question, index) => {
      expect(question.answer).toBe(getBirdCountTarget("normal", index));
      expect(question.birds).toHaveLength(question.answer);
      expect(question.answer).toBeGreaterThanOrEqual(4);
      expect(question.answer).toBeLessThanOrEqual(8);
      expect(question.revealMs).toBe(getBirdCountRevealMs("normal", index));
      expect(question.revealMs).toBeGreaterThanOrEqual(1150);
    });
  });

  test("hard questions use 7-12 birds and faster reveal timing", () => {
    createBirdCountSession("hard").forEach((question, index) => {
      expect(question.answer).toBe(getBirdCountTarget("hard", index));
      expect(question.birds).toHaveLength(question.answer);
      expect(question.answer).toBeGreaterThanOrEqual(7);
      expect(question.answer).toBeLessThanOrEqual(12);
      expect(question.revealMs).toBe(getBirdCountRevealMs("hard", index));
      expect(question.revealMs).toBeLessThanOrEqual(1100);
    });
  });

  test("generated birds have unique ids and bounded positions", () => {
    const question = createBirdCountQuestion("hard", 7);
    const ids = new Set(question.birds.map((bird) => bird.id));

    expect(ids.size).toBe(question.birds.length);
    question.birds.forEach((bird) => {
      expect(bird.x).toBeGreaterThanOrEqual(0);
      expect(bird.x).toBeLessThanOrEqual(100);
      expect(bird.y).toBeGreaterThanOrEqual(0);
      expect(bird.y).toBeLessThanOrEqual(100);
    });
  });

  test("options include the correct answer once", () => {
    for (let answer = 4; answer <= 12; answer += 1) {
      const options = createBirdCountOptions(answer);

      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options.filter((option) => option === answer)).toHaveLength(1);
    }
  });

  test("scores correct answers with speed and combo bonuses", () => {
    expect(scoreBirdCountQuestion({
      selectedAnswer: 8,
      correctAnswer: 8,
      answerMs: 1000,
      currentCombo: 2,
    })).toEqual({
      correct: true,
      speedBonus: 1,
      comboBonus: 1,
      score: 6,
    });

    expect(scoreBirdCountQuestion({
      selectedAnswer: 7,
      correctAnswer: 8,
      answerMs: 1000,
      currentCombo: 4,
    })).toEqual({
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    });
  });
});

