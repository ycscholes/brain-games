import { saveCloudSyncMeta } from "../local/cloudSyncMetaStore";
import type { UserCloudSnapshot } from "../types";
import { callGetUserDataFunction, callLoginFunction, callSyncUserDataFunction } from "./cloudFunctionsClient";

export const userDataCloudRepository = {
  async ensureIdentity() {
    try {
      const loginResult = await callLoginFunction();
      const openid = loginResult?.openid || null;

      if (openid) {
        saveCloudSyncMeta({
          openid,
          cloudEnabled: true,
          lastSyncError: null,
        });
      }

      return openid;
    } catch (error) {
      throw error;
    }
  },

  async pullSnapshot() {
    try {
      const result = await callGetUserDataFunction();
      return result?.snapshot || null;
    } catch (error) {
      throw error;
    }
  },

  async pushSnapshot(snapshot: UserCloudSnapshot) {
    try {
      const result = await callSyncUserDataFunction({ snapshot });
      return result.result?.updatedAt || snapshot.updatedAt;
    } catch (error) {
      throw error;
    }
  },
};
