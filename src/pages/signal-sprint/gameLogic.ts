import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type SignalSprintDifficulty = TrainingDifficulty;
export type SignalSprintSignal = "go" | "stop";
export type SignalSprintAction = "tap" | "hold" | "miss";

export interface SignalSprintTrial {
  id: string;
  signal: SignalSprintSignal;
  label: string;
  cue: string;
  responseWindowMs: number;
}

export interface SignalSprintTrialResult {
  correct: boolean;
  speedBonus: number;
  comboBonus: number;
  scoreDelta: number;
}

export const SIGNAL_SPRINT_TOTAL_TRIALS: Record<SignalSprintDifficulty, number> = {
  normal: 22,
  hard: 26,
};

const STOP_TRIALS: Record<SignalSprintDifficulty, number> = {
  normal: 6,
  hard: 8,
};

const RESPONSE_WINDOWS: Record<SignalSprintDifficulty, number[]> = {
  normal: [1350, 1300, 1250, 1200, 1150, 1100],
  hard: [1100, 1060, 1020, 980, 940, 900],
};

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function createSignalPool(difficulty: SignalSprintDifficulty) {
  const total = SIGNAL_SPRINT_TOTAL_TRIALS[difficulty];
  const stopCount = STOP_TRIALS[difficulty];
  const signals: SignalSprintSignal[] = [
    ...Array.from({ length: total - stopCount }, () => "go" as const),
    ...Array.from({ length: stopCount }, () => "stop" as const),
  ];
  const shuffled = shuffle(signals);

  if (shuffled[0] === "stop") {
    const firstGoIndex = shuffled.findIndex((signal) => signal === "go");
    if (firstGoIndex > 0) {
      [shuffled[0], shuffled[firstGoIndex]] = [shuffled[firstGoIndex], shuffled[0]];
    }
  }

  return shuffled;
}

export function getSignalSprintResponseWindowMs(
  difficulty: SignalSprintDifficulty,
  trialIndex: number,
) {
  const windows = RESPONSE_WINDOWS[difficulty];
  const safeIndex = Math.max(0, Math.min(windows.length - 1, Math.floor(trialIndex / 4)));
  return windows[safeIndex];
}

export function createSignalSprintSession(difficulty: SignalSprintDifficulty): SignalSprintTrial[] {
  return createSignalPool(difficulty).map((signal, index) => ({
    id: `signal-sprint-${difficulty}-${index + 1}`,
    signal,
    label: signal === "go" ? "出发" : "停住",
    cue: signal === "go" ? "绿灯" : "红灯",
    responseWindowMs: getSignalSprintResponseWindowMs(difficulty, index),
  }));
}

export function scoreSignalSprintTrial(params: {
  signal: SignalSprintSignal;
  action: SignalSprintAction;
  reactionMs: number;
  currentCombo: number;
}): SignalSprintTrialResult {
  const correct = params.signal === "go"
    ? params.action === "tap"
    : params.action === "hold";

  if (!correct) {
    return {
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      scoreDelta: params.signal === "stop" && params.action === "tap" ? -2 : 0,
    };
  }

  const speedBonus = params.signal === "go" && params.reactionMs <= 520 ? 1 : 0;
  const comboBonus = params.currentCombo >= 3 ? 1 : 0;

  return {
    correct: true,
    speedBonus,
    comboBonus,
    scoreDelta: 2 + speedBonus + comboBonus,
  };
}
