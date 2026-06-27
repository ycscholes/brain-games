const stores = {
  custom_pet_jobs: new Map(),
  custom_pet_entitlements: new Map(),
  xiaoyuyuan_user_snapshots: new Map(),
  custom_pet_assets: new Map(),
};

const mockCloud = {
  DYNAMIC_CURRENT_ENV: "current",
  init: jest.fn(),
  getWXContext: jest.fn(() => ({ OPENID: "user-1" })),
  callFunction: jest.fn(async () => ({})),
  getTempFileURL: jest.fn(),
  database: jest.fn(() => ({
    collection: (name) => createCollection(name),
    runTransaction: async (callback) =>
      callback({
        collection: (name) => createCollection(name),
      }),
  })),
};

jest.mock("wx-server-sdk", () => mockCloud, { virtual: true });
jest.mock(
  "../../cloudfunctions/customPetApi/shared/customPetDomain",
  () => require("../../cloudfunctions/shared/customPetDomain"),
  { virtual: true },
);

function getStore(name) {
  const store = stores[name];
  if (!store) {
    throw new Error(`unexpected collection: ${name}`);
  }
  return store;
}

function matchesWhere(data, query) {
  return Object.entries(query).every(([key, value]) => data && data[key] === value);
}

function createCollection(name) {
  return {
    doc: (id) => ({
      get: jest.fn(async () => {
        const data = getStore(name).get(id);
        if (!data) {
          throw new Error(`${name}/${id} not found`);
        }
        return { data };
      }),
      set: jest.fn(async ({ data }) => {
        getStore(name).set(id, data);
      }),
      update: jest.fn(async ({ data }) => {
        getStore(name).set(id, {
          ...(getStore(name).get(id) || {}),
          ...data,
        });
      }),
    }),
    where: (query) => ({
      limit: () => ({
        get: jest.fn(async () => ({
          data: Array.from(getStore(name).values()).filter((item) => matchesWhere(item, query)),
        })),
      }),
    }),
  };
}

function seedSnapshot(balance = 1000) {
  stores.xiaoyuyuan_user_snapshots.set("user-1", {
    openid: "user-1",
    snapshot: {
      schemaVersion: 1,
      openid: "user-1",
      petData: {
        pets: [],
        activePetId: null,
        balance,
        reservedBalance: 0,
        adoptedCount: 0,
        lastCheckTime: "2026-06-22T00:00:00.000Z",
      },
    },
  });
}

describe("custom pet api generation eligibility", () => {
  beforeEach(() => {
    jest.resetModules();
    Object.values(stores).forEach((store) => store.clear());
    mockCloud.callFunction.mockClear();
    mockCloud.getWXContext.mockReturnValue({ OPENID: "user-1" });
    seedSnapshot();
  });

  test("allows a new upload intent after a previous custom pet generation was used", async () => {
    stores.custom_pet_entitlements.set("user-1", {
      ownerId: "user-1",
      activeJobId: null,
      customPetGenerationUsed: true,
      customPetGenerationCount: 1,
      usedAt: "2026-06-21T00:00:00.000Z",
    });

    const { main } = require("../../cloudfunctions/customPetApi/index");
    const response = await main({ action: "createUploadIntent" });

    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({
      maxBytes: 4 * 1024 * 1024,
    });
    expect(response.data.jobId).toMatch(/^custom_pet_job_/);
    expect(response.data.cloudPath).toBe(`users/user-1/custom-pets/${response.data.jobId}/source/source.jpg`);
  });

  test("allows submit after previous use while keeping active job protection", async () => {
    stores.custom_pet_entitlements.set("user-1", {
      ownerId: "user-1",
      activeJobId: null,
      customPetGenerationUsed: true,
      customPetGenerationCount: 1,
      usedAt: "2026-06-21T00:00:00.000Z",
    });
    const jobId = "custom_pet_job_test";
    const sourceFileId = `cloud://test-env/users/user-1/custom-pets/${jobId}/source/source.jpg`;

    const { main } = require("../../cloudfunctions/customPetApi/index");
    const response = await main({ action: "submit", jobId, sourceFileId });

    expect(response.ok).toBe(true);
    expect(response.data.task).toMatchObject({
      jobId,
      status: "uploaded",
      candidateVersion: 1,
    });
    expect(stores.custom_pet_entitlements.get("user-1")).toMatchObject({
      activeJobId: jobId,
      customPetGenerationUsed: false,
      customPetGenerationCount: 1,
    });

    const blocked = await main({ action: "createUploadIntent" });
    expect(blocked).toEqual({
      ok: false,
      error: "custom pet task already active",
    });
  });

  test("blocks new custom pet generation after ten successful previews", async () => {
    stores.custom_pet_entitlements.set("user-1", {
      ownerId: "user-1",
      activeJobId: null,
      customPetGenerationUsed: false,
      customPetGenerationCount: 10,
      usedAt: "2026-06-21T00:00:00.000Z",
    });

    const { main } = require("../../cloudfunctions/customPetApi/index");
    const response = await main({ action: "createUploadIntent" });

    expect(response).toEqual({
      ok: false,
      error: "自定义宠物生成次数已用完",
    });
  });

  test("accepts CloudBase storage file IDs that include a bucket segment", async () => {
    const jobId = "custom_pet_job_test";
    const sourceFileId = `cloud://test-env.test-bucket/users/user-1/custom-pets/${jobId}/source/source.jpg`;

    const { main } = require("../../cloudfunctions/customPetApi/index");
    const response = await main({ action: "submit", jobId, sourceFileId });

    expect(response.ok).toBe(true);
    expect(response.data.task).toMatchObject({
      jobId,
      status: "uploaded",
    });
    expect(stores.custom_pet_jobs.get(jobId).sourceFileId).toBe(sourceFileId);
  });

  test("allows repeated rerolls for the same preview during testing", async () => {
    const jobId = "custom_pet_job_preview";
    stores.custom_pet_jobs.set(jobId, {
      jobId,
      ownerId: "user-1",
      status: "preview_ready",
      step: "preview_ready",
      candidateVersion: 2,
      candidateSpriteFileIds: {
        idle: "cloud://idle",
        feed: "cloud://feed",
        cuddle: "cloud://cuddle",
        hungry: "cloud://hungry",
      },
      rerollUsed: true,
      updatedAt: "2026-06-22T00:00:00.000Z",
    });

    const { main } = require("../../cloudfunctions/customPetApi/index");
    const response = await main({ action: "reroll", jobId });

    expect(response.ok).toBe(true);
    expect(response.data.task).toMatchObject({
      jobId,
      status: "rerolling",
      candidateVersion: 3,
      rerollUsed: true,
    });
  });

  test("does not mark generation as used when a preview is cancelled during testing", async () => {
    seedSnapshot(700);
    stores.xiaoyuyuan_user_snapshots.get("user-1").snapshot.petData.reservedBalance = 300;
    const jobId = "custom_pet_job_cancel";
    stores.custom_pet_jobs.set(jobId, {
      jobId,
      ownerId: "user-1",
      status: "preview_ready",
      step: "preview_ready",
      candidateVersion: 1,
      settlementStatus: "reserved",
      reservedPoints: 300,
      rerollUsed: true,
      updatedAt: "2026-06-22T00:00:00.000Z",
    });
    stores.custom_pet_entitlements.set("user-1", {
      ownerId: "user-1",
      activeJobId: jobId,
      customPetGenerationUsed: true,
      customPetGenerationCount: 4,
      usedAt: "2026-06-22T00:00:00.000Z",
    });

    const { main } = require("../../cloudfunctions/customPetApi/index");
    const response = await main({ action: "cancel", jobId });

    expect(response.ok).toBe(true);
    expect(stores.custom_pet_entitlements.get("user-1")).toMatchObject({
      activeJobId: null,
      customPetGenerationUsed: false,
      customPetGenerationCount: 4,
      usedAt: "2026-06-22T00:00:00.000Z",
    });
    expect(stores.xiaoyuyuan_user_snapshots.get("user-1").snapshot.petData).toMatchObject({
      balance: 1000,
      reservedBalance: 0,
    });
  });
});
