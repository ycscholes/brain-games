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

import { addPointsToPet, adoptPet, feedPet, readPetData } from "../../src/utils/petStorage";

describe("petStorage", () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.useFakeTimers().setSystemTime(new Date("2026-04-07T10:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("first pet adoption is free and feeding consumes balance", () => {
    const adoption = adoptPet("团子", "cat");
    expect(adoption.success).toBe(true);
    expect(adoption.cost).toBe(0);
    expect(adoption.data.pets).toHaveLength(1);

    addPointsToPet("mental-math", 12);
    const petId = adoption.pet?.id || "";
    const fed = feedPet(petId, 20, 5);

    expect(fed.success).toBe(true);
    expect(fed.data.balance).toBe(7);
  });

  test("reads empty storage as empty pet yard", () => {
    const data = readPetData();
    expect(data.pets).toHaveLength(0);
    expect(data.balance).toBe(0);
  });
});
