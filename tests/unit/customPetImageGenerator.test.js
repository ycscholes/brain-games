jest.mock("@cloudbase/node-sdk", () => ({
  init: jest.fn(),
  SYMBOL_CURRENT_ENV: "current",
}), { virtual: true });

const tcb = require("@cloudbase/node-sdk");
const {
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
        }),
      }),
    });

    await expect(generateImage("一只小狗")).resolves.toEqual({
      success: true,
      imageUrl: "https://example.com/generated.png",
      revised_prompt: "optimized prompt",
      expiresIn: 86400,
    });
    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "hunyuan-image",
        prompt: "一只小狗",
        revise: true,
      }),
    );
  });
});
