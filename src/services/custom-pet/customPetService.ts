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
const SOURCE_MAX_BYTES = 4 * 1024 * 1024;
const SOURCE_COMPRESS_SIZE = 1280;
const SOURCE_COMPRESS_ATTEMPTS = [
  { quality: 70, size: SOURCE_COMPRESS_SIZE },
  { quality: 55, size: 1024 },
  { quality: 40, size: 960 },
];
const MOODS: PetSpriteMood[] = ["idle", "feed", "cuddle", "hungry"];

type CachedMoodUrls = {
  expiresAt: number;
  urls: CustomPetMoodUrls;
};

type UrlCache = Record<string, CachedMoodUrls>;
type ImageFileResult = {
  filePath?: string;
  path?: string;
  tempFilePath?: string;
  tempFilePaths?: string[];
};

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

function getReadableErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error && typeof error === "object") {
    const value = error as { errMsg?: unknown; message?: unknown };
    const message = typeof value.errMsg === "string" && value.errMsg.trim()
      ? value.errMsg
      : typeof value.message === "string" && value.message.trim()
        ? value.message
        : "";
    if (message) {
      return message;
    }
  }
  return fallback;
}

function applyServerSnapshot(value: { snapshot?: { petData?: Parameters<typeof savePetData>[0] } | null }) {
  if (value.snapshot?.petData) {
    savePetData(value.snapshot.petData, { markChanged: false });
  }
}

async function getLocalFileSize(filePath: string): Promise<number> {
  const info = await Taro.getFileInfo({ filePath });
  return "size" in info ? Number(info.size || 0) : 0;
}

async function tryGetLocalFileSize(filePath: string): Promise<number | null> {
  try {
    return await getLocalFileSize(filePath);
  } catch {
    return null;
  }
}

function resolveImageFilePath(result: ImageFileResult): string {
  return result.tempFilePath
    || result.filePath
    || result.path
    || result.tempFilePaths?.[0]
    || "";
}

async function prepareUploadImage(filePath: string, maxBytes: number): Promise<string> {
  let sourcePath = filePath;
  try {
    const cropped = await Taro.cropImage({
      src: filePath,
      cropScale: "1:1",
    });
    const croppedPath = resolveImageFilePath(cropped);
    if (croppedPath) {
      sourcePath = croppedPath;
    }
  } catch {
    // Some WeChat environments reject cropImage after chooseMedia; compression can still proceed.
  }

  let lastSizedPath = sourcePath;
  let lastUnknownSizePath = "";
  for (const attempt of SOURCE_COMPRESS_ATTEMPTS) {
    try {
      const compressed = await Taro.compressImage({
        src: lastSizedPath,
        quality: attempt.quality,
        compressedWidth: attempt.size,
        compressedHeight: attempt.size,
      });
      const compressedPath = resolveImageFilePath(compressed);
      const candidatePath = compressedPath || lastSizedPath;
      const size = await tryGetLocalFileSize(candidatePath);
      if (size === null) {
        // Some runtimes return http://tmp paths that uploadFile can consume but getFileInfo cannot stat.
        // Keep the candidate for upload, but continue compressing from the last path whose size is known.
        lastUnknownSizePath = candidatePath;
        continue;
      }
      lastSizedPath = candidatePath;
      if (size > 0 && size <= maxBytes) {
        return candidatePath;
      }
    } catch (error) {
      const sourceSize = await tryGetLocalFileSize(lastSizedPath);
      if (sourceSize !== null && sourceSize > 0 && sourceSize <= maxBytes) {
        return lastSizedPath;
      }
      if (attempt === SOURCE_COMPRESS_ATTEMPTS[SOURCE_COMPRESS_ATTEMPTS.length - 1]) {
        throw new Error(`图片压缩失败：${getReadableErrorMessage(error, "请换一张更小的图片")}`);
      }
    }
  }

  if (lastUnknownSizePath) {
    return lastUnknownSizePath;
  }

  throw new Error("图片处理后仍超过 4MB，请换一张更小的图片");
}

export async function getCustomPetStatus(): Promise<{
  task: CustomPetTask | null;
  generationUsed: boolean;
  generationCount: number;
  maxGenerations: number;
}> {
  return callCustomPetApi<{
    task: CustomPetTask | null;
    generationUsed: boolean;
    generationCount: number;
    maxGenerations: number;
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
  const uploadFilePath = await prepareUploadImage(file.tempFilePath, intent.maxBytes || SOURCE_MAX_BYTES);
  const cloud = await ensureCloudReady();
  if (!cloud) {
    throw new Error("云服务暂不可用");
  }
  let uploaded: { fileID: string };
  try {
    uploaded = await cloud.uploadFile({
      cloudPath: intent.cloudPath,
      filePath: uploadFilePath,
    });
  } catch (error) {
    throw new Error(`图片上传失败：${getReadableErrorMessage(error, "请稍后重试")}`);
  }
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
