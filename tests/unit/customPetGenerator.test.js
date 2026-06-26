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
  generateReferencedMoodSheet,
  normalizeAnalysis,
  parseImageGenerationFunctionResult,
  pollTextToImageJob,
  splitMoodSheet,
} = require("../../cloudfunctions/shared/customPetGenerator");

describe("custom pet generator", () => {
  const forbiddenPromptTerms = /柴犬|小狗|狗|猫|小猫|食物|人手|抚摸/;
  const forbiddenReferencePromptTerms = /柴犬|小狗|狗|小猫|人手|抚摸/;

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
        traits: { primaryColor: "柴犬黑白" },
      });
      expect(prompt).toContain("水彩绘本");
      expect(prompt).toContain("#00FF00");
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
    expect(prompt).toContain("左上 idle");
    expect(prompt).toContain("右上 feed");
    expect(prompt).toContain("左下 cuddle");
    expect(prompt).toContain("右下 hungry");
    expect(prompt).toContain("#00FF00");
    expect(prompt).not.toMatch(forbiddenReferencePromptTerms);
    expect(prompt.length).toBeLessThanOrEqual(560);
  });

  test("separates user identity from state reference without species labels", () => {
    const prompt = buildMoodSheetPrompt({
      includeReferenceRoles: true,
      speciesLabel: "柴犬",
      traits: { primaryColor: "狗黄白" },
    });

    expect(prompt).toContain("第 1 张用户上传图是唯一宠物身份和外观来源，最高优先级");
    expect(prompt).toContain("物种、脸型、耳朵、眼睛、嘴吻、身体比例、毛色、花纹分布、尾巴和原有配饰");
    expect(prompt).toContain("第 2 张四状态参考图仅参考");
    expect(prompt).toContain("第 2 张里的猫只是姿态模板");
    expect(prompt).toContain("禁止复制猫脸、猫耳、猫眼、猫嘴、猫身体、猫毛色、猫花纹、猫尾巴");
    expect(prompt).toContain("禁止参考第 2 张的任何外观特征");
    expect(prompt).toContain("不得变成猫或其它动物");
    expect(prompt).toContain("不出现食物或食盆");
    expect(prompt).toContain("不出现爱心、抱枕或玩具");
    expect(prompt).toContain("两张图冲突时始终以第 1 张为准");
    expect(prompt).toContain("角色身份一致性优先于姿态一致性");
    expect(prompt).toContain("只调整姿态和表情");
    expect(prompt).not.toMatch(forbiddenReferencePromptTerms);
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
      }),
    ).resolves.toEqual(Buffer.from("png"));

    expect(cloudFunction).toHaveBeenCalledWith({
      name: "customPetImageGenerator",
      data: { prompt: "一张测试图片" },
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

  test("uses CloudBase-safe AIArt credential environment aliases", async () => {
    const { aiart } = require("tencentcloud-sdk-nodejs-aiart");
    const envKeys = [
      "CUSTOM_PET_AIART_SECRET_ID",
      "CUSTOM_PET_AIART_SECRET_KEY",
      "CUSTOM_PET_AIART_REGION",
      "TENCENTCLOUD_SECRET_ID",
      "TENCENTCLOUD_SECRET_KEY",
    ];
    const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    process.env.CUSTOM_PET_AIART_SECRET_ID = "dummy-cloudbase-safe-id";
    process.env.CUSTOM_PET_AIART_SECRET_KEY = "dummy-cloudbase-safe-key";
    process.env.CUSTOM_PET_AIART_REGION = "ap-shanghai";
    delete process.env.TENCENTCLOUD_SECRET_ID;
    delete process.env.TENCENTCLOUD_SECRET_KEY;

    const ImageToImage = jest.fn().mockResolvedValue({
      ResultImage: Buffer.from("sheet").toString("base64"),
    });
    aiart.v20221229.Client.mockImplementationOnce(() => ({ ImageToImage }));

    try {
      await generateAiArtSheetImage({
        referenceBuffer: Buffer.from("source"),
        speciesLabel: "小狗",
        traits: { primaryColor: "黑白" },
      });

      expect(aiart.v20221229.Client).toHaveBeenCalledWith(
        expect.objectContaining({
          credential: {
            secretId: "dummy-cloudbase-safe-id",
            secretKey: "dummy-cloudbase-safe-key",
            token: undefined,
          },
          region: "ap-shanghai",
        }),
      );
    } finally {
      Object.entries(previousEnv).forEach(([key, value]) => {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      });
    }
  });

  test("submits a referenced mood sheet with cat and user reference images", async () => {
    const SubmitTextToImageJob = jest.fn().mockResolvedValue({ JobId: "job-1" });
    const QueryTextToImageJob = jest.fn().mockResolvedValue({
      JobStatusCode: "5",
      ResultImage: ["https://example.com/referenced-sheet.png"],
    });
    const downloadImage = jest.fn().mockResolvedValue(Buffer.from("referenced-sheet"));

    await expect(
      generateReferencedMoodSheet({
        userReferenceBuffer: Buffer.from("user"),
        catReferenceBuffer: Buffer.from("cat"),
        speciesLabel: "小狗",
        traits: { primaryColor: "黑白" },
        client: { SubmitTextToImageJob, QueryTextToImageJob },
        downloadImage,
        sleepFn: jest.fn(),
      }),
    ).resolves.toEqual(Buffer.from("referenced-sheet"));

    expect(SubmitTextToImageJob).toHaveBeenCalledWith(
      expect.objectContaining({
        Images: [
          Buffer.from("user").toString("base64"),
          Buffer.from("cat").toString("base64"),
        ],
        LogoAdd: 0,
        Prompt: expect.stringContaining("第 1 张用户上传图是唯一宠物身份"),
        Resolution: "1024:1024",
        Revise: 0,
      }),
    );
    expect(SubmitTextToImageJob.mock.calls[0][0].Prompt).not.toMatch(forbiddenReferencePromptTerms);
    expect(QueryTextToImageJob).toHaveBeenCalledWith({ JobId: "job-1" });
    expect(downloadImage).toHaveBeenCalledWith("https://example.com/referenced-sheet.png");
  });

  test("polls Tencent text-to-image jobs until the result is ready", async () => {
    const sleepFn = jest.fn();
    const client = {
      QueryTextToImageJob: jest
        .fn()
        .mockResolvedValueOnce({ JobStatusCode: "1" })
        .mockResolvedValueOnce({ JobStatusCode: "2" })
        .mockResolvedValueOnce({
          JobStatusCode: "5",
          ResultImage: ["https://example.com/ready.png"],
          RevisedPrompt: ["optimized"],
        }),
    };

    await expect(
      pollTextToImageJob({
        jobId: "job-1",
        client,
        sleepFn,
        intervalMs: 10,
        maxAttempts: 4,
      }),
    ).resolves.toEqual({
      imageUrl: "https://example.com/ready.png",
      revisedPrompt: "optimized",
    });
    expect(sleepFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(10);
  });

  test("raises provider errors from failed text-to-image jobs", async () => {
    await expect(
      pollTextToImageJob({
        jobId: "job-1",
        client: {
          QueryTextToImageJob: jest.fn().mockResolvedValue({
            JobStatusCode: "4",
            JobErrorCode: "OperationDenied.ImageIllegalDetected",
            JobErrorMsg: "image rejected",
          }),
        },
        sleepFn: jest.fn(),
      }),
    ).rejects.toMatchObject({
      code: "OperationDenied.ImageIllegalDetected",
      message: "image rejected",
    });
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
