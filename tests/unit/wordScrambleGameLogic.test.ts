import {
  WORD_SCRAMBLE_TOTAL_QUESTIONS,
  createWordScrambleQuestion,
  createWordScrambleSession,
  getWordScrambleHintDelayMs,
  getWordScrambleRevealMs,
  getWordScrambleTimeLimitMs,
  scoreWordScrambleQuestion,
} from "../../src/pages/word-scramble/gameLogic";

describe("word-scramble game logic", () => {
  test("creates 8-question normal and hard sessions", () => {
    expect(createWordScrambleSession("normal")).toHaveLength(WORD_SCRAMBLE_TOTAL_QUESTIONS);
    expect(createWordScrambleSession("hard")).toHaveLength(WORD_SCRAMBLE_TOTAL_QUESTIONS);
  });

  test("questions contain scrambled chars, a target, and a playable char bank", () => {
    createWordScrambleSession("normal").forEach((question, index) => {
      expect(question.id).toBeTruthy();
      expect(question.target.word.length).toBeGreaterThanOrEqual(2);
      expect(question.scrambledChars).toHaveLength(Array.from(question.target.word).length);
      expect(question.scrambledChars.join("")).not.toBe("");
      expect(question.charChoices.length).toBeGreaterThan(question.target.word.length);
      Array.from(question.target.word).forEach((char) => {
        expect(question.charChoices.map((choice) => choice.char)).toContain(char);
      });
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      expect(question.options).toContain(question.target.word);
      expect(question.revealMs).toBe(getWordScrambleRevealMs("normal", index));
      expect(question.hintDelayMs).toBe(getWordScrambleHintDelayMs("normal", index));
      expect(question.timeLimitMs).toBe(getWordScrambleTimeLimitMs("normal", index));
    });
  });

  test("hard questions use longer language items, more decoys, and faster timing", () => {
    createWordScrambleSession("hard").forEach((question, index) => {
      expect(question.target.word.length).toBeGreaterThanOrEqual(3);
      expect(question.charChoices.length).toBeGreaterThanOrEqual(question.target.word.length + 4);
      expect(question.options).toHaveLength(4);
      expect(question.revealMs).toBe(getWordScrambleRevealMs("hard", index));
      expect(question.hintDelayMs).toBeGreaterThanOrEqual(650);
      expect(question.timeLimitMs).toBeLessThanOrEqual(6400);
      expect(question.revealMs).toBeLessThanOrEqual(4400);
    });
  });

  test("single question clamps out-of-range indexes", () => {
    const question = createWordScrambleQuestion("normal", 99);

    expect(question.id).toBe("word-scramble-normal-8");
    expect(question.options).toContain(question.target.word);
  });

  test("scores correct answers with speed and combo bonuses", () => {
    expect(scoreWordScrambleQuestion({
      selectedWord: "月亮",
      correctWord: "月亮",
      answerMs: 1200,
      currentCombo: 2,
    })).toEqual({
      correct: true,
      speedBonus: 1,
      comboBonus: 1,
      score: 6,
    });

    expect(scoreWordScrambleQuestion({
      selectedWord: "月亮",
      correctWord: "铅笔",
      answerMs: 1200,
      currentCombo: 5,
    })).toEqual({
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    });
  });
});
