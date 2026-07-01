import type { PetSkin } from "../pet/types";
import type { PetSpriteMood } from "../pet/components/PetSprite/types";
import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type BirdCountDifficulty = TrainingDifficulty;
export type PetCountSize = "small" | "medium" | "large";
export interface PetCountIdentity {
  id: string;
  skin: PetSkin;
}
export type PetCountIdentityInput = PetSkin | PetCountIdentity;

export interface BirdCountItem {
  id: string;
  petKey: string;
  skin: PetSkin;
  x: number;
  y: number;
  lane: number;
  size: PetCountSize;
  scale: number;
  mirror: boolean;
  delayMs: number;
  mood: PetSpriteMood;
  targetOrder?: number;
}

export interface BirdCountQuestion {
  id: string;
  pets: BirdCountItem[];
  targetPetKey: string;
  targetSkin: PetSkin;
  answer: number;
  totalPets: number;
  options: number[];
  revealMs: number;
  scrollMs: number;
  laneCount: number;
}

export interface BirdCountQuestionResult {
  correct: boolean;
  speedBonus: number;
  comboBonus: number;
  score: number;
}

export const BIRD_COUNT_TOTAL_QUESTIONS = 8;

export const PET_COUNT_SKINS: PetSkin[] = ["cat", "dog", "rabbit", "bear", "panda", "gecko", "turtle"];
export const PET_COUNT_MOODS: PetSpriteMood[] = ["idle", "feed", "cuddle", "hungry"];

const TARGET_COUNT_STEPS: Record<BirdCountDifficulty, number[]> = {
  normal: [3, 4, 4, 5, 5, 6, 6, 7],
  hard: [5, 6, 6, 7, 7, 8, 9, 9],
};

const TOTAL_PET_STEPS: Record<BirdCountDifficulty, number[]> = {
  normal: [8, 9, 10, 11, 12, 13, 14, 15],
  hard: [14, 15, 16, 17, 18, 19, 20, 21],
};

const REVEAL_MS: Record<BirdCountDifficulty, number[]> = {
  normal: [3600, 3400, 3200, 3000, 2800, 2650, 2500, 2350],
  hard: [2800, 2650, 2500, 2350, 2200, 2050, 1950, 1850],
};

const SCROLL_MS: Record<BirdCountDifficulty, number[]> = {
  normal: [3300, 3200, 3050, 2920, 2800, 2680, 2560, 2450],
  hard: [2500, 2380, 2260, 2160, 2060, 1960, 1880, 1800],
};

const GROUND_LANE_Y = [60, 68, 76, 84];
const STRIP_X_MIN = 5;
const STRIP_X_MAX = 95;
const PET_SCALE_MIN = 1;
const PET_SCALE_MAX = 1.5;

function clampQuestionIndex(questionIndex: number) {
  return Math.max(0, Math.min(BIRD_COUNT_TOTAL_QUESTIONS - 1, questionIndex));
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function createStandardIdentity(skin: PetSkin): PetCountIdentity {
  return {
    id: `standard:${skin}`,
    skin,
  };
}

function normalizePetIdentityPool(petPool?: PetCountIdentityInput[]) {
  const rawPool = petPool && petPool.length > 0
    ? petPool
    : PET_COUNT_SKINS;
  const uniqueIdentities = new Map<string, PetCountIdentity>();

  rawPool.forEach((item) => {
    const identity = typeof item === "string"
      ? createStandardIdentity(item)
      : item;
    if (PET_COUNT_SKINS.includes(identity.skin) && !uniqueIdentities.has(identity.id)) {
      uniqueIdentities.set(identity.id, identity);
    }
  });

  return uniqueIdentities.size > 0
    ? [...uniqueIdentities.values()]
    : PET_COUNT_SKINS.map(createStandardIdentity);
}

function pickTargetPet(questionIndex: number, petPool?: PetCountIdentityInput[]) {
  const pets = normalizePetIdentityPool(petPool);
  return pets[questionIndex % pets.length];
}

function createPetIdentityPool(
  targetPet: PetCountIdentity,
  targetCount: number,
  totalPets: number,
  petPool?: PetCountIdentityInput[],
) {
  const pets: PetCountIdentity[] = Array.from({ length: targetCount }, () => targetPet);
  const availablePets = normalizePetIdentityPool(petPool);
  const decoys = availablePets.filter((pet) => pet.id !== targetPet.id);
  const fallbackDecoys = decoys.length > 0 ? decoys : availablePets;

  while (pets.length < totalPets) {
    const decoyIndex = (pets.length + Math.floor(Math.random() * fallbackDecoys.length)) % fallbackDecoys.length;
    pets.push(fallbackDecoys[decoyIndex]);
  }

  return shuffle(pets);
}

export function getBirdCountTarget(difficulty: BirdCountDifficulty, questionIndex: number) {
  return TARGET_COUNT_STEPS[difficulty][clampQuestionIndex(questionIndex)];
}

export function getPetCountTotal(difficulty: BirdCountDifficulty, questionIndex: number) {
  return TOTAL_PET_STEPS[difficulty][clampQuestionIndex(questionIndex)];
}

export function getBirdCountRevealMs(difficulty: BirdCountDifficulty, questionIndex: number) {
  return REVEAL_MS[difficulty][clampQuestionIndex(questionIndex)];
}

export function getPetCountScrollMs(difficulty: BirdCountDifficulty, questionIndex: number) {
  return SCROLL_MS[difficulty][clampQuestionIndex(questionIndex)];
}

export function createBirdCountOptions(answer: number) {
  const candidates = [answer - 2, answer - 1, answer + 1, answer + 2, answer + 3, answer - 3]
    .filter((value) => value > 0 && value !== answer);
  const options = new Set<number>([answer]);

  candidates.forEach((candidate) => {
    if (options.size < 4) {
      options.add(candidate);
    }
  });

  let fallback = 1;
  while (options.size < 4) {
    if (fallback !== answer) {
      options.add(fallback);
    }
    fallback += 1;
  }

  return shuffle([...options]);
}

export function createBirdCountQuestion(
  difficulty: BirdCountDifficulty,
  questionIndex: number,
  petPool?: PetCountIdentityInput[],
): BirdCountQuestion {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  const targetPet = pickTargetPet(safeQuestionIndex, petPool);
  const answer = getBirdCountTarget(difficulty, safeQuestionIndex);
  const totalPets = getPetCountTotal(difficulty, safeQuestionIndex);
  const petPoolForQuestion = createPetIdentityPool(targetPet, answer, totalPets, petPool);
  const laneCount = difficulty === "hard" ? 4 : 3;
  const usableWidth = STRIP_X_MAX - STRIP_X_MIN;
  const segmentWidth = usableWidth / totalPets;
  const petsWithoutTargetOrder = petPoolForQuestion.map((pet, index) => {
    const lane = (index * 2 + safeQuestionIndex) % laneCount;
    const segmentCenter = STRIP_X_MIN + segmentWidth * (index + 0.5);
    const xJitter = (Math.random() - 0.5) * Math.min(5.5, segmentWidth * 0.72);
    const yJitter = Math.floor(Math.random() * 5) - 2;
    const groundDepth = lane / Math.max(1, laneCount - 1);
    const size = groundDepth > 0.72
      ? "large" as const
      : groundDepth < 0.28
        ? "small" as const
        : "medium" as const;

    return {
      id: `pet-count-${difficulty}-${safeQuestionIndex + 1}-pet-${index + 1}`,
      petKey: pet.id,
      skin: pet.skin,
      x: Math.max(STRIP_X_MIN, Math.min(STRIP_X_MAX, segmentCenter + xJitter)),
      y: GROUND_LANE_Y[lane] + yJitter,
      lane,
      size,
      scale: Number((PET_SCALE_MIN + Math.random() * (PET_SCALE_MAX - PET_SCALE_MIN)).toFixed(2)),
      mirror: index % 2 === 1,
      delayMs: index * 35,
      mood: PET_COUNT_MOODS[
        (index + safeQuestionIndex + Math.floor(Math.random() * PET_COUNT_MOODS.length)) % PET_COUNT_MOODS.length
      ],
    };
  });
  const targetOrderById = new Map(
    petsWithoutTargetOrder
      .filter((pet) => pet.petKey === targetPet.id)
      .sort((left, right) => left.x - right.x)
      .map((pet, index) => [pet.id, index + 1]),
  );
  const pets = petsWithoutTargetOrder.map((pet) => ({
    ...pet,
    targetOrder: targetOrderById.get(pet.id),
  }));

  return {
    id: `pet-count-${difficulty}-${safeQuestionIndex + 1}`,
    pets,
    targetPetKey: targetPet.id,
    targetSkin: targetPet.skin,
    answer,
    totalPets,
    options: createBirdCountOptions(answer),
    revealMs: getBirdCountRevealMs(difficulty, safeQuestionIndex),
    scrollMs: getPetCountScrollMs(difficulty, safeQuestionIndex),
    laneCount,
  };
}

export function createBirdCountSession(difficulty: BirdCountDifficulty, petPool?: PetCountIdentityInput[]) {
  return Array.from({ length: BIRD_COUNT_TOTAL_QUESTIONS }, (_, index) =>
    createBirdCountQuestion(difficulty, index, petPool),
  );
}

export function scoreBirdCountQuestion(params: {
  selectedAnswer: number;
  correctAnswer: number;
  answerMs: number;
  currentCombo: number;
}): BirdCountQuestionResult {
  const correct = params.selectedAnswer === params.correctAnswer;
  if (!correct) {
    return {
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    };
  }

  const speedBonus = params.answerMs <= 1700 ? 1 : 0;
  const comboBonus = params.currentCombo >= 2 ? 1 : 0;

  return {
    correct: true,
    speedBonus,
    comboBonus,
    score: 4 + speedBonus + comboBonus,
  };
}
