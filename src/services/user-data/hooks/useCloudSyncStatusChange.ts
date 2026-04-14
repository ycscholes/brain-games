import { useEffect } from "react";
import { subscribeCloudSyncStatusChanged } from "../local/userDataEvents";

export function useCloudSyncStatusChange(handler: () => void) {
  useEffect(() => {
    return subscribeCloudSyncStatusChanged(handler);
  }, [handler]);
}
