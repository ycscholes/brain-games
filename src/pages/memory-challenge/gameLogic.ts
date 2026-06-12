export type MemoryChallengeMode = "shape" | "pet" | "calculation";
export type MemoryChallengeN = 1 | 2 | 3 | 4;

export interface MemoryChallengeItem {
  id: string;
  prompt: string;
  answerId: string;
  answerLabel: string;
  imageSrc?: string;
}

export interface MemoryChallengeOption {
  id: string;
  label: string;
  imageSrc?: string;
}

const ROUND_POINTS: Record<MemoryChallengeN, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
};

function randomInteger(maxInclusive: number, random: () => number) {
  return Math.floor(random() * (maxInclusive + 1));
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
