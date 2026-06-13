import {
  addMemoryChallengeRoundScore,
  createCalculationItem,
  createNumericOptions,
  createVisualOptions,
  getUnlockedPetItems,
  getUnlockedPetMoods,
  getMemoryChallengeRewardCap,
  getMemoryChallengeRoundPoints,
  getNBackTarget,
  loadPetMemoryItems,
  loadPetMemoryItemsFromAssets,
  type MemoryChallengeItem,
} from "../../src/pages/memory-challenge/gameLogic";
import type { PetSpriteMood } from "../../src/pages/pet/components/PetSprite/types";
import type { PetSkin } from "../../src/pages/pet/types";

const PET_SKINS: PetSkin[] = ["cat", "dog", "rabbit", "bear", "panda", "gecko", "turtle"];
const PET_MOODS: PetSpriteMood[] = ["idle", "feed", "cuddle", "hungry"];

function createPetItems(): MemoryChallengeItem[] {
  return PET_SKINS.flatMap((skin) =>
    PET_MOODS.map((mood) => ({
      id: `pet-${skin}-${mood}`,
      prompt: `${skin}-${mood}`,
      answerId: `pet-${skin}-${mood}`,
      answerLabel: `${skin}-${mood}`,
      imageSrc: `${skin}-${mood}.png`,
      petMood: mood,
    })),
  );
}

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

  test.each([
    [0, ["idle"]],
    [4, ["idle"]],
    [5, ["idle", "feed"]],
    [9, ["idle", "feed"]],
    [10, ["idle", "feed", "cuddle"]],
    [14, ["idle", "feed", "cuddle"]],
    [15, ["idle", "feed", "cuddle", "hungry"]],
    [99, ["idle", "feed", "cuddle", "hungry"]],
  ])("unlocks cumulative pet moods after %i correct answers", (correctCount, moods) => {
    expect(getUnlockedPetMoods(correctCount)).toEqual(moods);
  });

  test.each([
    [0, 7],
    [5, 14],
    [10, 21],
    [15, 28],
  ])("expands the pet item pool after %i correct answers", (correctCount, expectedSize) => {
    const unlockedItems = getUnlockedPetItems(createPetItems(), correctCount);

    expect(unlockedItems).toHaveLength(expectedSize);
    expect(new Set(unlockedItems.map((item) => item.answerId)).size).toBe(expectedSize);
  });

  test("treats different moods of the same pet as unique visual answers", () => {
    const catItems = createPetItems().filter((item) => item.id.startsWith("pet-cat-"));
    const options = createVisualOptions(catItems[0], catItems, () => 0.5);

    expect(options).toHaveLength(4);
    expect(new Set(options.map((option) => option.id)).size).toBe(4);
    expect(options.map((option) => option.id)).toContain("pet-cat-idle");
  });

  test("rejects pet item loading when any required image fails to preload", async () => {
    await expect(loadPetMemoryItems(
      ["cat"],
      ["idle", "feed"],
      async (_skin, mood) => `${mood}.png`,
      async (url) => url !== "feed.png",
    )).rejects.toThrow("Unable to load cat-feed");
  });

  test("builds unique pet items for every loaded skin and mood", async () => {
    const items = await loadPetMemoryItems(
      PET_SKINS,
      PET_MOODS,
      async (skin, mood) => `${skin}-${mood}.png`,
      async () => true,
    );

    expect(items).toHaveLength(28);
    expect(new Set(items.map((item) => item.answerId)).size).toBe(28);
    expect(items.find((item) => item.answerId === "pet-cat-feed")?.petMood).toBe("feed");
  });

  test("uses custom asset identity for private pet memory items", async () => {
    const items = await loadPetMemoryItemsFromAssets(
      [{
        name: "豆豆",
        skin: "dog",
        assetRef: {
          kind: "custom",
          templateSkin: "dog",
          customAssetId: "asset-1",
        },
      }],
      ["idle", "feed"],
      async (assetRef, _skin, mood) => `${assetRef.kind}-${mood}.png`,
      async () => true,
    );

    expect(items.map((item) => item.answerId)).toEqual([
      "pet-custom:asset-1-idle",
      "pet-custom:asset-1-feed",
    ]);
    expect(items[0].answerLabel).toBe("豆豆·待机");
  });
});
