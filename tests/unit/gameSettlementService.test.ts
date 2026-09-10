jest.mock("../../src/utils/trainingStorage", () => ({
  __esModule: true,
  getAwardedPoints: jest.fn(),
  recordTrainingSession: jest.fn(),
}));

jest.mock("../../src/utils/petStorage", () => ({
  __esModule: true,
  addPointsToPet: jest.fn(),
}));

jest.mock("../../src/utils/gameGauntlet", () => ({
  __esModule: true,
  completeGauntletLegIfNeeded: jest.fn(),
}));

import {
  getAwardedPoints,
  recordTrainingSession,
} from "../../src/utils/trainingStorage";
import { addPointsToPet } from "../../src/utils/petStorage";
import { completeGauntletLegIfNeeded } from "../../src/utils/gameGauntlet";
import { settleGame } from "../../src/services/gameSettlementService";

const mockGetAwardedPoints = getAwardedPoints as jest.Mock;
const mockAddPointsToPet = addPointsToPet as jest.Mock;
const mockRecordTrainingSession = recordTrainingSession as jest.Mock;
const mockCompleteGauntletLegIfNeeded = completeGauntletLegIfNeeded as jest.Mock;

describe("gameSettlementService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAwardedPoints.mockReturnValue(48);
    mockCompleteGauntletLegIfNeeded.mockReturnValue(false);
    mockRecordTrainingSession.mockReturnValue({
      id: "training-1",
      playedAt: "2026-09-10T00:00:00.000Z",
    });
  });

  test("ordinary completion awards once and records once", () => {
    const result = settleGame({
      gameId: "hidato",
      score: 32,
      difficulty: "hard",
      durationSeconds: 91,
      outcome: "completed",
    });

    expect(mockGetAwardedPoints).toHaveBeenCalledTimes(1);
    expect(mockAddPointsToPet).toHaveBeenCalledTimes(1);
    expect(mockRecordTrainingSession).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      awardedPoints: 48,
      gauntletHandled: false,
      record: expect.any(Object),
    });
  });

  test("interrupted completion records zero score and interrupted outcome", () => {
    mockGetAwardedPoints.mockReturnValue(0);

    const result = settleGame({
      gameId: "hidato",
      score: 0,
      difficulty: "hard",
      outcome: "interrupted",
    });

    expect(mockGetAwardedPoints).toHaveBeenCalledTimes(1);
    expect(mockAddPointsToPet).toHaveBeenCalledWith("hidato", 0, "hard", undefined);
    expect(mockRecordTrainingSession).toHaveBeenCalledWith(expect.objectContaining({
      gameId: "hidato",
      score: 0,
      awardedPoints: 0,
      difficulty: "hard",
      outcome: "interrupted",
    }));
    expect(result.record).not.toBeNull();
  });

  test("gauntlet leg stops before ordinary reward and record", () => {
    mockCompleteGauntletLegIfNeeded.mockReturnValue(true);

    const result = settleGame({
      gameId: "hidato",
      score: 32,
      difficulty: "hard",
      outcome: "completed",
    });

    expect(result).toEqual({ awardedPoints: 48, gauntletHandled: true, record: null });
    expect(mockCompleteGauntletLegIfNeeded).toHaveBeenCalledTimes(1);
    expect(mockAddPointsToPet).not.toHaveBeenCalled();
    expect(mockRecordTrainingSession).not.toHaveBeenCalled();
  });

  test("forwards reward policy to the shared points pipeline", () => {
    const rewardPolicy = { applyDifficultyMultiplier: false, maxPoints: 100 };

    settleGame({
      gameId: "hidato",
      score: 32,
      difficulty: "hard",
      rewardPolicy,
      outcome: "completed",
    });

    expect(mockGetAwardedPoints).toHaveBeenCalledWith("hidato", 32, "hard", rewardPolicy);
    expect(mockAddPointsToPet).toHaveBeenCalledWith("hidato", 32, "hard", rewardPolicy);
  });

  test("uses an explicit reward score while recording the raw score", () => {
    settleGame({
      gameId: "mental-math",
      score: 20,
      rewardScore: 30,
      difficulty: "hard",
      outcome: "completed",
    });

    expect(mockGetAwardedPoints).toHaveBeenCalledWith("mental-math", 30, "hard", undefined);
    expect(mockAddPointsToPet).toHaveBeenCalledWith("mental-math", 30, "hard", undefined);
    expect(mockRecordTrainingSession).toHaveBeenCalledWith(expect.objectContaining({
      score: 20,
      awardedPoints: 48,
    }));
  });

  test("computes awarded points exactly once", () => {
    settleGame({ gameId: "hidato", score: 32, outcome: "completed" });

    expect(mockGetAwardedPoints).toHaveBeenCalledTimes(1);
  });
});
