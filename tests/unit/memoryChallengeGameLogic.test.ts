import {
  addMemoryChallengeRoundScore,
  createCalculationItem,
  createNumericOptions,
  getMemoryChallengeRewardCap,
  getMemoryChallengeRoundPoints,
  getNBackTarget,
  type MemoryChallengeItem,
} from "../../src/pages/memory-challenge/gameLogic";

describe("memory challenge game logic", () => {
  test("finds the item shown N rounds earlier", () => {
    const history: MemoryChallengeItem[] = [
      { id: "a", prompt: "A", answerId: "a", answerLabel: "A" },
      { id: "b", prompt: "B", answerId: "b", answerLabel: "B" },
      { id: "c", prompt: "C", answerId: "c", answerLabel: "C" },
      { id: "d", prompt: "D", answerId: "d", answerLabel: "D" },
    ];

    expect(getNBackTarget(history, 1)?.id).toBe("c");
    expect(getNBackTarget(history, 2)?.id).toBe("b");
    expect(getNBackTarget(history, 4)).toBeNull();
  });

  test("creates addition with operands from 0 to 10 and allows answers up to 20", () => {
    const item = createCalculationItem(() => 0.999);

    expect(item.prompt).toBe("10 + 10");
    expect(item.answerId).toBe("20");
    expect(item.answerLabel).toBe("20");
  });

  test("creates subtraction with a non-negative answer", () => {
    const randomValues = [0.1, 0.9, 0.2];
    const item = createCalculationItem(() => randomValues.shift() ?? 0);

    expect(item.prompt).toBe("9 - 2");
    expect(Number(item.answerId)).toBeGreaterThanOrEqual(0);
  });

  test("creates four unique numeric options containing the correct answer", () => {
    const options = createNumericOptions(0, () => 0.5);

    expect(options).toHaveLength(4);
    expect(new Set(options.map((option) => option.id)).size).toBe(4);
    expect(options.map((option) => option.id)).toContain("0");
    options.forEach((option) => {
      expect(Number(option.label)).toBeGreaterThanOrEqual(0);
      expect(Number(option.label)).toBeLessThanOrEqual(20);
    });
  });

  test("scores 1/2/4/8 points by N and doubles calculation rounds", () => {
    expect([1, 2, 3, 4].map((n) => getMemoryChallengeRoundPoints("shape", n as 1 | 2 | 3 | 4)))
      .toEqual([1, 2, 4, 8]);
    expect([1, 2, 3, 4].map((n) => getMemoryChallengeRoundPoints("pet", n as 1 | 2 | 3 | 4)))
      .toEqual([1, 2, 4, 8]);
    expect([1, 2, 3, 4].map((n) => getMemoryChallengeRoundPoints("calculation", n as 1 | 2 | 3 | 4)))
      .toEqual([2, 4, 8, 16]);
  });

  test("keeps accumulating game score without a session cap", () => {
    expect(addMemoryChallengeRoundScore(96, "shape", 4)).toBe(104);
    expect(addMemoryChallengeRoundScore(96, "calculation", 4)).toBe(112);
  });

  test("uses mode and N specific pet reward caps", () => {
    expect(getMemoryChallengeRewardCap("shape", 1)).toBe(40);
    expect(getMemoryChallengeRewardCap("pet", 2)).toBe(40);
    expect(getMemoryChallengeRewardCap("calculation", 2)).toBe(60);
    expect(getMemoryChallengeRewardCap("shape", 3)).toBe(80);
    expect(getMemoryChallengeRewardCap("pet", 4)).toBe(80);
    expect(getMemoryChallengeRewardCap("calculation", 3)).toBe(100);
    expect(getMemoryChallengeRewardCap("calculation", 4)).toBe(100);
  });
});
