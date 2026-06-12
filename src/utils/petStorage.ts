import Taro from "@tarojs/taro";
import type { PetData, PetSkin, PetStorageData } from "../pages/pet/types";
import { emitUserDataChanged } from "../services/user-data/local/changeNotifier";
import {
  getAwardedPoints,
  type TrainingDifficulty,
  type TrainingRewardPolicy,
} from "./trainingStorage";
import {
  HUNGER_POINT_PER_MINUTE,
  MAX_HUNGER,
  HOURS_AFTER_ZERO_BEFORE_DEATH,
  PET_ADOPTION_COST,
} from "../pages/pet/types";

const STORAGE_KEY = "pet_data";

type LegacyPetData = Omit<PetData, "id"> & {
  id?: string;
  points?: number;
};

type LegacyPetStorageData = {
  pet?: LegacyPetData | null;
  lastCheckTime?: string;
};

function createEmptyPetStorage(): PetStorageData {
  return {
    pets: [],
    activePetId: null,
    balance: 0,
    adoptedCount: 0,
    lastCheckTime: new Date().toISOString(),
  };
}

export function createPetId(): string {
  return `pet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePet(raw: LegacyPetData): PetData {
  const now = new Date().toISOString();

  return {
    id: raw.id || createPetId(),
    name: raw.name,
    skin: raw.skin,
    status: raw.status,
    hunger: Math.max(0, Math.min(MAX_HUNGER, raw.hunger)),
    level: raw.level ?? 1,
    experience: raw.experience ?? 0,
    createdAt: raw.createdAt || now,
    lastUpdated: raw.lastUpdated || now,
    deathTime: raw.deathTime ?? null,
  };
}

function getValidActivePetId(
  pets: PetData[],
  activePetId: string | null
): string | null {
  if (activePetId && pets.some((pet) => pet.id === activePetId)) {
    return activePetId;
  }

  const firstAlivePet = pets.find((pet) => pet.status !== "dead");
  return firstAlivePet?.id || pets[0]?.id || null;
}

function migratePetStorage(raw: string): PetStorageData {
  try {
    const parsed = JSON.parse(raw) as PetStorageData | LegacyPetStorageData;

    if ("pets" in parsed && Array.isArray(parsed.pets)) {
      const pets = parsed.pets.map((pet) => normalizePet(pet));
      return {
        pets,
        activePetId: getValidActivePetId(pets, parsed.activePetId ?? null),
        balance: Number(parsed.balance ?? 0),
        adoptedCount: Number(parsed.adoptedCount ?? pets.length),
        lastCheckTime: parsed.lastCheckTime || new Date().toISOString(),
      };
    }

    const legacy = parsed as LegacyPetStorageData;
    const legacyPet = legacy.pet ? normalizePet(legacy.pet) : null;
    return {
      pets: legacyPet ? [legacyPet] : [],
      activePetId: legacyPet?.id || null,
      balance: Number(legacy.pet?.points ?? 0),
      adoptedCount: legacyPet ? 1 : 0,
      lastCheckTime: legacy.lastCheckTime || new Date().toISOString(),
    };
  } catch {
    return createEmptyPetStorage();
  }
}

export function savePetData(
  data: PetStorageData,
  options?: {
    markChanged?: boolean;
  },
): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(data));
    if (options?.markChanged !== false) {
      emitUserDataChanged();
    }
  } catch {
    // ignore storage failures
  }
}

function persistMigratedPetData(raw: string, data: PetStorageData): void {
  try {
    const nextRaw = JSON.stringify(data);
    if (nextRaw !== raw) {
      Taro.setStorageSync(STORAGE_KEY, nextRaw);
    }
  } catch {
    // ignore storage failures
  }
}

export function readPetData(): PetStorageData {
  const raw = Taro.getStorageSync(STORAGE_KEY);
  if (!raw) {
    return createEmptyPetStorage();
  }

  const migrated = migratePetStorage(raw);
  persistMigratedPetData(raw, migrated);
  return migrated;
}

export function calculateHungerDecay(
  currentHunger: number,
  lastCheckTime: string
): {
  newHunger: number;
  shouldDie: boolean;
} {
  const lastDate = new Date(lastCheckTime);
  const elapsedMs = Math.max(0, Date.now() - lastDate.getTime());
  const minutesPassed = elapsedMs / (1000 * 60);

  const decay = Math.floor(minutesPassed * HUNGER_POINT_PER_MINUTE);
  const newHunger = Math.max(0, currentHunger - decay);

  let shouldDie = false;
  if (newHunger <= 0) {
    let minutesAtZero = minutesPassed;

    if (currentHunger > 0) {
      const minutesUntilZero = currentHunger / HUNGER_POINT_PER_MINUTE;
      minutesAtZero = Math.max(0, minutesPassed - minutesUntilZero);
    }

    if (minutesAtZero >= HOURS_AFTER_ZERO_BEFORE_DEATH * 60) {
      shouldDie = true;
    }
  }

  return {
    newHunger,
    shouldDie,
  };
}

export function updatePetStatus(pet: PetData): PetData {
  let status: PetData["status"] = "alive";
  if (pet.hunger < 20) {
    status = "hungry";
  }
  if (pet.hunger <= 0) {
    status = "hungry";
  }
  if (pet.status === "dead") {
    status = "dead";
  }

  return {
    ...pet,
    status,
  };
}

export function killPet(pet: PetData): PetData {
  return {
    ...pet,
    status: "dead",
    deathTime: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

function refreshAllPets(data: PetStorageData): PetStorageData {
  const now = new Date().toISOString();
  let hasChanged = false;

  const pets = data.pets.map((pet) => {
    if (pet.status === "dead") {
      return pet;
    }

    const { newHunger, shouldDie } = calculateHungerDecay(
      pet.hunger,
      pet.lastUpdated
    );

    if (newHunger === pet.hunger && !shouldDie) {
      const nextPet = updatePetStatus(pet);
      const statusChanged = nextPet.status !== pet.status;
      hasChanged = hasChanged || statusChanged;
      return statusChanged ? nextPet : pet;
    }

    hasChanged = true;
    let updated = {
      ...pet,
      hunger: newHunger,
    };

    // Only move the decay baseline when hunger actually changes and remains above 0.
    if (newHunger > 0) {
      updated.lastUpdated = now;
    }

    if (shouldDie && updated.status !== "dead") {
      return killPet(updated);
    }

    return updatePetStatus(updated);
  });

  const activePetId = getValidActivePetId(pets, data.activePetId);
  hasChanged = hasChanged || activePetId !== data.activePetId;

  if (!hasChanged) {
    return data;
  }

  return {
    ...data,
    pets,
    activePetId,
    lastCheckTime: now,
  };
}

export function syncPetData(options?: {
  markChanged?: boolean;
}): PetStorageData {
  const data = readPetData();
  const refreshed = refreshAllPets(data);
  if (refreshed !== data) {
    savePetData(refreshed, options);
  }
  return refreshed;
}

export function getNextAdoptionCost(data?: PetStorageData): number {
  const source = data || readPetData();
  return source.adoptedCount === 0 ? 0 : PET_ADOPTION_COST;
}

export function createPet(name: string, skin: PetSkin): PetData {
  const now = new Date().toISOString();
  return {
    id: createPetId(),
    name,
    skin,
    status: "alive",
    hunger: MAX_HUNGER,
    level: 1,
    experience: 0,
    createdAt: now,
    lastUpdated: now,
    deathTime: null,
  };
}

export function adoptPet(
  name: string,
  skin: PetSkin
): {
  success: boolean;
  cost: number;
  data: PetStorageData;
  pet: PetData | null;
} {
  const data = syncPetData();
  const cost = getNextAdoptionCost(data);

  if (cost > data.balance) {
    return {
      success: false,
      cost,
      data,
      pet: null,
    };
  }

  const newPet = createPet(name, skin);
  const nextData: PetStorageData = {
    ...data,
    pets: [...data.pets, newPet],
    activePetId: newPet.id,
    balance: data.balance - cost,
    adoptedCount: data.adoptedCount + 1,
    lastCheckTime: new Date().toISOString(),
  };

  savePetData(nextData);
  return {
    success: true,
    cost,
    data: nextData,
    pet: newPet,
  };
}

export function addPointsToPet(
  gameId: string,
  score: number,
  difficulty?: TrainingDifficulty,
  rewardPolicy?: TrainingRewardPolicy,
): void {
  // First sync all pets to update hunger decay before adding points
  const data = syncPetData();
  const pointsToAdd = getAwardedPoints(gameId, score, difficulty, rewardPolicy);

  if (pointsToAdd <= 0) {
    return;
  }

  const nextData: PetStorageData = {
    ...data,
    balance: data.balance + pointsToAdd,
    lastCheckTime: new Date().toISOString(),
  };

  savePetData(nextData);
}

export function feedPet(
  petId: string,
  restoreHunger: number,
  cost: number
): {
  success: boolean;
  data: PetStorageData;
  pet: PetData | null;
} {
  const data = syncPetData();
  const pet = data.pets.find((item) => item.id === petId);

  if (!pet || pet.status === "dead") {
    return {
      success: false,
      data,
      pet: null,
    };
  }

  if (data.balance < cost) {
    return {
      success: false,
      data,
      pet,
    };
  }

  const nextPet = updatePetStatus({
    ...pet,
    hunger: Math.min(MAX_HUNGER, pet.hunger + restoreHunger),
    lastUpdated: new Date().toISOString(),
  });

  const nextData: PetStorageData = {
    ...data,
    pets: data.pets.map((item) => (item.id === petId ? nextPet : item)),
    balance: data.balance - cost,
    lastCheckTime: new Date().toISOString(),
  };

  savePetData(nextData);
  return {
    success: true,
    data: nextData,
    pet: nextPet,
  };
}
