import { useEffect } from "react";
import { subscribeUserDataChanged } from "../local/userDataEvents";

export function useUserDataChange(handler: () => void) {
  useEffect(() => {
    return subscribeUserDataChanged(handler);
  }, [handler]);
}
