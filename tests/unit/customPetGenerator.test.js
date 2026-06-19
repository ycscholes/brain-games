jest.mock("jimp", () => ({ Jimp: {}, JimpMime: {} }), { virtual: true });
jest.mock("@cloudbase/node-sdk", () => ({
  init: jest.fn(),
  SYMBOL_CURRENT_ENV: "current",
}), { virtual: true });
jest.mock("tencentcloud-sdk-nodejs-aiart", () => ({
  aiart: {
    v20221229: {
      Client: jest.fn(),
    },
  },
}), { virtual: true });

const {
  analyzeSource,
  generateAiArtImage,
  generateCloudBaseImage,
  buildMoodPrompt,
  normalizeAnalysis,
} = require("../../cloudfunctions/shared/customPetGenerator");

describe("custom pet generator", () => {
  test("normalizes the classifier to one supported template", () => {
    expect(normalizeAnalysis({
      speciesLabel: "豹纹守宫",
      mappedSkin: "gecko",
      traits: { primaryColor: "黄色" },
    })).toMatchObject({
      speciesLabel: "豹纹守宫",
      mappedSkin: "gecko",
      traits: {
        primaryColor: "黄色",
      },
    });
    expect(normalizeAnalysis({ mappedSkin: "hamster" }).mappedSkin).toBe("cat");
  });

  test("normalizes null traits into a writable object", () => {
    expect(normalizeAnalysis({ traits: null })).toMatchObject({
      traits: {
        primaryColor: expect.any(String),
        secondaryColor: expect.any(String),
        markings: expect.any(String),
        bodyShape: expect.any(String),
        accessories: expect.any(String),
      },
    });
  });

  test("falls back to default source analysis when the AI SDK is not ready", async () => {
    await expect(analyzeSource({ sourceBuffer: Buffer.from("source") })).resolves.toMatchObject({
      speciesLabel: "自定义宠物",
      mappedSkin: "cat",
    });
  });

  test("builds a bounded watercolor chroma-key prompt for every mood", () => {
    ["idle", "feed", "cuddle", "hungry"].forEach((mood) => {
      const prompt = buildMoodPrompt({
        mood,
        speciesLabel: "小狗",
        traits: { primaryColor: "黑白" },
      });
      expect(prompt).toContain("水彩绘本");
      expect(prompt).toContain("#00FF00");
      expect(prompt.length).toBeLessThanOrEqual(250);
    });
  });

  test("uses CloudBase image model output URL as the default generated image source", async () => {
    const generateImage = jest.fn().mockResolvedValue({
      data: [{ url: "https://example.com/generated.png" }],
    });
    const downloadImage = jest.fn().mockResolvedValue(Buffer.from("png"));

    await expect(
      generateCloudBaseImage({
        mood: "idle",
        speciesLabel: "小狗",
        traits: { primaryColor: "黑白" },
        imageModel: { generateImage },
        downloadImage,
      }),
    ).resolves.toEqual(Buffer.from("png"));

    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "hunyuan-image",
        size: "1024x1024",
        version: "v1.9",
      }),
    );
    expect(downloadImage).toHaveBeenCalledWith("https://example.com/generated.png");
  });

  test("keeps Tencent AIArt as an explicit image-to-image fallback", async () => {
    const ImageToImage = jest.fn().mockResolvedValue({
      ResultImage: Buffer.from("png").toString("base64"),
    });

    await expect(
      generateAiArtImage({
        referenceBuffer: Buffer.from("source"),
        mood: "idle",
        speciesLabel: "小狗",
        traits: { primaryColor: "黑白" },
        client: { ImageToImage },
      }),
    ).resolves.toEqual(Buffer.from("png"));

    expect(ImageToImage).toHaveBeenCalledWith(
      expect.objectContaining({
        RspImgType: "base64",
        ResultConfig: { Resolution: "768:768" },
      }),
    );
  });
});
