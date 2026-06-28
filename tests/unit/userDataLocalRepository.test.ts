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

import { userDataLocalRepository } from "../../src/services/user-data/local/userDataLocalRepository";
import { readCloudSyncMeta, saveCloudSyncMeta } from "../../src/utils/cloudSyncMeta";
import type { UserCloudSnapshot } from "../../src/services/user-data/types";

function createCloudSnapshot(createdAt: string): UserCloudSnapshot {
  return {
    schemaVersion: 1,
    openid: "user-1",
    createdAt,
    updatedAt: "2026-06-29T09:00:00.000Z",
    source: "cloud",
    trainingRecords: [],
    petData: {
      pets: [],
      activePetId: null,
      balance: 0,
      reservedBalance: 0,
      adoptedCount: 0,
      lastCheckTime: "2026-06-29T09:00:00.000Z",
    },
    appSettings: {
      version: 1,
      soundEnabled: true,
      vibrationEnabled: true,
      reducedMotion: false,
      onboardingCompleted: false,
      privacyAccepted: false,
      updatedAt: "2026-06-29T09:00:00.000Z",
    },
  };
}

describe("userDataLocalRepository", () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.useFakeTimers().setSystemTime(new Date("2026-06-29T08:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("creates and preserves local snapshot createdAt", () => {
    const first = userDataLocalRepository.buildSnapshot("user-1");
    expect(first.createdAt).toBe("2026-06-29T08:00:00.000Z");
    expect(readCloudSyncMeta().userCreatedAt).toBe("2026-06-29T08:00:00.000Z");

    jest.setSystemTime(new Date("2026-06-29T09:00:00.000Z"));
    const second = userDataLocalRepository.buildSnapshot("user-1");

    expect(second.createdAt).toBe("2026-06-29T08:00:00.000Z");
    expect(second.updatedAt).toBe("2026-06-29T09:00:00.000Z");
  });

  test("uses restored cloud snapshot createdAt for future local snapshots", () => {
    userDataLocalRepository.applySnapshot(createCloudSnapshot("2026-05-01T00:00:00.000Z"));

    jest.setSystemTime(new Date("2026-06-29T10:00:00.000Z"));
    const next = userDataLocalRepository.buildSnapshot("user-1");

    expect(readCloudSyncMeta().userCreatedAt).toBe("2026-05-01T00:00:00.000Z");
    expect(next.createdAt).toBe("2026-05-01T00:00:00.000Z");
  });

  test("honors an existing sync meta createdAt", () => {
    saveCloudSyncMeta({ userCreatedAt: "2026-04-01T00:00:00.000Z" });

    const snapshot = userDataLocalRepository.buildSnapshot("user-1");

    expect(snapshot.createdAt).toBe("2026-04-01T00:00:00.000Z");
  });
});
