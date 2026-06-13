import Taro from "@tarojs/taro";
import type { PetSpriteMood } from "../../pages/pet/components/PetSprite/types";
import { savePetData } from "../../utils/petStorage";
import { ensureCloudReady } from "../user-data/cloud/cloudFunctionsClient";
import type {
  CustomPetApiResponse,
  CustomPetMoodUrls,
  CustomPetTask,
} from "./types";

const FUNCTION_NAME = "customPetApi";
const URL_CACHE_KEY = "custom_pet_url_cache_v1";
const URL_CACHE_TTL_MS = 50 * 60 * 1000;
const MOODS: PetSpriteMood[] = ["idle", "feed", "cuddle", "hungry"];

type CachedMoodUrls = {
  expiresAt: number;
  urls: CustomPetMoodUrls;
};

type UrlCache = Record<string, CachedMoodUrls>;

function readUrlCache(): UrlCache {
  try {
    const raw = Taro.getStorageSync(URL_CACHE_KEY);
    return raw ? JSON.parse(raw) as UrlCache : {};
  } catch {
    return {};
  }
}

function writeUrlCache(cache: UrlCache) {
  try {
    Taro.setStorageSync(URL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // URL cache failures should not block rendering.
  }
}

async function callCustomPetApi<T>(data: Record<string, unknown>): Promise<T> {
  const cloud = await ensureCloudReady();
  if (!cloud) {
    throw new Error("云服务暂不可用");
  }
  const result = await cloud.callFunction<CustomPetApiResponse<T>>({
    name: FUNCTION_NAME,
    data,
  });
  const response = result.result;
  if (!response?.ok || !response.data) {
    throw new Error(response?.error || "自定义宠物操作失败");
  }
  return response.data;
}

function applyServerSnapshot(value: { snapshot?: { petData?: Parameters<typeof savePetData>[0] } | null }) {
  if (value.snapshot?.petData) {
    savePetData(value.snapshot.petData, { markChanged: false });
  }
}

export async function getCustomPetStatus(): Promise<{
  task: CustomPetTask | null;
  generationUsed: boolean;
}> {
  return callCustomPetApi<{
    task: CustomPetTask | null;
    generationUsed: boolean;
  }>({
    action: "getStatus",
  });
}

export async function chooseAndSubmitCustomPet(): Promise<CustomPetTask> {
  const intent = await callCustomPetApi<{
    jobId: string;
    cloudPath: string;
    maxBytes: number;
  }>({
    action: "createUploadIntent",
  });
  const media = await Taro.chooseMedia({
    count: 1,
    mediaType: ["image"],
    sourceType: ["album", "camera"],
    sizeType: ["compressed"],
  });
  const file = media.tempFiles[0];
  if (!file?.tempFilePath) {
    throw new Error("没有选择图片");
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error("图片不能超过 4MB");
  }
  const cropped = await Taro.cropImage({
    src: file.tempFilePath,
    cropScale: "1:1",
  });
  const cloud = await ensureCloudReady();
  if (!cloud) {
    throw new Error("云服务暂不可用");
  }
  const uploaded = await cloud.uploadFile({
    cloudPath: intent.cloudPath,
    filePath: cropped.tempFilePath,
  });
  try {
    const result = await callCustomPetApi<{
      task: CustomPetTask;
      snapshot?: { petData?: Parameters<typeof savePetData>[0] } | null;
    }>({
      action: "submit",
      jobId: intent.jobId,
      sourceFileId: uploaded.fileID,
    });
    applyServerSnapshot(result);
    return result.task;
  } catch (error) {
    await cloud.deleteFile({ fileList: [uploaded.fileID] }).catch(() => null);
    throw error;
  }
}

export async function rerollCustomPet(jobId: string): Promise<CustomPetTask> {
  const result = await callCustomPetApi<{ task: CustomPetTask }>({
    action: "reroll",
    jobId,
  });
  return result.task;
}

export async function adoptCustomPet(jobId: string, name: string): Promise<string> {
  const result = await callCustomPetApi<{
    petId: string;
    snapshot?: { petData?: Parameters<typeof savePetData>[0] } | null;
  }>({
    action: "adopt",
    jobId,
    name,
  });
  applyServerSnapshot(result);
  return result.petId;
}

export async function cancelCustomPet(jobId: string): Promise<void> {
  const result = await callCustomPetApi<{
    snapshot?: { petData?: Parameters<typeof savePetData>[0] } | null;
  }>({
    action: "cancel",
    jobId,
  });
  applyServerSnapshot(result);
}

export async function deleteCustomPet(petId: string): Promise<void> {
  const result = await callCustomPetApi<{
    snapshot?: { petData?: Parameters<typeof savePetData>[0] } | null;
  }>({
    action: "delete",
    petId,
  });
  applyServerSnapshot(result);
}

export function resolveCachedCustomPetSpriteUrl(
  assetId: string,
  mood: PetSpriteMood,
): string {
  const cached = readUrlCache()[assetId];
  return cached && cached.expiresAt > Date.now() ? cached.urls[mood] || "" : "";
}

export async function resolveCustomPetSpriteUrls(
  assetId: string,
  options?: { forceRefresh?: boolean },
): Promise<CustomPetMoodUrls> {
  const cache = readUrlCache();
  const cached = cache[assetId];
  if (!options?.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.urls;
  }
  const result = await callCustomPetApi<{
    urls: Partial<Record<PetSpriteMood, { url: string; maxAge?: number }>>;
  }>({
    action: "getAssetUrls",
    assetId,
    moods: MOODS,
  });
  const urls = MOODS.reduce<CustomPetMoodUrls>((acc, mood) => {
    const value = result.urls[mood]?.url;
    if (value) {
      acc[mood] = value;
    }
    return acc;
  }, {});
  cache[assetId] = {
    expiresAt: Date.now() + URL_CACHE_TTL_MS,
    urls,
  };
  writeUrlCache(cache);
  return urls;
}

export async function resolveCustomPetSpriteUrl(
  assetId: string,
  mood: PetSpriteMood,
  options?: { forceRefresh?: boolean },
): Promise<string> {
  const urls = await resolveCustomPetSpriteUrls(assetId, options);
  return urls[mood] || "";
}
