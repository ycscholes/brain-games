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

jest.mock("../../src/services/gameSettlementService", () => ({
  __esModule: true,
  settleGame: jest.fn(),
}));

import {
  abandonTrafficEscapeRun,
  createTrafficEscapeRun,
  readTrafficEscapeRun,
  settleTrafficEscapeCompletion,
  settleTrafficEscapeRun,
  updateTrafficEscapeRun,
} from "../../src/pages/traffic-escape/run";
import { settleGame } from "../../src/services/gameSettlementService";

const mockSettleGame = settleGame as jest.Mock;

describe("traffic escape run", () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
    mockSettleGame.mockReturnValue({ awardedPoints: 21, gauntletHandled: false, record: {} });
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

  test("settles the game service once after the run becomes settled", () => {
    const run = createTrafficEscapeRun("normal", 31, 1_000);
    const settlementInput = {
      gameId: "traffic-escape" as const,
      score: 88,
      difficulty: "normal" as const,
      durationSeconds: 49,
      outcome: "completed" as const,
    };
    const result = {
      score: 88,
      awardedPoints: 0,
      durationSeconds: 49,
      moveCount: 9,
      hintCount: 2,
      isNewBest: true,
    };

    expect(settleTrafficEscapeCompletion(run.runId, result, settlementInput)).toMatchObject({
      settlement: { awardedPoints: 21 },
    });
    expect(settleTrafficEscapeCompletion(run.runId, { ...result, score: 99 }, { ...settlementInput, score: 99 })).toBeNull();
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
    expect(readTrafficEscapeRun(run.runId)).toMatchObject({
      status: "settled",
      result: { score: 88, awardedPoints: 21 },
    });
  });

  test("abandons before recording one interrupted settlement and ignores a second interruption", () => {
    const run = createTrafficEscapeRun("hard", 37, 1_000);
    const settlementInput = {
      gameId: "traffic-escape" as const,
      score: 0,
      difficulty: "hard" as const,
      durationSeconds: 12,
      outcome: "interrupted" as const,
    };
    mockSettleGame.mockImplementation(() => {
      expect(readTrafficEscapeRun(run.runId)?.status).toBe("abandoned");
      return { awardedPoints: 0, gauntletHandled: false, record: {} };
    });

    expect(abandonTrafficEscapeRun(run.runId, settlementInput)).toMatchObject({
      awardedPoints: 0,
    });
    expect(abandonTrafficEscapeRun(run.runId, settlementInput)).toBeNull();
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
    expect(mockSettleGame).toHaveBeenCalledWith(settlementInput);
    expect(readTrafficEscapeRun(run.runId)?.status).toBe("abandoned");
  });
});
