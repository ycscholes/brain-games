import { CLOUD_SCHEMA_VERSION } from "../../../config/cloud";
import { readPetData, savePetData } from "../../../utils/petStorage";
import {
  readStickerRewardLedger,
  saveStickerRewardLedger,
} from "../../../utils/stickerRewards";
import {
  readAppSettings,
  readTrainingRecords,
  saveAppSettings,
  saveTrainingRecords,
} from "../../../utils/trainingStorage";
import {
  readCloudSyncMeta,
  saveCloudSyncMeta,
} from "./cloudSyncMetaStore";
import type { CloudSyncMeta, UserCloudSnapshot, UserSnapshotComparable } from "../types";

function createSnapshotHash(snapshot: UserSnapshotComparable) {
  return JSON.stringify(snapshot);
}

export const userDataLocalRepository = {
  readCloudSyncMeta,
  saveCloudSyncMeta,

  hasMeaningfulLocalData() {
    const trainingRecords = readTrainingRecords();
    const petData = readPetData();
    const settings = readAppSettings();

    return (
      trainingRecords.length > 0 ||
      petData.pets.length > 0 ||
      petData.balance > 0 ||
      settings.onboardingCompleted ||
      settings.privacyAccepted
    );
  },

  buildSnapshot(openid: string): UserCloudSnapshot {
    const now = new Date().toISOString();
    const meta = readCloudSyncMeta();
    const createdAt = meta.userCreatedAt || now;
    if (!meta.userCreatedAt) {
      saveCloudSyncMeta({ userCreatedAt: createdAt });
    }

    return {
      schemaVersion: CLOUD_SCHEMA_VERSION,
      openid,
      createdAt,
      updatedAt: now,
      source: "local",
      trainingRecords: readTrainingRecords(),
      petData: readPetData(),
      appSettings: readAppSettings(),
      stickerRewardLedger: readStickerRewardLedger(),
    };
  },

  applySnapshot(snapshot: UserCloudSnapshot) {
    saveTrainingRecords(snapshot.trainingRecords, { markChanged: false });
    savePetData(snapshot.petData, { markChanged: false });
    saveAppSettings(snapshot.appSettings, { markChanged: false, replace: true });
    saveStickerRewardLedger(snapshot.stickerRewardLedger ?? { claims: [] });
    saveCloudSyncMeta({ userCreatedAt: snapshot.createdAt || null });
  },

  createSnapshotHashFromCloudSnapshot(snapshot: UserCloudSnapshot) {
    return createSnapshotHash({
      schemaVersion: snapshot.schemaVersion,
      createdAt: snapshot.createdAt,
      trainingRecords: snapshot.trainingRecords,
      petData: snapshot.petData,
      appSettings: snapshot.appSettings,
      stickerRewardLedger: snapshot.stickerRewardLedger ?? { claims: [] },
    });
  },

  isLocalSnapshotNewer(meta: CloudSyncMeta, cloudSnapshot: UserCloudSnapshot | null) {
    if (!cloudSnapshot) {
      return this.hasMeaningfulLocalData();
    }

    if (!meta.lastLocalChangeAt) {
      return false;
    }

    return new Date(meta.lastLocalChangeAt).getTime() > new Date(cloudSnapshot.updatedAt).getTime();
  },
};
