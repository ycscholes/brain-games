import { CLOUD_SCHEMA_VERSION } from "../../../config/cloud";
import { readPetData, savePetData } from "../../../utils/petStorage";
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
    return {
      schemaVersion: CLOUD_SCHEMA_VERSION,
      openid,
      updatedAt: new Date().toISOString(),
      source: "local",
      trainingRecords: readTrainingRecords(),
      petData: readPetData(),
      appSettings: readAppSettings(),
    };
  },

  applySnapshot(snapshot: UserCloudSnapshot) {
    saveTrainingRecords(snapshot.trainingRecords, { markChanged: false });
    savePetData(snapshot.petData, { markChanged: false });
    saveAppSettings(snapshot.appSettings, { markChanged: false, replace: true });
  },

  createSnapshotHashFromCloudSnapshot(snapshot: UserCloudSnapshot) {
    return createSnapshotHash({
      schemaVersion: snapshot.schemaVersion,
      trainingRecords: snapshot.trainingRecords,
      petData: snapshot.petData,
      appSettings: snapshot.appSettings,
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
