import Taro from "@tarojs/taro";
import { claimStickerReward, type StickerRewardClaimResult } from "./stickerRewards";

export const STICKER_TOPIC = "Cici脑力训练打卡";
const UNSUPPORTED_STICKER_PLATFORMS = new Set(["devtools", "windows", "mac", "harmony", "harmonyos"]);

export interface StickerPublishInput {
  gameTitle: string;
  score: number;
  pagePath: string;
  onResult?: (result: StickerPublishResult) => void;
}

export interface StickerPublishPayload {
  title: string;
  content: string;
  tags: string[];
  recommendPath: string;
  recommendTitle: string;
}

export type StickerPublishResult =
  | { status: "opened" }
  | { status: "unsupported" }
  | { status: "cancelled" }
  | { status: "failed"; message?: string }
  | { status: "published"; reward: StickerRewardClaimResult };

function toMiniProgramPath(pagePath: string) {
  return pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
}

function getPublishFailure(error: { errMsg?: string } | undefined): StickerPublishResult {
  const message = typeof error?.errMsg === "string" ? error.errMsg : "";
  if (/cancel|cancell?ed|用户主动退出/i.test(message)) {
    return { status: "cancelled" };
  }
  return message ? { status: "failed", message } : { status: "failed" };
}

export function createStickerPublishPayload({ gameTitle, score, pagePath }: Omit<StickerPublishInput, "onResult">): StickerPublishPayload {
  return {
    title: `我在${gameTitle}拿到 ${score} 分`,
    content: `完成一局${gameTitle}，来和我一起每天练一点脑力吧！`,
    tags: [STICKER_TOPIC],
    recommendPath: toMiniProgramPath(pagePath),
    recommendTitle: `${gameTitle} · Cici的脑部锻炼`,
  };
}

export function isOfficialAccountStickerPlatformSupported(platform?: string) {
  return !platform || !UNSUPPORTED_STICKER_PLATFORMS.has(platform.toLowerCase());
}

export function isOfficialAccountStickerRuntimeSupported() {
  if (process.env.TARO_ENV !== "weapp") {
    return false;
  }

  try {
    return isOfficialAccountStickerPlatformSupported(Taro.getSystemInfoSync().platform);
  } catch {
    return true;
  }
}

export function canShareCompletedGameResult({ completed, isGauntlet }: { completed: boolean; isGauntlet: boolean }) {
  return completed && !isGauntlet;
}

export function publishGameResultSticker(input: StickerPublishInput): StickerPublishResult {
  if (!isOfficialAccountStickerRuntimeSupported() || typeof wx === "undefined" || typeof wx.shareToOfficialAccount !== "function") {
    return { status: "unsupported" };
  }

  const payload = createStickerPublishPayload(input);

  try {
    wx.shareToOfficialAccount({
      ...payload,
      success: (result) => {
        const postUrl = typeof result?.postUrl === "string" ? result.postUrl : "";
        if (!postUrl) {
          input.onResult?.({ status: "failed" });
          return;
        }

        const reward = claimStickerReward({ postUrl });
        input.onResult?.({
          status: "published",
          reward,
        });
      },
      fail: (error) => {
        input.onResult?.(getPublishFailure(error));
      },
    });
  } catch {
    return { status: "failed" };
  }

  return { status: "opened" };
}

export function getOfficialAccountPublishFeedProps() {
  return {
    topic: STICKER_TOPIC,
    limit: 4,
    placeholder: "晒出你的第一局训练吧",
    recommendPath: "/pages/index/index",
    recommendTitle: "Cici的脑部锻炼：每天练一点",
  };
}
