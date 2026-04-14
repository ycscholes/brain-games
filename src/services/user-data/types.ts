import type { PetStorageData } from "../../pages/pet/types";
import type { AppSettings, TrainingRecord } from "../../utils/trainingStorage";

export interface UserCloudSnapshot {
  schemaVersion: number;
  openid: string;
  updatedAt: string;
  source: "local" | "cloud";
  trainingRecords: TrainingRecord[];
  petData: PetStorageData;
  appSettings: AppSettings;
}

export type UserSnapshotComparable = Omit<UserCloudSnapshot, "updatedAt" | "openid" | "source">;

export interface CloudSyncMeta {
  openid: string | null;
  lastCloudSyncAt: string | null;
  lastCloudSyncAttemptAt: string | null;
  lastLocalChangeAt: string | null;
  lastSyncedSnapshotHash: string | null;
  cloudEnabled: boolean;
  restoreAttempted: boolean;
  lastSyncStatus: "idle" | "syncing" | "success" | "error";
  lastSyncError: string | null;
}

export interface LoginResult {
  openid?: string;
}

export interface UserSnapshotResult {
  snapshot?: UserCloudSnapshot | null;
}
