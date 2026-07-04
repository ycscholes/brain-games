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
  getTempFileURL: jest.fn(async ({ fileList }) => ({
    fileList: fileList.map((fileID) => ({
      fileID,
      tempFileURL: `https://temp.example/${encodeURIComponent(fileID)}`,
    })),
  })),
  deleteFile: jest.fn(),
};

const mockGenerator = {
  analyzeSource: jest.fn(),
  generateMood: jest.fn(async ({ mood }) => Buffer.from(`${mood}-generated`)),
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
    mockCloud.getTempFileURL.mockClear();
    delete process.env.TARO_CLOUD_ENV_ID;
    delete process.env.CLOUD_ENV_ID;
    delete process.env.TCB_ENV;
    delete process.env.TARO_CLOUD_STORAGE_BUCKET;
    delete process.env.CLOUD_STORAGE_BUCKET;
    delete process.env.TCB_STORAGE_BUCKET;
  });

  test("generates one CloudBase mood sheet and uploads compatible mood files", async () => {
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

    expect(mockGenerator.generateMoodSheet).toHaveBeenCalledTimes(1);
    expect(mockGenerator.generateMoodSheet).toHaveBeenCalledWith({
      speciesLabel: "小狗",
      traits: { primaryColor: "黑白" },
      referenceImageUrl: "https://temp.example/cloud%3A%2F%2Fsource",
      poseImageUrl:
        "https://temp.example/cloud%3A%2F%2Ftest-env%2Fusers%2Fuser-1%2Fcustom-pets%2Fjob-1%2Freferences%2Fcat-reference-sheet.png",
    });
    expect(mockGenerator.generateMood).not.toHaveBeenCalled();
    expect(mockGenerator.splitMoodSheet).toHaveBeenCalledWith({ inputBuffer: Buffer.from("sheet") });
    expect(mockGenerator.normalizeSprite).toHaveBeenCalledTimes(4);
    expect(mockUploadedFiles.map((file) => file.cloudPath)).toEqual([
      "users/user-1/custom-pets/job-1/references/cat-reference-sheet.png",
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
    expect(mockEntitlementStore.get("user-1")).toMatchObject({
      customPetGenerationUsed: true,
      customPetGenerationCount: 1,
    });
  });

  test("falls back to per-mood generation when CloudBase sheet post-processing fails", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mockGenerator.splitMoodSheet.mockRejectedValueOnce(new Error("invalid sheet"));
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

      expect(mockGenerator.generateMoodSheet).toHaveBeenCalledTimes(1);
    expect(mockGenerator.generateMood).toHaveBeenCalledWith({
      referenceBuffer: Buffer.from("download:cloud://source"),
      mood: "idle",
      speciesLabel: "小狗",
      traits: { primaryColor: "黑白" },
      referenceImageUrl: "https://temp.example/cloud%3A%2F%2Fsource",
      poseImageUrl:
        "https://temp.example/cloud%3A%2F%2Ftest-env%2Fusers%2Fuser-1%2Fcustom-pets%2Fjob-1%2Freferences%2Fcat-reference-sheet.png",
    });
      expect(task.status).toBe("preview_ready");
    } finally {
      warnSpy.mockRestore();
    }
  });
});
