import { shouldPreloadImageWithGetImageInfo } from "../../src/utils/imagePreload";

describe("resource preloader", () => {
  test("skips SVG data URLs because getImageInfo cannot resolve them in the mini program runtime", () => {
    expect(shouldPreloadImageWithGetImageInfo("data:image/svg+xml;base64,PHN2Zy8+"))
      .toBe(false);
  });

  test("keeps raster and remote image URLs eligible for preloading", () => {
    expect(shouldPreloadImageWithGetImageInfo("/assets/background.jpg")).toBe(true);
    expect(shouldPreloadImageWithGetImageInfo("https://example.com/pet.png")).toBe(true);
  });
});
