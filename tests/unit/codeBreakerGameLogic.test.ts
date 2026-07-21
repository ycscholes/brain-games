import {
  CODE_BREAKER_TOTAL_PUZZLES,
  createCodeBreakerSession,
  evaluateCodeGuess,
  findConsistentOptions,
  scoreCodeBreakerPuzzle,
} from "../../src/pages/code-breaker/gameLogic";

describe("codeBreakerGameLogic", () => {
  test("evaluates exact and misplaced digits without double counting", () => {
    expect(evaluateCodeGuess(["1", "2", "3", "4"], ["1", "3", "5", "4"])).toEqual({
      exact: 2,
      misplaced: 1,
    });

    expect(evaluateCodeGuess(["1", "1", "2"], ["1", "2", "2"])).toEqual({
      exact: 2,
      misplaced: 0,
    });
  });

  test("creates a deterministic session with one valid answer option per puzzle", () => {
    const normalSession = createCodeBreakerSession("normal");
    const hardSession = createCodeBreakerSession("hard");

    expect(normalSession).toHaveLength(CODE_BREAKER_TOTAL_PUZZLES);
    expect(hardSession).toHaveLength(CODE_BREAKER_TOTAL_PUZZLES);
    expect(normalSession[0].answerCode).toHaveLength(3);
    expect(hardSession[0].answerCode).toHaveLength(4);

    [...normalSession, ...hardSession].forEach((puzzle) => {
      const consistentOptions = findConsistentOptions(puzzle);

      expect(puzzle.options).toHaveLength(4);
      expect(puzzle.clues.length).toBeGreaterThanOrEqual(3);
      expect(consistentOptions).toEqual([puzzle.answerOptionId]);
    });
  });

  test("scores correct answers with speed and combo bonuses", () => {
    expect(scoreCodeBreakerPuzzle({
      selectedOptionId: "answer",
      answerOptionId: "answer",
      answerMs: 4500,
      currentCombo: 2,
    })).toEqual({
      correct: true,
      speedBonus: 1,
      comboBonus: 1,
      score: 6,
    });

    expect(scoreCodeBreakerPuzzle({
      selectedOptionId: "decoy",
      answerOptionId: "answer",
      answerMs: 1200,
      currentCombo: 3,
    })).toEqual({
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    });
  });
});
