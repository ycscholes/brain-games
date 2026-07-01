jest.mock("jimp", () => ({ Jimp: {}, JimpMime: {} }), { virtual: true });
jest.mock("@cloudbase/node-sdk", () => ({
  init: jest.fn(),
  SYMBOL_CURRENT_ENV: "current",
}), { virtual: true });
jest.mock("wx-server-sdk", () => ({
  callFunction: jest.fn(),
}), { virtual: true });

const {
  analyzeSource,
  generateCloudBaseImage,
  generateCloudBaseFunctionImage,
  generateCloudBaseSheetImage,
  buildMoodPrompt,
  buildMoodSheetPrompt,
  CLOUD_BASE_IMAGE_MODEL_CLIENT_NAME,
  CLOUD_BASE_IMAGE_MODEL_NAME,
  normalizeAnalysis,
  parseImageGenerationFunctionResult,
  splitMoodSheet,
} = require("../../cloudfunctions/shared/customPetGenerator");

describe("custom pet generator", () => {
  const forbiddenPromptTerms = /人手|抚摸/;
  let consoleInfoSpy;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

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

  test("logs the analysis text prompt without treating mappedSkin as the generation source", async () => {
    const generateText = jest.fn().mockResolvedValue({
      text: JSON.stringify({
        speciesLabel: "长毛白色宠物",
        mappedSkin: "cat",
        traits: { primaryColor: "白色" },
      }),
    });

    await expect(
      analyzeSource({
        sourceBuffer: Buffer.from("source"),
        app: {
          ai: () => ({
            createModel: () => ({ generateText }),
          }),
        },
      }),
    ).resolves.toMatchObject({
      speciesLabel: "长毛白色宠物",
      mappedSkin: "cat",
      traits: {
        primaryColor: "白色",
      },
    });

    expect(generateText.mock.calls[0][0].messages[0].content).toContain(
      "不得作为生成物种或外观依据",
    );
    expect(generateText.mock.calls[0][0].messages[1].content[0].text).toContain(
      "必须直接描述参考图可见特征",
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[custom-pet-generator] text prompt",
      expect.stringContaining("\"operation\":\"analyzeSource\""),
    );
    expect(consoleInfoSpy.mock.calls[0][1]).not.toContain("base64");
  });

  test("builds a bounded watercolor chroma-key prompt for every mood", () => {
    ["idle", "feed", "cuddle", "hungry"].forEach((mood) => {
      const prompt = buildMoodPrompt({
        mood,
        speciesLabel: "小狗",
        traits: { primaryColor: "柴犬黑白" },
      });
      expect(prompt).toContain("水彩绘本");
      expect(prompt).toContain("#00FF00");
      expect(prompt).toContain("物种外观");
      expect(prompt).toContain("柴犬黑白");
      expect(prompt).not.toMatch(forbiddenPromptTerms);
      expect(prompt.length).toBeLessThanOrEqual(250);
    });
  });

  test("builds a bounded 2x2 mood sheet prompt", () => {
    const prompt = buildMoodSheetPrompt({
      speciesLabel: "小狗",
      traits: { primaryColor: "柴犬黑白" },
    });

    expect(prompt).toContain("2x2");
    expect(prompt).toContain("不是单张宠物画像");
    expect(prompt).toContain("宠物不能跨越格子");
    expect(prompt).toContain("按四宫格坐标裁切");
    expect(prompt).toContain("左上 idle");
    expect(prompt).toContain("右上 feed");
    expect(prompt).toContain("左下 cuddle");
    expect(prompt).toContain("右下 hungry");
    expect(prompt).toContain("#00FF00");
    expect(prompt).toContain("物种外观");
    expect(prompt).toContain("柴犬黑白");
    expect(prompt).not.toMatch(forbiddenPromptTerms);
    expect(prompt.length).toBeLessThanOrEqual(900);
  });

  test("keeps the custom-pet identity in the CloudBase text-to-image prompt", () => {
    const prompt = buildMoodSheetPrompt({
      speciesLabel: "柴犬",
      traits: { primaryColor: "狗黄白" },
    });

    expect(prompt).toContain("用户上传图分析得到的同一只宠物");
    expect(prompt).toContain("物种外观：柴犬");
    expect(prompt).toContain("主色：狗黄白");
    expect(prompt).toContain("不出现食物或食盆");
    expect(prompt).toContain("不出现爱心、抱枕或玩具");
    expect(prompt).toContain("只调整姿态和表情");
    expect(prompt).toContain("最终结果必须明显是 2x2 四宫格");
    expect(prompt).not.toMatch(/人手|抚摸/);
    expect(prompt.length).toBeLessThanOrEqual(900);
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
        prompt: "一张测试图片",
        cloudFunction,
        downloadImage,
        referenceImageUrl: "https://example.com/source.jpg",
        poseImageUrl: "https://example.com/pose.png",
      }),
    ).resolves.toEqual(Buffer.from("png"));

    expect(cloudFunction).toHaveBeenCalledWith({
      name: "customPetImageGenerator",
      data: {
        prompt: "一张测试图片",
        referenceImageUrl: "https://example.com/source.jpg",
        poseImageUrl: "https://example.com/pose.png",
      },
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[custom-pet-generator] image prompt",
      expect.stringContaining("\"provider\":\"cloudbase-function\""),
    );
    expect(consoleInfoSpy.mock.calls[0][1]).toContain("\"negativePrompt\"");
    expect(downloadImage).toHaveBeenCalledWith("https://example.com/generated.png");
  });

  test("keeps CloudBase image model output URL as an injectable fallback", async () => {
    const generateImage = jest.fn().mockResolvedValue({
      data: [{ url: "https://example.com/generated.png" }],
    });
    const downloadImage = jest.fn().mockResolvedValue(Buffer.from("png"));
    const imageModel = {
      generateImage,
      generateImageSubUrlConfig: {
        [CLOUD_BASE_IMAGE_MODEL_CLIENT_NAME]: {},
      },
    };

    await expect(
      generateCloudBaseImage({
        mood: "idle",
        speciesLabel: "小狗",
        traits: { primaryColor: "黑白" },
        imageModel,
        downloadImage,
        referenceImageUrl: "https://example.com/source.jpg",
        poseImageUrl: "https://example.com/pose.png",
      }),
    ).resolves.toEqual(Buffer.from("png"));

    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: CLOUD_BASE_IMAGE_MODEL_NAME,
        size: "1024x1024",
        footnote: "",
        revise: { value: false },
        enable_thinking: { value: false },
        image_url: "https://example.com/source.jpg",
        pose_image_url: "https://example.com/pose.png",
      }),
    );
    expect(imageModel.generateImageSubUrlConfig[CLOUD_BASE_IMAGE_MODEL_CLIENT_NAME][CLOUD_BASE_IMAGE_MODEL_NAME])
      .toBe("images/ar/generations");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[custom-pet-generator] image prompt",
      expect.stringContaining("\"provider\":\"cloudbase-sdk\""),
    );
    expect(consoleInfoSpy.mock.calls[0][1]).toContain("\"negativePrompt\"");
    expect(consoleInfoSpy.mock.calls[0][1]).not.toMatch(forbiddenPromptTerms);
    expect(downloadImage).toHaveBeenCalledWith("https://example.com/generated.png");
  });

  test("uses one CloudBase image request for the mood sheet", async () => {
    const generateImage = jest.fn().mockResolvedValue({
      data: [{ url: "https://example.com/generated-sheet.png" }],
    });
    const downloadImage = jest.fn().mockResolvedValue(Buffer.from("sheet"));
    const imageModel = {
      generateImage,
      generateImageSubUrlConfig: {
        [CLOUD_BASE_IMAGE_MODEL_CLIENT_NAME]: {},
      },
    };

    await expect(
      generateCloudBaseSheetImage({
        speciesLabel: "小狗",
        traits: { primaryColor: "黑白" },
        imageModel,
        downloadImage,
        referenceImageUrl: "https://example.com/source.jpg",
        poseImageUrl: "https://example.com/pose.png",
      }),
    ).resolves.toEqual(Buffer.from("sheet"));

    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("2x2"),
        model: CLOUD_BASE_IMAGE_MODEL_NAME,
        size: "1024x1024",
        image_url: "https://example.com/source.jpg",
        pose_image_url: "https://example.com/pose.png",
      }),
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[custom-pet-generator] image prompt",
      expect.stringContaining("\"provider\":\"cloudbase-sdk\""),
    );
    expect(consoleInfoSpy.mock.calls[0][1]).not.toMatch(forbiddenPromptTerms);
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
