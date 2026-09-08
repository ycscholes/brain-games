const mockStorage = new Map<string, string>();

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) ?? ""),
    setStorageSync: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
  },
}));

import {
  createTrafficEscapeRun,
  readTrafficEscapeRun,
  settleTrafficEscapeRun,
  updateTrafficEscapeRun,
} from "../../src/pages/traffic-escape/run";

describe("traffic escape run", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  test("creates a restorable active puzzle run", () => {
    const run = createTrafficEscapeRun("normal", 17, 1_000);
    const restored = readTrafficEscapeRun(run.runId);

    expect(restored).toMatchObject({
      status: "active",
      payload: {
        difficulty: "normal",
        selectedVehicleId: "target",
        hintCount: 0,
        startedAt: 1_000,
      },
    });
    expect(restored?.payload.puzzle.id).toBe(run.payload.puzzle.id);
  });

  test("persists moves and settles its score snapshot once", () => {
    const run = createTrafficEscapeRun("hard", 29, 1_000);
    const updated = updateTrafficEscapeRun(run.runId, { hintCount: 2, selectedVehicleId: "vehicle-3" });

    expect(updated?.payload).toMatchObject({ hintCount: 2, selectedVehicleId: "vehicle-3" });
    expect(settleTrafficEscapeRun(run.runId, {
      score: 88,
      awardedPoints: 12,
      durationSeconds: 49,
      moveCount: 9,
      hintCount: 2,
      isNewBest: true,
    })).toMatchObject({ status: "settled", result: { score: 88, awardedPoints: 12 } });
    expect(settleTrafficEscapeRun(run.runId, {
      score: 99,
      awardedPoints: 15,
      durationSeconds: 42,
      moveCount: 8,
      hintCount: 1,
      isNewBest: true,
    })).toBeNull();
  });
});
