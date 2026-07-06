const mockStorage = new Map<string, string>();
let mockRouteParams: Record<string, string> = {};

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
    redirectTo: jest.fn(() => Promise.resolve()),
    navigateTo: jest.fn(() => Promise.resolve()),
  },
  getCurrentInstance: jest.fn(() => ({ router: { params: mockRouteParams } })),
}));

import Taro from "@tarojs/taro";
import { GAUNTLET_CANDIDATE_GAMES } from "../../src/config/gameCatalog";
import {
  buildGameGauntletGameIds,
  buildGameGauntletWeightedPool,
  completeGauntletLegIfNeeded,
  createGameGauntletSession,
  createGameGauntletModePreset,
  getGauntletGameUrl,
  readGameGauntletSession,
  selectWeightedUniqueGauntletGames,
  startGameGauntletSession,
} from "../../src/utils/gameGauntlet";

describe("gameGauntlet", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockRouteParams = {};
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("builds a weighted pool from gameplay mode counts", () => {
    const pool = buildGameGauntletWeightedPool(GAUNTLET_CANDIDATE_GAMES);
    const counts = new Map(pool.map((game) => [
      game.id,
      pool.filter((item) => item.id === game.id).length,
    ]));

    expect(counts.get("mental-math")).toBe(2);
    expect(counts.get("memory-challenge")).toBe(3);
    expect(counts.get("bird-count")).toBe(2);
    expect(counts.get("twenty-four")).toBe(1);
  });

  test("selects unique games even when weighted games have multiple tickets", () => {
    const selectedGames = selectWeightedUniqueGauntletGames(
      GAUNTLET_CANDIDATE_GAMES,
      3,
      "stable-test-seed",
    );
    const selectedIds = selectedGames.map((game) => game.id);

    expect(selectedIds).toHaveLength(3);
    expect(new Set(selectedIds).size).toBe(3);
  });

  test("builds three unique gauntlet game ids", () => {
    const gameIds = buildGameGauntletGameIds("stable-test-seed");

    expect(gameIds).toHaveLength(3);
    expect(new Set(gameIds).size).toBe(3);
    expect(gameIds).not.toContain("game-gauntlet");
    expect(gameIds).not.toContain("head-count");
  });

  test("creates a session with one shared random difficulty and leg presets", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.8);

    const session = createGameGauntletSession("preview-seed");

    expect(session.difficulty).toBe("hard");
    expect(session.legs).toHaveLength(3);
    expect(session.legs.map((leg) => leg.gameId)).toEqual(session.gameIds);
    session.legs.forEach((leg) => {
      expect(leg.modePreset.difficulty).toBe("hard");
    });
    expect(Taro.setStorageSync).not.toHaveBeenCalled();
  });

  test("starts a gauntlet session from a preview session", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.2);
    const previewSession = createGameGauntletSession("preview-seed");

    const session = startGameGauntletSession(previewSession);

    expect(session).toEqual(previewSession);
    expect(Taro.setStorageSync).toHaveBeenCalled();
  });

  test("maps gauntlet presets for games with true gameplay modes", () => {
    expect(createGameGauntletModePreset("mental-math", "normal")).toMatchObject({
      difficulty: "normal",
      mode: "timed",
      stageId: "G1A",
    });
    expect(createGameGauntletModePreset("mental-math", "hard")).toMatchObject({
      difficulty: "hard",
      mode: "timed",
      stageId: "G4_MIXED_100",
    });

    const memoryHard = createGameGauntletModePreset("memory-challenge", "hard", "memory-seed");
    expect(["shape", "pet", "calculation"]).toContain(memoryHard.memoryMode);
    expect(memoryHard.memoryN).toBe("3");

    const farmHard = createGameGauntletModePreset("bird-count", "hard", "farm-seed");
    expect(["speed", "yard"]).toContain(farmHard.farmMode);
    expect(["standard", "fast"]).toContain(farmHard.yardSpeed);
  });

  test("adds gauntlet difficulty and mode preset params to child game urls", () => {
    mockStorage.set("game_gauntlet_session_v1", JSON.stringify({
      id: "session_1",
      gameIds: ["mental-math", "memory-challenge", "bird-count"],
      difficulty: "hard",
      legs: [
        {
          gameId: "mental-math",
          modePreset: {
            difficulty: "hard",
            mode: "timed",
            stageId: "G4_MIXED_100",
          },
        },
        {
          gameId: "memory-challenge",
          modePreset: {
            difficulty: "hard",
            memoryMode: "calculation",
            memoryN: "3",
          },
        },
        {
          gameId: "bird-count",
          modePreset: {
            difficulty: "hard",
            farmMode: "yard",
            yardSpeed: "fast",
          },
        },
      ],
      currentLegIndex: 0,
      results: [],
      status: "active",
      createdAt: "2026-07-04T00:00:00.000Z",
    }));

    const mathUrl = getGauntletGameUrl("mental-math", "session_1", 0);
    expect(mathUrl).toContain("gauntletDifficulty=hard");
    expect(mathUrl).toContain("gauntletMode=timed");
    expect(mathUrl).toContain("gauntletStageId=G4_MIXED_100");

    const memoryUrl = getGauntletGameUrl("memory-challenge", "session_1", 1);
    expect(memoryUrl).toContain("gauntletMemoryMode=calculation");
    expect(memoryUrl).toContain("gauntletMemoryN=3");

    const farmUrl = getGauntletGameUrl("bird-count", "session_1", 2);
    expect(farmUrl).toContain("gauntletFarmMode=yard");
    expect(farmUrl).toContain("gauntletYardSpeed=fast");
  });

  test("does not redirect when a leg result does not match the expected game", () => {
    mockStorage.set("game_gauntlet_session_v1", JSON.stringify({
      id: "session_1",
      gameIds: ["bird-count", "memory-challenge", "mental-math"],
      difficulty: "normal",
      legs: [
        { gameId: "bird-count", modePreset: { difficulty: "normal", farmMode: "yard", yardSpeed: "slow" } },
        { gameId: "memory-challenge", modePreset: { difficulty: "normal", memoryMode: "shape", memoryN: "1" } },
        { gameId: "mental-math", modePreset: { difficulty: "normal", mode: "timed", stageId: "G1A" } },
      ],
      currentLegIndex: 0,
      results: [],
      status: "active",
      createdAt: "2026-07-04T00:00:00.000Z",
    }));
    mockRouteParams = { gauntletSessionId: "session_1", gauntletLeg: "0" };

    const completed = completeGauntletLegIfNeeded({
      gameId: "head-count",
      score: 12,
      awardedPoints: 12,
      difficulty: "normal",
      mode: "yard:slow",
      outcome: "completed",
    });

    expect(completed).toBe(false);
    expect(Taro.redirectTo).not.toHaveBeenCalled();
    expect(readGameGauntletSession("session_1")?.results).toEqual([]);
  });

  test("saves a matching leg result so the gauntlet can advance to the second game", () => {
    mockStorage.set("game_gauntlet_session_v1", JSON.stringify({
      id: "session_1",
      gameIds: ["bird-count", "memory-challenge", "mental-math"],
      difficulty: "normal",
      legs: [
        { gameId: "bird-count", modePreset: { difficulty: "normal", farmMode: "yard", yardSpeed: "slow" } },
        { gameId: "memory-challenge", modePreset: { difficulty: "normal", memoryMode: "shape", memoryN: "1" } },
        { gameId: "mental-math", modePreset: { difficulty: "normal", mode: "timed", stageId: "G1A" } },
      ],
      currentLegIndex: 0,
      results: [],
      status: "active",
      createdAt: "2026-07-04T00:00:00.000Z",
    }));
    mockRouteParams = { gauntletSessionId: "session_1", gauntletLeg: "0" };

    const completed = completeGauntletLegIfNeeded({
      gameId: "bird-count",
      score: 12,
      awardedPoints: 12,
      difficulty: "normal",
      mode: "yard:slow",
      outcome: "completed",
    });
    const nextSession = readGameGauntletSession("session_1");

    expect(completed).toBe(true);
    expect(Taro.redirectTo).toHaveBeenCalledWith({
      url: "/pages/game-gauntlet/index?sessionId=session_1",
    });
    expect(nextSession?.currentLegIndex).toBe(1);
    expect(nextSession?.results[0]).toMatchObject({
      gameId: "bird-count",
      score: 12,
      awardedPoints: 12,
    });
    expect(getGauntletGameUrl("memory-challenge", "session_1", 1)).toContain("gauntletLeg=1");
  });
});
