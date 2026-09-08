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

import {
  abandonGameRun,
  createGameRun,
  readGameRun,
  settleGameRun,
  updateGameRun,
} from "../../src/utils/gameFlowSession";

describe("game flow session", () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.spyOn(Math, "random").mockReturnValue(0.123456);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("creates and restores an active run isolated by game id", () => {
    const run = createGameRun("traffic-escape", { moves: 0, selectedVehicleId: "target" });

    expect(readGameRun("traffic-escape", run.runId)).toMatchObject({
      gameId: "traffic-escape",
      runId: run.runId,
      status: "active",
      payload: { moves: 0, selectedVehicleId: "target" },
    });
    expect(readGameRun("netwalk", run.runId)).toBeNull();
  });

  test("updates only an active run and preserves its original payload fields", () => {
    const run = createGameRun("traffic-escape", { moves: 0, hintCount: 0 });

    expect(updateGameRun("traffic-escape", run.runId, { moves: 2 })).toMatchObject({
      status: "active",
      payload: { moves: 2, hintCount: 0 },
    });
    expect(updateGameRun("traffic-escape", "missing", { moves: 3 })).toBeNull();
  });

  test("settles a run only once and rejects later updates", () => {
    const run = createGameRun("traffic-escape", { moves: 3 });
    const settled = settleGameRun("traffic-escape", run.runId, { score: 82, awardedPoints: 8 });

    expect(settled).toMatchObject({
      status: "settled",
      payload: { moves: 3 },
      result: { score: 82, awardedPoints: 8 },
    });
    expect(settleGameRun("traffic-escape", run.runId, { score: 90 })).toBeNull();
    expect(updateGameRun("traffic-escape", run.runId, { moves: 4 })).toBeNull();
  });

  test("abandons an active run once and never changes a settled run", () => {
    const activeRun = createGameRun("traffic-escape", { moves: 1 });
    const settledRun = createGameRun("traffic-escape", { moves: 2 });
    settleGameRun("traffic-escape", settledRun.runId, { score: 50 });

    expect(abandonGameRun("traffic-escape", activeRun.runId)).toMatchObject({ status: "abandoned" });
    expect(abandonGameRun("traffic-escape", activeRun.runId)).toBeNull();
    expect(abandonGameRun("traffic-escape", settledRun.runId)).toBeNull();
  });
});
