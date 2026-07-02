jest.mock("@cloudbase/node-sdk", () => ({
  init: jest.fn(),
  SYMBOL_CURRENT_ENV: "current",
}), { virtual: true });

const tcb = require("@cloudbase/node-sdk");
const {
  configureImageModel,
  generateImage,
  getReferenceImageUrls,
  getImageUrl,
} = require("../../cloudfunctions/customPetImageGenerator/index");

describe("custom pet image generator function", () => {
  test("extracts CloudBase image URLs from supported response shapes", () => {
    expect(getImageUrl({ imageUrl: "https://example.com/direct.png" })).toBe(
      "https://example.com/direct.png",
    );
    expect(getImageUrl({ data: [{ url: "https://example.com/sdk.png" }] })).toBe(
      "https://example.com/sdk.png",
    );
  });

  test("returns the WeChat cloud image function contract", async () => {
    const generateImageMock = jest.fn().mockResolvedValue({
      data: [{
        url: "https://example.com/generated.png",
        revised_prompt: "optimized prompt",
      }],
    });
    tcb.init.mockReturnValue({
      ai: () => ({
        createImageModel: () => ({
          generateImage: generateImageMock,
          generateImageSubUrlConfig: {
            "hunyuan-image": {},
          },
        }),
      }),
    });

    await expect(generateImage("一只小狗", {
      referenceImageUrl: "https://example.com/source.jpg",
      poseImageUrl: "https://example.com/pose.png",
    })).resolves.toEqual({
      success: true,
      imageUrl: "https://example.com/generated.png",
      revised_prompt: "optimized prompt",
      expiresIn: 86400,
    });
    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "HY-Image-3.0-Plus-4090-Tob-v1.0",
        prompt: "一只小狗",
        footnote: "",
        revise: { value: false },
        enable_thinking: { value: false },
        image_urls: [
          "https://example.com/source.jpg",
          "https://example.com/pose.png",
        ],
      }),
    );
    expect(generateImageMock.mock.calls[0][0]).not.toHaveProperty("image_url");
    expect(generateImageMock.mock.calls[0][0]).not.toHaveProperty("pose_image_url");
  });

  test("configures the CloudBase image generation sub-url for the upgraded model", () => {
    const model = configureImageModel({});

    expect(model.generateImageSubUrlConfig).toEqual({
      "hunyuan-image": [
        [/^HY-Image-3.0-Plus-4090-Tob-v1.0$/, "images/ar/generations"],
      ],
    });
    expect(model.generateImageSubUrl).toBe("images/ar/generations");
  });

  test("sends a single reference image URL when only one reference exists", async () => {
    const generateImageMock = jest.fn().mockResolvedValue({
      data: [{
        url: "https://example.com/generated.png",
      }],
    });

    await expect(generateImage("一只小狗", {
      model: {
        generateImage: generateImageMock,
      },
      referenceImageUrl: "https://example.com/source.jpg",
    })).resolves.toMatchObject({
      success: true,
      imageUrl: "https://example.com/generated.png",
    });

    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        image_urls: ["https://example.com/source.jpg"],
      }),
    );
    expect(generateImageMock.mock.calls[0][0]).not.toHaveProperty("image_url");
    expect(generateImageMock.mock.calls[0][0]).not.toHaveProperty("pose_image_url");
  });

  test("builds reference image URLs without empty entries", () => {
    expect(getReferenceImageUrls({
      referenceImageUrl: "https://example.com/source.jpg",
    })).toEqual(["https://example.com/source.jpg"]);
    expect(getReferenceImageUrls({
      poseImageUrl: "https://example.com/pose.png",
    })).toEqual(["https://example.com/pose.png"]);
    expect(getReferenceImageUrls({})).toEqual([]);
  });
});
