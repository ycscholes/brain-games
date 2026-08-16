import Taro from "@tarojs/taro";
import { addPointsToPet } from "./petStorage";

const STICKER_REWARD_STORAGE_KEY = "sticker_reward_ledger_v1";

export const STICKER_REWARD_POINTS = 30;
export const STICKER_REWARD_DAILY_LIMIT = 3;

export interface StickerRewardClaim {
  postUrl: string;
  dayKey: string;
  rewardedAt: string;
}

export interface StickerRewardLedger {
  claims: StickerRewardClaim[];
}

export interface StickerRewardClaimInput {
  postUrl: string;
  now?: Date;
}

export type StickerRewardClaimResult =
  | { awardedPoints: typeof STICKER_REWARD_POINTS; remainingClaims: number }
  | { awardedPoints: 0; reason: "duplicate" | "daily-limit" | "invalid-post" };

function getChinaDayKey(now: Date) {
  const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return chinaTime.toISOString().slice(0, 10);
}

function normalizePostUrl(postUrl: string) {
  return postUrl.trim();
}

function normalizeLedger(value: unknown): StickerRewardLedger {
  if (!value || typeof value !== "object" || !Array.isArray((value as StickerRewardLedger).claims)) {
    return { claims: [] };
  }

  return {
    claims: (value as StickerRewardLedger).claims.filter((claim) => (
      typeof claim?.postUrl === "string"
      && typeof claim?.dayKey === "string"
      && typeof claim?.rewardedAt === "string"
    )),
  };
}

export function readStickerRewardLedger(): StickerRewardLedger {
  const raw = Taro.getStorageSync(STICKER_REWARD_STORAGE_KEY);
  if (!raw) {
    return { claims: [] };
  }

  try {
    return normalizeLedger(JSON.parse(raw));
  } catch {
    return { claims: [] };
  }
}

export function saveStickerRewardLedger(ledger: StickerRewardLedger) {
  Taro.setStorageSync(STICKER_REWARD_STORAGE_KEY, JSON.stringify(normalizeLedger(ledger)));
}

export function claimStickerReward({ postUrl, now = new Date() }: StickerRewardClaimInput): StickerRewardClaimResult {
  const normalizedPostUrl = normalizePostUrl(postUrl);
  if (!normalizedPostUrl) {
    return { awardedPoints: 0, reason: "invalid-post" };
  }

  const ledger = readStickerRewardLedger();
  if (ledger.claims.some((claim) => claim.postUrl === normalizedPostUrl)) {
    return { awardedPoints: 0, reason: "duplicate" };
  }

  const dayKey = getChinaDayKey(now);
  const claimedToday = ledger.claims.filter((claim) => claim.dayKey === dayKey).length;
  if (claimedToday >= STICKER_REWARD_DAILY_LIMIT) {
    return { awardedPoints: 0, reason: "daily-limit" };
  }

  saveStickerRewardLedger({
    claims: [...ledger.claims, {
      postUrl: normalizedPostUrl,
      dayKey,
      rewardedAt: now.toISOString(),
    }],
  });
  addPointsToPet("sticker-publish", STICKER_REWARD_POINTS, "normal", {
    applyDifficultyMultiplier: false,
    maxPoints: STICKER_REWARD_POINTS,
  });

  return {
    awardedPoints: STICKER_REWARD_POINTS,
    remainingClaims: STICKER_REWARD_DAILY_LIMIT - claimedToday - 1,
  };
}
