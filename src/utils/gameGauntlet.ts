import Taro, { getCurrentInstance } from "@tarojs/taro";
import {
  GAME_GAUNTLET_ID,
  GAUNTLET_CANDIDATE_GAMES,
  getGameById,
  type GameCatalogItem,
} from "../config/gameCatalog";
import { addPointsToPet } from "./petStorage";
import {
  getAwardedPoints,
  recordTrainingSession,
  type TrainingDifficulty,
  type TrainingGameId,
  type TrainingOutcome,
} from "./trainingStorage";
import { stableShuffle } from "./nextRecommendation";

export const GAUNTLET_LEG_COUNT = 3;
const GAUNTLET_STORAGE_KEY = "game_gauntlet_session_v1";

export type GameGauntletDifficulty = TrainingDifficulty;
export type GameGauntletModePreset = {
  difficulty: GameGauntletDifficulty;
  mode?: string;
  stageId?: string;
  memoryMode?: "shape" | "pet" | "calculation";
  memoryN?: "1" | "3";
  farmMode?: "speed" | "yard";
  yardSpeed?: "slow" | "standard" | "fast";
};

export interface GameGauntletLeg {
  gameId: TrainingGameId;
  modePreset: GameGauntletModePreset;
}

export interface GameGauntletLegResult {
  gameId: TrainingGameId;
  score: number;
  awardedPoints: number;
  difficulty?: TrainingDifficulty;
  mode?: string;
  outcome: TrainingOutcome;
}

export interface GameGauntletSession {
  id: string;
  gameIds: TrainingGameId[];
  difficulty: GameGauntletDifficulty;
  legs: GameGauntletLeg[];
  currentLegIndex: number;
  results: GameGauntletLegResult[];
  status: "active" | "completed";
  createdAt: string;
  completedAt?: string;
}

export interface GameGauntletCompletionInput extends GameGauntletLegResult {
  durationSeconds?: number;
}

function createSessionId() {
  return `gauntlet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickOne<T>(items: T[], seed: string) {
  return stableShuffle(items, seed)[0] ?? items[0];
}

export function createGameGauntletModePreset(
  gameId: TrainingGameId,
  difficulty: GameGauntletDifficulty,
  seed = `${Date.now()}`,
): GameGauntletModePreset {
  if (gameId === "mental-math") {
    return {
      difficulty,
      mode: "timed",
      stageId: difficulty === "hard" ? "G4_MIXED_100" : "G1A",
    };
  }

  if (gameId === "memory-challenge") {
    return {
      difficulty,
      memoryMode: pickOne(["shape", "pet", "calculation"], seed),
      memoryN: difficulty === "hard" ? "3" : "1",
    };
  }

  if (gameId === "bird-count") {
    const farmMode = pickOne(["speed", "yard"] as const, seed);
    return {
      difficulty,
      farmMode,
      yardSpeed: difficulty === "hard" ? pickOne(["standard", "fast"], `${seed}:speed`) : "slow",
    };
  }

  if (gameId === "rock-paper-scissors") {
    return {
      difficulty,
      mode: difficulty === "hard" ? "3" : "1",
    };
  }

  return { difficulty };
}

function readSessionFromStorage(): GameGauntletSession | null {
  const raw = Taro.getStorageSync(GAUNTLET_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.id === "string" &&
      Array.isArray(parsed?.gameIds) &&
      Array.isArray(parsed?.results) &&
      (parsed?.status === "active" || parsed?.status === "completed")
    ) {
      const difficulty = parsed.difficulty === "hard" ? "hard" : "normal";
      return {
        ...parsed,
        difficulty,
        legs: Array.isArray(parsed.legs)
          ? parsed.legs
          : parsed.gameIds.map((gameId: TrainingGameId, index: number) => ({
              gameId,
              modePreset: createGameGauntletModePreset(gameId, difficulty, `${parsed.id}:${index}`),
            })),
      } as GameGauntletSession;
    }
  } catch {
    return null;
  }

  return null;
}

export function readGameGauntletSession(sessionId?: string) {
  const session = readSessionFromStorage();
  if (!session) return null;
  if (sessionId && session.id !== sessionId) return null;
  return session;
}

function saveGameGauntletSession(session: GameGauntletSession) {
  Taro.setStorageSync(GAUNTLET_STORAGE_KEY, JSON.stringify(session));
}

export function clearGameGauntletSession() {
  Taro.removeStorageSync(GAUNTLET_STORAGE_KEY);
}

export function buildGameGauntletWeightedPool(games: GameCatalogItem[]) {
  return games.flatMap((game) => (
    Array.from({ length: Math.max(1, Math.floor(game.gauntletModeWeight)) }, () => game)
  ));
}

export function selectWeightedUniqueGauntletGames(
  games: GameCatalogItem[],
  count: number,
  seed = `${Date.now()}`,
) {
  const selectedGames: GameCatalogItem[] = [];
  let remainingGames = [...games];

  for (let index = 0; index < count && remainingGames.length > 0; index += 1) {
    const weightedPool = buildGameGauntletWeightedPool(remainingGames);
    const [selectedGame] = stableShuffle(weightedPool, `${seed}:${index}`);
    if (!selectedGame) break;

    selectedGames.push(selectedGame);
    remainingGames = remainingGames.filter((game) => game.id !== selectedGame.id);
  }

  return selectedGames;
}

export function buildGameGauntletGameIds(seed = `${Date.now()}`) {
  return selectWeightedUniqueGauntletGames(GAUNTLET_CANDIDATE_GAMES, GAUNTLET_LEG_COUNT, seed)
    .map((game) => game.id);
}

export function createGameGauntletSession(seed = `${Date.now()}`): GameGauntletSession {
  const difficulty: GameGauntletDifficulty = Math.random() < 0.5 ? "normal" : "hard";
  const gameIds = buildGameGauntletGameIds(seed);
  const sessionId = createSessionId();
  return {
    id: sessionId,
    gameIds,
    difficulty,
    legs: gameIds.map((gameId, index) => ({
      gameId,
      modePreset: createGameGauntletModePreset(gameId, difficulty, `${sessionId}:${gameId}:${index}`),
    })),
    currentLegIndex: 0,
    results: [],
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

export function startGameGauntletSession(previewSession?: GameGauntletSession) {
  const session: GameGauntletSession = previewSession ?? createGameGauntletSession();
  saveGameGauntletSession(session);
  return session;
}

function getGauntletPageUrl(sessionId: string) {
  return `/pages/game-gauntlet/index?sessionId=${encodeURIComponent(sessionId)}`;
}

export function getGauntletGameUrl(gameId: TrainingGameId, sessionId: string, legIndex: number) {
  const game = getGameById(gameId);
  const separator = game?.url.includes("?") ? "&" : "?";
  const session = readGameGauntletSession(sessionId);
  const preset = session?.legs[legIndex]?.modePreset;
  const params: Array<[string, string]> = [
    ["gauntletSessionId", sessionId],
    ["gauntletLeg", `${legIndex}`],
  ];

  if (preset) {
    params.push(["gauntletDifficulty", preset.difficulty]);
    if (preset.mode) params.push(["gauntletMode", preset.mode]);
    if (preset.stageId) params.push(["gauntletStageId", preset.stageId]);
    if (preset.memoryMode) params.push(["gauntletMemoryMode", preset.memoryMode]);
    if (preset.memoryN) params.push(["gauntletMemoryN", preset.memoryN]);
    if (preset.farmMode) params.push(["gauntletFarmMode", preset.farmMode]);
    if (preset.yardSpeed) params.push(["gauntletYardSpeed", preset.yardSpeed]);
  }

  const query = params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return `${game?.url ?? "/pages/index/index"}${separator}${query}`;
}

export function readGauntletRouteParams() {
  const params = getCurrentInstance().router?.params ?? {};
  const sessionId = typeof params.gauntletSessionId === "string" ? params.gauntletSessionId : "";
  const legIndex = Number(params.gauntletLeg);

  if (!sessionId || !Number.isInteger(legIndex) || legIndex < 0) {
    return null;
  }

  return { sessionId, legIndex };
}

export function isGameGauntletRun() {
  return readGauntletRouteParams() !== null;
}

export function readGameGauntletModePreset(): GameGauntletModePreset | null {
  const params = getCurrentInstance().router?.params ?? {};
  const difficulty = params.gauntletDifficulty === "hard" ? "hard" : "normal";
  if (!readGauntletRouteParams()) return null;

  return {
    difficulty,
    mode: typeof params.gauntletMode === "string" ? params.gauntletMode : undefined,
    stageId: typeof params.gauntletStageId === "string" ? params.gauntletStageId : undefined,
    memoryMode:
      params.gauntletMemoryMode === "pet" || params.gauntletMemoryMode === "calculation" || params.gauntletMemoryMode === "shape"
        ? params.gauntletMemoryMode
        : undefined,
    memoryN: params.gauntletMemoryN === "3" ? "3" : params.gauntletMemoryN === "1" ? "1" : undefined,
    farmMode: params.gauntletFarmMode === "yard" ? "yard" : params.gauntletFarmMode === "speed" ? "speed" : undefined,
    yardSpeed:
      params.gauntletYardSpeed === "fast" || params.gauntletYardSpeed === "standard" || params.gauntletYardSpeed === "slow"
        ? params.gauntletYardSpeed
        : undefined,
  };
}

export function saveGameGauntletLegResult(
  sessionId: string,
  legIndex: number,
  result: GameGauntletLegResult,
) {
  const session = readGameGauntletSession(sessionId);
  if (!session || session.status !== "active" || session.gameIds[legIndex] !== result.gameId) {
    return null;
  }

  const results = [...session.results];
  results[legIndex] = result;

  const completed = results.filter(Boolean).length >= session.gameIds.length;
  const nextSession: GameGauntletSession = {
    ...session,
    results,
    currentLegIndex: Math.min(legIndex + 1, session.gameIds.length),
    status: completed ? "completed" : "active",
    completedAt: completed ? new Date().toISOString() : session.completedAt,
  };

  saveGameGauntletSession(nextSession);
  return nextSession;
}

export function completeGauntletLegIfNeeded(input: GameGauntletCompletionInput) {
  const params = readGauntletRouteParams();
  if (!params) {
    return false;
  }

  const nextSession = saveGameGauntletLegResult(params.sessionId, params.legIndex, {
    gameId: input.gameId,
    score: input.score,
    awardedPoints: input.awardedPoints,
    difficulty: input.difficulty,
    mode: input.mode,
    outcome: input.outcome,
  });
  if (!nextSession) {
    return false;
  }

  void Taro.navigateBack({ delta: 1 }).catch(() => {
    void Taro.redirectTo({ url: getGauntletPageUrl(params.sessionId) });
  });
  return true;
}

export function finalizeGameGauntletSession(sessionId: string) {
  const session = readGameGauntletSession(sessionId);
  if (!session || session.status !== "completed") {
    return null;
  }

  const score = session.results.reduce((sum, result) => sum + result.awardedPoints, 0);
  const rewardPolicy = {
    applyDifficultyMultiplier: false,
    maxPoints: score,
  };
  const awardedPoints = getAwardedPoints(GAME_GAUNTLET_ID, score, "normal", rewardPolicy);

  addPointsToPet(GAME_GAUNTLET_ID, score, "normal", rewardPolicy);
  const record = recordTrainingSession({
    gameId: GAME_GAUNTLET_ID,
    score,
    awardedPoints,
    mode: session.gameIds.join("+"),
    difficulty: "normal",
    outcome: "completed",
  });

  clearGameGauntletSession();
  return record;
}
