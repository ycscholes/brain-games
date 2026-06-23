const mockStorage = new Map<string, string>();
const mockCallFunction = jest.fn();
const mockUploadFile = jest.fn();
const mockDeleteFile = jest.fn();
const mockEnsureCloudReady = jest.fn();
const mockChooseMedia = jest.fn();
const mockCropImage = jest.fn();
const mockCompressImage = jest.fn();
const mockGetFileInfo = jest.fn();

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) || ""),
    setStorageSync: jest.fn((key: string, value: string) => mockStorage.set(key, value)),
    chooseMedia: mockChooseMedia,
    cropImage: mockCropImage,
    compressImage: mockCompressImage,
    getFileInfo: mockGetFileInfo,
  },
}));

jest.mock("../../src/services/user-data/cloud/cloudFunctionsClient", () => ({
  ensureCloudReady: mockEnsureCloudReady,
}));

jest.mock("../../src/utils/petStorage", () => ({
  savePetData: jest.fn(),
}));

describe("customPetService", () => {
  beforeEach(() => {
    jest.resetModules();
    mockStorage.clear();
    mockCallFunction.mockReset();
    mockUploadFile.mockReset();
    mockDeleteFile.mockReset();
    mockChooseMedia.mockReset();
    mockCropImage.mockReset();
    mockCompressImage.mockReset();
    mockGetFileInfo.mockReset();
    mockEnsureCloudReady.mockResolvedValue({
      callFunction: mockCallFunction,
      uploadFile: mockUploadFile,
      deleteFile: mockDeleteFile,
    });
    jest.useFakeTimers().setSystemTime(new Date("2026-06-14T08:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("fetches all private mood URLs once and reuses the local cache", async () => {
    mockCallFunction.mockResolvedValue({
      result: {
        ok: true,
        data: {
          urls: {
            idle: { url: "https://private.example/idle.png" },
            feed: { url: "https://private.example/feed.png" },
            cuddle: { url: "https://private.example/cuddle.png" },
            hungry: { url: "https://private.example/hungry.png" },
          },
        },
      },
    });
    const {
      resolveCachedCustomPetSpriteUrl,
      resolveCustomPetSpriteUrl,
    } = await import("../../src/services/custom-pet/customPetService");

    await expect(resolveCustomPetSpriteUrl("asset-1", "idle")).resolves.toContain("idle.png");
    await expect(resolveCustomPetSpriteUrl("asset-1", "hungry")).resolves.toContain("hungry.png");
    expect(resolveCachedCustomPetSpriteUrl("asset-1", "feed")).toContain("feed.png");
    expect(mockCallFunction).toHaveBeenCalledTimes(1);
    expect(mockCallFunction).toHaveBeenCalledWith({
      name: "customPetApi",
      data: {
        action: "getAssetUrls",
        assetId: "asset-1",
        moods: ["idle", "feed", "cuddle", "hungry"],
      },
    });
  });

  test("refreshes an expired private URL cache", async () => {
    mockStorage.set("custom_pet_url_cache_v1", JSON.stringify({
      "asset-1": {
        expiresAt: Date.now() - 1,
        urls: { idle: "https://expired.example/idle.png" },
      },
    }));
    mockCallFunction.mockResolvedValue({
      result: {
        ok: true,
        data: {
          urls: {
            idle: { url: "https://fresh.example/idle.png" },
          },
        },
      },
    });
    const { resolveCustomPetSpriteUrl } = await import(
      "../../src/services/custom-pet/customPetService"
    );

    await expect(resolveCustomPetSpriteUrl("asset-1", "idle")).resolves.toContain("fresh.example");
    expect(mockCallFunction).toHaveBeenCalledTimes(1);
  });

  test("compresses the cropped source image and rejects it before upload when it is still too large", async () => {
    mockCallFunction.mockResolvedValueOnce({
      result: {
        ok: true,
        data: {
          jobId: "job-1",
          cloudPath: "users/openid/custom-pets/job-1/source/source.jpg",
          maxBytes: 4 * 1024 * 1024,
        },
      },
    });
    mockChooseMedia.mockResolvedValue({
      tempFiles: [{ tempFilePath: "/tmp/source.jpg", size: 1024 }],
    });
    mockCropImage.mockResolvedValue({ tempFilePath: "/tmp/cropped.jpg" });
    mockCompressImage.mockResolvedValue({ tempFilePath: "/tmp/compressed.jpg" });
    mockGetFileInfo.mockResolvedValue({ size: 5 * 1024 * 1024, errMsg: "ok", digest: "hash" });
    const { chooseAndSubmitCustomPet } = await import(
      "../../src/services/custom-pet/customPetService"
    );

    await expect(chooseAndSubmitCustomPet()).rejects.toThrow("图片处理后仍超过 4MB");
    expect(mockCompressImage).toHaveBeenCalledWith(expect.objectContaining({
      src: "/tmp/cropped.jpg",
      quality: 70,
    }));
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  test("compresses a large selected image instead of rejecting it before upload", async () => {
    mockCallFunction
      .mockResolvedValueOnce({
        result: {
          ok: true,
          data: {
            jobId: "job-1",
            cloudPath: "users/openid/custom-pets/job-1/source/source.jpg",
            maxBytes: 4 * 1024 * 1024,
          },
        },
      })
      .mockResolvedValueOnce({
        result: {
          ok: true,
          data: {
            task: { jobId: "job-1", status: "uploaded" },
          },
        },
      });
    mockChooseMedia.mockResolvedValue({
      tempFiles: [{ tempFilePath: "/tmp/source.jpg", size: 8 * 1024 * 1024 }],
    });
    mockCropImage.mockResolvedValue({ tempFilePath: "/tmp/cropped.jpg" });
    mockCompressImage.mockResolvedValue({ tempFilePath: "/tmp/compressed.jpg" });
    mockGetFileInfo.mockResolvedValue({ size: 2 * 1024 * 1024, errMsg: "ok", digest: "hash" });
    mockUploadFile.mockResolvedValue({ fileID: "cloud://env/test-openid/custom-pets/job-1/source/source.jpg" });
    const { chooseAndSubmitCustomPet } = await import(
      "../../src/services/custom-pet/customPetService"
    );

    await expect(chooseAndSubmitCustomPet()).resolves.toMatchObject({
      jobId: "job-1",
      status: "uploaded",
    });
    expect(mockUploadFile).toHaveBeenCalledWith({
      cloudPath: "users/openid/custom-pets/job-1/source/source.jpg",
      filePath: "/tmp/compressed.jpg",
    });
  });

  test("continues with compression when cropImage fails in the mini program runtime", async () => {
    mockCallFunction
      .mockResolvedValueOnce({
        result: {
          ok: true,
          data: {
            jobId: "job-1",
            cloudPath: "users/openid/custom-pets/job-1/source/source.jpg",
            maxBytes: 4 * 1024 * 1024,
          },
        },
      })
      .mockResolvedValueOnce({
        result: {
          ok: true,
          data: {
            task: { jobId: "job-1", status: "uploaded" },
          },
        },
      });
    mockChooseMedia.mockResolvedValue({
      tempFiles: [{ tempFilePath: "/tmp/source.jpg", size: 1024 }],
    });
    mockCropImage.mockRejectedValue({ errMsg: "cropImage:fail unsupported" });
    mockCompressImage.mockResolvedValue({ tempFilePath: "/tmp/compressed.jpg" });
    mockGetFileInfo.mockResolvedValue({ size: 2 * 1024 * 1024, errMsg: "ok", digest: "hash" });
    mockUploadFile.mockResolvedValue({ fileID: "cloud://env/test-openid/custom-pets/job-1/source/source.jpg" });
    const { chooseAndSubmitCustomPet } = await import(
      "../../src/services/custom-pet/customPetService"
    );

    await expect(chooseAndSubmitCustomPet()).resolves.toMatchObject({
      jobId: "job-1",
      status: "uploaded",
    });
    expect(mockCompressImage).toHaveBeenCalledWith(expect.objectContaining({
      src: "/tmp/source.jpg",
    }));
  });

  test("uploads a compressed temp path when getFileInfo cannot stat the runtime path", async () => {
    mockCallFunction
      .mockResolvedValueOnce({
        result: {
          ok: true,
          data: {
            jobId: "job-1",
            cloudPath: "users/openid/custom-pets/job-1/source/source.jpg",
            maxBytes: 4 * 1024 * 1024,
          },
        },
      })
      .mockResolvedValueOnce({
        result: {
          ok: true,
          data: {
            task: { jobId: "job-1", status: "uploaded" },
          },
        },
      });
    mockChooseMedia.mockResolvedValue({
      tempFiles: [{ tempFilePath: "/tmp/source.jpg", size: 1024 }],
    });
    mockCropImage.mockResolvedValue({ tempFilePath: "/tmp/cropped.jpg" });
    mockCompressImage.mockResolvedValue({ tempFilePath: "http://tmp/wb-image.jpg" });
    mockGetFileInfo.mockImplementation(({ filePath }: { filePath: string }) => {
      if (filePath === "http://tmp/wb-image.jpg") {
        return Promise.reject({
          errMsg: "getFileInfo:fail no such file or directory http://tmp/wb-image.jpg",
        });
      }
      return Promise.resolve({ size: 7 * 1024 * 1024, errMsg: "ok", digest: "hash" });
    });
    mockUploadFile.mockResolvedValue({
      fileID: "cloud://env/test-openid/custom-pets/job-1/source/source.jpg",
    });
    const { chooseAndSubmitCustomPet } = await import(
      "../../src/services/custom-pet/customPetService"
    );

    await expect(chooseAndSubmitCustomPet()).resolves.toMatchObject({
      jobId: "job-1",
      status: "uploaded",
    });
    expect(mockUploadFile).toHaveBeenCalledWith({
      cloudPath: "users/openid/custom-pets/job-1/source/source.jpg",
      filePath: "http://tmp/wb-image.jpg",
    });
  });

  test("accepts image runtime APIs that return path instead of tempFilePath", async () => {
    mockCallFunction
      .mockResolvedValueOnce({
        result: {
          ok: true,
          data: {
            jobId: "job-1",
            cloudPath: "users/openid/custom-pets/job-1/source/source.jpg",
            maxBytes: 4 * 1024 * 1024,
          },
        },
      })
      .mockResolvedValueOnce({
        result: {
          ok: true,
          data: {
            task: { jobId: "job-1", status: "uploaded" },
          },
        },
      });
    mockChooseMedia.mockResolvedValue({
      tempFiles: [{ tempFilePath: "/tmp/source.jpg", size: 1024 }],
    });
    mockCropImage.mockResolvedValue({ path: "/tmp/cropped-from-path.jpg" });
    mockCompressImage.mockResolvedValue({ path: "/tmp/compressed-from-path.jpg" });
    mockGetFileInfo.mockResolvedValue({ size: 2 * 1024 * 1024, errMsg: "ok", digest: "hash" });
    mockUploadFile.mockResolvedValue({
      fileID: "cloud://env/test-openid/custom-pets/job-1/source/source.jpg",
    });
    const { chooseAndSubmitCustomPet } = await import(
      "../../src/services/custom-pet/customPetService"
    );

    await expect(chooseAndSubmitCustomPet()).resolves.toMatchObject({
      jobId: "job-1",
      status: "uploaded",
    });
    expect(mockCompressImage).toHaveBeenCalledWith(expect.objectContaining({
      src: "/tmp/cropped-from-path.jpg",
    }));
    expect(mockUploadFile).toHaveBeenCalledWith({
      cloudPath: "users/openid/custom-pets/job-1/source/source.jpg",
      filePath: "/tmp/compressed-from-path.jpg",
    });
  });

  test("shows mini program upload failure details instead of a generic submit error", async () => {
    mockCallFunction.mockResolvedValueOnce({
      result: {
        ok: true,
        data: {
          jobId: "job-1",
          cloudPath: "users/openid/custom-pets/job-1/source/source.jpg",
          maxBytes: 4 * 1024 * 1024,
        },
      },
    });
    mockChooseMedia.mockResolvedValue({
      tempFiles: [{ tempFilePath: "/tmp/source.jpg", size: 1024 }],
    });
    mockCropImage.mockResolvedValue({ tempFilePath: "/tmp/cropped.jpg" });
    mockCompressImage.mockResolvedValue({ tempFilePath: "/tmp/compressed.jpg" });
    mockGetFileInfo.mockResolvedValue({ size: 2 * 1024 * 1024, errMsg: "ok", digest: "hash" });
    mockUploadFile.mockRejectedValue({ errMsg: "uploadFile:fail permission denied" });
    const { chooseAndSubmitCustomPet } = await import(
      "../../src/services/custom-pet/customPetService"
    );

    await expect(chooseAndSubmitCustomPet()).rejects.toThrow(
      "图片上传失败：uploadFile:fail permission denied",
    );
  });
});
