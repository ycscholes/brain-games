import { createTrafficEscapeInterruption } from "../../src/pages/traffic-escape/navigation";

describe("traffic escape navigation", () => {
  test("creates a zero-score interruption record with the elapsed duration", () => {
    expect(createTrafficEscapeInterruption({
      difficulty: "normal",
      elapsedSeconds: 18,
      moveCount: 4,
      hintCount: 1,
    })).toEqual({
      score: 0,
      awardedPoints: 0,
      durationSeconds: 18,
      difficulty: "normal",
      outcome: "interrupted",
    });
  });

  test("clamps an interruption duration to one second", () => {
    expect(createTrafficEscapeInterruption({
      difficulty: "hard",
      elapsedSeconds: 0,
      moveCount: 0,
      hintCount: 0,
    }).durationSeconds).toBe(1);
  });
});
