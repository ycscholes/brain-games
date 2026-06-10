import Taro from "@tarojs/taro";
import type { PetSkin } from "../pages/pet/types";
import type { PetSpriteMood } from "../pages/pet/components/PetSprite/types";
import { CLOUD_ENV_ID } from "./cloud";
import { ensureCloudReady } from "../services/user-data/cloud/cloudFunctionsClient";

const PET_SPRITE_PATHS: Record<PetSkin, Record<PetSpriteMood, string>> = {
  cat: {
    idle: "assets/pets/cat-idle.png",
    feed: "assets/pets/cat-feed.png",
    cuddle: "assets/pets/cat-cuddle.png",
    hungry: "assets/pets/cat-hungry.png",
  },
  dog: {
    idle: "assets/pets/dog-idle.png",
    feed: "assets/pets/dog-feed.png",
    cuddle: "assets/pets/dog-cuddle.png",
    hungry: "assets/pets/dog-hungry.png",
  },
  rabbit: {
    idle: "assets/pets/rabbit-idle.png",
    feed: "assets/pets/rabbit-feed.png",
    cuddle: "assets/pets/rabbit-cuddle.png",
    hungry: "assets/pets/rabbit-hungry.png",
  },
  bear: {
    idle: "assets/pets/bear-idle.png",
    feed: "assets/pets/bear-feed.png",
    cuddle: "assets/pets/bear-cuddle.png",
    hungry: "assets/pets/bear-hungry.png",
  },
  panda: {
    idle: "assets/pets/panda-idle.png",
    feed: "assets/pets/panda-feed.png",
    cuddle: "assets/pets/panda-cuddle.png",
    hungry: "assets/pets/panda-hungry.png",
  },
  gecko: {
    idle: "assets/pets/gecko-idle.png",
    feed: "assets/pets/gecko-feed.png",
    cuddle: "assets/pets/gecko-cuddle.png",
    hungry: "assets/pets/gecko-hungry.png",
  },
  turtle: {
    idle: "assets/pets/turtle-idle.png",
    feed: "assets/pets/turtle-feed.png",
    cuddle: "assets/pets/turtle-cuddle.png",
    hungry: "assets/pets/turtle-hungry.png",
  },
};

const FOOD_ICON_PATHS: Partial<Record<string, string>> = {
  apple: "assets/pets/food-apple.png",
  berry: "assets/pets/food-berry.png",
  carrot: "assets/pets/food-carrot.png",
  fish: "assets/pets/food-fish.png",
  meat: "assets/pets/food-meat.png",
  greens: "assets/pets/food-greens.png",
  pumpkin: "assets/pets/food-pumpkin.png",
  biscuit: "assets/pets/food-biscuit.png",
  salmon: "assets/pets/food-salmon.png",
  "beef-bone": "assets/pets/food-beef-bone.png",
  "strawberry-basket": "assets/pets/food-strawberry-basket.png",
  "honey-jar": "assets/pets/food-honey-jar.png",
  "bamboo-rice": "assets/pets/food-bamboo-rice.png",
  "cricket-cup": "assets/pets/food-cricket-cup.png",
  "shrimp-greens": "assets/pets/food-shrimp-greens.png",
};

type CachedRemoteAsset = {
  expiresAt: number;
  url: string;
};

type RemoteAssetCache = {
  version: 2;
  assets: Record<string, CachedRemoteAsset>;
};

type ResolveCloudFileUrlOptions = {
  forceRefresh?: boolean;
};

type ResolvedCloudFile = {
  maxAge?: number;
  tempFileURL?: string;
};

export type PetSpriteRemoteAsset = {
  skin: PetSkin;
  mood: PetSpriteMood;
};

export type RemoteAssetPreloadResult = {
  loaded: number;
  total: number;
  failed: number;
};

export type RemoteAssetPreloadProgress = RemoteAssetPreloadResult & {
  current?: string;
};

const REMOTE_ASSET_CACHE_KEY = "remote_asset_url_cache_v2";
const DEFAULT_TEMP_URL_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const TEMP_URL_EXPIRY_BUFFER_MS = 60 * 1000;
const tempFileUrlCache = new Map<string, string>();
const tempFileUrlExpiryCache = new Map<string, number>();
const refreshPromiseCache = new Map<string, Promise<string>>();
const CLOUD_STORAGE_BUCKET =
  typeof __CLOUD_STORAGE_BUCKET__ !== "undefined"
    ? __CLOUD_STORAGE_BUCKET__
    : process.env.TARO_CLOUD_STORAGE_BUCKET || "";

function toCloudFileId(path: string): string {
  if (!CLOUD_ENV_ID || !CLOUD_STORAGE_BUCKET) {
    return "";
  }

  return `cloud://${CLOUD_ENV_ID}.${CLOUD_STORAGE_BUCKET}/${path}`;
}

function createEmptyCache(): RemoteAssetCache {
  return {
    version: 2,
    assets: {},
  };
}

function parseRemoteAssetCache(raw: unknown): RemoteAssetCache {
  if (typeof raw !== "string" || !raw) {
    return createEmptyCache();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RemoteAssetCache>;
    if (parsed.version !== 2 || !parsed.assets || typeof parsed.assets !== "object") {
      return createEmptyCache();
    }

    return {
      version: 2,
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

function writeRemoteAssetCache(fileID: string, url: string, expiresAt: number): void {
  try {
    const cache = readRemoteAssetCache();
    cache.assets[fileID] = {
      expiresAt,
      url,
    };
    Taro.setStorageSync(REMOTE_ASSET_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage failures should not prevent the remote image from rendering.
  }
}

function getCachedCloudFileUrl(fileID: string): CachedRemoteAsset | null {
  const memoryUrl = tempFileUrlCache.get(fileID);
  const memoryExpiresAt = tempFileUrlExpiryCache.get(fileID);
  if (memoryUrl && memoryExpiresAt && memoryExpiresAt > Date.now()) {
    return {
      expiresAt: memoryExpiresAt,
      url: memoryUrl,
    };
  }

  const cached = readRemoteAssetCache().assets[fileID];
  if (!cached?.url || !cached.expiresAt || cached.expiresAt <= Date.now()) {
    tempFileUrlCache.delete(fileID);
    tempFileUrlExpiryCache.delete(fileID);
    return null;
  }

  tempFileUrlCache.set(fileID, cached.url);
  tempFileUrlExpiryCache.set(fileID, cached.expiresAt);
  return cached;
}

function getCachedCloudFileUrlByPath(path: string): string {
  const fileID = toCloudFileId(path);
  if (!fileID) {
    return "";
  }

  return getCachedCloudFileUrl(fileID)?.url || "";
}

function getTempUrlExpiresAt(maxAge: unknown): number {
  const reportedMaxAge = typeof maxAge === "number" && maxAge > 0 ? maxAge : DEFAULT_TEMP_URL_MAX_AGE_MS;
  const usableMaxAge = Math.max(0, reportedMaxAge - TEMP_URL_EXPIRY_BUFFER_MS);
  return Date.now() + usableMaxAge;
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

    const result = await cloud.getTempFileURL({
      fileList: [fileID],
    });
    const resolvedFile = result.fileList?.[0] as ResolvedCloudFile | undefined;
    const tempFileURL = resolvedFile?.tempFileURL || "";

    if (tempFileURL) {
      const expiresAt = getTempUrlExpiresAt(resolvedFile?.maxAge);
      tempFileUrlCache.set(fileID, tempFileURL);
      tempFileUrlExpiryCache.set(fileID, expiresAt);
      writeRemoteAssetCache(fileID, tempFileURL, expiresAt);
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
