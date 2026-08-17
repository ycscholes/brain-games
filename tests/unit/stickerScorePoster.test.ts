jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: (() => {
    const canvasContext = {
      setFillStyle: jest.fn(),
      fillRect: jest.fn(),
      setFontSize: jest.fn(),
      setTextAlign: jest.fn(),
      fillText: jest.fn(),
      setStrokeStyle: jest.fn(),
      setLineWidth: jest.fn(),
      strokeRect: jest.fn(),
      draw: jest.fn((_reserve: boolean, callback: () => void) => callback()),
    };
    return {
      createCanvasContext: jest.fn(() => canvasContext),
      canvasToTempFilePath: jest.fn(),
    };
  })(),
}));

import Taro from "@tarojs/taro";
import { exportStickerScorePoster } from "../../src/utils/stickerScorePoster";

const mockTaro = Taro as unknown as {
  createCanvasContext: jest.Mock;
  canvasToTempFilePath: jest.Mock;
};

describe("sticker score poster", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTaro.canvasToTempFilePath.mockResolvedValue({ tempFilePath: "wxfile://score-poster.png" });
  });

  test("draws a score-specific poster and exports a PNG temporary file", async () => {
    await expect(exportStickerScorePoster({
      canvasId: "sticker-score-poster",
      gameTitle: "奇趣记忆",
      score: 16,
    })).resolves.toBe("wxfile://score-poster.png");

    const mockCanvasContext = mockTaro.createCanvasContext.mock.results[0].value;
    expect(mockTaro.createCanvasContext).toHaveBeenCalledWith("sticker-score-poster");
    expect(mockCanvasContext.fillText).toHaveBeenCalledWith("奇趣记忆", 375, 302);
    expect(mockCanvasContext.fillText).toHaveBeenCalledWith("16", 375, 466);
    expect(mockTaro.canvasToTempFilePath).toHaveBeenCalledWith(expect.objectContaining({
      canvasId: "sticker-score-poster",
      fileType: "png",
      width: 750,
      height: 960,
    }));
  });

  test("rejects when Canvas cannot export the poster", async () => {
    mockTaro.canvasToTempFilePath.mockRejectedValue(new Error("export failed"));

    await expect(exportStickerScorePoster({
      canvasId: "sticker-score-poster",
      gameTitle: "奇趣记忆",
      score: 16,
    })).rejects.toThrow("export failed");
  });
});
