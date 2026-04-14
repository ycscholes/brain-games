import { markLocalDataChanged } from "./cloudSyncMetaStore";
import { emitUserDataChangedEvent } from "./userDataEvents";

type UserDataChangeHandler = (() => void) | null;

let userDataChangeHandler: UserDataChangeHandler = null;

export function registerUserDataChangeHandler(handler: () => void) {
  userDataChangeHandler = handler;
}

export function notifyUserDataChanged() {
  if (userDataChangeHandler) {
    userDataChangeHandler();
  }
  emitUserDataChangedEvent();
}

export function emitUserDataChanged() {
  markLocalDataChanged();
  notifyUserDataChanged();
}
