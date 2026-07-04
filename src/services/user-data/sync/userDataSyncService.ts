import { CLOUD_ENV_ID } from "../../../config/cloud";
import { userDataCloudRepository } from "../cloud/userDataCloudRepository";
import { registerUserDataChangeHandler } from "../local/changeNotifier";
import { userDataLocalRepository } from "../local/userDataLocalRepository";
import {
  emitCloudSyncStatusChangedEvent,
  emitUserDataChangedEvent,
} from "../local/userDataEvents";
import type { CloudSyncMeta } from "../types";

const CLOUD_SYNC_DEBOUNCE_MS = 1500;

let pendingSyncTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight = false;
let syncQueuedWhileInFlight = false;
let initializePromise: Promise<void> | null = null;
let activeSyncPromise: Promise<void> | null = null;

export function getCloudSyncStatusText(meta: CloudSyncMeta): string {
  if (meta.lastSyncError === "missing cloud env id") return "云备份未启用：缺少云环境配置";
  if (!meta.cloudEnabled) return "云备份未启用";
  if (meta.lastSyncStatus === "syncing") return "云端备份同步中";
  if (meta.lastSyncStatus === "error") return meta.lastSyncError ? `云端备份失败：${meta.lastSyncError}` : "云端备份失败";
  if (meta.lastCloudSyncAt) return `最近云备份：${meta.lastCloudSyncAt}`;
  return "云端备份已启用";
}

async function uploadSnapshot(reason: "startup" | "change") {
  if (syncInFlight) {
    if (reason === "change") {
      syncQueuedWhileInFlight = true;
    }
    return activeSyncPromise || undefined;
  }

  activeSyncPromise = uploadSnapshotOnce(reason);
  await activeSyncPromise;
}

async function uploadSnapshotOnce(reason: "startup" | "change") {
  const meta = userDataLocalRepository.readCloudSyncMeta();
  if (!meta.openid) {
    return;
  }

  syncInFlight = true;
  userDataLocalRepository.saveCloudSyncMeta({
    cloudEnabled: true,
    lastCloudSyncAttemptAt: new Date().toISOString(),
    lastSyncStatus: "syncing",
    lastSyncError: null,
  });
  emitCloudSyncStatusChangedEvent();

  try {
    const snapshot = userDataLocalRepository.buildSnapshot(meta.openid);
    const snapshotHash = userDataLocalRepository.createSnapshotHashFromCloudSnapshot(snapshot);

    if (reason === "change" && snapshotHash === meta.lastSyncedSnapshotHash) {
      userDataLocalRepository.saveCloudSyncMeta({
        lastSyncStatus: "success",
      });
      emitCloudSyncStatusChangedEvent();
      return;
    }

    const updatedAt = await userDataCloudRepository.pushSnapshot(snapshot);
    userDataLocalRepository.saveCloudSyncMeta({
      cloudEnabled: true,
      lastCloudSyncAt: updatedAt,
      lastSyncedSnapshotHash: snapshotHash,
      lastSyncStatus: "success",
      lastSyncError: null,
    });
    emitCloudSyncStatusChangedEvent();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown sync error";
    userDataLocalRepository.saveCloudSyncMeta({
      lastSyncStatus: "error",
      lastSyncError: message,
    });
    emitCloudSyncStatusChangedEvent();
  } finally {
    syncInFlight = false;
    activeSyncPromise = null;
    if (syncQueuedWhileInFlight) {
      syncQueuedWhileInFlight = false;
      scheduleCloudBackup();
    }
  }
}

function scheduleCloudBackup() {
  if (pendingSyncTimer) {
    clearTimeout(pendingSyncTimer);
  }

  pendingSyncTimer = setTimeout(() => {
    pendingSyncTimer = null;
    void uploadSnapshot("change");
  }, CLOUD_SYNC_DEBOUNCE_MS);
}

async function bootstrapCloudSync() {
  try {
    const openid = await userDataCloudRepository.ensureIdentity();
    if (!openid) {
      userDataLocalRepository.saveCloudSyncMeta({
        cloudEnabled: false,
      });
      emitCloudSyncStatusChangedEvent();
      return;
    }

    const localHasData = userDataLocalRepository.hasMeaningfulLocalData();
    const meta = userDataLocalRepository.readCloudSyncMeta();
    const cloudSnapshot = await userDataCloudRepository.pullSnapshot();

    if (cloudSnapshot && !localHasData) {
      userDataLocalRepository.applySnapshot(cloudSnapshot);
      userDataLocalRepository.saveCloudSyncMeta({
        cloudEnabled: true,
        restoreAttempted: true,
        lastCloudSyncAt: cloudSnapshot.updatedAt,
        lastSyncedSnapshotHash: userDataLocalRepository.createSnapshotHashFromCloudSnapshot(cloudSnapshot),
        lastSyncStatus: "success",
        lastSyncError: null,
      });
      emitCloudSyncStatusChangedEvent();
      emitUserDataChangedEvent();
      return;
    }

    if (localHasData && userDataLocalRepository.isLocalSnapshotNewer(meta, cloudSnapshot)) {
      await uploadSnapshot("startup");
      return;
    }

    if (cloudSnapshot) {
      userDataLocalRepository.applySnapshot(cloudSnapshot);
      userDataLocalRepository.saveCloudSyncMeta({
        cloudEnabled: true,
        restoreAttempted: true,
        lastCloudSyncAt: cloudSnapshot.updatedAt,
        lastSyncedSnapshotHash: userDataLocalRepository.createSnapshotHashFromCloudSnapshot(cloudSnapshot),
        lastSyncStatus: "success",
        lastSyncError: null,
      });
      emitCloudSyncStatusChangedEvent();
      emitUserDataChangedEvent();
      return;
    }

    userDataLocalRepository.saveCloudSyncMeta({
      cloudEnabled: true,
      lastSyncStatus: "success",
    });
    emitCloudSyncStatusChangedEvent();
  } catch (error) {
    const message = error instanceof Error ? error.message : "cloud bootstrap failed";
    userDataLocalRepository.saveCloudSyncMeta({
      cloudEnabled: false,
      lastSyncStatus: "error",
      lastSyncError: message,
    });
    emitCloudSyncStatusChangedEvent();
  }
}

export async function initializeCloudSync() {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = initializeCloudSyncOnce();
  return initializePromise;
}

async function initializeCloudSyncOnce() {
  if (!CLOUD_ENV_ID) {
    userDataLocalRepository.saveCloudSyncMeta({
      cloudEnabled: false,
      lastSyncStatus: "idle",
      lastSyncError: "missing cloud env id",
    });
    emitCloudSyncStatusChangedEvent();
    return;
  }

  registerUserDataChangeHandler(() => {
    scheduleCloudBackup();
  });

  await bootstrapCloudSync();
}

export async function syncLocalUserDataToCloudNow() {
  if (!CLOUD_ENV_ID) {
    return;
  }

  if (pendingSyncTimer) {
    clearTimeout(pendingSyncTimer);
    pendingSyncTimer = null;
  }

  if (syncInFlight && activeSyncPromise) {
    await activeSyncPromise;
  }

  let meta = userDataLocalRepository.readCloudSyncMeta();
  let openid = meta.openid;
  if (!openid) {
    openid = await userDataCloudRepository.ensureIdentity();
  }
  if (!openid) {
    return;
  }

  meta = userDataLocalRepository.readCloudSyncMeta();
  const snapshot = userDataLocalRepository.buildSnapshot(openid);
  const snapshotHash = userDataLocalRepository.createSnapshotHashFromCloudSnapshot(snapshot);
  if (snapshotHash === meta.lastSyncedSnapshotHash) {
    return;
  }

  userDataLocalRepository.saveCloudSyncMeta({
    cloudEnabled: true,
    lastCloudSyncAttemptAt: new Date().toISOString(),
    lastSyncStatus: "syncing",
    lastSyncError: null,
  });
  emitCloudSyncStatusChangedEvent();

  try {
    const updatedAt = await userDataCloudRepository.pushSnapshot(snapshot);
    userDataLocalRepository.saveCloudSyncMeta({
      cloudEnabled: true,
      lastCloudSyncAt: updatedAt,
      lastSyncedSnapshotHash: snapshotHash,
      lastSyncStatus: "success",
      lastSyncError: null,
    });
    emitCloudSyncStatusChangedEvent();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown sync error";
    userDataLocalRepository.saveCloudSyncMeta({
      lastSyncStatus: "error",
      lastSyncError: message,
    });
    emitCloudSyncStatusChangedEvent();
    throw error;
  }
}
