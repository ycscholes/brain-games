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
  abandonMusicTheoryRun,
  createMusicTheoryRun,
  readMusicTheoryRun,
  settleMusicTheoryCompletion,
  updateMusicTheoryRun,
} from "../../src/pages/music-theory/run";
import { settleGame } from "../../src/services/gameSettlementService";

const mockSettleGame = settleGame as jest.Mock;

describe("music theory run", () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
    mockSettleGame.mockReturnValue({ awardedPoints: 8, gauntletHandled: false, record: {} });
  });

  test("persists both question phases and settles once", () => {
    const run = createMusicTheoryRun("normal", 1_000);
    expect(run.payload.state.phase).toBe("quiz");
    expect(run.payload.questions).toHaveLength(8);
    expect(run.payload.levels).toHaveLength(4);

    const updated = updateMusicTheoryRun(run.runId, {
      state: { ...run.payload.state, phase: "staff-placement", index: 1, hintCount: 2 },
    });
    expect(readMusicTheoryRun(run.runId)?.payload.state).toMatchObject({
      phase: "staff-placement",
      index: 1,
      hintCount: 2,
    });
    expect(updated?.status).toBe("active");

    expect(
      settleMusicTheoryCompletion(
        run.runId,
        {
          score: 32,
          awardedPoints: 0,
          durationSeconds: 12,
          quizCorrectCount: 7,
          placementCorrectCount: 3,
          hintCount: 2,
          isNewBest: true,
        },
        { gameId: "music-theory", score: 32, difficulty: "normal", outcome: "completed" },
      ),
    ).toMatchObject({ settlement: { awardedPoints: 8 } });
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
    expect(settleMusicTheoryCompletion(run.runId, {} as never, {} as never)).toBeNull();
  });

  test("abandons before recording one interruption", () => {
    const run = createMusicTheoryRun("hard", 1_000);
    expect(
      abandonMusicTheoryRun(run.runId, {
        gameId: "music-theory",
        score: 0,
        difficulty: "hard",
        outcome: "interrupted",
      }),
    ).toMatchObject({ awardedPoints: 8 });
    expect(abandonMusicTheoryRun(run.runId, {} as never)).toBeNull();
    expect(readMusicTheoryRun(run.runId)?.status).toBe("abandoned");
    expect(mockSettleGame).toHaveBeenCalledTimes(1);
  });
});
