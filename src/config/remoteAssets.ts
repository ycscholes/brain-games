import Taro from "@tarojs/taro";
import type { PetSkin } from "../pages/pet/types";
import type { PetSpriteMood } from "../pages/pet/components/PetSprite/types";
import { CLOUD_ENV_ID } from "./cloud";
import { ensureCloudReady } from "../services/user-data/cloud/cloudFunctionsClient";
import remoteAssetManifest from "../../config/remote-assets.json";

const PET_ASSET_BASE_PATH = `assets/${remoteAssetManifest.petAssetVersion}/pets`;
const AUDIO_ASSET_BASE_PATH = `assets/audio/${remoteAssetManifest.audioAssetVersion}`;
const AUDIO_ASSET_PATHS = {
  ambient: `${AUDIO_ASSET_BASE_PATH}/focus-ambient.m4a`,
  tap: `${AUDIO_ASSET_BASE_PATH}/tap.m4a`,
  correct: `${AUDIO_ASSET_BASE_PATH}/correct.m4a`,
  wrong: `${AUDIO_ASSET_BASE_PATH}/wrong.m4a`,
  complete: `${AUDIO_ASSET_BASE_PATH}/complete.m4a`,
} as const;
const PET_SPRITE_PATHS: Record<PetSkin, Record<PetSpriteMood, string>> = {
  cat: {
    idle: `${PET_ASSET_BASE_PATH}/cat-idle.png`,
    feed: `${PET_ASSET_BASE_PATH}/cat-feed.png`,
    cuddle: `${PET_ASSET_BASE_PATH}/cat-cuddle.png`,
    hungry: `${PET_ASSET_BASE_PATH}/cat-hungry.png`,
  },
  dog: {
    idle: `${PET_ASSET_BASE_PATH}/dog-idle.png`,
    feed: `${PET_ASSET_BASE_PATH}/dog-feed.png`,
    cuddle: `${PET_ASSET_BASE_PATH}/dog-cuddle.png`,
    hungry: `${PET_ASSET_BASE_PATH}/dog-hungry.png`,
  },
  rabbit: {
    idle: `${PET_ASSET_BASE_PATH}/rabbit-idle.png`,
    feed: `${PET_ASSET_BASE_PATH}/rabbit-feed.png`,
    cuddle: `${PET_ASSET_BASE_PATH}/rabbit-cuddle.png`,
    hungry: `${PET_ASSET_BASE_PATH}/rabbit-hungry.png`,
  },
  bear: {
    idle: `${PET_ASSET_BASE_PATH}/bear-idle.png`,
    feed: `${PET_ASSET_BASE_PATH}/bear-feed.png`,
    cuddle: `${PET_ASSET_BASE_PATH}/bear-cuddle.png`,
    hungry: `${PET_ASSET_BASE_PATH}/bear-hungry.png`,
  },
  panda: {
    idle: `${PET_ASSET_BASE_PATH}/panda-idle.png`,
    feed: `${PET_ASSET_BASE_PATH}/panda-feed.png`,
    cuddle: `${PET_ASSET_BASE_PATH}/panda-cuddle.png`,
    hungry: `${PET_ASSET_BASE_PATH}/panda-hungry.png`,
  },
  gecko: {
    idle: `${PET_ASSET_BASE_PATH}/gecko-idle.png`,
    feed: `${PET_ASSET_BASE_PATH}/gecko-feed.png`,
    cuddle: `${PET_ASSET_BASE_PATH}/gecko-cuddle.png`,
    hungry: `${PET_ASSET_BASE_PATH}/gecko-hungry.png`,
  },
  turtle: {
    idle: `${PET_ASSET_BASE_PATH}/turtle-idle.png`,
    feed: `${PET_ASSET_BASE_PATH}/turtle-feed.png`,
    cuddle: `${PET_ASSET_BASE_PATH}/turtle-cuddle.png`,
    hungry: `${PET_ASSET_BASE_PATH}/turtle-hungry.png`,
  },
};

const FOOD_ICON_PATHS: Partial<Record<string, string>> = {
  apple: `${PET_ASSET_BASE_PATH}/food-apple.png`,
  berry: `${PET_ASSET_BASE_PATH}/food-berry.png`,
  carrot: `${PET_ASSET_BASE_PATH}/food-carrot.png`,
  fish: `${PET_ASSET_BASE_PATH}/food-fish.png`,
  meat: `${PET_ASSET_BASE_PATH}/food-meat.png`,
  greens: `${PET_ASSET_BASE_PATH}/food-greens.png`,
  pumpkin: `${PET_ASSET_BASE_PATH}/food-pumpkin.png`,
  biscuit: `${PET_ASSET_BASE_PATH}/food-biscuit.png`,
  salmon: `${PET_ASSET_BASE_PATH}/food-salmon.png`,
  "beef-bone": `${PET_ASSET_BASE_PATH}/food-beef-bone.png`,
  "strawberry-basket": `${PET_ASSET_BASE_PATH}/food-strawberry-basket.png`,
  "honey-jar": `${PET_ASSET_BASE_PATH}/food-honey-jar.png`,
  "bamboo-rice": `${PET_ASSET_BASE_PATH}/food-bamboo-rice.png`,
  "cricket-cup": `${PET_ASSET_BASE_PATH}/food-cricket-cup.png`,
  "shrimp-greens": `${PET_ASSET_BASE_PATH}/food-shrimp-greens.png`,
};

type CachedRemoteAsset = {
  expiresAt?: number;
  permanent: boolean;
  url: string;
};

type RemoteAssetCache = {
  version: 4;
  assets: Record<string, CachedRemoteAsset>;
};

type ResolveCloudFileUrlOptions = {
  forceRefresh?: boolean;
};

type ResolvedCloudFile = {
  maxAge?: number;
  tempFileURL?: string;
};

type CloudFileUrlRequest = {
  fileID: string;
  maxAge: number;
};

export type PetSpriteRemoteAsset = {
  skin: PetSkin;
  mood: PetSpriteMood;
};

export type AudioAssetId = keyof typeof AUDIO_ASSET_PATHS;

export type RemoteAssetPreloadResult = {
  loaded: number;
  total: number;
  failed: number;
};

export type RemoteAssetPreloadProgress = RemoteAssetPreloadResult & {
  current?: string;
};

const REMOTE_ASSET_CACHE_KEY = "remote_asset_url_cache_v4";
const TEMP_URL_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const TEMP_URL_EXPIRY_BUFFER_MS = 60 * 1000;
const SIGNED_URL_QUERY_PATTERN = /[?&](?:q-sign-[^=&]+|x-cos-security-token|sign|token)=/i;
const SIGNED_URL_TIME_PATTERN = /[?&](?:q-sign-time|q-key-time)=([^&]+)/i;
const memoryAssetCache = new Map<string, CachedRemoteAsset>();
const refreshPromiseCache = new Map<string, Promise<string>>();
const CLOUD_STORAGE_BUCKET =
  typeof __CLOUD_STORAGE_BUCKET__ !== "undefined"
    ? __CLOUD_STORAGE_BUCKET__
    : process.env.TARO_CLOUD_STORAGE_BUCKET || "";
const REMOTE_ASSETS_PUBLIC =
  typeof __REMOTE_ASSETS_PUBLIC__ !== "undefined"
    ? __REMOTE_ASSETS_PUBLIC__
    : process.env.TARO_REMOTE_ASSETS_PUBLIC === "true";

function toCloudFileId(path: string): string {
  if (!CLOUD_ENV_ID || !CLOUD_STORAGE_BUCKET) {
    return "";
  }

  return `cloud://${CLOUD_ENV_ID}.${CLOUD_STORAGE_BUCKET}/${path}`;
}

function createEmptyCache(): RemoteAssetCache {
  return {
    version: 4,
    assets: {},
  };
}

function parseRemoteAssetCache(raw: unknown): RemoteAssetCache {
  if (typeof raw !== "string" || !raw) {
    return createEmptyCache();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RemoteAssetCache>;
    if (parsed.version !== 4 || !parsed.assets || typeof parsed.assets !== "object") {
      return createEmptyCache();
    }

    return {
      version: 4,
      assets: parsed.assets,
    };
  } catch {
    return createEmptyCache();
  }
}

function readRemoteAssetCache(): RemoteAssetCache {
  try {
    return parseRemoteAssetCache(Taro.getStorageSync(REMOTE_ASSET_CACHE_KEY));
  } catch {
    return createEmptyCache();
  }
}

function writeRemoteAssetCache(fileID: string, asset: CachedRemoteAsset): void {
  try {
    const cache = readRemoteAssetCache();
    cache.assets[fileID] = asset;
    Taro.setStorageSync(REMOTE_ASSET_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage failures should not prevent the remote image from rendering.
  }
}

function getCachedCloudFileUrl(fileID: string): CachedRemoteAsset | null {
  const memoryAsset = memoryAssetCache.get(fileID);
  if (memoryAsset && (memoryAsset.permanent || (memoryAsset.expiresAt || 0) > Date.now())) {
    return memoryAsset;
  }

  const cached = readRemoteAssetCache().assets[fileID];
  const isValid = cached?.url && (cached.permanent || (cached.expiresAt || 0) > Date.now());
  if (!isValid) {
    memoryAssetCache.delete(fileID);
    return null;
  }

  memoryAssetCache.set(fileID, cached);
  return cached;
}

function getCachedCloudFileUrlByPath(path: string): string {
  const fileID = toCloudFileId(path);
  if (!fileID) {
    return "";
  }

  return getCachedCloudFileUrl(fileID)?.url || "";
}

function getSignedUrlExpiresAt(url: string): number | null {
  const match = url.match(SIGNED_URL_TIME_PATTERN);
  if (!match?.[1]) {
    return null;
  }

  try {
    const endTimeSeconds = Number(decodeURIComponent(match[1]).split(";")[1]);
    return Number.isFinite(endTimeSeconds) && endTimeSeconds > 0 ? endTimeSeconds * 1000 : null;
  } catch {
    return null;
  }
}

function getTempUrlExpiresAt(url: string, maxAge: unknown): number {
  const reportedMaxAgeSeconds =
    typeof maxAge === "number" && maxAge > 0 ? maxAge : TEMP_URL_MAX_AGE_SECONDS;
  const reportedExpiresAt = Date.now() + reportedMaxAgeSeconds * 1000;
  const signedExpiresAt = getSignedUrlExpiresAt(url);
  const expiresAt = signedExpiresAt ? Math.min(signedExpiresAt, reportedExpiresAt) : reportedExpiresAt;

  return Math.max(Date.now(), expiresAt - TEMP_URL_EXPIRY_BUFFER_MS);
}

function createCachedRemoteAsset(url: string, maxAge: unknown): CachedRemoteAsset {
  const permanent = REMOTE_ASSETS_PUBLIC && !SIGNED_URL_QUERY_PATTERN.test(url);
  if (permanent) {
    return {
      permanent: true,
      url,
    };
  }

  return {
    expiresAt: getTempUrlExpiresAt(url, maxAge),
    permanent: false,
    url,
  };
}

async function refreshCloudFileUrl(fileID: string): Promise<string> {
  const cachedRefresh = refreshPromiseCache.get(fileID);
  if (cachedRefresh) {
    return cachedRefresh;
  }

  const refreshPromise = (async () => {
    const cloud = await ensureCloudReady();
    if (!cloud?.getTempFileURL) {
      return "";
    }

    const fileRequest: CloudFileUrlRequest = {
      fileID,
      maxAge: TEMP_URL_MAX_AGE_SECONDS,
    };
    const result = await cloud.getTempFileURL({
      // WeChat supports object entries with maxAge, but the bundled Taro type still declares string[].
      fileList: [fileRequest] as unknown as string[],
    });
    const resolvedFile = result.fileList?.[0] as ResolvedCloudFile | undefined;
    const tempFileURL = resolvedFile?.tempFileURL || "";

    if (tempFileURL) {
      const cachedAsset = createCachedRemoteAsset(tempFileURL, resolvedFile?.maxAge);
      memoryAssetCache.set(fileID, cachedAsset);
      writeRemoteAssetCache(fileID, cachedAsset);
    }

    return tempFileURL;
  })();

  refreshPromiseCache.set(fileID, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    refreshPromiseCache.delete(fileID);
  }
}

async function resolveCloudFileUrl(path: string, options?: ResolveCloudFileUrlOptions): Promise<string> {
  try {
    const fileID = toCloudFileId(path);
    if (!fileID) {
      return "";
    }

    if (options?.forceRefresh) {
      return refreshCloudFileUrl(fileID);
    }

    const cached = getCachedCloudFileUrl(fileID);
    if (cached?.url) {
      return cached.url;
    }

    return refreshCloudFileUrl(fileID);
  } catch {
    return "";
  }
}

export async function resolvePetSpriteUrl(
  skin: PetSkin,
  mood: PetSpriteMood,
  options?: ResolveCloudFileUrlOptions,
): Promise<string> {
  return resolveCloudFileUrl(PET_SPRITE_PATHS[skin][mood], options);
}

export async function resolveAudioAssetUrl(
  assetId: AudioAssetId,
  options?: ResolveCloudFileUrlOptions,
): Promise<string> {
  return resolveCloudFileUrl(AUDIO_ASSET_PATHS[assetId], options);
}

export function resolveCachedPetSpriteUrl(skin: PetSkin, mood: PetSpriteMood): string {
  return getCachedCloudFileUrlByPath(PET_SPRITE_PATHS[skin][mood]);
}

export function resolveCachedFoodIconUrl(foodId: string): string {
  const path = FOOD_ICON_PATHS[foodId];
  if (!path) {
    return "";
  }

  return getCachedCloudFileUrlByPath(path);
}

export async function resolveFoodIconUrl(
  foodId: string,
  options?: ResolveCloudFileUrlOptions,
): Promise<string> {
  const path = FOOD_ICON_PATHS[foodId];
  if (!path) {
    return "";
  }

  return resolveCloudFileUrl(path, options);
}

export function getAllPetSpriteRemoteAssets(): PetSpriteRemoteAsset[] {
  return (Object.keys(PET_SPRITE_PATHS) as PetSkin[]).flatMap((skin) =>
    (Object.keys(PET_SPRITE_PATHS[skin]) as PetSpriteMood[]).map((mood) => ({ skin, mood })),
  );
}

export function getAllFoodIconIds(): string[] {
  return Object.keys(FOOD_ICON_PATHS);
}

export async function resolveAllRemoteAssetUrls(
  onProgress?: (progress: RemoteAssetPreloadProgress) => void,
): Promise<string[]> {
  const petAssets = getAllPetSpriteRemoteAssets().map((asset) => ({
    id: `pet:${asset.skin}:${asset.mood}`,
    resolve: () => resolvePetSpriteUrl(asset.skin, asset.mood),
  }));
  const foodAssets = getAllFoodIconIds().map((foodId) => ({
    id: `food:${foodId}`,
    resolve: () => resolveFoodIconUrl(foodId),
  }));
  const assets = [...petAssets, ...foodAssets];
  const urls: string[] = [];
  let loaded = 0;
  let failed = 0;

  onProgress?.({ loaded, total: assets.length, failed });

  await Promise.all(
    assets.map(async (asset) => {
      try {
        const url = await asset.resolve();
        if (url) {
          urls.push(url);
        }
      } catch {
        failed += 1;
      } finally {
        loaded += 1;
        onProgress?.({ loaded, total: assets.length, failed, current: asset.id });
      }
    }),
  );

  return urls;
}
