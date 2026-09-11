const mockStorage = new Map<string, string>();

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) ?? ""),
    setStorageSync: jest.fn((key: string, value: string) => mockStorage.set(key, value)),
  },
}));

jest.mock("../../src/services/gameSettlementService", () => ({
  __esModule: true,
  settleGame: jest.fn(),
}));

import {
  abandonMultipleObjectTrackingRun,
  createMultipleObjectTrackingRun,
  readMultipleObjectTrackingRun,
  settleMultipleObjectTrackingCompletion,
  updateMultipleObjectTrackingRun,
} from "../../src/pages/multiple-object-tracking/run";
import { settleGame } from "../../src/services/gameSettlementService";

const mockSettleGame = settleGame as jest.Mock;

describe("multiple-object-tracking run", () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
    mockSettleGame.mockReturnValue({ awardedPoints: 9, gauntletHandled: false, record: {} });
  });

  test("persists the active board and progress for restoration", () => {
    const run = createMultipleObjectTrackingRun("hard", 1_000);
    const updated = updateMultipleObjectTrackingRun(run.runId, {
      score: 3,
      targetCount: 4,
      phase: "selecting",
      selectedIds: [1, 5],
    });

    expect(readMultipleObjectTrackingRun(run.runId)).toMatchObject({
      status: "active",
      payload: {
        difficulty: "hard",
        startedAt: 1_000,
        score: 3,
        targetCount: 4,
        phase: "selecting",
        selectedIds: [1, 5],
      },
    });
    expect(updated?.payload.circles.length).toBeGreaterThan(0);
  });

  test("settles before recording completion points and only settles once", () => {
    const run = createMultipleObjectTrackingRun("normal", 1_000);
    const result = {
      score: 5,
      awardedPoints: 0,
      durationSeconds: 20,
      isNewBest: true,
    };
    const settlementInput = {
      gameId: "multiple-object-tracking" as const,
      score: 5,
      difficulty: "normal" as const,
      durationSeconds: 20,
      outcome: "completed" as const,
    };

    mockSettleGame.mockImplementation(() => {
      expect(readMultipleObjectTrackingRun(run.runId)?.status).toBe("settled");
      return { awardedPoints: 9, gauntletHandled: false, record: {} };
    });

    expect(
      settleMultipleObjectTrackingCompletion(run.runId, result, settlementInput),
    ).toMatchObject({
      settlement: { awardedPoints: 9 },
    });
    expect(
      settleMultipleObjectTrackingCompletion(
        run.runId,
        { ...result, score: 6 },
        { ...settlementInput, score: 6 },
      ),
    ).toBeNull();
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
  });

  test("abandons active runs once for interrupted native back navigation", () => {
    const run = createMultipleObjectTrackingRun("normal", 1_000);
    const input = {
      gameId: "multiple-object-tracking" as const,
      score: 0,
      difficulty: "normal" as const,
      durationSeconds: 2,
      outcome: "interrupted" as const,
    };

    mockSettleGame.mockReturnValueOnce({ awardedPoints: 0, gauntletHandled: false, record: {} });
    expect(abandonMultipleObjectTrackingRun(run.runId, input)).toMatchObject({ awardedPoints: 0 });
    expect(abandonMultipleObjectTrackingRun(run.runId, input)).toBeNull();
    expect(readMultipleObjectTrackingRun(run.runId)?.status).toBe("abandoned");
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
  });
});
