import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  MAX_POINTS_PER_SESSION,
  recordTrainingSession,
} from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import {
  applyDualTaskEvent,
  createInitialDualTaskStats,
  createInsertTask,
  DUAL_TASK_SESSION_MS,
  getDualTaskDifficultyConfig,
  getMainTrackFrame,
  isInsertTaskAnswerCorrect,
  judgeMainTrackTap,
  shouldEnterRecovery,
  type DualTaskDifficulty,
  type DualTaskFeedback,
  type DualTaskPhase,
  type DualTaskStats,
  type InsertTask,
  type InsertTaskType,
  type MainTrackFrame,
} from "./gameLogic";
import "./index.scss";

type GameStatus = "start" | "playing" | "finished";

const STORAGE_KEY = "dual_task_best_command_center";
const TICK_MS = 50;
const FEEDBACK_RESET_MS = 700;
const INSERT_TYPES: InsertTaskType[] = ["odd-even", "greater-than", "color", "direction"];

const PHASE_LABELS: Record<DualTaskPhase, string> = {
  warmup: "热身",
  interference: "干扰",
  sprint: "冲刺",
};

const FEEDBACK_TEXT: Record<DualTaskFeedback, string> = {
  idle: "盯住游标，进目标区就校准；插入任务出现时快速处理。",
  "main-hit": "主轨校准命中",
  "insert-hit": "插入任务命中",
  "sync-hit": "双线同步完成",
  miss: "偏离节奏",
  recovery: "恢复窗口：先稳住主轨",
};

const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function getStorageKey(difficulty: DualTaskDifficulty) {
  return `${STORAGE_KEY}_${difficulty}`;
}

function getNextInsertDelay(difficulty: DualTaskDifficulty, phase: DualTaskPhase) {
  const config = getDualTaskDifficultyConfig(difficulty);
  const range = config.insertIntervalMs[phase];
  return randomRange(range.min, range.max);
}

function getNextTargetCenter() {
  return Math.random() * 0.5 + 0.25;
}

function pickInsertType(difficulty: DualTaskDifficulty, phase: DualTaskPhase): InsertTaskType {
  const config = getDualTaskDifficultyConfig(difficulty);
  if (Math.random() < config.stroopChance[phase]) {
    return "stroop";
  }
  return INSERT_TYPES[randomRange(0, INSERT_TYPES.length - 1)];
}

function createFrame(difficulty: DualTaskDifficulty, elapsedMs: number, targetCenter: number) {
  return getMainTrackFrame({ difficulty, elapsedMs, targetCenter });
}

export default function DualTaskGame() {
  usePageShare("pages/dual-task/index");

  const [gameStatus, setGameStatus] = useState<GameStatus>("start");
  const [difficulty, setDifficulty] = useState<DualTaskDifficulty>("normal");
  const [stats, setStats] = useState<DualTaskStats>(() => createInitialDualTaskStats());
  const [finalStats, setFinalStats] = useState<DualTaskStats>(() => createInitialDualTaskStats());
  const [bestScore, setBestScore] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [frame, setFrame] = useState<MainTrackFrame>(() => createFrame("normal", 0, 0.5));
  const [insertTask, setInsertTask] = useState<InsertTask | null>(null);
  const [feedback, setFeedback] = useState<DualTaskFeedback>("idle");
  const [recoveryUntilMs, setRecoveryUntilMs] = useState(0);

  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);
  const nextInsertAtRef = useRef(0);
  const targetCenterRef = useRef(0.5);
  const statsRef = useRef(stats);
  const frameRef = useRef(frame);
  const insertTaskRef = useRef<InsertTask | null>(insertTask);
  const difficultyRef = useRef<DualTaskDifficulty>(difficulty);
  const recoveryUntilRef = useRef(0);
  const finishedRef = useRef(false);

  const difficultyConfig = getDualTaskDifficultyConfig(difficulty);
  const displayStats = gameStatus === "finished" ? finalStats : stats;
  const timeLeftMs = Math.max(0, DUAL_TASK_SESSION_MS - elapsedMs);
  const activeRecovery = gameStatus === "playing" && elapsedMs < recoveryUntilMs;
  const awardedPointsPreview = getAwardedPoints(
    "dual-task",
    Math.min(MAX_POINTS_PER_SESSION, Math.max(0, Math.round(displayStats.score))),
    difficultyConfig.rewardDifficulty,
  );

  const clearTimers = () => {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  };

  const loadBestScore = useCallback(() => {
    const cached = Taro.getStorageSync(getStorageKey(difficulty));
    setBestScore(cached ? Number(cached) : 0);
  }, [difficulty]);

  useLoad(() => {
    loadBestScore();
  });

  useDidShow(() => {
    loadBestScore();
  });

  useEffect(() => {
    difficultyRef.current = difficulty;
    if (gameStatus !== "playing") {
      setFrame(createFrame(difficulty, 0, targetCenterRef.current));
      loadBestScore();
    }
  }, [difficulty, gameStatus, loadBestScore]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    insertTaskRef.current = insertTask;
  }, [insertTask]);

  const setMomentaryFeedback = useCallback((nextFeedback: DualTaskFeedback) => {
    setFeedback(nextFeedback);
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(recoveryUntilRef.current > Date.now() - startedAtRef.current ? "recovery" : "idle");
    }, FEEDBACK_RESET_MS);
  }, []);

  const updateStats = useCallback((nextStats: DualTaskStats) => {
    statsRef.current = nextStats;
    setStats(nextStats);
  }, []);

  const finishGame = useCallback((statsOverride?: DualTaskStats, elapsedOverride?: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();

    const settledStats = statsOverride ?? statsRef.current;
    const settledDifficulty = difficultyRef.current;
    const config = getDualTaskDifficultyConfig(settledDifficulty);
    const settledScore = Math.min(MAX_POINTS_PER_SESSION, Math.max(0, Math.round(settledStats.score)));
    const awardedPoints = getAwardedPoints("dual-task", settledScore, config.rewardDifficulty);
    const durationSeconds = Math.max(1, Math.round(Math.min(DUAL_TASK_SESSION_MS, elapsedOverride ?? elapsedMs) / 1000));

    Taro.setStorageSync(`dual_task_last_command_center_${settledDifficulty}`, settledScore);
    addPointsToPet("dual-task", settledScore, config.rewardDifficulty);
    recordTrainingSession({
      gameId: "dual-task",
      score: settledScore,
      awardedPoints,
      mode: "command-center",
      difficulty: config.rewardDifficulty,
      durationSeconds,
      outcome: "completed",
    });

    const key = getStorageKey(settledDifficulty);
    const currentBest = Number(Taro.getStorageSync(key) || 0);
    const nextBest = Math.max(currentBest, settledScore);
    if (nextBest !== currentBest) {
      Taro.setStorageSync(key, nextBest);
    }

    setElapsedMs(Math.min(DUAL_TASK_SESSION_MS, elapsedOverride ?? elapsedMs));
    setFinalStats({ ...settledStats, score: settledScore });
    setStats({ ...settledStats, score: settledScore });
    setBestScore(nextBest);
    setInsertTask(null);
    setRecoveryUntilMs(0);
    recoveryUntilRef.current = 0;
    setGameStatus("finished");
  }, [elapsedMs]);

  const applyMiss = useCallback(() => {
    const nextStats = applyDualTaskEvent(statsRef.current, { type: "miss" });
    updateStats(nextStats);
    setMomentaryFeedback("miss");

    if (shouldEnterRecovery(nextStats)) {
      const recoveryUntil = Math.min(
        DUAL_TASK_SESSION_MS,
        Math.max(elapsedMs, frameRef.current.elapsedMs) + getDualTaskDifficultyConfig(difficultyRef.current).recoveryMs,
      );
      recoveryUntilRef.current = recoveryUntil;
      setRecoveryUntilMs(recoveryUntil);
      setFeedback("recovery");
      setInsertTask(null);
    }
  }, [elapsedMs, setMomentaryFeedback, updateStats]);

  const handleCalibrate = useCallback(() => {
    if (gameStatus !== "playing" || elapsedMs < recoveryUntilMs) return;

    const currentFrame = frameRef.current;
    const judgment = judgeMainTrackTap(currentFrame);
    if (judgment !== "hit") {
      applyMiss();
      return;
    }

    const currentInsert = insertTaskRef.current;
    const previousSyncCount = statsRef.current.syncCount;
    const nextStats = applyDualTaskEvent(statsRef.current, {
      type: "main-hit",
      insertWindowId: currentInsert?.id,
    });
    updateStats(nextStats);
    targetCenterRef.current = getNextTargetCenter();
    setMomentaryFeedback(nextStats.syncCount > previousSyncCount ? "sync-hit" : "main-hit");
  }, [applyMiss, elapsedMs, gameStatus, recoveryUntilMs, setMomentaryFeedback, updateStats]);

  const handleInsertAnswer = useCallback((optionIndex: number) => {
    if (gameStatus !== "playing" || elapsedMs < recoveryUntilMs) return;

    const currentInsert = insertTaskRef.current;
    if (!currentInsert) return;

    if (!isInsertTaskAnswerCorrect(currentInsert, optionIndex)) {
      insertTaskRef.current = null;
      setInsertTask(null);
      applyMiss();
      return;
    }

    const previousSyncCount = statsRef.current.syncCount;
    const nextStats = applyDualTaskEvent(statsRef.current, {
      type: "insert-hit",
      insertWindowId: currentInsert.id,
    });
    updateStats(nextStats);
    insertTaskRef.current = null;
    setInsertTask(null);
    setMomentaryFeedback(nextStats.syncCount > previousSyncCount ? "sync-hit" : "insert-hit");
  }, [applyMiss, elapsedMs, gameStatus, recoveryUntilMs, setMomentaryFeedback, updateStats]);

  const startGame = useCallback(() => {
    clearTimers();
    finishedRef.current = false;

    const config = getDualTaskDifficultyConfig(difficulty);
    const initialStats = createInitialDualTaskStats();
    const initialFrame = createFrame(difficulty, 0, 0.5);
    const firstDelay = getNextInsertDelay(difficulty, "warmup");

    startedAtRef.current = Date.now();
    targetCenterRef.current = 0.5;
    nextInsertAtRef.current = firstDelay;
    recoveryUntilRef.current = 0;
    statsRef.current = initialStats;
    frameRef.current = initialFrame;
    insertTaskRef.current = null;
    difficultyRef.current = difficulty;

    setStats(initialStats);
    setFinalStats(initialStats);
    setElapsedMs(0);
    setFrame(initialFrame);
    setInsertTask(null);
    setRecoveryUntilMs(0);
    setFeedback("idle");
    setGameStatus("playing");

    tickTimerRef.current = setInterval(() => {
      const nextElapsed = Math.min(DUAL_TASK_SESSION_MS, Date.now() - startedAtRef.current);
      const currentDifficulty = difficultyRef.current;
      const nextFrame = createFrame(currentDifficulty, nextElapsed, targetCenterRef.current);
      const currentConfig = getDualTaskDifficultyConfig(currentDifficulty);

      frameRef.current = nextFrame;
      setElapsedMs(nextElapsed);
      setFrame(nextFrame);

      if (recoveryUntilRef.current && nextElapsed >= recoveryUntilRef.current) {
        recoveryUntilRef.current = 0;
        setRecoveryUntilMs(0);
        setFeedback("idle");
      }

      const currentInsert = insertTaskRef.current;
      if (currentInsert && nextElapsed - currentInsert.startedAtMs >= currentInsert.durationMs) {
        insertTaskRef.current = null;
        setInsertTask(null);
        const nextStats = applyDualTaskEvent(statsRef.current, { type: "miss" });
        statsRef.current = nextStats;
        setStats(nextStats);
        setMomentaryFeedback("miss");
        if (shouldEnterRecovery(nextStats)) {
          const recoveryUntil = Math.min(DUAL_TASK_SESSION_MS, nextElapsed + currentConfig.recoveryMs);
          recoveryUntilRef.current = recoveryUntil;
          setRecoveryUntilMs(recoveryUntil);
          setFeedback("recovery");
        }
      }

      if (!insertTaskRef.current && !recoveryUntilRef.current && nextElapsed >= nextInsertAtRef.current) {
        const type = pickInsertType(currentDifficulty, nextFrame.phase);
        const task = createInsertTask({
          type,
          seed: nextElapsed + statsRef.current.score + statsRef.current.mainHits,
          durationMs: currentConfig.insertDurationMs[nextFrame.phase],
          startedAtMs: nextElapsed,
        });
        insertTaskRef.current = task;
        setInsertTask(task);
        nextInsertAtRef.current = nextElapsed + getNextInsertDelay(currentDifficulty, nextFrame.phase);
      }

      if (nextElapsed >= DUAL_TASK_SESSION_MS) {
        finishGame(statsRef.current, DUAL_TASK_SESSION_MS);
      }
    }, TICK_MS);
  }, [difficulty, finishGame, setMomentaryFeedback]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  const trackTargetStyle = useMemo(
    () => ({
      left: `${frame.targetStart * 100}%`,
      width: `${(frame.targetEnd - frame.targetStart) * 100}%`,
    }),
    [frame.targetEnd, frame.targetStart],
  );

  const cursorStyle = useMemo(
    () => ({
      left: `${frame.cursorPosition * 100}%`,
    }),
    [frame.cursorPosition],
  );

  const insertProgress = useMemo(() => {
    if (!insertTask) return 0;
    return Math.max(0, Math.min(1, 1 - (elapsedMs - insertTask.startedAtMs) / insertTask.durationMs));
  }, [elapsedMs, insertTask]);

  return (
    <View className="dual-task-page">
      {gameStatus === "start" && (
        <View className="start-screen command-start-screen">
          <View className="hero-card command-hero-card">
            <Text className="hero-kicker">双线专注训练</Text>
            <Text className="hero-icon">⌁</Text>
            <Text className="hero-title">多任务处理</Text>
            <Text className="hero-subtitle">双线指挥台：校准主轨，同时处理短插入任务。</Text>
            <View className="best-chip">
              <Text className="best-chip-text">历史最高: {bestScore}</Text>
            </View>
            <View className="hero-metrics">
              <View className="hero-metric">
                <Text className="hero-metric-value">60s</Text>
                <Text className="hero-metric-label">训练时长</Text>
              </View>
              <View className="hero-metric">
                <Text className="hero-metric-value">{difficultyConfig.label}</Text>
                <Text className="hero-metric-label">当前难度</Text>
              </View>
              <View className="hero-metric">
                <Text className="hero-metric-value">{getTrainingDifficultyLabel(difficultyConfig.rewardDifficulty)}</Text>
                <Text className="hero-metric-label">积分难度</Text>
              </View>
            </View>
          </View>

          <View className="panel-grid command-panel-grid">
            <View className="panel panel-primary">
              <Text className="panel-title">难度</Text>
              <View className="chip-row">
                {(["normal", "hard"] as DualTaskDifficulty[]).map((item) => {
                  const itemConfig = getDualTaskDifficultyConfig(item);
                  return (
                    <View
                      key={item}
                      className={`chip ${difficulty === item ? "chip-active" : ""}`}
                      onClick={() => setDifficulty(item)}
                    >
                      <Text className="chip-text">{itemConfig.label}</Text>
                      <Text className="chip-meta">
                        目标区 {Math.round(itemConfig.targetWidth * 100)}% · 插入 {itemConfig.insertDurationMs.sprint / 1000}s
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View className="floating-start-action">
            <View className="primary-button" onClick={startGame}>
              <Text className="button-text">进入指挥中心</Text>
            </View>
          </View>
          <View className="floating-start-spacer" />
        </View>
      )}

      {gameStatus === "playing" && (
        <View className="game-screen command-game-screen">
          <View className="play-shell command-play-shell">
            <View className="battle-header command-header">
              <View className="mode-pill">
                <Text className="mode-pill-text">指挥中心 · {difficultyConfig.label}</Text>
              </View>
              <Text className="mode-sub">
                {PHASE_LABELS[frame.phase]} · 剩余 {Math.ceil(timeLeftMs / 1000)}s
              </Text>
            </View>

            <View className="top-bar command-stats">
              <View className="stat-cell">
                <Text className="stat-label">得分</Text>
                <Text className="stat-value">{stats.score}</Text>
              </View>
              <View className="stat-cell">
                <Text className="stat-label">主轨</Text>
                <Text className="stat-value">{stats.mainHits}</Text>
              </View>
              <View className="stat-cell">
                <Text className="stat-label">插入</Text>
                <Text className="stat-value">{stats.insertHits}</Text>
              </View>
              <View className="stat-cell">
                <Text className="stat-label">连击</Text>
                <Text className="stat-value">x{stats.streak}</Text>
              </View>
            </View>

            <View className={`insert-card command-insert-card ${insertTask ? "insert-card-active" : "insert-card-idle"}`}>
              {insertTask ? (
                <>
                  <View className="task-head">
                    <View className="task-head-main">
                      <Text className="task-tag">插入任务</Text>
                      <Text className="task-label">{insertTask.prompt}</Text>
                    </View>
                    <Text className="task-status">{Math.ceil(insertProgress * insertTask.durationMs / 100) / 10}s</Text>
                  </View>
                  <Text
                    className={`task-question ${insertTask.type === "stroop" ? "task-question-stroop" : ""}`}
                    style={insertTask.inkColor ? { color: insertTask.inkColor } : {}}
                  >
                    {insertTask.display}
                  </Text>
                  <View className="task-progress-track">
                    <View className="task-progress-fill" style={{ width: `${insertProgress * 100}%` }} />
                  </View>
                </>
              ) : (
                <>
                  <Text className="task-tag">插入任务</Text>
                  <Text className="task-label">{activeRecovery ? "恢复中" : "等待指令"}</Text>
                </>
              )}
            </View>

            <View className={`feedback feedback-${feedback}`}>
              <Text className="feedback-text">{FEEDBACK_TEXT[feedback]}</Text>
            </View>

            <View className="command-track-card">
              <View className="command-track-head">
                <Text className="task-label">主命令轨</Text>
                <Text className="task-status">命中区内点击校准</Text>
              </View>
              <View className="command-track">
                <View className="command-track-target" style={trackTargetStyle} />
                <View className="command-track-cursor" style={cursorStyle} />
              </View>
            </View>

            <View className={`primary-button calibrate-button ${activeRecovery ? "button-disabled" : ""}`} onClick={handleCalibrate}>
              <Text className="button-text">{activeRecovery ? "恢复中" : "校准"}</Text>
            </View>

            <View className="options-grid insert-options-grid">
              {(insertTask?.options ?? ["奇", "偶", "左", "右"]).map((option, idx) => (
                <View
                  key={`${insertTask?.id ?? "idle"}-${option}-${idx}`}
                  className={`option-btn ${!insertTask || activeRecovery ? "option-disabled" : ""}`}
                  onClick={() => handleInsertAnswer(idx)}
                >
                  <Text className="option-index">{idx + 1}</Text>
                  <Text className="option-text">{option}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {gameStatus === "finished" && (
        <View className="result-screen command-result-screen">
          <View className="result-card">
            <Text className="result-title">指挥中心成绩</Text>
            <Text className="result-score">{finalStats.score}</Text>
            <Text className="result-desc">
              主轨命中 {finalStats.mainHits} · 插入命中 {finalStats.insertHits} · 同步 {finalStats.syncCount}
            </Text>
            <Text className="result-desc">最佳连击 x{finalStats.bestStreak}</Text>
            <Text className="result-desc">
              积分预览 {awardedPointsPreview} · {getTrainingDifficultyLabel(difficultyConfig.rewardDifficulty)}
            </Text>
            <Text className="result-desc">
              历史最高 {bestScore}
              {finalStats.score > 0 && finalStats.score >= bestScore ? <Text className="result-highlight">，刷新纪录</Text> : null}
            </Text>
          </View>

          <View className="result-actions">
            <View className="primary-button" onClick={startGame}>
              <Text className="button-text">再来一局</Text>
            </View>
            <View className="secondary-button" onClick={() => setGameStatus("start")}>
              <Text className="button-text">返回开始页</Text>
            </View>
            <View className="secondary-button" onClick={() => Taro.reLaunch({ url: "/pages/index/index" })}>
              <Text className="button-text">返回游戏主页</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
