import {
  FOOD_POOL,
  PET_EXCLUSIVE_FOODS,
  PET_FOOD_LOADOUTS,
  PET_SKIN_NAME,
  PetSkin,
  getFoodItemsForPetSkin,
} from "../../src/pages/pet/types";

const PET_SKINS = Object.keys(PET_SKIN_NAME) as PetSkin[];
const GENERATED_FOOD_LOADOUTS: Record<PetSkin, readonly string[]> = {
  cat: ["biscuit", "salmon"],
  dog: ["biscuit", "beef-bone"],
  rabbit: ["strawberry-basket"],
  bear: ["honey-jar"],
  panda: ["bamboo-rice"],
  gecko: ["cricket-cup"],
  turtle: ["shrimp-greens"],
};

describe("pet food config", () => {
  test("uses an eight item shared food pool and one exclusive premium food per pet", () => {
    expect(FOOD_POOL).toHaveLength(8);
    expect(PET_EXCLUSIVE_FOODS).toHaveLength(PET_SKINS.length);

    const exclusiveOwners = new Set(PET_EXCLUSIVE_FOODS.map((food) => food.exclusiveFor));
    expect(exclusiveOwners).toEqual(new Set(PET_SKINS));
  });

  test("assigns three fixed feeding tiers to every pet", () => {
    for (const skin of PET_SKINS) {
      const foods = getFoodItemsForPetSkin(skin);

      expect(foods).toHaveLength(3);
      expect(foods.map((food) => food.cost)).toEqual([5, 10, 20]);
      expect(foods.map((food) => food.restoreHunger)).toEqual([8, 16, 32]);
    }
  });

  test("keeps premium foods exclusive to their matching pet", () => {
    const sharedFoodIds = new Set(FOOD_POOL.map((food) => food.id));
    const exclusiveFoodById = new Map(PET_EXCLUSIVE_FOODS.map((food) => [food.id, food]));

    for (const skin of PET_SKINS) {
      const loadout = PET_FOOD_LOADOUTS[skin];
      const [smallFoodId, mediumFoodId, premiumFoodId] = loadout;
      const premiumFood = exclusiveFoodById.get(premiumFoodId);

      expect(sharedFoodIds.has(smallFoodId)).toBe(true);
      expect(sharedFoodIds.has(mediumFoodId)).toBe(true);
      expect(premiumFood?.exclusiveFor).toBe(skin);
    }
  });

  test("includes every generated food icon in the active feeding loadouts", () => {
    for (const skin of PET_SKINS) {
      const loadoutIds = getFoodItemsForPetSkin(skin).map((food) => food.imageId);

      expect(loadoutIds).toEqual(expect.arrayContaining(GENERATED_FOOD_LOADOUTS[skin]));
    }
  });
});
