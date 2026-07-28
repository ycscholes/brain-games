import { readRockPaperScissorsHighScore } from "../../src/pages/rock-paper-scissors/highScoreStorage";

describe("rock-paper-scissors high-score storage", () => {
  test.each(["{", "[]", JSON.stringify({ score: "12" }), JSON.stringify({})])(
    "returns null for invalid stored value %p",
    (raw) => expect(readRockPaperScissorsHighScore(raw)).toBeNull(),
  );

  test("returns the existing score record without changing valid data", () => {
    expect(readRockPaperScissorsHighScore(JSON.stringify({ score: 24, achievedAt: "2026-07-29T00:00:00.000Z" }))).toEqual({
      score: 24,
      achievedAt: "2026-07-29T00:00:00.000Z",
    });
  });
});
