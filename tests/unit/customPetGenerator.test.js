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
  removeChromaKeyBackground,
  removeGeneratedSheetFootnote,
  removeNormalizedFootnote,
  shouldRemoveChromaKeyPixel,
  splitMoodSheet,
} = require("../../cloudfunctions/shared/customPetGenerator");

describe("custom pet generator", () => {
  const forbiddenPromptTerms = /人手|抚摸/;
  let consoleInfoSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
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
    expect(normalizeAnalysis({ mappedSkin: "hamster" })).toMatchObject({
      speciesLabel: "上传图中的宠物",
      mappedSkin: "rabbit",
    });
    expect(normalizeAnalysis({
      speciesLabel: "欧亚鸲",
      mappedSkin: "bird",
      traits: { bodyShape: "有喙、羽毛、翅膀，爪趾站在树枝上" },
    })).toMatchObject({
      speciesLabel: "欧亚鸲",
      mappedSkin: "rabbit",
      traits: {
        bodyShape: "有喙、羽毛、翅膀，爪趾站在树枝上",
      },
    });
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
      speciesLabel: "上传图中的宠物",
      mappedSkin: "rabbit",
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[custom-pet-generator] analysis summary",
      expect.stringContaining("\"status\":\"request_failed\""),
    );
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
    expect(generateText.mock.calls[0][0].messages[0].content).toContain(
      "先判断开放物种类别",
    );
    expect(generateText.mock.calls[0][0].messages[0].content).toContain(
      "看到喙、羽毛、翅膀",
    );
    expect(generateText.mock.calls[0][0].messages[1].content[0].text).toContain(
      "若图中是鸟",
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[custom-pet-generator] text prompt",
      expect.stringContaining("\"operation\":\"analyzeSource\""),
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[custom-pet-generator] analysis summary",
      expect.stringContaining("\"status\":\"ok\""),
    );
    expect(consoleInfoSpy.mock.calls[0][1]).not.toContain("base64");
  });

  test("logs weak analysis without falling back to a cat identity", async () => {
    const generateText = jest.fn().mockResolvedValue({
      text: JSON.stringify({
        speciesLabel: "未知",
        mappedSkin: "hamster",
        traits: { primaryColor: "浅棕色" },
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
      speciesLabel: "上传图中的宠物",
      mappedSkin: "rabbit",
      traits: {
        primaryColor: "浅棕色",
      },
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[custom-pet-generator] analysis summary",
      expect.stringContaining("\"status\":\"weak_species\""),
    );
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
      expect(prompt).toContain("辅助分析");
      expect(prompt).toContain("柴犬黑白");
      expect(prompt).toContain("用户上传参考图");
      expect(prompt).toContain("如果辅助分析的物种");
      expect(prompt).toContain("姿态参考图只用于四宫格布局和姿态参考");
      expect(prompt).toContain("禁止把宠物改画成猫、狗");
      expect(prompt).not.toMatch(forbiddenPromptTerms);
      expect(prompt.length).toBeLessThanOrEqual(520);
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
    expect(prompt).toContain("辅助分析");
    expect(prompt).toContain("柴犬黑白");
    expect(prompt).toContain("用户上传参考图");
    expect(prompt).toContain("如果辅助分析的物种");
    expect(prompt).toContain("姿态参考图只用于四宫格布局和姿态参考");
    expect(prompt).toContain("禁止把宠物改画成猫、狗");
    expect(prompt).not.toMatch(forbiddenPromptTerms);
    expect(prompt.length).toBeLessThanOrEqual(1200);
  });

  test("keeps the custom-pet identity in the CloudBase text-to-image prompt", () => {
    const prompt = buildMoodSheetPrompt({
      speciesLabel: "柴犬",
      traits: { primaryColor: "狗黄白" },
    });

    expect(prompt).toContain("用户上传图分析得到的同一只宠物");
    expect(prompt).toContain("辅助分析（若与参考图冲突必须忽略）：物种线索：柴犬");
    expect(prompt).toContain("主色：狗黄白");
    expect(prompt).toContain("不出现食物或食盆");
    expect(prompt).toContain("不出现爱心、抱枕或玩具");
    expect(prompt).toContain("只调整姿态和表情");
    expect(prompt).toContain("最终结果必须明显是 2x2 四宫格");
    expect(prompt).toContain("用户上传参考图是物种");
    expect(prompt).toContain("不得覆盖用户上传图中的物种和外观");
    expect(prompt).not.toMatch(/人手|抚摸/);
    expect(prompt.length).toBeLessThanOrEqual(1200);
  });

  test("keeps a misclassified species label lower priority than the reference image", () => {
    const prompt = buildMoodSheetPrompt({
      speciesLabel: "猫",
      traits: {
        primaryColor: "白色",
        markings: "脸部有浅棕色斑块",
        bodyShape: "中等体型，四肢修长，尾巴细长",
      },
    });

    expect(prompt).toContain("身份优先级：用户上传参考图是物种");
    expect(prompt).toContain("辅助分析（若与参考图冲突必须忽略）：物种线索：猫");
    expect(prompt).toContain("如果辅助分析的物种、体型或器官描述与用户上传参考图冲突，必须忽略辅助分析");
  });

  test("preserves bird morphology in the image prompt", () => {
    const prompt = buildMoodSheetPrompt({
      speciesLabel: "欧亚鸲",
      traits: {
        primaryColor: "橙黄色胸腹、灰褐色背羽、白色腹部",
        markings: "圆眼、细尖喙、翅膀深褐色",
        bodyShape: "小型鸟类，双爪站在树枝上",
      },
    });

    expect(prompt).toContain("物种线索：欧亚鸲");
    expect(prompt).toContain("细尖喙");
    expect(prompt).toContain("翅膀深褐色");
    expect(prompt).toContain("必须保留参考图的真实动物结构");
    expect(prompt).toContain("必须生成鸟类");
    expect(prompt).toContain("禁止改成狗、猫、兔");
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
        image_urls: [
          "https://example.com/source.jpg",
          "https://example.com/pose.png",
        ],
      }),
    );
    expect(imageModel.generateImageSubUrlConfig[CLOUD_BASE_IMAGE_MODEL_CLIENT_NAME]).toEqual([
      [new RegExp(`^${CLOUD_BASE_IMAGE_MODEL_NAME}$`), "images/ar/generations"],
    ]);
    expect(imageModel.generateImageSubUrl).toBe("images/ar/generations");
    expect(generateImage.mock.calls[0][0]).not.toHaveProperty("image_url");
    expect(generateImage.mock.calls[0][0]).not.toHaveProperty("pose_image_url");
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
        image_urls: [
          "https://example.com/source.jpg",
          "https://example.com/pose.png",
        ],
      }),
    );
    expect(generateImage.mock.calls[0][0]).not.toHaveProperty("image_url");
    expect(generateImage.mock.calls[0][0]).not.toHaveProperty("pose_image_url");
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

  test("detects chroma-key green variants without erasing normal pet colors", () => {
    expect(shouldRemoveChromaKeyPixel(0, 255, 0)).toBe(true);
    expect(shouldRemoveChromaKeyPixel(28, 230, 24)).toBe(true);
    expect(shouldRemoveChromaKeyPixel(82, 180, 55)).toBe(true);
    expect(shouldRemoveChromaKeyPixel(130, 220, 60)).toBe(true);
    expect(shouldRemoveChromaKeyPixel(170, 126, 42)).toBe(false);
    expect(shouldRemoveChromaKeyPixel(80, 80, 80)).toBe(false);
    expect(shouldRemoveChromaKeyPixel(62, 96, 138)).toBe(false);
  });

  test("removes green background before users receive normalized sprites", () => {
    const width = 4;
    const height = 3;
    const data = Buffer.alloc(width * height * 4, 0);
    const setPixel = (x, y, red, green, blue, alpha = 255) => {
      const offset = (width * y + x) * 4;
      data[offset] = red;
      data[offset + 1] = green;
      data[offset + 2] = blue;
      data[offset + 3] = alpha;
    };
    setPixel(0, 0, 0, 255, 0);
    setPixel(1, 0, 82, 180, 55);
    setPixel(2, 0, 130, 220, 60);
    setPixel(1, 1, 214, 126, 42);
    setPixel(2, 1, 62, 96, 138);

    const bounds = removeChromaKeyBackground({
      bitmap: { width, height, data },
      scan(callback) {
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            callback(x, y, (width * y + x) * 4);
          }
        }
      },
    });

    expect(data[(width * 0 + 0) * 4 + 3]).toBe(0);
    expect(data[(width * 0 + 1) * 4 + 3]).toBe(0);
    expect(data[(width * 0 + 2) * 4 + 3]).toBe(0);
    expect(data[(width * 1 + 1) * 4 + 3]).toBe(255);
    expect(data[(width * 1 + 2) * 4 + 3]).toBe(255);
    expect(bounds).toEqual({ minX: 1, minY: 1, maxX: 2, maxY: 1 });
  });

  test("removes the generated provider footnote without erasing saturated pet pixels", () => {
    const width = 100;
    const height = 100;
    const data = Buffer.alloc(width * height * 4, 0);
    const setPixel = (x, y, red, green, blue, alpha = 255) => {
      const offset = (width * y + x) * 4;
      data[offset] = red;
      data[offset + 1] = green;
      data[offset + 2] = blue;
      data[offset + 3] = alpha;
    };
    setPixel(92, 92, 104, 104, 104);
    setPixel(71, 88, 214, 126, 42);
    setPixel(10, 10, 104, 104, 104);

    removeGeneratedSheetFootnote({ bitmap: { width, height, data } });

    const footnoteOffset = (width * 92 + 92) * 4;
    expect([...data.subarray(footnoteOffset, footnoteOffset + 4)]).toEqual([0, 255, 0, 255]);

    const petOffset = (width * 88 + 71) * 4;
    expect([...data.subarray(petOffset, petOffset + 4)]).toEqual([214, 126, 42, 255]);

    const outsideOffset = (width * 10 + 10) * 4;
    expect([...data.subarray(outsideOffset, outsideOffset + 4)]).toEqual([104, 104, 104, 255]);
  });

  test("clears residual footnote pixels from the normalized sprite corner", () => {
    const width = 100;
    const height = 100;
    const data = Buffer.alloc(width * height * 4, 0);
    const setPixel = (x, y, red, green, blue, alpha = 255) => {
      const offset = (width * y + x) * 4;
      data[offset] = red;
      data[offset + 1] = green;
      data[offset + 2] = blue;
      data[offset + 3] = alpha;
    };
    setPixel(92, 92, 166, 166, 148);
    setPixel(71, 88, 214, 126, 42);
    setPixel(10, 10, 166, 166, 148);

    removeNormalizedFootnote({ bitmap: { width, height, data } });

    const footnoteOffset = (width * 92 + 92) * 4;
    expect(data[footnoteOffset + 3]).toBe(0);

    const petOffset = (width * 88 + 71) * 4;
    expect([...data.subarray(petOffset, petOffset + 4)]).toEqual([214, 126, 42, 255]);

    const outsideOffset = (width * 10 + 10) * 4;
    expect([...data.subarray(outsideOffset, outsideOffset + 4)]).toEqual([166, 166, 148, 255]);
  });
});
