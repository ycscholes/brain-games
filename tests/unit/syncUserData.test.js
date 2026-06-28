const snapshotStore = new Map();

const mockCloud = {
  DYNAMIC_CURRENT_ENV: "current",
  init: jest.fn(),
  getWXContext: jest.fn(() => ({ OPENID: "user-1" })),
  database: jest.fn(() => ({
    collection: (name) => createCollection(name),
  })),
};

jest.mock("wx-server-sdk", () => mockCloud, { virtual: true });
jest.mock(
  "../../cloudfunctions/syncUserData/shared/customPetDomain",
  () => require("../../cloudfunctions/shared/customPetDomain"),
  { virtual: true },
);

function createCollection(name) {
  if (name !== "xiaoyuyuan_user_snapshots") {
    throw new Error(`unexpected collection: ${name}`);
  }

  return {
    doc: (id) => ({
      get: jest.fn(async () => {
        const data = snapshotStore.get(id);
        if (!data) {
          throw new Error(`${name}/${id} not found`);
        }
        return { data };
      }),
      set: jest.fn(async ({ data }) => {
        snapshotStore.set(id, data);
      }),
    }),
  };
}

function createPet(id = "pet-1") {
  return {
    id,
    name: "小猫",
    skin: "cat",
    assetRef: { kind: "standard", skin: "cat" },
    status: "alive",
    hunger: 100,
    level: 1,
    experience: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    lastUpdated: "2026-06-01T00:00:00.000Z",
    deathTime: null,
  };
}

function createRecord(index) {
  return {
    id: `training-${index}`,
    gameId: "rock-paper-scissors",
    score: index,
    awardedPoints: index,
    playedAt: `2026-06-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    outcome: "completed",
  };
}

function createSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    openid: "user-1",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    source: "local",
    trainingRecords: [createRecord(1)],
    petData: {
      pets: [createPet()],
      activePetId: "pet-1",
      balance: 20,
      reservedBalance: 0,
      adoptedCount: 1,
      lastCheckTime: "2026-06-10T00:00:00.000Z",
    },
    appSettings: {
      version: 1,
      soundEnabled: true,
      vibrationEnabled: true,
      reducedMotion: false,
      onboardingCompleted: true,
      privacyAccepted: true,
      updatedAt: "2026-06-10T00:00:00.000Z",
    },
    ...overrides,
  };
}

function seedExisting(snapshot = createSnapshot(), extra = {}) {
  snapshotStore.set("user-1", {
    openid: "user-1",
    createdAt: snapshot.createdAt,
    snapshot,
    updatedAt: snapshot.updatedAt,
    ...extra,
  });
}

describe("syncUserData cloud function", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers().setSystemTime(new Date("2026-06-29T00:00:00.000Z"));
    snapshotStore.clear();
    mockCloud.getWXContext.mockReturnValue({ OPENID: "user-1" });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("creates a new user snapshot with createdAt", async () => {
    const incoming = createSnapshot({ createdAt: undefined });
    const { main } = require("../../cloudfunctions/syncUserData/index");

    const result = await main({ snapshot: incoming });
    const saved = snapshotStore.get("user-1");

    expect(result.updatedAt).toBe("2026-06-10T00:00:00.000Z");
    expect(saved.createdAt).toBe("2026-06-29T00:00:00.000Z");
    expect(saved.snapshot.createdAt).toBe("2026-06-29T00:00:00.000Z");
  });

  test("preserves existing createdAt during normal sync", async () => {
    seedExisting(createSnapshot({
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    }));
    const incoming = createSnapshot({
      createdAt: "2026-06-20T00:00:00.000Z",
      updatedAt: "2026-06-20T00:00:00.000Z",
      trainingRecords: [createRecord(1), createRecord(2)],
    });
    const { main } = require("../../cloudfunctions/syncUserData/index");

    await main({ snapshot: incoming });
    const saved = snapshotStore.get("user-1");

    expect(saved.createdAt).toBe("2026-05-01T00:00:00.000Z");
    expect(saved.snapshot.createdAt).toBe("2026-05-01T00:00:00.000Z");
    expect(saved.snapshot.trainingRecords).toHaveLength(2);
  });

  test("allows normal progress sync", async () => {
    seedExisting(createSnapshot({
      trainingRecords: [createRecord(1)],
      petData: {
        ...createSnapshot().petData,
        balance: 20,
      },
    }));
    const incoming = createSnapshot({
      trainingRecords: [createRecord(1), createRecord(2), createRecord(3)],
      petData: {
        ...createSnapshot().petData,
        balance: 35,
      },
    });
    const { main } = require("../../cloudfunctions/syncUserData/index");

    await main({ snapshot: incoming });
    const saved = snapshotStore.get("user-1");

    expect(saved.snapshot.trainingRecords).toHaveLength(3);
    expect(saved.snapshot.petData.balance).toBe(35);
  });

  test("rejects a much smaller snapshot before it overwrites meaningful cloud data", async () => {
    const existingRecords = Array.from({ length: 12 }, (_, index) => createRecord(index + 1));
    const existing = createSnapshot({
      trainingRecords: existingRecords,
      petData: {
        ...createSnapshot().petData,
        balance: 240,
      },
    });
    seedExisting(existing);
    const incoming = createSnapshot({
      trainingRecords: [createRecord(1), createRecord(2)],
      petData: {
        pets: [createPet()],
        activePetId: "pet-1",
        balance: 10,
        reservedBalance: 0,
        adoptedCount: 1,
        lastCheckTime: "2026-06-20T00:00:00.000Z",
      },
    });
    const { main } = require("../../cloudfunctions/syncUserData/index");

    await expect(main({ snapshot: incoming })).rejects.toThrow("destructive user snapshot sync rejected");
    expect(snapshotStore.get("user-1").snapshot.trainingRecords).toHaveLength(12);
    expect(snapshotStore.get("user-1").snapshot.petData.balance).toBe(240);
  });

  test("accepts explicit destructive clear only when confirmed", async () => {
    seedExisting(createSnapshot({
      trainingRecords: Array.from({ length: 8 }, (_, index) => createRecord(index + 1)),
      petData: {
        ...createSnapshot().petData,
        balance: 120,
      },
    }));
    const incoming = createSnapshot({
      trainingRecords: [],
      petData: {
        pets: [],
        activePetId: null,
        balance: 0,
        reservedBalance: 0,
        adoptedCount: 0,
        lastCheckTime: "2026-06-29T00:00:00.000Z",
      },
      appSettings: {
        ...createSnapshot().appSettings,
        onboardingCompleted: false,
        privacyAccepted: false,
      },
    });
    const { main } = require("../../cloudfunctions/syncUserData/index");

    await main({
      action: "clearProductData",
      confirmDestructiveSync: true,
      snapshot: incoming,
    });
    const saved = snapshotStore.get("user-1");

    expect(saved.snapshot.trainingRecords).toHaveLength(0);
    expect(saved.snapshot.petData.pets).toHaveLength(0);
    expect(saved.snapshot.petData.balance).toBe(0);
  });
});
