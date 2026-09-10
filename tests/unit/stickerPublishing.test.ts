const mockStorage = new Map<string, string>();
const shareToOfficialAccount = jest.fn();
let mockPlatform: string | undefined;

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    eventCenter: { trigger: jest.fn() },
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) ?? ""),
    setStorageSync: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    getSystemInfoSync: jest.fn(() => ({ platform: mockPlatform })),
    getDeviceInfo: jest.fn(() => ({ platform: mockPlatform })),
  },
}));

import Taro from "@tarojs/taro";
import {
  canShareCompletedGameResult,
  createStickerPublishPayload,
  getOfficialAccountPublishFeedProps,
  isOfficialAccountPublishFeedSupported,
  isOfficialAccountStickerPlatformSupported,
  publishGameResultSticker,
} from "../../src/utils/stickerPublishing";
import { readPetData } from "../../src/utils/petStorage";
import fs from "node:fs";
import path from "node:path";

describe("sticker publishing", () => {
  const originalTaroEnv = process.env.TARO_ENV;

  beforeEach(() => {
    mockStorage.clear();
    mockPlatform = undefined;
    shareToOfficialAccount.mockReset();
    (Taro.getSystemInfoSync as jest.Mock).mockClear();
    (Taro.getDeviceInfo as jest.Mock).mockClear();
    (globalThis as { wx?: { shareToOfficialAccount: typeof shareToOfficialAccount } }).wx = {
      shareToOfficialAccount,
    };
  });

  afterEach(() => {
    process.env.TARO_ENV = originalTaroEnv;
    delete (globalThis as { wx?: unknown }).wx;
  });

  test("builds a score-specific publication payload with the game link", () => {
    expect(
      createStickerPublishPayload({
        gameTitle: "速算挑战",
        score: 18,
        pagePath: "pages/mental-math/index",
      }),
    ).toEqual({
      title: "我在速算挑战拿到 18 分",
      content: "完成一局速算挑战，来和我一起每天练一点脑力吧！",
      tags: ["Cici脑力训练打卡"],
      recommendPath: "/pages/mental-math/index",
      recommendTitle: "速算挑战 · Cici的脑部锻炼",
    });
  });

  test("includes an exported score poster when one is available", () => {
    expect(
      createStickerPublishPayload({
        gameTitle: "速算挑战",
        score: 18,
        pagePath: "pages/mental-math/index",
        imagePath: "wxfile://score-poster.png",
      }),
    ).toMatchObject({
      images: ["wxfile://score-poster.png"],
    });
  });

  test("does not invoke the native API or award points outside a mini program", () => {
    process.env.TARO_ENV = "h5";

    expect(
      publishGameResultSticker({
        gameTitle: "速算挑战",
        score: 18,
        pagePath: "pages/mental-math/index",
      }),
    ).toEqual({ status: "unsupported" });
    expect(shareToOfficialAccount).not.toHaveBeenCalled();
    expect(readPetData().balance).toBe(0);
  });

  test("does not offer official-account publishing on unsupported desktop and devtool platforms", () => {
    expect(isOfficialAccountStickerPlatformSupported("devtools")).toBe(false);
    expect(isOfficialAccountStickerPlatformSupported("windows")).toBe(false);
    expect(isOfficialAccountStickerPlatformSupported("mac")).toBe(false);
    expect(isOfficialAccountStickerPlatformSupported("harmony")).toBe(false);
    expect(isOfficialAccountStickerPlatformSupported("ios")).toBe(true);
    expect(isOfficialAccountStickerPlatformSupported("android")).toBe(true);
  });

  test("does not invoke the native API in developer tools", () => {
    process.env.TARO_ENV = "weapp";
    mockPlatform = "devtools";

    expect(
      publishGameResultSticker({
        gameTitle: "速算挑战",
        score: 18,
        pagePath: "pages/mental-math/index",
      }),
    ).toEqual({ status: "unsupported" });
    expect(shareToOfficialAccount).not.toHaveBeenCalled();
  });

  test("does not render the native feed in developer tools", () => {
    process.env.TARO_ENV = "weapp";
    mockPlatform = "devtools";

    expect(isOfficialAccountPublishFeedSupported()).toBe(false);
  });

  test("uses the non-deprecated device info API for platform detection", () => {
    process.env.TARO_ENV = "weapp";
    mockPlatform = "ios";

    expect(isOfficialAccountPublishFeedSupported()).toBe(true);
    expect(Taro.getDeviceInfo).toHaveBeenCalled();
    expect(Taro.getSystemInfoSync).not.toHaveBeenCalled();
  });

  test("awards only after the native success callback has a postUrl", () => {
    process.env.TARO_ENV = "weapp";
    const onResult = jest.fn();

    expect(
      publishGameResultSticker({
        gameTitle: "速算挑战",
        score: 18,
        pagePath: "pages/mental-math/index",
        onResult,
      }),
    ).toEqual({ status: "opened" });
    expect(readPetData().balance).toBe(0);

    const options = shareToOfficialAccount.mock.calls[0][0] as {
      success: (result: { postUrl: string }) => void;
    };
    options.success({ postUrl: "https://mp.weixin.qq.com/s/score-post" });

    expect(onResult).toHaveBeenCalledWith({
      status: "published",
      reward: { awardedPoints: 30, remainingClaims: 2 },
    });
    expect(readPetData().balance).toBe(30);
  });

  test("treats an editor cancellation as a distinct non-error result", () => {
    process.env.TARO_ENV = "weapp";
    const onResult = jest.fn();

    publishGameResultSticker({
      gameTitle: "速算挑战",
      score: 18,
      pagePath: "pages/mental-math/index",
      onResult,
    });
    const options = shareToOfficialAccount.mock.calls[0][0] as {
      fail: (error: { errMsg?: string }) => void;
    };
    options.fail({ errMsg: "shareToOfficialAccount:fail cancel" });

    expect(onResult).toHaveBeenCalledWith({ status: "cancelled" });
    expect(readPetData().balance).toBe(0);
  });

  test("preserves an actionable native publishing failure", () => {
    process.env.TARO_ENV = "weapp";
    const onResult = jest.fn();

    publishGameResultSticker({
      gameTitle: "速算挑战",
      score: 18,
      pagePath: "pages/mental-math/index",
      onResult,
    });
    const options = shareToOfficialAccount.mock.calls[0][0] as {
      fail: (error: { errMsg?: string }) => void;
    };
    options.fail({ errMsg: "shareToOfficialAccount:fail no permission" });

    expect(onResult).toHaveBeenCalledWith({
      status: "failed",
      message: "shareToOfficialAccount:fail no permission",
    });
  });

  test("hides the result sharing action inside a gauntlet leg", () => {
    expect(canShareCompletedGameResult({ completed: true, isGauntlet: false })).toBe(true);
    expect(canShareCompletedGameResult({ completed: true, isGauntlet: true })).toBe(false);
  });

  test("renders the score share action on every ordinary game result screen", () => {
    const pageFiles = [
      "mental-math/components/MentalMathResultPanel.tsx",
      "pattern-completion/components/PatternResultPanel.tsx",
      "music-theory/components/MusicTheoryResultPanel.tsx",
      "digit-span/result.tsx",
      "twenty-four/result.tsx",
      "rock-paper-scissors/result.tsx",
      "color-trap/index.tsx",
      "spatial-rotation/index.tsx",
      "hidato/result.tsx",
      "tents-camp/result.tsx",
      "sumplete-grid/index.tsx",
      "traffic-escape/result.tsx",
      "netwalk/result.tsx",
      "loop-line/result.tsx",
      "number-order/index.tsx",
      "memory-challenge/components/MemoryChallengeResultPanel.tsx",
      "multiple-object-tracking/index.tsx",
      "word-scramble/index.tsx",
      "bird-count/components/FarmCountResult.tsx",
    ];

    for (const pageFile of pageFiles) {
      const source = fs.readFileSync(path.resolve(__dirname, "../../src/pages", pageFile), "utf8");
      expect(source).toContain("StickerShareButton");
      expect(source).toContain("<StickerShareButton");
    }
  });

  test("generates a score poster before opening the native publishing page", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../src/components/stickers/StickerShareButton.tsx"),
      "utf8",
    );

    expect(source).toContain("StickerScorePoster");
    expect(source).toContain("exportStickerScorePoster");
    expect(source).toContain("useEffect");
    expect(source).not.toContain("await exportStickerScorePoster");
  });

  test("uses one configured topic and homepage return link for the native feed", () => {
    expect(getOfficialAccountPublishFeedProps()).toEqual({
      topic: "Cici脑力训练打卡",
      limit: 4,
      placeholder: "晒出你的第一局训练吧",
      recommendPath: "/pages/index/index",
      recommendTitle: "Cici的脑部锻炼：每天练一点",
    });
  });

  test("awards a published post even when the caller does not subscribe to status", () => {
    process.env.TARO_ENV = "weapp";

    publishGameResultSticker({
      gameTitle: "24 点",
      score: 20,
      pagePath: "pages/twenty-four/index",
    });
    const options = shareToOfficialAccount.mock.calls[0][0] as {
      success: (result: { postUrl: string }) => void;
    };
    options.success({ postUrl: "https://mp.weixin.qq.com/s/no-listener" });

    expect(readPetData().balance).toBe(30);
  });
});
