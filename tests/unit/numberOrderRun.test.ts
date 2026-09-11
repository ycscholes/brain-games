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
  abandonNumberOrderRun,
  createNumberOrderRun,
  readNumberOrderRun,
  settleNumberOrderCompletion,
  settleNumberOrderRun,
  updateNumberOrderRun,
} from "../../src/pages/number-order/run";
import { settleGame } from "../../src/services/gameSettlementService";

const mockSettleGame = settleGame as jest.Mock;

describe("number-order run", () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
    mockSettleGame.mockReturnValue({ awardedPoints: 21, gauntletHandled: false, record: {} });
  });

  test("creates a restorable session and persists progress", () => {
    const run = createNumberOrderRun("hard", 1_000);
    const updated = updateNumberOrderRun(run.runId, { score: 12, currentIndex: 2 });

    expect(readNumberOrderRun(run.runId)).toMatchObject({
      status: "active",
      payload: { difficulty: "hard", startedAt: 1_000, score: 12, currentIndex: 2 },
    });
    expect(updated?.payload.questions).toHaveLength(8);
  });

  test("settles the run before recording one completion settlement", () => {
    const run = createNumberOrderRun("normal", 1_000);
    const result = {
      score: 88,
      best: 88,
      awardedPoints: 0,
      durationSeconds: 49,
      correctQuestions: 7,
      bestCombo: 4,
      isNewBest: true,
    };
    const settlementInput = {
      gameId: "number-order" as const,
      score: 88,
      difficulty: "normal" as const,
      durationSeconds: 49,
      outcome: "completed" as const,
    };

    mockSettleGame.mockImplementation(() => {
      expect(readNumberOrderRun(run.runId)?.status).toBe("settled");
      return { awardedPoints: 21, gauntletHandled: false, record: {} };
    });

    expect(settleNumberOrderCompletion(run.runId, result, settlementInput)).toMatchObject({
      settlement: { awardedPoints: 21 },
    });
    expect(
      settleNumberOrderCompletion(
        run.runId,
        { ...result, score: 99 },
        { ...settlementInput, score: 99 },
      ),
    ).toBeNull();
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
  });

  test("abandons an active run once before recording interruption", () => {
    const run = createNumberOrderRun("normal", 1_000);
    const input = {
      gameId: "number-order" as const,
      score: 0,
      difficulty: "normal" as const,
      durationSeconds: 12,
      outcome: "interrupted" as const,
    };

    mockSettleGame.mockReturnValueOnce({ awardedPoints: 0, gauntletHandled: false, record: {} });
    expect(abandonNumberOrderRun(run.runId, input)).toMatchObject({ awardedPoints: 0 });
    expect(abandonNumberOrderRun(run.runId, input)).toBeNull();
    expect(readNumberOrderRun(run.runId)?.status).toBe("abandoned");
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
  });

  test("does not allow settling an abandoned run", () => {
    const run = createNumberOrderRun("normal", 1_000);
    abandonNumberOrderRun(run.runId, {
      gameId: "number-order",
      score: 0,
      difficulty: "normal",
      durationSeconds: 1,
      outcome: "interrupted",
    });

    expect(
      settleNumberOrderRun(run.runId, {
        score: 10,
        best: 10,
        awardedPoints: 0,
        durationSeconds: 1,
        correctQuestions: 0,
        bestCombo: 0,
        isNewBest: false,
      }),
    ).toBeNull();
  });
});
