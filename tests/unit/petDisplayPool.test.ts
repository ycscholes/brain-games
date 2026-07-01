import {
  buildPetDisplayPool,
  getPetDisplayItemsForSkin,
  STANDARD_PET_DISPLAY_SKINS,
} from "../../src/pages/pet/petDisplayPool";
import { createCustomPetAssetRef } from "../../src/pages/pet/petAssets";
import type { PetData, PetSkin, PetStorageData } from "../../src/pages/pet/types";

function createPet(overrides: Partial<PetData> = {}): PetData {
  return {
    id: overrides.id || "pet-1",
    name: overrides.name || "团子",
    skin: overrides.skin || "cat",
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

function createPetStorage(overrides: Partial<PetStorageData> = {}): PetStorageData {
  return {
    pets: [],
    activePetId: null,
    balance: 0,
    adoptedCount: 0,
    lastCheckTime: "2026-06-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("pet display pool", () => {
  test("includes one custom pet and fills the rest with standard pets", () => {
    const pool = buildPetDisplayPool(createPetStorage({
      pets: [
        createPet({
          id: "custom-cat",
          name: "豆豆",
          skin: "cat",
          assetRef: createCustomPetAssetRef("cat", "asset-1"),
        }),
      ],
      activePetId: "custom-cat",
    }), { random: () => 0 });

    expect(pool).toHaveLength(STANDARD_PET_DISPLAY_SKINS.length);
    expect(pool[0]).toMatchObject({
      name: "豆豆",
      skin: "cat",
      source: "owned",
      assetRef: { kind: "custom", customAssetId: "asset-1" },
    });
    expect(pool.filter((item) => item.source === "standard")).toHaveLength(6);
    expect(pool.filter((item) => item.skin === "cat")).toHaveLength(1);
  });

  test("prioritizes the active pet and keeps other living owned pets before supplements", () => {
    const pool = buildPetDisplayPool(createPetStorage({
      pets: [
        createPet({ id: "pet-cat", name: "小猫", skin: "cat" }),
        createPet({ id: "pet-dog", name: "小狗", skin: "dog" }),
        createPet({ id: "pet-rabbit", name: "小兔", skin: "rabbit" }),
      ],
      activePetId: "pet-dog",
    }), { random: () => 0 });

    expect(pool.slice(0, 3).map((item) => item.petId)).toEqual([
      "pet-dog",
      "pet-cat",
      "pet-rabbit",
    ]);
    expect(pool.slice(0, 3).every((item) => item.source === "owned")).toBe(true);
    expect(pool).toHaveLength(STANDARD_PET_DISPLAY_SKINS.length);
  });

  test("ignores dead pets and allows their standard skin to supplement the pool", () => {
    const pool = buildPetDisplayPool(createPetStorage({
      pets: [
        createPet({
          id: "dead-cat",
          name: "旧猫",
          skin: "cat",
          status: "dead",
          deathTime: "2026-06-15T00:00:00.000Z",
        }),
        createPet({ id: "pet-dog", name: "小狗", skin: "dog" }),
      ],
      activePetId: "dead-cat",
    }), { random: () => 0 });

    expect(pool[0]).toMatchObject({ petId: "pet-dog", source: "owned" });
    expect(pool.some((item) => item.petId === "dead-cat")).toBe(false);
    expect(pool.some((item) => item.skin === "cat" && item.source === "standard")).toBe(true);
  });

  test("falls back to all standard pets when no living owned pet exists", () => {
    const pool = buildPetDisplayPool(createPetStorage({
      pets: [
        createPet({ id: "dead-cat", skin: "cat", status: "dead" }),
      ],
      activePetId: "dead-cat",
    }));

    expect(pool).toHaveLength(STANDARD_PET_DISPLAY_SKINS.length);
    expect(pool.map((item) => item.skin)).toEqual(STANDARD_PET_DISPLAY_SKINS);
    expect(pool.every((item) => item.source === "standard")).toBe(true);
  });

  test("does not truncate owned pets when there are more than the standard pool size", () => {
    const pets = STANDARD_PET_DISPLAY_SKINS.map((skin, index) =>
      createPet({
        id: `pet-${index}`,
        name: `宠物${index}`,
        skin,
      }),
    );
    const extraPet = createPet({
      id: "extra-custom-cat",
      name: "额外猫",
      skin: "cat",
      assetRef: createCustomPetAssetRef("cat", "asset-extra"),
    });
    const pool = buildPetDisplayPool(createPetStorage({
      pets: [...pets, extraPet],
      activePetId: "extra-custom-cat",
    }));

    expect(pool).toHaveLength(STANDARD_PET_DISPLAY_SKINS.length + 1);
    expect(pool[0].petId).toBe("extra-custom-cat");
    expect(pool.every((item) => item.source === "owned")).toBe(true);
  });

  test("supports a smaller target size without removing owned pets", () => {
    const skins: PetSkin[] = ["cat", "dog", "rabbit"];
    const pool = buildPetDisplayPool(createPetStorage({
      pets: [
        createPet({ id: "pet-cat", skin: "cat" }),
        createPet({ id: "pet-dog", skin: "dog" }),
      ],
      activePetId: "pet-cat",
    }), {
      standardSkins: skins,
      targetSize: 1,
    });

    expect(pool.map((item) => item.petId)).toEqual(["pet-cat", "pet-dog"]);
  });

  test("adds a standard same-skin fallback for repeated custom skin rendering", () => {
    const pool = buildPetDisplayPool(createPetStorage({
      pets: [
        createPet({
          id: "custom-cat",
          skin: "cat",
          assetRef: createCustomPetAssetRef("cat", "asset-1"),
        }),
      ],
      activePetId: "custom-cat",
    }));

    const catItems = getPetDisplayItemsForSkin(pool, "cat");

    expect(catItems).toHaveLength(2);
    expect(catItems.map((item) => item.assetRef.kind)).toEqual(["custom", "standard"]);
  });
});
