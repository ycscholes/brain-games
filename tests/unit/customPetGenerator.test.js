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
});
