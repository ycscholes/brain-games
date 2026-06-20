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
jest.mock("wx-server-sdk", () => ({
  callFunction: jest.fn(),
}), { virtual: true });

const {
  analyzeSource,
  generateAiArtImage,
  generateAiArtSheetImage,
  generateCloudBaseImage,
  generateCloudBaseFunctionImage,
  generateCloudBaseSheetImage,
  buildMoodPrompt,
  buildMoodSheetPrompt,
  normalizeAnalysis,
  parseImageGenerationFunctionResult,
  splitMoodSheet,
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

  test("builds a bounded 2x2 mood sheet prompt", () => {
    const prompt = buildMoodSheetPrompt({
      speciesLabel: "小狗",
      traits: { primaryColor: "黑白" },
    });

    expect(prompt).toContain("2x2");
    expect(prompt).toContain("左上 idle");
    expect(prompt).toContain("右上 feed");
    expect(prompt).toContain("左下 cuddle");
    expect(prompt).toContain("右下 hungry");
    expect(prompt).toContain("#00FF00");
    expect(prompt.length).toBeLessThanOrEqual(520);
  });

  test("uses the generated image cloud function contract as the default source", async () => {
    const cloudFunction = jest.fn().mockResolvedValue({
      result: {
        success: true,
        imageUrl: "https://example.com/generated.png",
        revised_prompt: "optimized prompt",
      },
    });
    const downloadImage = jest.fn().mockResolvedValue(Buffer.from("png"));

    await expect(
      generateCloudBaseFunctionImage({
        prompt: "一只小狗",
        cloudFunction,
        downloadImage,
      }),
    ).resolves.toEqual(Buffer.from("png"));

    expect(cloudFunction).toHaveBeenCalledWith({
      name: "customPetImageGenerator",
      data: { prompt: "一只小狗" },
    });
    expect(downloadImage).toHaveBeenCalledWith("https://example.com/generated.png");
  });

  test("keeps CloudBase image model output URL as an injectable fallback", async () => {
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

  test("uses one CloudBase image request for the mood sheet", async () => {
    const generateImage = jest.fn().mockResolvedValue({
      data: [{ url: "https://example.com/generated-sheet.png" }],
    });
    const downloadImage = jest.fn().mockResolvedValue(Buffer.from("sheet"));

    await expect(
      generateCloudBaseSheetImage({
        speciesLabel: "小狗",
        traits: { primaryColor: "黑白" },
        imageModel: { generateImage },
        downloadImage,
      }),
    ).resolves.toEqual(Buffer.from("sheet"));

    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("2x2"),
        size: "1024x1024",
      }),
    );
  });

  test("parses image generation cloud function failures", () => {
    expect(() =>
      parseImageGenerationFunctionResult({
        result: {
          success: false,
          code: "429",
          message: "quota exceeded",
        },
      }),
    ).toThrow("quota exceeded");
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

  test("keeps Tencent AIArt sheet generation as one image-to-image request", async () => {
    const ImageToImage = jest.fn().mockResolvedValue({
      ResultImage: Buffer.from("sheet").toString("base64"),
    });

    await expect(
      generateAiArtSheetImage({
        referenceBuffer: Buffer.from("source"),
        speciesLabel: "小狗",
        traits: { primaryColor: "黑白" },
        client: { ImageToImage },
      }),
    ).resolves.toEqual(Buffer.from("sheet"));

    expect(ImageToImage).toHaveBeenCalledTimes(1);
    expect(ImageToImage).toHaveBeenCalledWith(
      expect.objectContaining({
        Prompt: expect.stringContaining("2x2"),
        ResultConfig: { Resolution: "1024:1024" },
      }),
    );
  });

  test("splits a 2x2 mood sheet in the fixed mood order", async () => {
    const jimp = require("jimp");
    const cropCalls = [];
    const makeCell = () => ({
      crop: jest.fn((frame) => {
        cropCalls.push(frame);
        return {
          getBuffer: jest.fn(async () => Buffer.from(`${frame.x},${frame.y}`)),
        };
      }),
    });
    jimp.Jimp.read = jest.fn().mockResolvedValue({
      bitmap: { width: 1024, height: 1024 },
      clone: jest.fn(makeCell),
    });

    await expect(splitMoodSheet({ inputBuffer: Buffer.from("sheet") })).resolves.toEqual({
      idle: Buffer.from("0,0"),
      feed: Buffer.from("512,0"),
      cuddle: Buffer.from("0,512"),
      hungry: Buffer.from("512,512"),
    });
    expect(cropCalls).toEqual([
      { x: 0, y: 0, w: 512, h: 512 },
      { x: 512, y: 0, w: 512, h: 512 },
      { x: 0, y: 512, w: 512, h: 512 },
      { x: 512, y: 512, w: 512, h: 512 },
    ]);
  });
});
