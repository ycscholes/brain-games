const mockTaskStore = new Map();
const mockEntitlementStore = new Map();
const mockUploadedFiles = [];

const mockCloud = {
  DYNAMIC_CURRENT_ENV: "current",
  init: jest.fn(),
  database: jest.fn(() => ({
    collection: (name) => createCollection(name),
    runTransaction: async (callback) =>
      callback({
        collection: (name) => createCollection(name),
      }),
  })),
  downloadFile: jest.fn(async ({ fileID }) => ({
    fileContent: Buffer.from(`download:${fileID}`),
  })),
  uploadFile: jest.fn(async ({ cloudPath, fileContent }) => {
    const fileID = `cloud://test-env/${cloudPath}`;
    mockUploadedFiles.push({ cloudPath, fileContent, fileID });
    return { fileID };
  }),
  deleteFile: jest.fn(),
};

const mockGenerator = {
  analyzeSource: jest.fn(),
  generateReferencedMoodSheet: jest.fn(async () => Buffer.from("referenced-sheet")),
  generateMood: jest.fn(),
  generateMoodSheet: jest.fn(async () => Buffer.from("sheet")),
  normalizeSprite: jest.fn(async ({ inputBuffer }) => Buffer.from(`normalized:${inputBuffer.toString()}`)),
  splitMoodSheet: jest.fn(async () => ({
    idle: Buffer.from("idle"),
    feed: Buffer.from("feed"),
    cuddle: Buffer.from("cuddle"),
    hungry: Buffer.from("hungry"),
  })),
  validateRuntimeDependencies: jest.fn(() => ({ node: "test" })),
};

jest.mock("wx-server-sdk", () => mockCloud, { virtual: true });
jest.mock(
  "../../cloudfunctions/customPetWorker/shared/customPetDomain",
  () => require("../../cloudfunctions/shared/customPetDomain"),
  { virtual: true },
);
jest.mock("../../cloudfunctions/customPetWorker/shared/customPetGenerator", () => mockGenerator, {
  virtual: true,
});

function createCollection(name) {
  return {
    doc: (id) => ({
      get: jest.fn(async () => {
        const store = getStore(name);
        const data = store.get(id);
        if (!data) {
          throw new Error(`${name}/${id} not found`);
        }
        return { data };
      }),
      update: jest.fn(async ({ data }) => {
        const store = getStore(name);
        store.set(id, {
          ...(store.get(id) || {}),
          ...data,
        });
      }),
      set: jest.fn(async ({ data }) => {
        getStore(name).set(id, data);
      }),
      remove: jest.fn(async () => {
        getStore(name).delete(id);
      }),
    }),
  };
}

function getStore(name) {
  if (name === "custom_pet_jobs") {
    return mockTaskStore;
  }
  if (name === "custom_pet_entitlements") {
    return mockEntitlementStore;
  }
  return new Map();
}

describe("custom pet worker", () => {
  beforeEach(() => {
    jest.resetModules();
    mockTaskStore.clear();
    mockEntitlementStore.clear();
    mockUploadedFiles.length = 0;
    Object.values(mockGenerator).forEach((value) => {
      if (value && value.mockClear) {
        value.mockClear();
      }
    });
    mockCloud.downloadFile.mockClear();
    mockCloud.uploadFile.mockClear();
    delete process.env.TARO_CLOUD_ENV_ID;
    delete process.env.CLOUD_ENV_ID;
    delete process.env.TCB_ENV;
    delete process.env.TARO_CLOUD_STORAGE_BUCKET;
    delete process.env.CLOUD_STORAGE_BUCKET;
    delete process.env.TCB_STORAGE_BUCKET;
  });

  test("generates one referenced mood sheet and uploads compatible mood files", async () => {
    mockTaskStore.set("job-1", {
      jobId: "job-1",
      ownerId: "user-1",
      sourceFileId: "cloud://source",
      status: "generating_idle",
      step: "generating_idle",
      candidateVersion: 1,
      traits: { primaryColor: "黑白" },
      speciesLabel: "小狗",
    });

    const { runJob } = require("../../cloudfunctions/customPetWorker/index");
    const task = await runJob("job-1");

    expect(mockGenerator.generateReferencedMoodSheet).toHaveBeenCalledTimes(1);
    expect(mockGenerator.generateReferencedMoodSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        userReferenceBuffer: Buffer.from("download:cloud://source"),
        poseReferenceBuffer: expect.any(Buffer),
        speciesLabel: "小狗",
        traits: { primaryColor: "黑白" },
      }),
    );
    expect(mockGenerator.generateMoodSheet).not.toHaveBeenCalled();
    expect(mockGenerator.generateMood).not.toHaveBeenCalled();
    expect(mockGenerator.splitMoodSheet).toHaveBeenCalledWith({ inputBuffer: Buffer.from("referenced-sheet") });
    expect(mockGenerator.normalizeSprite).toHaveBeenCalledTimes(4);
    expect(mockUploadedFiles.map((file) => file.cloudPath)).toEqual([
      "users/user-1/custom-pets/job-1/candidates/1/idle.png",
      "users/user-1/custom-pets/job-1/candidates/1/feed.png",
      "users/user-1/custom-pets/job-1/candidates/1/cuddle.png",
      "users/user-1/custom-pets/job-1/candidates/1/hungry.png",
    ]);
    expect(task.status).toBe("preview_ready");
    expect(task.candidateSpriteFileIds).toEqual({
      idle: "cloud://test-env/users/user-1/custom-pets/job-1/candidates/1/idle.png",
      feed: "cloud://test-env/users/user-1/custom-pets/job-1/candidates/1/feed.png",
      cuddle: "cloud://test-env/users/user-1/custom-pets/job-1/candidates/1/cuddle.png",
      hungry: "cloud://test-env/users/user-1/custom-pets/job-1/candidates/1/hungry.png",
    });
  });

  test("loads the CloudBase pose reference sheet when storage env is configured", async () => {
    process.env.TARO_CLOUD_ENV_ID = "test-env";
    process.env.TARO_CLOUD_STORAGE_BUCKET = "test-bucket";
    mockTaskStore.set("job-1", {
      jobId: "job-1",
      ownerId: "user-1",
      sourceFileId: "cloud://source",
      status: "generating_idle",
      step: "generating_idle",
      candidateVersion: 1,
      traits: { primaryColor: "黑白" },
      speciesLabel: "小狗",
    });

    const { runJob } = require("../../cloudfunctions/customPetWorker/index");
    await runJob("job-1");

    expect(mockCloud.downloadFile).toHaveBeenCalledWith({
      fileID: "cloud://test-env.test-bucket/assets/v1/pets/pose-reference-sheet.png",
    });
    expect(mockGenerator.generateReferencedMoodSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        poseReferenceBuffer: Buffer.from(
          "download:cloud://test-env.test-bucket/assets/v1/pets/pose-reference-sheet.png",
        ),
        userReferenceBuffer: Buffer.from("download:cloud://source"),
      }),
    );
  });

  test("falls back to the single-reference sheet when referenced generation fails", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mockGenerator.generateReferencedMoodSheet.mockRejectedValueOnce(new Error("referenced unavailable"));
      mockTaskStore.set("job-1", {
        jobId: "job-1",
        ownerId: "user-1",
        sourceFileId: "cloud://source",
        status: "generating_idle",
        step: "generating_idle",
        candidateVersion: 1,
        traits: { primaryColor: "黑白" },
        speciesLabel: "小狗",
      });

      const { runJob } = require("../../cloudfunctions/customPetWorker/index");
      const task = await runJob("job-1");

      expect(mockGenerator.generateReferencedMoodSheet).toHaveBeenCalledTimes(1);
      expect(mockGenerator.generateMoodSheet).toHaveBeenCalledWith({
        referenceBuffer: Buffer.from("download:cloud://source"),
        speciesLabel: "小狗",
        traits: { primaryColor: "黑白" },
      });
      expect(mockGenerator.splitMoodSheet).toHaveBeenCalledWith({ inputBuffer: Buffer.from("sheet") });
      expect(task.status).toBe("preview_ready");
    } finally {
      warnSpy.mockRestore();
    }
  });
});
