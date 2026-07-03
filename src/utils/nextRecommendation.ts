import {
  GAME_GAUNTLET_ID,
  GAME_CATALOG,
  type GameCatalogItem,
} from "../config/gameCatalog";
import {
  readTrainingRecords,
  type TrainingGameId,
  type TrainingRecord,
} from "./trainingStorage";

export const GAUNTLET_RECOMMENDATION_INTERVAL = 3;

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createStableRandom(seed: string) {
  let state = hashString(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

export function stableShuffle<T>(items: T[], seed: string): T[] {
  const nextItems = [...items];
  const random = createStableRandom(seed);

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

export function buildRecommendationTicketBag(games: GameCatalogItem[]) {
  return games.flatMap((game) => Array.from({ length: game.recommendationWeight }, () => game.id));
}

function getRecommendationSeed(games: GameCatalogItem[], cycleIndex: number) {
  return `recommendation:v1:${cycleIndex}:${games.map((game) => game.id).join("|")}`;
}

function getSingleGameSlotIndex(recommendationRound: number) {
  return (recommendationRound - 1) - Math.floor((recommendationRound - 1) / GAUNTLET_RECOMMENDATION_INTERVAL);
}

export function recommendNextWeightedGame(
  records: TrainingRecord[],
  games: GameCatalogItem[] = GAME_CATALOG,
): TrainingGameId {
  const recommendationRound = records.length + 1;
  if (recommendationRound % GAUNTLET_RECOMMENDATION_INTERVAL === 0) {
    return GAME_GAUNTLET_ID;
  }

  const singleGamePool = games.filter((game) => (
    game.showInAllGames && game.id !== GAME_GAUNTLET_ID
  ));
  const ticketBag = buildRecommendationTicketBag(singleGamePool);
  if (ticketBag.length === 0) {
    return GAME_GAUNTLET_ID;
  }

  const singleSlotIndex = getSingleGameSlotIndex(recommendationRound);
  const cycleIndex = Math.floor(singleSlotIndex / ticketBag.length);
  const cycleOffset = singleSlotIndex % ticketBag.length;
  const shuffledBag = stableShuffle(ticketBag, getRecommendationSeed(singleGamePool, cycleIndex));
  return shuffledBag[cycleOffset];
}

export function readRecommendedGame() {
  return recommendNextWeightedGame(readTrainingRecords());
}
