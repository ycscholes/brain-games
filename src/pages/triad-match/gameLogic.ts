import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type TriadMatchDifficulty = TrainingDifficulty;
export type TriadMatchCount = 1 | 2 | 3;
export type TriadMatchShape = "gem" | "leaf" | "moon";
export type TriadMatchShading = "solid" | "stripe" | "hollow";
export type TriadMatchColor = "coral" | "teal" | "amber";
export type TriadMatchFeature = keyof Omit<TriadMatchCard, "id">;

export interface TriadMatchCard {
  id: string;
  count: TriadMatchCount;
  shape: TriadMatchShape;
  shading: TriadMatchShading;
  color: TriadMatchColor;
}

export interface TriadMatchPuzzle {
  id: string;
  cards: TriadMatchCard[];
  timeLimitMs: number;
}

export interface TriadMatchResult {
  correct: boolean;
  speedBonus: number;
  comboBonus: number;
  score: number;
}

export const TRIAD_MATCH_TOTAL_PUZZLES = 8;

const COUNTS: TriadMatchCount[] = [1, 2, 3];
const SHAPES: TriadMatchShape[] = ["gem", "leaf", "moon"];
const SHADINGS: TriadMatchShading[] = ["solid", "stripe", "hollow"];
const COLORS: TriadMatchColor[] = ["coral", "teal", "amber"];
const FEATURES: TriadMatchFeature[] = ["count", "shape", "shading", "color"];

const TIME_LIMIT_MS: Record<TriadMatchDifficulty, number[]> = {
  normal: [18000, 17500, 17000, 16500, 16000, 15500, 15000, 14500],
  hard: [14500, 14000, 13500, 13000, 12500, 12000, 11500, 11000],
};

function clampPuzzleIndex(puzzleIndex: number) {
  return Math.max(0, Math.min(TRIAD_MATCH_TOTAL_PUZZLES - 1, puzzleIndex));
}

function createCardId(card: Omit<TriadMatchCard, "id">) {
  return `${card.count}-${card.shape}-${card.shading}-${card.color}`;
}

function createCard(card: Omit<TriadMatchCard, "id">): TriadMatchCard {
  return {
    id: createCardId(card),
    ...card,
  };
}

function thirdValue<T>(values: T[], left: T, right: T): T {
  if (left === right) {
    return left;
  }

  const next = values.find((value) => value !== left && value !== right);
  if (next === undefined) {
    return left;
  }
  return next;
}

function createDeck() {
  const deck: TriadMatchCard[] = [];
  COUNTS.forEach((count) => {
    SHAPES.forEach((shape) => {
      SHADINGS.forEach((shading) => {
        COLORS.forEach((color) => {
          deck.push(createCard({ count, shape, shading, color }));
        });
      });
    });
  });
  return deck;
}

function seededShuffle<T>(items: T[], seed: number) {
  const nextItems = [...items];
  let nextSeed = seed;

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    nextSeed = (nextSeed * 1664525 + 1013904223) % 4294967296;
    const swapIndex = nextSeed % (index + 1);
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

function getTimeLimitMs(difficulty: TriadMatchDifficulty, puzzleIndex: number) {
  return TIME_LIMIT_MS[difficulty][clampPuzzleIndex(puzzleIndex)];
}

function hasAllSameOrAllDifferent(values: Array<string | number>) {
  const uniqueSize = new Set(values).size;
  return uniqueSize === 1 || uniqueSize === 3;
}

export function isTriadMatch(cards: TriadMatchCard[]) {
  if (cards.length !== 3) {
    return false;
  }

  return FEATURES.every((feature) => hasAllSameOrAllDifferent(cards.map((card) => card[feature])));
}

export function completeTriadCard(
  left: TriadMatchCard,
  right: TriadMatchCard,
  id = createCardId({
    count: thirdValue(COUNTS, left.count, right.count),
    shape: thirdValue(SHAPES, left.shape, right.shape),
    shading: thirdValue(SHADINGS, left.shading, right.shading),
    color: thirdValue(COLORS, left.color, right.color),
  }),
): TriadMatchCard {
  return {
    id,
    count: thirdValue(COUNTS, left.count, right.count),
    shape: thirdValue(SHAPES, left.shape, right.shape),
    shading: thirdValue(SHADINGS, left.shading, right.shading),
    color: thirdValue(COLORS, left.color, right.color),
  };
}

export function findTriadMatches(cards: TriadMatchCard[]) {
  const matches: TriadMatchCard[][] = [];

  for (let first = 0; first < cards.length - 2; first += 1) {
    for (let second = first + 1; second < cards.length - 1; second += 1) {
      for (let third = second + 1; third < cards.length; third += 1) {
        const candidate = [cards[first], cards[second], cards[third]];
        if (isTriadMatch(candidate)) {
          matches.push(candidate);
        }
      }
    }
  }

  return matches;
}

export function createTriadMatchPuzzle(
  difficulty: TriadMatchDifficulty,
  puzzleIndex: number,
): TriadMatchPuzzle {
  const safePuzzleIndex = clampPuzzleIndex(puzzleIndex);
  const deck = createDeck();
  const firstCard = deck[(safePuzzleIndex * 7 + (difficulty === "hard" ? 5 : 2)) % deck.length];
  const secondCard = deck[(safePuzzleIndex * 13 + (difficulty === "hard" ? 17 : 11)) % deck.length];
  const completedCard = completeTriadCard(firstCard, secondCard);
  const answerCard = deck.find((card) => card.id === completedCard.id) ?? completedCard;
  const answerIds = new Set([firstCard.id, secondCard.id, answerCard.id]);
  const fillerCards = deck.filter((card) => !answerIds.has(card.id));
  const shuffledFillers = seededShuffle(
    fillerCards,
    (safePuzzleIndex + 1) * (difficulty === "hard" ? 7919 : 3571),
  );
  const cards = seededShuffle(
    [firstCard, secondCard, answerCard, ...shuffledFillers.slice(0, 9)],
    (safePuzzleIndex + 3) * (difficulty === "hard" ? 593 : 389),
  );

  return {
    id: `triad-match-${difficulty}-${safePuzzleIndex + 1}`,
    cards,
    timeLimitMs: getTimeLimitMs(difficulty, safePuzzleIndex),
  };
}

export function createTriadMatchSession(difficulty: TriadMatchDifficulty) {
  return Array.from({ length: TRIAD_MATCH_TOTAL_PUZZLES }, (_, index) =>
    createTriadMatchPuzzle(difficulty, index),
  );
}

export function scoreTriadMatchSelection(params: {
  selectedCards: TriadMatchCard[];
  answerMs: number;
  currentCombo: number;
}): TriadMatchResult {
  const correct = isTriadMatch(params.selectedCards);
  if (!correct) {
    return {
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    };
  }

  const speedBonus = params.answerMs <= 5500 ? 1 : 0;
  const comboBonus = params.currentCombo >= 2 ? 1 : 0;

  return {
    correct: true,
    speedBonus,
    comboBonus,
    score: 4 + speedBonus + comboBonus,
  };
}
