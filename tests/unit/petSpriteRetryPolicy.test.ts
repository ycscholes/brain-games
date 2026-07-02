import {
  PET_IMAGE_RETRY_DELAYS_MS,
  getPetImageRetryDelayMs,
} from "../../src/pages/pet/components/PetSprite/retryPolicy";

describe("pet sprite retry policy", () => {
  test("uses bounded automatic reload delays", () => {
    expect(PET_IMAGE_RETRY_DELAYS_MS).toEqual([300, 1000, 2500, 5000]);
    expect(getPetImageRetryDelayMs(0)).toBe(300);
    expect(getPetImageRetryDelayMs(1)).toBe(1000);
    expect(getPetImageRetryDelayMs(2)).toBe(2500);
    expect(getPetImageRetryDelayMs(3)).toBe(5000);
    expect(getPetImageRetryDelayMs(4)).toBeNull();
  });
});
