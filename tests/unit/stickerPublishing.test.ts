const mockStorage = new Map<string, string>();
const shareToOfficialAccount = jest.fn();

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    eventCenter: { trigger: jest.fn() },
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) ?? ""),
    setStorageSync: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
  },
}));

import {
  canShareCompletedGameResult,
  createStickerPublishPayload,
  getOfficialAccountPublishFeedProps,
  publishGameResultSticker,
} from "../../src/utils/stickerPublishing";
import { readPetData } from "../../src/utils/petStorage";

describe("sticker publishing", () => {
  const originalTaroEnv = process.env.TARO_ENV;

  beforeEach(() => {
    mockStorage.clear();
    shareToOfficialAccount.mockReset();
    (globalThis as { wx?: { shareToOfficialAccount: typeof shareToOfficialAccount } }).wx = {
      shareToOfficialAccount,
    };
  });

  afterEach(() => {
    process.env.TARO_ENV = originalTaroEnv;
    delete (globalThis as { wx?: unknown }).wx;
  });

  test("builds a score-specific publication payload with the game link", () => {
    expect(createStickerPublishPayload({
      gameTitle: "速算挑战",
      score: 18,
      pagePath: "pages/mental-math/index",
    })).toEqual({
      title: "我在速算挑战拿到 18 分",
      content: "完成一局速算挑战，来和我一起每天练一点脑力吧！",
      tags: ["Cici脑力训练打卡"],
      recommendPath: "/pages/mental-math/index",
      recommendTitle: "速算挑战 · Cici的脑部锻炼",
    });
  });

  test("does not invoke the native API or award points outside a mini program", () => {
    process.env.TARO_ENV = "h5";

    expect(publishGameResultSticker({
      gameTitle: "速算挑战",
      score: 18,
      pagePath: "pages/mental-math/index",
    })).toEqual({ status: "unsupported" });
    expect(shareToOfficialAccount).not.toHaveBeenCalled();
    expect(readPetData().balance).toBe(0);
  });

  test("awards only after the native success callback has a postUrl", () => {
    process.env.TARO_ENV = "weapp";
    const onResult = jest.fn();

    expect(publishGameResultSticker({
      gameTitle: "速算挑战",
      score: 18,
      pagePath: "pages/mental-math/index",
      onResult,
    })).toEqual({ status: "opened" });
    expect(readPetData().balance).toBe(0);

    const options = shareToOfficialAccount.mock.calls[0][0] as { success: (result: { postUrl: string }) => void };
    options.success({ postUrl: "https://mp.weixin.qq.com/s/score-post" });

    expect(onResult).toHaveBeenCalledWith({
      status: "published",
      reward: { awardedPoints: 30, remainingClaims: 2 },
    });
    expect(readPetData().balance).toBe(30);
  });

  test("hides the result sharing action inside a gauntlet leg", () => {
    expect(canShareCompletedGameResult({ completed: true, isGauntlet: false })).toBe(true);
    expect(canShareCompletedGameResult({ completed: true, isGauntlet: true })).toBe(false);
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
    const options = shareToOfficialAccount.mock.calls[0][0] as { success: (result: { postUrl: string }) => void };
    options.success({ postUrl: "https://mp.weixin.qq.com/s/no-listener" });

    expect(readPetData().balance).toBe(30);
  });
});
