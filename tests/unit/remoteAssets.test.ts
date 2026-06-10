const mockStorage = new Map<string, string>();
const mockGetTempFileURL = jest.fn();
const mockEnsureCloudReady = jest.fn();

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) ?? ""),
    setStorageSync: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
  },
}));

jest.mock("../../src/services/user-data/cloud/cloudFunctionsClient", () => ({
  ensureCloudReady: mockEnsureCloudReady,
}));

const CACHE_KEY = "remote_asset_url_cache_v4";
const TEMP_URL_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const CAT_IDLE_FILE_ID = "cloud://test-env.test-bucket/assets/v1/pets/cat-idle.png";
const GECKO_IDLE_FILE_ID = "cloud://test-env.test-bucket/assets/v1/pets/gecko-idle.png";
const TURTLE_CUDDLE_FILE_ID = "cloud://test-env.test-bucket/assets/v1/pets/turtle-cuddle.png";
const BISCUIT_FILE_ID = "cloud://test-env.test-bucket/assets/v1/pets/food-biscuit.png";
const GENERATED_FOOD_IMAGE_IDS = [
  "biscuit",
  "salmon",
  "beef-bone",
  "strawberry-basket",
  "honey-jar",
  "bamboo-rice",
  "cricket-cup",
  "shrimp-greens",
] as const;

function writeAssetCache(asset: { expiresAt?: number; permanent: boolean; url: string }) {
  mockStorage.set(
    CACHE_KEY,
    JSON.stringify({
      version: 4,
      assets: {
        [CAT_IDLE_FILE_ID]: asset,
      },
    }),
  );
}

function writeFoodAssetCache(asset: { expiresAt?: number; permanent: boolean; url: string }) {
  mockStorage.set(
    CACHE_KEY,
    JSON.stringify({
      version: 4,
      assets: {
        [BISCUIT_FILE_ID]: asset,
      },
    }),
  );
}

describe("remoteAssets", () => {
  beforeEach(() => {
    jest.resetModules();
    mockStorage.clear();
    mockGetTempFileURL.mockReset();
    mockEnsureCloudReady.mockReset();
    process.env.TARO_CLOUD_ENV_ID = "test-env";
    process.env.TARO_CLOUD_STORAGE_BUCKET = "test-bucket";
    process.env.TARO_REMOTE_ASSETS_PUBLIC = "true";
    jest.useFakeTimers().setSystemTime(new Date("2026-06-05T08:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("uses a permanent local pet image cache without requesting cloud URL", async () => {
    writeAssetCache({
      permanent: true,
      url: "https://cached.example/cat-idle.png",
    });

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");

    await expect(resolvePetSpriteUrl("cat", "idle")).resolves.toBe("https://cached.example/cat-idle.png");
    jest.advanceTimersByTime(30 * 24 * 60 * 60 * 1000);
    await expect(resolvePetSpriteUrl("cat", "idle")).resolves.toBe("https://cached.example/cat-idle.png");
    expect(mockEnsureCloudReady).not.toHaveBeenCalled();
  });

  test("uses an unexpired signed URL cache without requesting cloud URL", async () => {
    writeAssetCache({
      expiresAt: Date.now() + 30 * 60 * 1000,
      permanent: false,
      url: "https://cached.example/cat-idle.png?q-sign-algorithm=test",
    });

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");

    await expect(resolvePetSpriteUrl("cat", "idle")).resolves.toContain("q-sign-algorithm");
    expect(mockEnsureCloudReady).not.toHaveBeenCalled();
  });

  test("stores a clean public URL as permanent", async () => {
    mockGetTempFileURL.mockResolvedValue({
      fileList: [{ tempFileURL: "https://fresh.example/cat-idle.png", maxAge: 2 * 60 * 60 * 1000 }],
    });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");
    await expect(resolvePetSpriteUrl("cat", "idle")).resolves.toBe("https://fresh.example/cat-idle.png");
    expect(JSON.parse(mockStorage.get(CACHE_KEY) || "{}").assets[CAT_IDLE_FILE_ID]).toEqual({
      permanent: true,
      url: "https://fresh.example/cat-idle.png",
    });
  });

  test("keeps a signed URL temporary even when public caching is enabled", async () => {
    mockGetTempFileURL
      .mockResolvedValueOnce({
        fileList: [
          {
            tempFileURL: "https://fresh.example/first.png?q-sign-algorithm=test",
            maxAge: 2 * 60,
          },
        ],
      })
      .mockResolvedValueOnce({
        fileList: [
          {
            tempFileURL: "https://fresh.example/second.png?q-sign-algorithm=test",
            maxAge: 2 * 60,
          },
        ],
      });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");

    await expect(resolvePetSpriteUrl("cat", "idle")).resolves.toContain("first.png");
    expect(JSON.parse(mockStorage.get(CACHE_KEY) || "{}").assets[CAT_IDLE_FILE_ID]).toMatchObject({
      expiresAt: Date.now() + 60 * 1000,
      permanent: false,
    });
    jest.advanceTimersByTime(61 * 1000);
    await expect(resolvePetSpriteUrl("cat", "idle")).resolves.toContain("second.png");
    expect(mockGetTempFileURL).toHaveBeenCalledTimes(2);
  });

  test("keeps a clean URL temporary when public caching is disabled", async () => {
    process.env.TARO_REMOTE_ASSETS_PUBLIC = "false";
    mockGetTempFileURL.mockResolvedValue({
      fileList: [{ tempFileURL: "https://fresh.example/cat-idle.png", maxAge: 2 * 60 }],
    });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");

    await expect(resolvePetSpriteUrl("cat", "idle")).resolves.toBe("https://fresh.example/cat-idle.png");
    expect(JSON.parse(mockStorage.get(CACHE_KEY) || "{}").assets[CAT_IDLE_FILE_ID]).toMatchObject({
      expiresAt: Date.now() + 60 * 1000,
      permanent: false,
    });
  });

  test("does not reuse legacy expiring cache entries", async () => {
    mockStorage.set(
      "remote_asset_url_cache_v3",
      JSON.stringify({
        version: 3,
        assets: {
          [CAT_IDLE_FILE_ID]: {
            expiresAt: Date.now() + 30 * 60 * 1000,
            url: "https://cached.example/legacy.png",
          },
        },
      }),
    );
    mockGetTempFileURL.mockResolvedValue({
      fileList: [{ tempFileURL: "https://fresh.example/cat-idle.png" }],
    });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");

    await expect(resolvePetSpriteUrl("cat", "idle")).resolves.toBe("https://fresh.example/cat-idle.png");
    expect(mockGetTempFileURL).toHaveBeenCalledTimes(1);
  });

  test("requests and stores cloud URL when no local pet image cache exists", async () => {
    mockGetTempFileURL.mockResolvedValue({
      fileList: [{ tempFileURL: "https://fresh.example/cat-idle.png" }],
    });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");
    const url = await resolvePetSpriteUrl("cat", "idle");

    expect(url).toBe("https://fresh.example/cat-idle.png");
    expect(JSON.parse(mockStorage.get(CACHE_KEY) || "{}").assets[CAT_IDLE_FILE_ID]).toEqual({
      permanent: true,
      url: "https://fresh.example/cat-idle.png",
    });
  });

  test("reads a permanent cached food icon URL before any cloud refresh", async () => {
    writeFoodAssetCache({
      permanent: true,
      url: "https://cached.example/food-biscuit.png",
    });

    const { resolveCachedFoodIconUrl } = await import("../../src/config/remoteAssets");

    expect(resolveCachedFoodIconUrl("biscuit")).toBe("https://cached.example/food-biscuit.png");
    expect(mockEnsureCloudReady).not.toHaveBeenCalled();
  });

  test("resolves new gecko and turtle pet sprite storage paths", async () => {
    mockGetTempFileURL
      .mockResolvedValueOnce({
        fileList: [{ tempFileURL: "https://fresh.example/gecko-idle.png" }],
      })
      .mockResolvedValueOnce({
        fileList: [{ tempFileURL: "https://fresh.example/turtle-cuddle.png" }],
      });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");

    await expect(resolvePetSpriteUrl("gecko", "idle")).resolves.toBe("https://fresh.example/gecko-idle.png");
    await expect(resolvePetSpriteUrl("turtle", "cuddle")).resolves.toBe("https://fresh.example/turtle-cuddle.png");
    expect(mockGetTempFileURL).toHaveBeenNthCalledWith(1, {
      fileList: [{ fileID: GECKO_IDLE_FILE_ID, maxAge: TEMP_URL_MAX_AGE_SECONDS }],
    });
    expect(mockGetTempFileURL).toHaveBeenNthCalledWith(2, {
      fileList: [{ fileID: TURTLE_CUDDLE_FILE_ID, maxAge: TEMP_URL_MAX_AGE_SECONDS }],
    });
  });

  test("resolves every configured pet food icon storage path", async () => {
    mockGetTempFileURL.mockImplementation(({ fileList }) => {
      const fileID = fileList[0].fileID;
      const fileName = String(fileID).split("/").pop();
      return Promise.resolve({
        fileList: [{ tempFileURL: `https://fresh.example/${fileName}` }],
      });
    });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const [{ resolveFoodIconUrl }, { PET_SKIN_NAME, getFoodItemsForPetSkin }] = await Promise.all([
      import("../../src/config/remoteAssets"),
      import("../../src/pages/pet/types"),
    ]);

    const foodImageIds = new Set(
      Object.keys(PET_SKIN_NAME).flatMap((skin) =>
        getFoodItemsForPetSkin(skin as keyof typeof PET_SKIN_NAME).map((food) => food.imageId),
      ),
    );

    for (const foodImageId of foodImageIds) {
      await expect(resolveFoodIconUrl(foodImageId)).resolves.toBe(`https://fresh.example/food-${foodImageId}.png`);
    }
  });

  test("resolves every generated feeding icon used by the pet menu", async () => {
    mockGetTempFileURL.mockImplementation(({ fileList }) => {
      const fileID = fileList[0].fileID;
      const fileName = String(fileID).split("/").pop();
      return Promise.resolve({
        fileList: [{ tempFileURL: `https://fresh.example/${fileName}` }],
      });
    });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const { resolveFoodIconUrl } = await import("../../src/config/remoteAssets");

    for (const foodImageId of GENERATED_FOOD_IMAGE_IDS) {
      await expect(resolveFoodIconUrl(foodImageId)).resolves.toBe(`https://fresh.example/food-${foodImageId}.png`);
    }
  });

  test("forces a fresh food icon URL when the cached temp URL has expired", async () => {
    writeFoodAssetCache({
      expiresAt: Date.now() - 1,
      permanent: false,
      url: "https://cached.example/food-biscuit.png?q-sign-algorithm=test",
    });
    mockGetTempFileURL.mockResolvedValue({
      fileList: [{ tempFileURL: "https://fresh.example/food-biscuit.png" }],
    });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const { resolveFoodIconUrl } = await import("../../src/config/remoteAssets");

    await expect(resolveFoodIconUrl("biscuit", { forceRefresh: true })).resolves.toBe(
      "https://fresh.example/food-biscuit.png",
    );
    expect(mockGetTempFileURL).toHaveBeenCalledWith({
      fileList: [{ fileID: BISCUIT_FILE_ID, maxAge: TEMP_URL_MAX_AGE_SECONDS }],
    });
  });

  test("requests a 30-day private URL and treats returned maxAge as seconds", async () => {
    process.env.TARO_REMOTE_ASSETS_PUBLIC = "false";
    mockGetTempFileURL.mockResolvedValue({
      fileList: [
        {
          tempFileURL: "https://fresh.example/cat-idle.png?q-sign-algorithm=test",
          maxAge: TEMP_URL_MAX_AGE_SECONDS,
        },
      ],
    });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");
    await resolvePetSpriteUrl("cat", "idle");

    expect(mockGetTempFileURL).toHaveBeenCalledWith({
      fileList: [{ fileID: CAT_IDLE_FILE_ID, maxAge: TEMP_URL_MAX_AGE_SECONDS }],
    });
    expect(JSON.parse(mockStorage.get(CACHE_KEY) || "{}").assets[CAT_IDLE_FILE_ID]).toMatchObject({
      expiresAt: Date.now() + (TEMP_URL_MAX_AGE_SECONDS - 60) * 1000,
      permanent: false,
    });
  });

  test("uses the signed URL deadline when it is shorter than the requested cache duration", async () => {
    process.env.TARO_REMOTE_ASSETS_PUBLIC = "false";
    const signedExpirySeconds = Math.floor(Date.now() / 1000) + 20 * 60;
    mockGetTempFileURL.mockResolvedValue({
      fileList: [
        {
          tempFileURL:
            `https://fresh.example/cat-idle.png?q-sign-algorithm=test` +
            `&q-sign-time=${Math.floor(Date.now() / 1000)}%3B${signedExpirySeconds}`,
        },
      ],
    });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");
    await resolvePetSpriteUrl("cat", "idle");

    expect(JSON.parse(mockStorage.get(CACHE_KEY) || "{}").assets[CAT_IDLE_FILE_ID]).toMatchObject({
      expiresAt: signedExpirySeconds * 1000 - 60 * 1000,
      permanent: false,
    });
  });
});
