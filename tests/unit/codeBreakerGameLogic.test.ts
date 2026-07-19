import {
  calculateCodeBreakerFinalScore,
  createSecretCode,
  getCodeBreakerConfig,
  scoreCodeBreakerGuess,
  type CodeBreakerSymbol,
} from "../../src/pages/code-breaker/gameLogic";

describe("code-breaker game logic", () => {
  test("scores exact and present symbols without double-counting", () => {
    const solution: CodeBreakerSymbol[] = ["amber", "jade", "cyan", "rose"];
    const guess: CodeBreakerSymbol[] = ["amber", "cyan", "violet", "jade"];

    expect(scoreCodeBreakerGuess(solution, guess)).toEqual({
      exact: 1,
      present: 2,
      solved: false,
    });
  });

  test("handles duplicate symbols in hard mode feedback", () => {
    const solution: CodeBreakerSymbol[] = ["amber", "amber", "cyan", "rose"];
    const guess: CodeBreakerSymbol[] = ["amber", "cyan", "amber", "amber"];

    expect(scoreCodeBreakerGuess(solution, guess)).toEqual({
      exact: 1,
      present: 2,
      solved: false,
    });
  });

  test("creates unique normal codes and duplicate-friendly hard codes", () => {
    const normalCode = createSecretCode("normal", () => 0);
    expect(normalCode).toEqual(["amber", "jade", "cyan", "rose"]);
    expect(new Set(normalCode).size).toBe(getCodeBreakerConfig("normal").codeLength);

    const hardCode = createSecretCode("hard", () => 0);
    expect(hardCode).toEqual(["amber", "amber", "amber", "amber"]);
  });

  test("rewards fast solutions and gives only partial credit when unsolved", () => {
    expect(calculateCodeBreakerFinalScore({
      solved: true,
      attemptsUsed: 4,
      maxGuesses: 8,
      elapsedSeconds: 45,
      bestExact: 3,
      bestPresent: 1,
    })).toBe(34);

    expect(calculateCodeBreakerFinalScore({
      solved: false,
      attemptsUsed: 8,
      maxGuesses: 8,
      elapsedSeconds: 100,
      bestExact: 2,
      bestPresent: 2,
    })).toBe(12);
  });
});
