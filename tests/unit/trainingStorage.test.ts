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
      gameId: "memory",
      score: 12,
      awardedPoints: 2,
      outcome: "completed",
    });

    recordTrainingSession({
      gameId: "memory",
      score: 18,
      awardedPoints: 3,
      outcome: "completed",
    });

    const summary = readTrainingSummary("memory");
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
});
