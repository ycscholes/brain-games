jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    navigateTo: jest.fn(() => Promise.resolve()),
    redirectTo: jest.fn(() => Promise.resolve()),
    navigateBack: jest.fn(() => Promise.resolve()),
  },
  getCurrentInstance: jest.fn(() => ({
    router: { params: { gauntletSessionId: "session/1", gauntletLeg: "0" } },
  })),
}));

import {
  buildGameRouteQuery,
  getGamePageUrl,
  goBackToGameStart,
  goToGamePlay,
  goToGameResult,
  replaceWithGamePlay,
  shouldRedirectInvalidGameRun,
} from "../../src/utils/gameRoute";
import Taro from "@tarojs/taro";

const mockNavigateTo = Taro.navigateTo as jest.Mock;
const mockRedirectTo = Taro.redirectTo as jest.Mock;
const mockNavigateBack = Taro.navigateBack as jest.Mock;

describe("game route navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("forwards gauntlet context alongside a run id", () => {
    expect(buildGameRouteQuery("run/1")).toBe(
      "gauntletSessionId=session%2F1&gauntletLeg=0&runId=run%2F1",
    );
    expect(getGamePageUrl("hidato", "play", "runId=run%2F1")).toBe(
      "/pages/hidato/play?runId=run%2F1",
    );
  });

  test("uses navigateTo for ordinary play and redirectTo for gauntlet play", () => {
    void goToGamePlay("hidato", "run_1", { gauntletLeg: "0" });
    expect(mockNavigateTo).toHaveBeenCalledWith({
      url: "/pages/hidato/play?gauntletLeg=0&runId=run_1",
    });

    void replaceWithGamePlay("hidato", "run_1", { gauntletLeg: "0" });
    expect(mockRedirectTo).toHaveBeenCalledWith({
      url: "/pages/hidato/play?gauntletLeg=0&runId=run_1",
    });
  });

  test("redirects completed runs to result and prefers a back-stack return", async () => {
    void goToGameResult("hidato", "run_1");
    expect(mockRedirectTo).toHaveBeenCalledWith({ url: "/pages/hidato/result?runId=run_1" });

    await goBackToGameStart("hidato");
    expect(mockNavigateBack).toHaveBeenCalledTimes(1);
  });

  test("suppresses the invalid-run fallback after completion has started", () => {
    expect(shouldRedirectInvalidGameRun("run_1", "settled")).toBe(true);
    expect(shouldRedirectInvalidGameRun("run_1", "settled", true)).toBe(false);
    expect(shouldRedirectInvalidGameRun("run_1", "active", false)).toBe(false);
    expect(shouldRedirectInvalidGameRun("", "active", true)).toBe(true);
  });

  test("falls back to the existing game start when the result has no back stack", async () => {
    mockNavigateBack.mockRejectedValueOnce(new Error("no page stack"));

    await goBackToGameStart("hidato");

    expect(mockRedirectTo).toHaveBeenCalledWith({ url: "/pages/hidato/index" });
  });
});
