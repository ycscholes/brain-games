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
  readTrainingRecords,
  readTrainingSummary,
  recordTrainingSession,
  saveAppSettings,
} from "../../src/utils/trainingStorage";
import { getMathStage } from "../../src/pages/mental-math/mathStages";

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
      difficulty: "hard",
      outcome: "completed",
    });

    const summary = readTrainingSummary("memory-challenge");
    expect(summary.played).toBe(true);
    expect(summary.best).toBe(18);
    expect(summary.recent).toBe(18);
    expect(summary.totalSessions).toBe(2);
  });

  test("accepts records with and without difficulty", () => {
    recordTrainingSession({
      gameId: "mental-math",
      score: 12,
      awardedPoints: 12,
      difficulty: "normal",
      outcome: "completed",
    });

    recordTrainingSession({
      gameId: "mental-math",
      score: 20,
      awardedPoints: 30,
      difficulty: "hard",
      outcome: "completed",
    });

    const stats = readDashboardStats();
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalAwardedPoints).toBe(42);
  });

  test("records mental math stage-derived reward difficulty", () => {
    recordTrainingSession({
      gameId: "mental-math",
      score: 8,
      awardedPoints: getAwardedPoints("mental-math", 8, getMathStage("G1A").difficulty),
      mode: "timed:G1A",
      difficulty: getMathStage("G1A").difficulty,
      outcome: "completed",
    });

    recordTrainingSession({
      gameId: "mental-math",
      score: 8,
      awardedPoints: getAwardedPoints("mental-math", 8, getMathStage("G4_MIXED_100").difficulty),
      mode: "timed:G4_MIXED_100",
      difficulty: getMathStage("G4_MIXED_100").difficulty,
      outcome: "completed",
    });

    const records = readTrainingRecords();
    expect(records[1]).toMatchObject({
      gameId: "mental-math",
      mode: "timed:G1A",
      difficulty: "normal",
      awardedPoints: 8,
    });
    expect(records[0]).toMatchObject({
      gameId: "mental-math",
      mode: "timed:G4_MIXED_100",
      difficulty: "hard",
      awardedPoints: 12,
    });
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

  test("summaries and recommendations treat legacy short ids as the same game", () => {
    recordTrainingSession({
      gameId: "rps",
      score: 12,
      awardedPoints: 12,
      outcome: "completed",
    });

    const summary = readTrainingSummary("rock-paper-scissors");
    expect(summary.played).toBe(true);
    expect(summary.best).toBe(12);
    expect(summary.recent).toBe(12);
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
    mockStorage.set("number_order_best_normal", "30");
    mockStorage.set("head_count_best_hard", "45");
    mockStorage.set("head_count_best_normal_slow", "35");
    mockStorage.set("head_count_best_hard_fast", "48");
    mockStorage.set("word_scramble_best_normal", "33");
    mockStorage.set("bird_count_best_hard", "41");
    mockStorage.set("color_trap_best_normal", "35");
    mockStorage.set("memory_highscore_shape_M1", JSON.stringify({ score: 42 }));
    mockStorage.set("memory_highscore_calculation_M4", JSON.stringify({ score: 128 }));

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
      expect(getAwardedPoints("twenty-four", 2)).toBe(4);
      expect(getAwardedPoints("twenty-four", 10)).toBe(20);
      expect(getAwardedPoints("twenty-four", 20)).toBe(40);
    });

    test("pattern-completion: 1.2x conversion", () => {
      expect(getAwardedPoints("pattern-completion", 10)).toBe(12);
      expect(getAwardedPoints("pattern-completion", 30)).toBe(36);
    });

    test("dual-task: capped score maps directly to points", () => {
      expect(getAwardedPoints("dual-task", 10)).toBe(10);
      expect(getAwardedPoints("dual-task", 40)).toBe(40);
      expect(getAwardedPoints("dual-task", 30, "hard")).toBe(45);
      expect(getAwardedPoints("dual-task", 50, "hard")).toBe(60);
    });

    test("multiple-object-tracking: 3x conversion with normal cap", () => {
      expect(getAwardedPoints("multiple-object-tracking", 5)).toBe(15);
      expect(getAwardedPoints("multiple-object-tracking", 15)).toBe(40);
    });

    test("rock-paper-scissors: capped score maps directly to points", () => {
      expect(getAwardedPoints("rock-paper-scissors", 10)).toBe(10);
      expect(getAwardedPoints("rock-paper-scissors", 40)).toBe(40);
    });

    test("memory-challenge: capped score maps directly to points", () => {
      expect(getAwardedPoints("memory-challenge", 10)).toBe(10);
      expect(getAwardedPoints("memory-challenge", 40)).toBe(40);
    });

    test("supports an explicit reward policy for special game modes", () => {
      expect(getAwardedPoints("memory-challenge", 90, "hard", {
        applyDifficultyMultiplier: false,
        maxPoints: 100,
      })).toBe(90);
      expect(getAwardedPoints("memory-challenge", 120, "hard", {
        applyDifficultyMultiplier: false,
        maxPoints: 100,
      })).toBe(100);
    });

    test("number-order: capped score maps directly to points", () => {
      expect(getAwardedPoints("number-order", 20, "normal")).toBe(20);
      expect(getAwardedPoints("number-order", 40, "normal")).toBe(40);
      expect(getAwardedPoints("number-order", 30, "hard")).toBe(45);
      expect(getAwardedPoints("number-order", 50, "hard")).toBe(60);
    });

    test("head-count: hard difficulty applies 1.5x conversion and caps at 60", () => {
      expect(getAwardedPoints("head-count", 30, "hard")).toBe(45);
      expect(getAwardedPoints("head-count", 50, "hard")).toBe(60);
    });

    test("word-scramble, bird-count, and color-trap use 1x conversion with difficulty caps", () => {
      expect(getAwardedPoints("word-scramble", 32, "normal")).toBe(32);
      expect(getAwardedPoints("word-scramble", 50, "normal")).toBe(40);
      expect(getAwardedPoints("bird-count", 32, "hard")).toBe(48);
      expect(getAwardedPoints("bird-count", 50, "hard")).toBe(60);
      expect(getAwardedPoints("color-trap", 32, "normal")).toBe(32);
      expect(getAwardedPoints("color-trap", 50, "hard")).toBe(60);
    });

    test("typical good performance gives similar rewards across games", () => {
      // 良好表现应该获得大约 10-40 积分
      const rewards = [
        getAwardedPoints("digit-span", 7),
        getAwardedPoints("mental-math", 20),
        getAwardedPoints("twenty-four", 10),
        getAwardedPoints("pattern-completion", 20),
        getAwardedPoints("dual-task", 24),
        getAwardedPoints("multiple-object-tracking", 10),
        getAwardedPoints("rock-paper-scissors", 24),
        getAwardedPoints("memory-challenge", 24),
        getAwardedPoints("number-order", 30),
        getAwardedPoints("head-count", 35),
        getAwardedPoints("word-scramble", 34),
        getAwardedPoints("bird-count", 34),
        getAwardedPoints("color-trap", 34),
      ];

      rewards.forEach(reward => {
        expect(reward).toBeGreaterThanOrEqual(10);
        expect(reward).toBeLessThanOrEqual(40);
      });
    });

    test("hard difficulty applies 1.5x conversion and caps at 60", () => {
      expect(getAwardedPoints("mental-math", 20, "hard")).toBe(30);
      expect(getAwardedPoints("twenty-four", 20, "hard")).toBe(60);
      expect(getAwardedPoints("multiple-object-tracking", 15, "hard")).toBe(60);
    });

    test("missing difficulty defaults to normal cap", () => {
      expect(getAwardedPoints("dual-task", 80)).toBe(40);
      expect(getAwardedPoints("dual-task", 80, "normal")).toBe(40);
    });

    test("returns 0 for unknown gameId or zero score", () => {
      expect(getAwardedPoints("unknown-game", 100)).toBe(0);
      expect(getAwardedPoints("digit-span", 0)).toBe(0);
      expect(getAwardedPoints("mental-math", -5)).toBe(0);
    });
  });
});
