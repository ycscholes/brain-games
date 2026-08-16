const mockStorage = new Map<string, string>();

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    eventCenter: {
      trigger: jest.fn(),
    },
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) ?? ""),
    setStorageSync: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeStorageSync: jest.fn((key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

import {
  claimStickerReward,
  readStickerRewardLedger,
  STICKER_REWARD_DAILY_LIMIT,
  STICKER_REWARD_POINTS,
} from "../../src/utils/stickerRewards";
import { readPetData } from "../../src/utils/petStorage";

describe("sticker rewards", () => {
  const firstDay = new Date("2026-08-17T00:30:00.000Z");

  beforeEach(() => {
    mockStorage.clear();
  });

  test("rewards a real post once and remembers its postUrl", () => {
    const result = claimStickerReward({
      postUrl: "https://mp.weixin.qq.com/s/first-post",
      now: firstDay,
    });

    expect(result).toEqual({
      awardedPoints: STICKER_REWARD_POINTS,
      remainingClaims: STICKER_REWARD_DAILY_LIMIT - 1,
    });
    expect(readPetData().balance).toBe(STICKER_REWARD_POINTS);
    expect(readStickerRewardLedger().claims).toEqual([
      expect.objectContaining({
        postUrl: "https://mp.weixin.qq.com/s/first-post",
        dayKey: "2026-08-17",
      }),
    ]);
  });

  test("rejects a duplicate post and the fourth successful post on one China day", () => {
    expect(claimStickerReward({ postUrl: "https://mp.weixin.qq.com/s/a", now: firstDay }).awardedPoints).toBe(30);
    expect(claimStickerReward({ postUrl: "https://mp.weixin.qq.com/s/a", now: firstDay })).toEqual({
      awardedPoints: 0,
      reason: "duplicate",
    });
    expect(claimStickerReward({ postUrl: "https://mp.weixin.qq.com/s/b", now: firstDay }).awardedPoints).toBe(30);
    expect(claimStickerReward({ postUrl: "https://mp.weixin.qq.com/s/c", now: firstDay }).awardedPoints).toBe(30);
    expect(claimStickerReward({ postUrl: "https://mp.weixin.qq.com/s/d", now: firstDay })).toEqual({
      awardedPoints: 0,
      reason: "daily-limit",
    });
    expect(readPetData().balance).toBe(90);
  });

  test("restores the daily allowance on the next China day", () => {
    claimStickerReward({ postUrl: "https://mp.weixin.qq.com/s/a", now: firstDay });
    claimStickerReward({ postUrl: "https://mp.weixin.qq.com/s/b", now: firstDay });
    claimStickerReward({ postUrl: "https://mp.weixin.qq.com/s/c", now: firstDay });

    const result = claimStickerReward({
      postUrl: "https://mp.weixin.qq.com/s/d",
      now: new Date("2026-08-17T16:30:00.000Z"),
    });

    expect(result).toEqual({ awardedPoints: 30, remainingClaims: 2 });
  });
});
