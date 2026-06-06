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

const CACHE_KEY = "remote_asset_url_cache_v1";
const CAT_IDLE_FILE_ID = "cloud://test-env.test-bucket/assets/pets/cat-idle.png";
const GECKO_IDLE_FILE_ID = "cloud://test-env.test-bucket/assets/pets/gecko-idle.png";
const TURTLE_CUDDLE_FILE_ID = "cloud://test-env.test-bucket/assets/pets/turtle-cuddle.png";
const BISCUIT_FILE_ID = "cloud://test-env.test-bucket/assets/pets/food-biscuit.png";
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

function writeAssetCache(updatedDate: string, url: string) {
  mockStorage.set(
    CACHE_KEY,
    JSON.stringify({
      version: 1,
      assets: {
        [CAT_IDLE_FILE_ID]: {
          updatedDate,
          url,
        },
      },
    }),
  );
}

function writeFoodAssetCache(updatedDate: string, url: string) {
  mockStorage.set(
    CACHE_KEY,
    JSON.stringify({
      version: 1,
      assets: {
        [BISCUIT_FILE_ID]: {
          updatedDate,
          url,
        },
      },
    }),
  );
}

async function flushBackgroundRefresh() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("remoteAssets", () => {
  beforeEach(() => {
    jest.resetModules();
    mockStorage.clear();
    mockGetTempFileURL.mockReset();
    mockEnsureCloudReady.mockReset();
    process.env.TARO_CLOUD_ENV_ID = "test-env";
    process.env.TARO_CLOUD_STORAGE_BUCKET = "test-bucket";
    jest.useFakeTimers().setSystemTime(new Date("2026-06-05T08:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("uses same-day local pet image cache without requesting cloud URL", async () => {
    writeAssetCache("2026-06-05", "https://cached.example/cat-idle.png");

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");
    const url = await resolvePetSpriteUrl("cat", "idle");

    expect(url).toBe("https://cached.example/cat-idle.png");
    expect(mockEnsureCloudReady).not.toHaveBeenCalled();
  });

  test("returns stale cached pet image immediately and refreshes it once per day", async () => {
    writeAssetCache("2026-06-04", "https://cached.example/cat-idle.png");
    mockGetTempFileURL.mockResolvedValue({
      fileList: [{ tempFileURL: "https://fresh.example/cat-idle.png" }],
    });
    mockEnsureCloudReady.mockResolvedValue({
      getTempFileURL: mockGetTempFileURL,
    });

    const { resolvePetSpriteUrl } = await import("../../src/config/remoteAssets");
    const url = await resolvePetSpriteUrl("cat", "idle");
    await flushBackgroundRefresh();

    expect(url).toBe("https://cached.example/cat-idle.png");
    expect(mockGetTempFileURL).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockStorage.get(CACHE_KEY) || "{}").assets[CAT_IDLE_FILE_ID]).toEqual({
      updatedDate: "2026-06-05",
      url: "https://fresh.example/cat-idle.png",
    });
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
      updatedDate: "2026-06-05",
      url: "https://fresh.example/cat-idle.png",
    });
  });

  test("reads same-day cached food icon URL before any cloud refresh", async () => {
    writeFoodAssetCache("2026-06-05", "https://cached.example/food-biscuit.png");

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
      fileList: [GECKO_IDLE_FILE_ID],
    });
    expect(mockGetTempFileURL).toHaveBeenNthCalledWith(2, {
      fileList: [TURTLE_CUDDLE_FILE_ID],
    });
  });

  test("resolves every configured pet food icon storage path", async () => {
    mockGetTempFileURL.mockImplementation(({ fileList }) => {
      const fileID = fileList[0];
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
      const fileID = fileList[0];
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
    writeFoodAssetCache("2026-06-04", "https://cached.example/food-biscuit.png");
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
      fileList: [BISCUIT_FILE_ID],
    });
  });
});
