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
  clearProductData,
  getAwardedPoints,
  readAppSettings,
  readDashboardStats,
  readTrainingSummary,
  recordTrainingSession,
  saveAppSettings,
} from "../../src/utils/trainingStorage";

describe("trainingStorage", () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.useFakeTimers().setSystemTime(new Date("2026-04-07T10:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("records sessions and builds summaries from unified records", () => {
    recordTrainingSession({
      gameId: "memory-challenge",
      score: 12,
      awardedPoints: 2,
      outcome: "completed",
    });

    recordTrainingSession({
      gameId: "memory-challenge",
      score: 18,
      awardedPoints: 3,
      outcome: "completed",
    });

    const summary = readTrainingSummary("memory-challenge");
    expect(summary.played).toBe(true);
    expect(summary.best).toBe(18);
    expect(summary.recent).toBe(18);
    expect(summary.totalSessions).toBe(2);
  });

  test("falls back to legacy scores when no unified records exist", () => {
    mockStorage.set("rps_last_score", "21");
    mockStorage.set("rps_highscore_D2", JSON.stringify({ score: 34, achievedAt: "2026-04-07T09:00:00.000Z" }));

    const summary = readTrainingSummary("rps");
    expect(summary.played).toBe(true);
    expect(summary.best).toBe(34);
    expect(summary.recent).toBe(21);
    expect(summary.totalSessions).toBe(0);
  });

  test("reads and updates app settings", () => {
    expect(readAppSettings().privacyAccepted).toBe(false);

    const saved = saveAppSettings({ privacyAccepted: true, reducedMotion: true });
    expect(saved.privacyAccepted).toBe(true);
    expect(readAppSettings().reducedMotion).toBe(true);
  });

  test("computes dashboard stats from recent records", () => {
    recordTrainingSession({
      gameId: "digit-span",
      score: 9,
      awardedPoints: 9,
      outcome: "completed",
    });

    jest.setSystemTime(new Date("2026-04-06T10:00:00.000Z"));
    recordTrainingSession({
      gameId: "pattern",
      score: 8,
      awardedPoints: 8,
      outcome: "completed",
    });

    jest.setSystemTime(new Date("2026-04-07T10:00:00.000Z"));
    const stats = readDashboardStats();
    expect(stats.totalSessions).toBe(2);
    expect(stats.todaySessions).toBe(1);
    expect(stats.activeDaysLast7).toBe(2);
    expect(stats.totalAwardedPoints).toBe(17);
  });

  test("clears unified and legacy product data", () => {
    mockStorage.set("training_records_v1", JSON.stringify([{ id: "1" }]));
    mockStorage.set("pet_data", JSON.stringify({ pets: [] }));
    mockStorage.set("mot_best", "4");

    clearProductData();

    expect(mockStorage.size).toBe(0);
  });

  describe("getAwardedPoints - aligned reward rates", () => {
    test("digit-span: 3x conversion", () => {
      expect(getAwardedPoints("digit-span", 5)).toBe(15);
      expect(getAwardedPoints("digit-span", 10)).toBe(30);
    });

    test("mental-math: 1x conversion", () => {
      expect(getAwardedPoints("mental-math", 15)).toBe(15);
      expect(getAwardedPoints("mental-math", 30)).toBe(30);
    });

    test("twenty-four: 2x conversion", () => {
      expect(getAwardedPoints("twenty-four", 5)).toBe(10);
      expect(getAwardedPoints("twenty-four", 20)).toBe(40);
    });

    test("pattern-completion: 1.2x conversion", () => {
      expect(getAwardedPoints("pattern-completion", 10)).toBe(12);
      expect(getAwardedPoints("pattern-completion", 30)).toBe(36);
    });

    test("dual-task: 0.05x conversion (lower rate for high scores)", () => {
      expect(getAwardedPoints("dual-task", 200)).toBe(10);
      expect(getAwardedPoints("dual-task", 800)).toBe(40);
    });

    test("multiple-object-tracking: 3x conversion", () => {
      expect(getAwardedPoints("multiple-object-tracking", 5)).toBe(15);
      expect(getAwardedPoints("multiple-object-tracking", 15)).toBe(45);
    });

    test("rock-paper-scissors: 0.15x conversion", () => {
      expect(getAwardedPoints("rock-paper-scissors", 100)).toBe(15);
      expect(getAwardedPoints("rock-paper-scissors", 300)).toBe(45);
    });

    test("memory-challenge: 0.25x conversion", () => {
      expect(getAwardedPoints("memory-challenge", 50)).toBe(12);
      expect(getAwardedPoints("memory-challenge", 150)).toBe(37);
    });

    test("typical good performance gives similar rewards across games", () => {
      // 良好表现应该获得大约 10-40 积分
      const rewards = [
        getAwardedPoints("digit-span", 7),
        getAwardedPoints("mental-math", 20),
        getAwardedPoints("twenty-four", 10),
        getAwardedPoints("pattern-completion", 20),
        getAwardedPoints("dual-task", 400),
        getAwardedPoints("multiple-object-tracking", 10),
        getAwardedPoints("rock-paper-scissors", 200),
        getAwardedPoints("memory-challenge", 100),
      ];

      rewards.forEach(reward => {
        expect(reward).toBeGreaterThanOrEqual(10);
        expect(reward).toBeLessThanOrEqual(50);
      });
    });

    test("returns 0 for unknown gameId or zero score", () => {
      expect(getAwardedPoints("unknown-game", 100)).toBe(0);
      expect(getAwardedPoints("digit-span", 0)).toBe(0);
      expect(getAwardedPoints("mental-math", -5)).toBe(0);
    });
  });
});
