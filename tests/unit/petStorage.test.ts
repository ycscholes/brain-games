const mockStorage = new Map<string, string>();

jest.mock("@tarojs/taro", () => ({
    __esModule: true,
    default: {
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) ?? ""),
    setStorageSync: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeStorageSync: jest.fn((key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

import {
  addPointsToPet,
  adoptPet,
  calculateHungerDecay,
  feedPet,
  readPetData,
  updatePetStatus,
} from "../../src/utils/petStorage";

describe("petStorage", () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.useFakeTimers().setSystemTime(new Date("2026-04-07T10:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("first pet adoption is free and feeding restores reduced hunger while consuming balance", () => {
    const adoption = adoptPet("团子", "cat");
    expect(adoption.success).toBe(true);
    expect(adoption.cost).toBe(0);
    expect(adoption.data.pets).toHaveLength(1);

    addPointsToPet("mental-math", 12);
    const petId = adoption.pet?.id || "";
    const data = readPetData();
    mockStorage.set(
      "pet_data",
      JSON.stringify({
        ...data,
        pets: data.pets.map((pet) => (pet.id === petId ? { ...pet, hunger: 40 } : pet)),
      }),
    );

    const fed = feedPet(petId, 8, 5);

    expect(fed.success).toBe(true);
    expect(fed.pet?.hunger).toBe(48);
    expect(fed.data.balance).toBe(7);
  });

  test("adds difficulty-adjusted points to shared balance", () => {
    adoptPet("团子", "cat");
    addPointsToPet("mental-math", 20, "hard");

    expect(readPetData().balance).toBe(30);
  });

  test("adds points using a special game reward policy", () => {
    adoptPet("团子", "cat");
    addPointsToPet("memory-challenge", 120, "hard", {
      applyDifficultyMultiplier: false,
      maxPoints: 100,
    });

    expect(readPetData().balance).toBe(100);
  });

  test("reads empty storage as empty pet yard", () => {
    const data = readPetData();
    expect(data.pets).toHaveLength(0);
    expect(data.balance).toBe(0);
  });

  test("marks pets hungry only when hunger is below twenty percent", () => {
    const adoption = adoptPet("米粒", "rabbit");
    const pet = adoption.pet!;

    expect(updatePetStatus({ ...pet, hunger: 20 }).status).toBe("alive");
    expect(updatePetStatus({ ...pet, hunger: 19 }).status).toBe("hungry");
    expect(updatePetStatus({ ...pet, hunger: 0 }).status).toBe("hungry");
  });

  test("decays full hunger to zero after three days without killing the pet", () => {
    const lastCheckTime = new Date("2026-04-04T10:00:00.000Z").toISOString();

    expect(calculateHungerDecay(100, lastCheckTime)).toEqual({
      newHunger: 0,
      shouldDie: false,
    });
  });

  test("keeps pets alive before three full days of hunger decay", () => {
    const lastCheckTime = new Date("2026-04-04T10:01:00.000Z").toISOString();

    expect(calculateHungerDecay(100, lastCheckTime)).toEqual({
      newHunger: 1,
      shouldDie: false,
    });
  });

  test("kills pets after hunger has been zero for one day", () => {
    const lastCheckTime = new Date("2026-04-03T10:00:00.000Z").toISOString();

    expect(calculateHungerDecay(100, lastCheckTime)).toEqual({
      newHunger: 0,
      shouldDie: true,
    });
  });
});
