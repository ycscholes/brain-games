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
});
