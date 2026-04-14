import Taro from "@tarojs/taro";
import type { CloudSyncMeta } from "../types";

const CLOUD_SYNC_META_KEY = "cloud_sync_meta_v1";

function createDefaultCloudSyncMeta(): CloudSyncMeta {
  return {
    openid: null,
    lastCloudSyncAt: null,
    lastCloudSyncAttemptAt: null,
    lastLocalChangeAt: null,
    lastSyncedSnapshotHash: null,
    cloudEnabled: false,
    restoreAttempted: false,
    lastSyncStatus: "idle",
    lastSyncError: null,
  };
}

export function readCloudSyncMeta(): CloudSyncMeta {
  const raw = Taro.getStorageSync(CLOUD_SYNC_META_KEY);
  if (!raw) {
    return createDefaultCloudSyncMeta();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...createDefaultCloudSyncMeta(),
      ...parsed,
    };
  } catch {
    return createDefaultCloudSyncMeta();
  }
}

export function saveCloudSyncMeta(partial: Partial<CloudSyncMeta>): CloudSyncMeta {
  const nextMeta = {
    ...readCloudSyncMeta(),
    ...partial,
  };
  Taro.setStorageSync(CLOUD_SYNC_META_KEY, JSON.stringify(nextMeta));
  return nextMeta;
}

export function markLocalDataChanged(): CloudSyncMeta {
  return saveCloudSyncMeta({
    lastLocalChangeAt: new Date().toISOString(),
    lastSyncStatus: "idle",
    lastSyncError: null,
  });
}

export function resetCloudSyncMeta(): void {
  Taro.removeStorageSync(CLOUD_SYNC_META_KEY);
}
