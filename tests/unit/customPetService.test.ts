const mockStorage = new Map<string, string>();
const mockCallFunction = jest.fn();
const mockEnsureCloudReady = jest.fn();

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) || ""),
    setStorageSync: jest.fn((key: string, value: string) => mockStorage.set(key, value)),
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
    mockEnsureCloudReady.mockResolvedValue({
      callFunction: mockCallFunction,
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
});
