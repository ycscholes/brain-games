import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mockStorage = new Map<string, string>();

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    clearStorageSync: jest.fn(() => mockStorage.clear()),
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) ?? ""),
    setStorageSync: jest.fn((key: string, value: string) => mockStorage.set(key, value)),
  },
}));

jest.mock("../../src/services/gameSettlementService", () => ({
  __esModule: true,
  settleGame: jest.fn(() => ({ awardedPoints: 6, gauntletHandled: false, record: {} })),
}));

import Taro from "@tarojs/taro";
import {
  abandonColorTrapRun,
  createColorTrapRun,
  readColorTrapRun,
  settleColorTrapCompletion,
} from "../../src/pages/color-trap/run";
import {
  abandonSpatialRotationRun,
  createSpatialRotationRun,
  readSpatialRotationRun,
  settleSpatialRotationCompletion,
} from "../../src/pages/spatial-rotation/run";
import {
  abandonWordScrambleRun,
  createWordScrambleRun,
  readWordScrambleRun,
  settleWordScrambleCompletion,
} from "../../src/pages/word-scramble/run";

const games = [
  {
    id: "color-trap",
    create: createColorTrapRun,
    read: readColorTrapRun,
    settle: settleColorTrapCompletion,
    abandon: abandonColorTrapRun,
  },
  {
    id: "spatial-rotation",
    create: createSpatialRotationRun,
    read: readSpatialRotationRun,
    settle: settleSpatialRotationCompletion,
    abandon: abandonSpatialRotationRun,
  },
  {
    id: "word-scramble",
    create: createWordScrambleRun,
    read: readWordScrambleRun,
    settle: settleWordScrambleCompletion,
    abandon: abandonWordScrambleRun,
  },
] as const;

describe("routed quiz game runs", () => {
  beforeEach(() => {
    Taro.clearStorageSync();
  });

  test.each(games)("$id persists active state and settles exactly once", (game) => {
    const run = game.create("normal", 1700000000000);
    expect(game.read(run.runId)).toMatchObject({ gameId: game.id, status: "active" });

    const result = {
      score: 24,
      awardedPoints: 0,
      durationSeconds: 12,
      correctQuestions: 6,
      totalQuestions: 8,
      bestCombo: 3,
      isNewBest: true,
    };
    const settled = game.settle(run.runId, result, {
      gameId: game.id,
      score: result.score,
      durationSeconds: result.durationSeconds,
      difficulty: "normal",
      outcome: "completed",
    });
    expect(settled?.run.status).toBe("settled");
    expect(game.read(run.runId)?.result).toMatchObject({ score: 24 });
    expect(
      game.settle(run.runId, result, {
        gameId: game.id,
        score: result.score,
        durationSeconds: result.durationSeconds,
        difficulty: "normal",
        outcome: "completed",
      }),
    ).toBeNull();
  });

  test.each(games)("$id marks active run abandoned", (game) => {
    const run = game.create("hard", 1700000000000);
    expect(
      game.abandon(run.runId, {
        gameId: game.id,
        score: 0,
        durationSeconds: 1,
        difficulty: "hard",
        outcome: "interrupted",
      }),
    ).not.toBeNull();
    expect(game.read(run.runId)?.status).toBe("abandoned");
    expect(
      game.abandon(run.runId, {
        gameId: game.id,
        score: 0,
        durationSeconds: 1,
        difficulty: "hard",
        outcome: "interrupted",
      }),
    ).toBeNull();
  });
});

describe("routed quiz game route contract", () => {
  test("registers color-trap pages and keeps its result root isolated", () => {
    const config = readFileSync(resolve(process.cwd(), "src/app.config.ts"), "utf8");
    for (const gameId of ["color-trap"]) {
      expect(config).toContain(`pages/${gameId}/index`);
      expect(config).toContain(`pages/${gameId}/play`);
      expect(config).toContain(`pages/${gameId}/result`);
      expect(
        readFileSync(resolve(process.cwd(), `src/pages/${gameId}/play.tsx`), "utf8"),
      ).toContain("useUnload");
      expect(
        readFileSync(resolve(process.cwd(), `src/pages/${gameId}/result.tsx`), "utf8"),
      ).toContain(`${gameId}-result-page`);
    }
  });
});
