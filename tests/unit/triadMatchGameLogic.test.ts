import {
  TRIAD_MATCH_TOTAL_PUZZLES,
  completeTriadCard,
  createTriadMatchPuzzle,
  createTriadMatchSession,
  findTriadMatches,
  isTriadMatch,
  scoreTriadMatchSelection,
  type TriadMatchCard,
} from "../../src/pages/triad-match/gameLogic";

describe("triad-match game logic", () => {
  const validTriad: TriadMatchCard[] = [
    { id: "a", count: 1, shape: "gem", shading: "solid", color: "coral" },
    { id: "b", count: 2, shape: "leaf", shading: "solid", color: "teal" },
    { id: "third", count: 3, shape: "moon", shading: "solid", color: "amber" },
  ];

  test("recognizes triads where every feature is all same or all different", () => {
    expect(isTriadMatch(validTriad)).toBe(true);
    expect(isTriadMatch([validTriad[0], validTriad[1]])).toBe(false);
    expect(isTriadMatch([
      validTriad[0],
      validTriad[1],
      { ...validTriad[2], color: "teal" },
    ])).toBe(false);
  });

  test("completes the third card for a pair", () => {
    expect(completeTriadCard(validTriad[0], validTriad[1], "third")).toEqual(validTriad[2]);
  });

  test("creates normal and hard sessions with solvable boards", () => {
    expect(createTriadMatchSession("normal")).toHaveLength(TRIAD_MATCH_TOTAL_PUZZLES);
    expect(createTriadMatchSession("hard")).toHaveLength(TRIAD_MATCH_TOTAL_PUZZLES);

    createTriadMatchSession("normal").forEach((puzzle, index) => {
      expect(puzzle.id).toBe(`triad-match-normal-${index + 1}`);
      expect(puzzle.cards).toHaveLength(12);
      expect(new Set(puzzle.cards.map((card) => card.id)).size).toBe(12);
      expect(findTriadMatches(puzzle.cards).length).toBeGreaterThanOrEqual(1);
    });
  });

  test("hard mode tightens timing", () => {
    expect(createTriadMatchPuzzle("hard", 0).timeLimitMs).toBeLessThan(
      createTriadMatchPuzzle("normal", 0).timeLimitMs,
    );
  });

  test("scores valid selections with speed and combo bonuses", () => {
    expect(scoreTriadMatchSelection({
      selectedCards: validTriad,
      answerMs: 3200,
      currentCombo: 2,
    })).toEqual({
      correct: true,
      speedBonus: 1,
      comboBonus: 1,
      score: 6,
    });

    expect(scoreTriadMatchSelection({
      selectedCards: [validTriad[0], validTriad[1]],
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
