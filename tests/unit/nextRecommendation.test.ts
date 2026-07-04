import { GAME_CATALOG, GAME_GAUNTLET_ID } from "../../src/config/gameCatalog";

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getStorageSync: jest.fn(() => ""),
    setStorageSync: jest.fn(),
  },
}));

import {
  buildRecommendationTicketBag,
  recommendNextWeightedGame,
} from "../../src/utils/nextRecommendation";
import type { TrainingRecord } from "../../src/utils/trainingStorage";

function buildRecords(count: number): TrainingRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `record_${count - index}`,
    gameId: "mental-math",
    score: 1,
    awardedPoints: 1,
    playedAt: new Date(2026, 6, 4, 8, index).toISOString(),
    outcome: "completed",
  }));
}

describe("nextRecommendation", () => {
  const singleGames = GAME_CATALOG.filter((game) => (
    game.showInAllGames && game.id !== GAME_GAUNTLET_ID
  ));

  test("builds a weighted ticket bag without gauntlet", () => {
    const bag = buildRecommendationTicketBag(singleGames);
    const counts = new Map(bag.map((gameId) => [
      gameId,
      bag.filter((item) => item === gameId).length,
    ]));

    expect(bag).not.toContain(GAME_GAUNTLET_ID);
    singleGames.forEach((game) => {
      expect(counts.get(game.id)).toBe(game.isHot ? 2 : 1);
    });
  });

  test("inserts gauntlet every third recommendation round", () => {
    expect(recommendNextWeightedGame(buildRecords(2))).toBe("game-gauntlet");
    expect(recommendNextWeightedGame(buildRecords(5))).toBe("game-gauntlet");
    expect(recommendNextWeightedGame(buildRecords(8))).toBe("game-gauntlet");
  });

  test("uses single games on non-gauntlet recommendation rounds", () => {
    expect(recommendNextWeightedGame(buildRecords(0))).not.toBe("game-gauntlet");
    expect(recommendNextWeightedGame(buildRecords(1))).not.toBe("game-gauntlet");
    expect(recommendNextWeightedGame(buildRecords(3))).not.toBe("game-gauntlet");
  });

  test("covers each weighted ticket exactly once in a single-game cycle", () => {
    const bagLength = buildRecommendationTicketBag(singleGames).length;
    const recommendedSingleGames: string[] = [];

    for (let recordsCount = 0; recommendedSingleGames.length < bagLength; recordsCount += 1) {
      const recommendation = recommendNextWeightedGame(buildRecords(recordsCount));
      if (recommendation !== "game-gauntlet") {
        recommendedSingleGames.push(recommendation);
      }
    }

    singleGames.forEach((game) => {
      const count = recommendedSingleGames.filter((gameId) => gameId === game.id).length;
      expect(count).toBe(game.isHot ? 2 : 1);
    });
  });

  test("returns a stable recommendation for the same training state", () => {
    const records = buildRecords(4);

    expect(recommendNextWeightedGame(records)).toBe(recommendNextWeightedGame(records));
  });
});
