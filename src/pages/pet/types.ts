export type PetStatus = "alive" | "hungry" | "dead";
export type PetSkin = "cat" | "dog" | "rabbit" | "bear" | "panda" | "gecko" | "turtle";

export interface PetData {
  id: string;
  name: string;
  skin: PetSkin;
  status: PetStatus;
  hunger: number;
  level: number;
  experience: number;
  createdAt: string;
  lastUpdated: string;
  deathTime: string | null;
}

export interface PetStorageData {
  pets: PetData[];
  activePetId: string | null;
  balance: number;
  adoptedCount: number;
  lastCheckTime: string;
}

export interface FoodItem {
  id: string;
  name: string;
  imageId: string;
  cost: number;
  restoreHunger: number;
  emoji: string;
  exclusiveFor?: PetSkin;
}

export const PET_ADOPTION_COST = 50;

const SMALL_FOOD_COST = 5;
const MEDIUM_FOOD_COST = 10;
const PREMIUM_FOOD_COST = 20;
const SMALL_FOOD_RESTORE_HUNGER = 8;
const MEDIUM_FOOD_RESTORE_HUNGER = 16;
const PREMIUM_FOOD_RESTORE_HUNGER = 32;

type FoodTier = "small" | "medium" | "premium";

interface FoodCatalogItem {
  id: string;
  name: string;
  emoji: string;
  exclusiveFor?: PetSkin;
}

export const FOOD_POOL: FoodCatalogItem[] = [
  { id: "apple", name: "苹果", emoji: "🍎" },
  { id: "berry", name: "浆果", emoji: "🫐" },
  { id: "carrot", name: "胡萝卜", emoji: "🥕" },
  { id: "fish", name: "小鱼", emoji: "🐟" },
  { id: "meat", name: "肉块", emoji: "🍖" },
  { id: "greens", name: "青菜", emoji: "🥬" },
  { id: "pumpkin", name: "南瓜", emoji: "🎃" },
  { id: "biscuit", name: "饼干", emoji: "🍪" },
];

export const PET_EXCLUSIVE_FOODS: FoodCatalogItem[] = [
  { id: "salmon", name: "三文鱼", emoji: "🍣", exclusiveFor: "cat" },
  { id: "beef-bone", name: "牛肉骨", emoji: "🦴", exclusiveFor: "dog" },
  { id: "strawberry-basket", name: "草莓篮", emoji: "🍓", exclusiveFor: "rabbit" },
  { id: "honey-jar", name: "蜂蜜罐", emoji: "🍯", exclusiveFor: "bear" },
  { id: "bamboo-rice", name: "竹筒饭", emoji: "🎋", exclusiveFor: "panda" },
  { id: "cricket-cup", name: "蟋蟀杯", emoji: "🦗", exclusiveFor: "gecko" },
  { id: "shrimp-greens", name: "小虾水草盘", emoji: "🦐", exclusiveFor: "turtle" },
];

export const FOOD_CATALOG: FoodCatalogItem[] = [
  ...FOOD_POOL,
  ...PET_EXCLUSIVE_FOODS,
];

const FOOD_BY_ID = FOOD_CATALOG.reduce<Record<string, FoodCatalogItem>>((acc, food) => {
  acc[food.id] = food;
  return acc;
}, {});

export const PET_FOOD_LOADOUTS: Record<PetSkin, [string, string, string]> = {
  cat: ["fish", "biscuit", "salmon"],
  dog: ["biscuit", "meat", "beef-bone"],
  rabbit: ["greens", "carrot", "strawberry-basket"],
  bear: ["berry", "fish", "honey-jar"],
  panda: ["greens", "pumpkin", "bamboo-rice"],
  gecko: ["berry", "apple", "cricket-cup"],
  turtle: ["greens", "carrot", "shrimp-greens"],
};

const FOOD_TIER_CONFIG: Record<FoodTier, { cost: number; restoreHunger: number }> = {
  small: {
    cost: SMALL_FOOD_COST,
    restoreHunger: SMALL_FOOD_RESTORE_HUNGER,
  },
  medium: {
    cost: MEDIUM_FOOD_COST,
    restoreHunger: MEDIUM_FOOD_RESTORE_HUNGER,
  },
  premium: {
    cost: PREMIUM_FOOD_COST,
    restoreHunger: PREMIUM_FOOD_RESTORE_HUNGER,
  },
};

const FOOD_LOADOUT_TIERS: FoodTier[] = ["small", "medium", "premium"];

export function getFoodItemsForPetSkin(skin: PetSkin): FoodItem[] {
  return PET_FOOD_LOADOUTS[skin].map((foodId, index) => {
    const food = FOOD_BY_ID[foodId];
    const tier = FOOD_LOADOUT_TIERS[index];
    const tierConfig = FOOD_TIER_CONFIG[tier];

    return {
      ...food,
      imageId: food.id,
      cost: tierConfig.cost,
      restoreHunger: tierConfig.restoreHunger,
    };
  });
}

export const PET_SKIN_EMOJI: Record<PetSkin, string> = {
  cat: "🐱",
  dog: "🐶",
  rabbit: "🐰",
  bear: "🐻",
  panda: "🐼",
  gecko: "🦎",
  turtle: "🐢",
};

export const PET_SKIN_NAME: Record<PetSkin, string> = {
  cat: "小猫",
  dog: "小狗",
  rabbit: "小兔",
  bear: "小熊",
  panda: "熊猫",
  gecko: "守宫",
  turtle: "小乌龟",
};

// Hunger decay constants
export const HUNGER_POINT_PER_MINUTE = 100 / (3 * 24 * 60); // 100 points over 3 days
export const MAX_HUNGER = 100;
export const HOURS_AFTER_ZERO_BEFORE_DEATH = 24;
