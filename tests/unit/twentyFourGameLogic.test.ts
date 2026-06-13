import {
  BASE_POINTS_PER_SOLVED_ROUND,
  MAX_CARD_VALUE,
  MIN_CARD_VALUE,
  evaluateExpression,
  generateRound,
  getPointsForAttempt,
  getPointsForSolvedRound,
  solveTwentyFour,
  type Token,
} from "../../src/pages/twenty-four/gameLogic";

describe("twenty-four game logic", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("starts at two points and increases after every three solved rounds", () => {
    expect(BASE_POINTS_PER_SOLVED_ROUND).toBe(2);
    expect(Array.from({ length: 9 }, (_, solvedCount) => (
      getPointsForSolvedRound(solvedCount)
    ))).toEqual([2, 2, 2, 3, 3, 3, 4, 4, 4]);
  });

  test("normalizes invalid solved counts without advancing the score tier", () => {
    expect(getPointsForSolvedRound(-1)).toBe(2);
    expect(getPointsForSolvedRound(Number.NaN)).toBe(2);
    expect(getPointsForSolvedRound(3.9)).toBe(3);
  });

  test("does not award points or advance tiers for wrong or hinted attempts", () => {
    expect(getPointsForAttempt(3, false, false)).toBe(0);
    expect(getPointsForAttempt(3, true, true)).toBe(0);
    expect(getPointsForAttempt(3, true, false)).toBe(3);
  });

  test("uses card values from one through ten", () => {
    expect(MIN_CARD_VALUE).toBe(1);
    expect(MAX_CARD_VALUE).toBe(10);
  });

  test("can generate both numeric boundaries", () => {
    const randomValues = [
      0, 0.99, 0.6, 0.6,
      0.2, 0.2, 0.7, 0.7,
    ];
    jest.spyOn(Math, "random").mockImplementation(() => randomValues.shift() ?? 0.2);

    const round = generateRound();

    expect(round.cards.map((card) => card.value)).toEqual([1, 10, 7, 7]);
    expect(solveTwentyFour(round.cards.map((card) => card.value))).not.toBeNull();
  });

  test("only generates solvable rounds with cards in range", () => {
    for (let index = 0; index < 100; index += 1) {
      const round = generateRound();
      const values = round.cards.map((card) => card.value);

      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(MIN_CARD_VALUE);
        expect(value).toBeLessThanOrEqual(MAX_CARD_VALUE);
      });
      expect(solveTwentyFour(values)).not.toBeNull();
    }
  });

  test("evaluates a valid expression using all four cards", () => {
    const tokens: Token[] = [
      { type: "paren", value: "(" },
      { type: "number", value: 8, cardIndex: 0, label: "8" },
      { type: "operator", value: "/" },
      { type: "paren", value: "(" },
      { type: "number", value: 3, cardIndex: 1, label: "3" },
      { type: "operator", value: "-" },
      { type: "number", value: 8, cardIndex: 2, label: "8" },
      { type: "operator", value: "/" },
      { type: "number", value: 3, cardIndex: 3, label: "3" },
      { type: "paren", value: ")" },
      { type: "paren", value: ")" },
    ];

    expect(evaluateExpression(tokens)).toBeCloseTo(24);
  });
});
