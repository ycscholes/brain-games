jest.mock("@cloudbase/node-sdk", () => ({
  init: jest.fn(),
  SYMBOL_CURRENT_ENV: "current",
}), { virtual: true });

const tcb = require("@cloudbase/node-sdk");
const {
  configureImageModel,
  generateImage,
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
        image_url: "https://example.com/source.jpg",
        pose_image_url: "https://example.com/pose.png",
      }),
    );
  });

  test("configures the CloudBase image generation sub-url for the upgraded model", () => {
    const model = configureImageModel({});

    expect(model.generateImageSubUrlConfig).toEqual({
      "hunyuan-image": {
        "HY-Image-3.0-Plus-4090-Tob-v1.0": "images/ar/generations",
      },
    });
  });
});
