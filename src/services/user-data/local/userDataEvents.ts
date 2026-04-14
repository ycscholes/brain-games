import Taro from "@tarojs/taro";

export const USER_DATA_CHANGED_EVENT = "user-data:changed";
export const CLOUD_SYNC_STATUS_CHANGED_EVENT = "cloud-sync:status-changed";

let pendingChangeEvent: ReturnType<typeof setTimeout> | null = null;
let pendingCloudSyncStatusEvent: ReturnType<typeof setTimeout> | null = null;

function emitCoalescedEvent(
  eventName: string,
  pendingEvent: ReturnType<typeof setTimeout> | null,
  setPendingEvent: (timer: ReturnType<typeof setTimeout> | null) => void,
) {
  if (pendingEvent) {
    return;
  }

  const timer = setTimeout(() => {
    setPendingEvent(null);
    Taro.eventCenter.trigger(eventName);
  }, 0);

  setPendingEvent(timer);
}

export function emitUserDataChangedEvent() {
  emitCoalescedEvent(USER_DATA_CHANGED_EVENT, pendingChangeEvent, (timer) => {
    pendingChangeEvent = timer;
  });
}

export function emitCloudSyncStatusChangedEvent() {
  emitCoalescedEvent(CLOUD_SYNC_STATUS_CHANGED_EVENT, pendingCloudSyncStatusEvent, (timer) => {
    pendingCloudSyncStatusEvent = timer;
  });
}

export function subscribeUserDataChanged(handler: () => void) {
  Taro.eventCenter.on(USER_DATA_CHANGED_EVENT, handler);

  return () => {
    Taro.eventCenter.off(USER_DATA_CHANGED_EVENT, handler);
  };
}

export function subscribeCloudSyncStatusChanged(handler: () => void) {
  Taro.eventCenter.on(CLOUD_SYNC_STATUS_CHANGED_EVENT, handler);

  return () => {
    Taro.eventCenter.off(CLOUD_SYNC_STATUS_CHANGED_EVENT, handler);
  };
}
