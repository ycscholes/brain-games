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
  abandonPatternCompletionRun,
  createPatternCompletionRun,
  readPatternCompletionRun,
  settlePatternCompletionCompletion,
  updatePatternCompletionRun,
} from "../../src/pages/pattern-completion/run";
import { settleGame } from "../../src/services/gameSettlementService";

const mockSettleGame = settleGame as jest.Mock;

describe("pattern completion run", () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
    mockSettleGame.mockReturnValue({ awardedPoints: 9, gauntletHandled: false, record: {} });
  });

  test("persists generated pattern state and settles once after active state is sealed", () => {
    const run = createPatternCompletionRun("hard", 1_000);
    const state = run.payload.state;
    expect(state.session).toHaveLength(8);
    expect(readPatternCompletionRun(run.runId)?.payload.state).toEqual(state);

    const updated = updatePatternCompletionRun(run.runId, {
      state: { ...state, currentIndex: 2, finalScore: 7 },
    });
    expect(updated?.payload.state.currentIndex).toBe(2);

    expect(
      settlePatternCompletionCompletion(
        run.runId,
        {
          score: 7,
          awardedPoints: 0,
          correctCount: 2,
          totalQuestions: 10,
          longestCombo: 2,
          hintsUsed: 1,
          multiruleCases: 4,
          elapsedMs: 2_000,
          best: 7,
          isNewBest: true,
        },
        { gameId: "pattern-completion", score: 7, difficulty: "hard", outcome: "completed" },
      ),
    ).toMatchObject({ settlement: { awardedPoints: 9 } });
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
    expect(settlePatternCompletionCompletion(run.runId, {} as never, {} as never)).toBeNull();
  });

  test("abandons an active run before recording interruption and ignores a second unload", () => {
    const run = createPatternCompletionRun("normal", 1_000);
    expect(
      abandonPatternCompletionRun(run.runId, {
        gameId: "pattern-completion",
        score: 0,
        difficulty: "normal",
        outcome: "interrupted",
      }),
    ).toMatchObject({ awardedPoints: 9 });
    expect(abandonPatternCompletionRun(run.runId, {} as never)).toBeNull();
    expect(readPatternCompletionRun(run.runId)?.status).toBe("abandoned");
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
  });
});
