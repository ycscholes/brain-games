import Taro, { getCurrentInstance } from "@tarojs/taro";
import {
  GAME_GAUNTLET_ID,
  GAUNTLET_CANDIDATE_GAMES,
  getGameById,
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
      return parsed as GameGauntletSession;
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

export function buildGameGauntletGameIds(seed = `${Date.now()}`) {
  return stableShuffle(GAUNTLET_CANDIDATE_GAMES, seed)
    .slice(0, GAUNTLET_LEG_COUNT)
    .map((game) => game.id);
}

export function startGameGauntletSession() {
  const session: GameGauntletSession = {
    id: createSessionId(),
    gameIds: buildGameGauntletGameIds(),
    currentLegIndex: 0,
    results: [],
    status: "active",
    createdAt: new Date().toISOString(),
  };

  saveGameGauntletSession(session);
  return session;
}

function getGauntletPageUrl(sessionId: string) {
  return `/pages/game-gauntlet/index?sessionId=${encodeURIComponent(sessionId)}`;
}

export function getGauntletGameUrl(gameId: TrainingGameId, sessionId: string, legIndex: number) {
  const game = getGameById(gameId);
  const separator = game?.url.includes("?") ? "&" : "?";
  return `${game?.url ?? "/pages/index/index"}${separator}gauntletSessionId=${encodeURIComponent(sessionId)}&gauntletLeg=${legIndex}`;
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

  saveGameGauntletLegResult(params.sessionId, params.legIndex, {
    gameId: input.gameId,
    score: input.score,
    awardedPoints: input.awardedPoints,
    difficulty: input.difficulty,
    mode: input.mode,
    outcome: input.outcome,
  });

  void Taro.redirectTo({ url: getGauntletPageUrl(params.sessionId) }).catch(() => {
    void Taro.navigateTo({ url: getGauntletPageUrl(params.sessionId) });
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
