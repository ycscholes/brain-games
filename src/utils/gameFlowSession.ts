import Taro from "@tarojs/taro";
import type { TrainingGameId } from "../domain/training/types";

const STORAGE_KEY_PREFIX = "game_flow_run_v1";
let runSequence = 0;

export type GameRunStatus = "active" | "settled" | "abandoned";

export interface GameRun<TPayload extends object = Record<string, never>, TResult extends object = Record<string, never>> {
  gameId: TrainingGameId;
  runId: string;
  status: GameRunStatus;
  createdAt: string;
  updatedAt: string;
  payload: TPayload;
  result?: TResult;
}

function getStorageKey(gameId: TrainingGameId, runId: string) {
  return `${STORAGE_KEY_PREFIX}:${gameId}:${runId}`;
}

function createRunId() {
  runSequence += 1;
  return `run_${Date.now()}_${runSequence}_${Math.random().toString(36).slice(2, 8)}`;
}

function isGameRun(value: unknown): value is GameRun<object, object> {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<GameRun<object, object>>;
  return (
    typeof run.gameId === "string"
    && typeof run.runId === "string"
    && (run.status === "active" || run.status === "settled" || run.status === "abandoned")
    && typeof run.createdAt === "string"
    && typeof run.updatedAt === "string"
    && Boolean(run.payload)
    && typeof run.payload === "object"
  );
}

function saveGameRun<TPayload extends object, TResult extends object>(run: GameRun<TPayload, TResult>) {
  Taro.setStorageSync(getStorageKey(run.gameId, run.runId), JSON.stringify(run));
  return run;
}

export function createGameRun<TPayload extends object>(gameId: TrainingGameId, payload: TPayload): GameRun<TPayload> {
  const now = new Date().toISOString();
  return saveGameRun({
    gameId,
    runId: createRunId(),
    status: "active",
    createdAt: now,
    updatedAt: now,
    payload,
  });
}

export function readGameRun<TPayload extends object, TResult extends object = Record<string, never>>(
  gameId: TrainingGameId,
  runId: string,
): GameRun<TPayload, TResult> | null {
  if (!runId) return null;
  const raw = Taro.getStorageSync(getStorageKey(gameId, runId));
  if (typeof raw !== "string" || !raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isGameRun(parsed) || parsed.gameId !== gameId || parsed.runId !== runId) return null;
    return parsed as GameRun<TPayload, TResult>;
  } catch {
    return null;
  }
}

export function updateGameRun<TPayload extends object>(
  gameId: TrainingGameId,
  runId: string,
  patch: Partial<TPayload>,
): GameRun<TPayload> | null {
  const run = readGameRun<TPayload>(gameId, runId);
  if (!run || run.status !== "active") return null;
  return saveGameRun({
    ...run,
    updatedAt: new Date().toISOString(),
    payload: { ...run.payload, ...patch },
  });
}

export function settleGameRun<TPayload extends object, TResult extends object>(
  gameId: TrainingGameId,
  runId: string,
  result: TResult,
): GameRun<TPayload, TResult> | null {
  const run = readGameRun<TPayload, TResult>(gameId, runId);
  if (!run || run.status !== "active") return null;
  return saveGameRun({
    ...run,
    status: "settled",
    updatedAt: new Date().toISOString(),
    result,
  });
}

export function abandonGameRun<TPayload extends object>(gameId: TrainingGameId, runId: string): GameRun<TPayload> | null {
  const run = readGameRun<TPayload>(gameId, runId);
  if (!run || run.status !== "active") return null;
  return saveGameRun({
    ...run,
    status: "abandoned",
    updatedAt: new Date().toISOString(),
  });
}
