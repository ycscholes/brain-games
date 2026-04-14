const mockStorage = new Map<string, string>();

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) ?? ""),
    setStorageSync: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeStorageSync: jest.fn((key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

import { markLocalDataChanged, readCloudSyncMeta, resetCloudSyncMeta, saveCloudSyncMeta } from "../../src/utils/cloudSyncMeta";

describe("cloudSyncMeta", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  test("creates default meta when storage is empty", () => {
    expect(readCloudSyncMeta().cloudEnabled).toBe(false);
    expect(readCloudSyncMeta().openid).toBe(null);
  });

  test("persists sync meta and marks local changes", () => {
    saveCloudSyncMeta({ openid: "test-openid", cloudEnabled: true });
    const marked = markLocalDataChanged();
    expect(marked.openid).toBe("test-openid");
    expect(marked.lastLocalChangeAt).not.toBe(null);
  });

  test("resets sync meta", () => {
    saveCloudSyncMeta({ cloudEnabled: true });
    resetCloudSyncMeta();
    expect(readCloudSyncMeta().cloudEnabled).toBe(false);
  });
});
