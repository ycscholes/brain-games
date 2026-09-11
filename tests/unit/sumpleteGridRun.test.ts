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
  abandonSumpleteGridRun,
  createSumpleteGridRun,
  readSumpleteGridRun,
  settleSumpleteGridCompletion,
  settleSumpleteGridRun,
  updateSumpleteGridRun,
} from "../../src/pages/sumplete-grid/run";
import { settleGame } from "../../src/services/gameSettlementService";

const mockSettleGame = settleGame as jest.Mock;

describe("sumplete-grid run", () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
    mockSettleGame.mockReturnValue({ awardedPoints: 21, gauntletHandled: false, record: {} });
  });

  test("creates a restorable active puzzle run and persists gameplay updates", () => {
    const run = createSumpleteGridRun("normal", 1_000);
    const updated = updateSumpleteGridRun(run.runId, { mistakes: 2 });

    expect(readSumpleteGridRun(run.runId)).toMatchObject({
      status: "active",
      payload: { difficulty: "normal", startedAt: 1_000, mistakes: 2 },
    });
    expect(updated?.payload.puzzle.id).toBe(run.payload.puzzle.id);
  });

  test("settles the run before recording one completion settlement", () => {
    const run = createSumpleteGridRun("hard", 1_000);
    const result = {
      score: 88,
      awardedPoints: 0,
      durationSeconds: 49,
      mistakes: 1,
      isNewBest: true,
    };
    const settlementInput = {
      gameId: "sumplete-grid" as const,
      score: 88,
      difficulty: "hard" as const,
      durationSeconds: 49,
      outcome: "completed" as const,
    };

    mockSettleGame.mockImplementation(() => {
      expect(readSumpleteGridRun(run.runId)?.status).toBe("settled");
      return { awardedPoints: 21, gauntletHandled: false, record: {} };
    });

    expect(settleSumpleteGridCompletion(run.runId, result, settlementInput)).toMatchObject({
      settlement: { awardedPoints: 21 },
    });
    expect(
      settleSumpleteGridCompletion(
        run.runId,
        { ...result, score: 99 },
        { ...settlementInput, score: 99 },
      ),
    ).toBeNull();
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
  });

  test("abandons an active run once before recording interruption", () => {
    const run = createSumpleteGridRun("normal", 1_000);
    const input = {
      gameId: "sumplete-grid" as const,
      score: 0,
      difficulty: "normal" as const,
      durationSeconds: 12,
      outcome: "interrupted" as const,
    };

    mockSettleGame.mockReturnValueOnce({ awardedPoints: 0, gauntletHandled: false, record: {} });
    expect(abandonSumpleteGridRun(run.runId, input)).toMatchObject({ awardedPoints: 0 });
    expect(abandonSumpleteGridRun(run.runId, input)).toBeNull();
    expect(readSumpleteGridRun(run.runId)?.status).toBe("abandoned");
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
  });

  test("does not allow settling an abandoned run", () => {
    const run = createSumpleteGridRun("normal", 1_000);
    abandonSumpleteGridRun(run.runId, {
      gameId: "sumplete-grid",
      score: 0,
      difficulty: "normal",
      durationSeconds: 1,
      outcome: "interrupted",
    });

    expect(
      settleSumpleteGridRun(run.runId, {
        score: 10,
        awardedPoints: 0,
        durationSeconds: 1,
        mistakes: 0,
        isNewBest: false,
      }),
    ).toBeNull();
  });
});
