import {
  MAX_CARD_VALUE,
  MIN_CARD_VALUE,
  POINTS_PER_SOLVED_ROUND,
  evaluateExpression,
  generateRound,
  solveTwentyFour,
  type Token,
} from "../../src/pages/twenty-four/gameLogic";

describe("twenty-four game logic", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("awards two game points for each solved round", () => {
    expect(POINTS_PER_SOLVED_ROUND).toBe(2);
  });

  test("uses card values from zero through ten", () => {
    expect(MIN_CARD_VALUE).toBe(0);
    expect(MAX_CARD_VALUE).toBe(10);
  });

  test("can generate both numeric boundaries", () => {
    const randomValues = [
      0, 10 / 11, 7 / 11, 7 / 11,
      3 / 11, 3 / 11, 8 / 11, 8 / 11,
    ];
    jest.spyOn(Math, "random").mockImplementation(() => randomValues.shift() ?? 3 / 11);

    const round = generateRound();

    expect(round.cards.map((card) => card.value)).toEqual([0, 10, 7, 7]);
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
