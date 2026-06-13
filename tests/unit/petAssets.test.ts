import {
  createCustomPetAssetRef,
  createStandardPetAssetRef,
  getPetAssetKey,
  getPetAssetRef,
  getPetTemplateSkin,
} from "../../src/pages/pet/petAssets";
import type { PetData } from "../../src/pages/pet/types";

function createPet(overrides: Partial<PetData> = {}): PetData {
  return {
    id: "pet-1",
    name: "团子",
    skin: "cat",
    status: "alive",
    hunger: 100,
    level: 1,
    experience: 0,
    createdAt: "2026-06-14T00:00:00.000Z",
    lastUpdated: "2026-06-14T00:00:00.000Z",
    deathTime: null,
    ...overrides,
  };
}

describe("pet asset references", () => {
  test("normalizes a legacy pet to a standard asset reference", () => {
    const pet = createPet({ skin: "dog" });

    expect(getPetAssetRef(pet)).toEqual(createStandardPetAssetRef("dog"));
    expect(getPetTemplateSkin(pet)).toBe("dog");
  });

  test("uses the mapped template for a custom pet", () => {
    const pet = createPet({
      skin: "rabbit",
      assetRef: createCustomPetAssetRef("rabbit", "asset-1"),
    });

    expect(getPetTemplateSkin(pet)).toBe("rabbit");
    expect(getPetAssetKey(getPetAssetRef(pet))).toBe("custom:asset-1");
  });
});
