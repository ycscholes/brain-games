import { PET_SKIN_NAME, type PetSkin, type PetStorageData } from "./types";
import {
  createStandardPetAssetRef,
  getPetAssetRef,
  type PetAssetRef,
} from "./petAssets";

export const STANDARD_PET_DISPLAY_SKINS: PetSkin[] = [
  "cat",
  "dog",
  "rabbit",
  "bear",
  "panda",
  "gecko",
  "turtle",
];

export interface PetDisplayItem {
  displayId: string;
  name: string;
  skin: PetSkin;
  assetRef: PetAssetRef;
  source: "owned" | "standard";
  petId?: string;
}

function shuffle<T>(items: T[], random: () => number) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

export function buildPetDisplayPool(
  petData: PetStorageData,
  options: {
    random?: () => number;
    targetSize?: number;
    standardSkins?: readonly PetSkin[];
  } = {},
): PetDisplayItem[] {
  const random = options.random ?? Math.random;
  const standardSkins = [...(options.standardSkins ?? STANDARD_PET_DISPLAY_SKINS)];
  const targetSize = options.targetSize ?? standardSkins.length;
  const alivePets = petData.pets.filter((pet) => pet.status !== "dead");
  const activePet = alivePets.find((pet) => pet.id === petData.activePetId) ?? null;
  const orderedPets = [
    ...(activePet ? [activePet] : []),
    ...alivePets.filter((pet) => pet.id !== activePet?.id),
  ];

  if (orderedPets.length === 0) {
    return standardSkins.map((skin) => ({
      displayId: `standard:${skin}`,
      name: PET_SKIN_NAME[skin],
      skin,
      assetRef: createStandardPetAssetRef(skin),
      source: "standard",
    }));
  }

  const ownedItems: PetDisplayItem[] = orderedPets.map((pet) => ({
    displayId: pet.id,
    name: pet.name,
    skin: pet.skin,
    assetRef: getPetAssetRef(pet),
    source: "owned",
    petId: pet.id,
  }));
  const ownedSkins = new Set(orderedPets.map((pet) => pet.skin));
  const supplementItems = shuffle(
    standardSkins
      .filter((skin) => !ownedSkins.has(skin))
      .map((skin) => ({
        displayId: `standard:${skin}`,
        name: PET_SKIN_NAME[skin],
        skin,
        assetRef: createStandardPetAssetRef(skin),
        source: "standard" as const,
      })),
    random,
  );
  const supplementCount = Math.max(0, targetSize - ownedItems.length);

  return [
    ...ownedItems,
    ...supplementItems.slice(0, supplementCount),
  ];
}

export function getPetDisplayItemsForSkin(
  pool: readonly PetDisplayItem[],
  skin: PetSkin,
): PetDisplayItem[] {
  const matchingItems = pool.filter((item) => item.skin === skin);
  const hasStandardItem = matchingItems.some((item) => item.assetRef.kind === "standard");
  if (hasStandardItem) {
    return matchingItems;
  }

  const standardItem: PetDisplayItem = {
    displayId: `standard:${skin}`,
    name: PET_SKIN_NAME[skin],
    skin,
    assetRef: createStandardPetAssetRef(skin),
    source: "standard",
  };

  return matchingItems.length > 0
    ? [...matchingItems, standardItem]
    : [standardItem];
}

export function getPetDisplayNameForSkin(
  pool: readonly PetDisplayItem[],
  skin: PetSkin,
): string {
  return getPetDisplayItemsForSkin(pool, skin)[0]?.name ?? PET_SKIN_NAME[skin];
}
