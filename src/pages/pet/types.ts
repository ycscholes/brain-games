export type PetStatus = "alive" | "hungry" | "dead";
export type PetSkin = "cat" | "dog" | "rabbit" | "bear" | "panda";

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
  cost: number;
  restoreHunger: number;
  emoji: string;
}

export const PET_ADOPTION_COST = 50;

export const FOOD_ITEMS: FoodItem[] = [
  {
    id: "apple",
    name: "苹果",
    cost: 5,
    restoreHunger: 20,
    emoji: "🍎",
  },
  {
    id: "fish",
    name: "鲜鱼",
    cost: 10,
    restoreHunger: 40,
    emoji: "🐟",
  },
  {
    id: "steak",
    name: "大牛排",
    cost: 20,
    restoreHunger: 100,
    emoji: "🥩",
  },
];

export const PET_SKIN_EMOJI: Record<PetSkin, string> = {
  cat: "🐱",
  dog: "🐶",
  rabbit: "🐰",
  bear: "🐻",
  panda: "🐼",
};

export const PET_SKIN_NAME: Record<PetSkin, string> = {
  cat: "小猫",
  dog: "小狗",
  rabbit: "小兔",
  bear: "小熊",
  panda: "熊猫",
};

// Hunger decay constants
export const HUNGER_POINT_PER_MINUTE = 100 / (3 * 24 * 60); // 100 points over 3 days
export const MAX_HUNGER = 100;
export const HOURS_AFTER_ZERO_BEFORE_DEATH = 24;
