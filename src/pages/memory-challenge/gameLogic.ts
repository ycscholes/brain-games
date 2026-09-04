import type { PetSpriteMood } from "../pet/components/PetSprite/types";
import { PET_SKIN_NAME, type PetSkin } from "../pet/types";
import type { PetAssetRef } from "../pet/petAssets";
import { getPetAssetKey } from "../pet/petAssets";

export type MemoryChallengeMode = "shape" | "pet" | "calculation";
export type MemoryChallengeN = 1 | 2 | 3 | 4;

export interface MemoryChallengeItem {
  id: string;
  prompt: string;
  answerId: string;
  answerLabel: string;
  imageSrc?: string;
  petMood?: PetSpriteMood;
}

export interface MemoryChallengeOption {
  id: string;
  label: string;
  imageSrc?: string;
}

type PetImageResolveOptions = {
  forceRefresh?: boolean;
};

const ROUND_POINTS: Record<MemoryChallengeN, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
};

export const PET_MOOD_UNLOCK_ORDER: readonly PetSpriteMood[] = [
  "idle",
  "feed",
  "cuddle",
  "hungry",
];

const PET_MOOD_NAME: Record<PetSpriteMood, string> = {
  idle: "待机",
  feed: "进食",
  cuddle: "互动",
  hungry: "饥饿",
};

const PET_IMAGE_LOAD_CONCURRENCY = 3;

async function mapWithConcurrency<T, Result>(
  values: readonly T[],
  mapValue: (value: T) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(values.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapValue(values[index]);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(PET_IMAGE_LOAD_CONCURRENCY, values.length) },
      () => worker(),
    ),
  );
  return results;
}

async function resolvePreloadedPetImage(
  resolveImage: (options?: PetImageResolveOptions) => Promise<string>,
  preloadImage: (url: string) => Promise<boolean>,
): Promise<string> {
  const imageSrc = await resolveImage();
  if (imageSrc && await preloadImage(imageSrc)) {
    return imageSrc;
  }

  const refreshedImageSrc = await resolveImage({ forceRefresh: true });
  return refreshedImageSrc && await preloadImage(refreshedImageSrc) ? refreshedImageSrc : "";
}

function randomInteger(maxInclusive: number, random: () => number) {
  return Math.floor(random() * (maxInclusive + 1));
}

export function getUnlockedPetMoods(correctCount: number): PetSpriteMood[] {
  const unlockedCount = Math.min(
    PET_MOOD_UNLOCK_ORDER.length,
    Math.floor(Math.max(0, correctCount) / 5) + 1,
  );
  return PET_MOOD_UNLOCK_ORDER.slice(0, unlockedCount);
}

export function getUnlockedPetItems(
  items: MemoryChallengeItem[],
  correctCount: number,
): MemoryChallengeItem[] {
  const unlockedMoods = new Set(getUnlockedPetMoods(correctCount));
  return items.filter((item) => item.petMood && unlockedMoods.has(item.petMood));
}

export async function loadPetMemoryItems(
  skins: readonly PetSkin[],
  moods: readonly PetSpriteMood[],
  resolveImage: (
    skin: PetSkin,
    mood: PetSpriteMood,
    options?: PetImageResolveOptions,
  ) => Promise<string>,
  preloadImage: (url: string) => Promise<boolean>,
): Promise<MemoryChallengeItem[]> {
  try {
    return await mapWithConcurrency(
      skins.flatMap((skin) => moods.map((mood) => ({ skin, mood }))),
      async ({ skin, mood }) => {
        const imageSrc = await resolvePreloadedPetImage(
          (options) => resolveImage(skin, mood, options),
          preloadImage,
        );
        if (!imageSrc) {
          throw new Error(`Unable to load ${skin}-${mood}`);
        }

        const id = `pet-${skin}-${mood}`;
        const label = `${PET_SKIN_NAME[skin]}·${PET_MOOD_NAME[mood]}`;
        return {
          id,
          prompt: label,
          answerId: id,
          answerLabel: label,
          imageSrc,
          petMood: mood,
        };
      },
    );
  } catch (error) {
    throw error instanceof Error ? error : new Error("Unable to load pet memory images");
  }
}

export async function loadPetMemoryItemsFromAssets(
  pets: ReadonlyArray<{
    displayId?: string;
    name: string;
    skin: PetSkin;
    assetRef: PetAssetRef;
  }>,
  moods: readonly PetSpriteMood[],
  resolveImage: (
    assetRef: PetAssetRef,
    skin: PetSkin,
    mood: PetSpriteMood,
    options?: PetImageResolveOptions,
  ) => Promise<string>,
  preloadImage: (url: string) => Promise<boolean>,
): Promise<MemoryChallengeItem[]> {
  return mapWithConcurrency(
    pets.flatMap((pet) => moods.map((mood) => ({ pet, mood }))),
    async ({ pet, mood }) => {
      const imageSrc = await resolvePreloadedPetImage(
        (options) => resolveImage(pet.assetRef, pet.skin, mood, options),
        preloadImage,
      );
      const petKey = pet.displayId ?? getPetAssetKey(pet.assetRef);
      if (!imageSrc) {
        throw new Error(`Unable to load ${petKey}-${mood}`);
      }
      const id = `pet-${petKey}-${mood}`;
      const label = `${pet.name}·${PET_MOOD_NAME[mood]}`;
      return {
        id,
        prompt: label,
        answerId: id,
        answerLabel: label,
        imageSrc,
        petMood: mood,
      };
    },
  );
}

export function shuffleMemoryOptions<T>(items: T[], random: () => number = Math.random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

export function getNBackTarget(
  history: MemoryChallengeItem[],
  n: MemoryChallengeN,
): MemoryChallengeItem | null {
  const targetIndex = history.length - n - 1;
  return targetIndex >= 0 ? history[targetIndex] : null;
}

export function createCalculationItem(
  random: () => number = Math.random,
): MemoryChallengeItem {
  const isAddition = random() >= 0.5;
  const first = randomInteger(10, random);
  const second = randomInteger(10, random);
  const left = isAddition ? first : Math.max(first, second);
  const right = isAddition ? second : Math.min(first, second);
  const answer = isAddition ? left + right : left - right;
  const operator = isAddition ? "+" : "-";

  return {
    id: `calculation-${left}-${operator}-${right}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: `${left} ${operator} ${right}`,
    answerId: `${answer}`,
    answerLabel: `${answer}`,
  };
}

export function createNumericOptions(
  correctAnswer: number,
  random: () => number = Math.random,
): MemoryChallengeOption[] {
  const answers = new Set<number>([correctAnswer]);
  const nearbyOffsets = shuffleMemoryOptions([-3, -2, -1, 1, 2, 3, 4, -4], random);

  nearbyOffsets.forEach((offset) => {
    const candidate = correctAnswer + offset;
    if (answers.size < 4 && candidate >= 0 && candidate <= 20) {
      answers.add(candidate);
    }
  });

  let fallback = 0;
  while (answers.size < 4) {
    answers.add(fallback);
    fallback += 1;
  }

  return shuffleMemoryOptions(
    [...answers].map((answer) => ({
      id: `${answer}`,
      label: `${answer}`,
    })),
    random,
  );
}

export function createVisualOptions(
  correctItem: MemoryChallengeItem,
  itemPool: MemoryChallengeItem[],
  random: () => number = Math.random,
): MemoryChallengeOption[] {
  const uniqueByAnswer = new Map<string, MemoryChallengeOption>();
  uniqueByAnswer.set(correctItem.answerId, {
    id: correctItem.answerId,
    label: correctItem.answerLabel,
    imageSrc: correctItem.imageSrc,
  });

  shuffleMemoryOptions(itemPool, random).forEach((item) => {
    if (uniqueByAnswer.size < 4 && !uniqueByAnswer.has(item.answerId)) {
      uniqueByAnswer.set(item.answerId, {
        id: item.answerId,
        label: item.answerLabel,
        imageSrc: item.imageSrc,
      });
    }
  });

  return shuffleMemoryOptions([...uniqueByAnswer.values()], random);
}

export function getMemoryChallengeRoundPoints(
  mode: MemoryChallengeMode,
  n: MemoryChallengeN,
): number {
  return ROUND_POINTS[n] * (mode === "calculation" ? 2 : 1);
}

export function addMemoryChallengeRoundScore(
  currentScore: number,
  mode: MemoryChallengeMode,
  n: MemoryChallengeN,
): number {
  return Math.max(0, currentScore) + getMemoryChallengeRoundPoints(mode, n);
}

export function getMemoryChallengeRewardCap(
  mode: MemoryChallengeMode,
  n: MemoryChallengeN,
): number {
  if (n <= 2) {
    return mode === "calculation" ? 60 : 40;
  }
  return mode === "calculation" ? 100 : 80;
}

export function getMemoryChallengeModeRecord(
  mode: MemoryChallengeMode,
  n: MemoryChallengeN,
): string {
  return `${mode}:M${n}`;
}
