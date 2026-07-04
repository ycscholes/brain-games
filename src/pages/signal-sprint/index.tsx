import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  recordTrainingSession,
  type TrainingDifficulty,
} from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import {
  createSignalSprintSession,
  scoreSignalSprintTrial,
  SIGNAL_SPRINT_TOTAL_TRIALS,
  type SignalSprintTrial,
  type SignalSprintTrialResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "ready" | "active" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "signal_sprint_best";
const READY_MS = 520;
const FEEDBACK_MS = 560;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function SignalSprint() {
  usePageShare("pages/signal-sprint/index");

  const [phase, setPhase] = useState<Phase>("start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>("normal");
  const [best, setBest] = useState(0);
  const [trials, setTrials] = useState<SignalSprintTrial[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctTrials, setCorrectTrials] = useState(0);
  const [lastResult, setLastResult] = useState<SignalSprintTrialResult | null>(null);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const trialStartedAtRef = useRef(0);
  const answeredRef = useRef(false);
  const finishedRef = useRef(false);
  const phaseRef = useRef<Phase>("start");
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const correctTrialsRef = useRef(0);
  const currentIndexRef = useRef(0);
  const trialsRef = useRef<SignalSprintTrial[]>([]);

  const currentTrial = trials[currentIndex] ?? null;
  const totalTrials = SIGNAL_SPRINT_TOTAL_TRIALS[difficulty];

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timersRef.current.push(timer);
  }, []);

  const refreshBest = useCallback(() => {
    setBest(readBestScore(difficulty));
  }, [difficulty]);

  useLoad(() => {
    refreshBest();
  });

  useDidShow(() => {
    refreshBest();
  });

  useEffect(() => {
    refreshBest();
  }, [refreshBest]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    bestComboRef.current = bestCombo;
  }, [bestCombo]);

  useEffect(() => {
    correctTrialsRef.current = correctTrials;
  }, [correctTrials]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    trialsRef.current = trials;
  }, [trials]);

  const finishGame = useCallback((finalScore: number, finalCorrectTrials: number) => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    clearTimers();

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const nextAwardedPoints = getAwardedPoints("signal-sprint", finalScore, difficulty);
    addPointsToPet("signal-sprint", finalScore, difficulty);
    recordTrainingSession({
      gameId: "signal-sprint",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    });

    setAwardedPoints(nextAwardedPoints);
    setCorrectTrials(finalCorrectTrials);
    setPhase("finished");

    if (finalScore > best) {
      Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`, finalScore);
      setBest(finalScore);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }
  }, [best, clearTimers, difficulty]);

  const beginTrial = useCallback((trialIndex: number, nextTrials = trialsRef.current) => {
    clearTimers();
    answeredRef.current = false;
    setCurrentIndex(trialIndex);
    setLastResult(null);
    setPhase("ready");

    schedule(() => {
      const trial = nextTrials[trialIndex];
      if (!trial) {
        finishGame(scoreRef.current, correctTrialsRef.current);
        return;
      }

      trialStartedAtRef.current = Date.now();
      setPhase("active");

      schedule(() => {
        if (answeredRef.current || phaseRef.current !== "active") {
          return;
        }

        const action = trial.signal === "stop" ? "hold" : "miss";
        settleTrial(trial, action);
      }, trial.responseWindowMs);
    }, READY_MS);
  }, [clearTimers, finishGame, schedule]);

  const startGame = () => {
    clearTimers();
    const nextTrials = createSignalSprintSession(difficulty);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    trialsRef.current = nextTrials;
    setTrials(nextTrials);
    setCurrentIndex(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectTrials(0);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    beginTrial(0, nextTrials);
  };

  const backToStart = () => {
    clearTimers();
    setPhase("start");
    setTrials([]);
    setCurrentIndex(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectTrials(0);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    answeredRef.current = false;
    finishedRef.current = false;
    refreshBest();
  };

  function settleTrial(trial: SignalSprintTrial, action: "tap" | "hold" | "miss") {
    if (answeredRef.current || phaseRef.current !== "active") {
      return;
    }

    answeredRef.current = true;
    clearTimers();

    const result = scoreSignalSprintTrial({
      signal: trial.signal,
      action,
      reactionMs: Date.now() - trialStartedAtRef.current,
      currentCombo: comboRef.current,
    });
    const nextScore = Math.max(0, scoreRef.current + result.scoreDelta);
    const nextCombo = result.correct ? comboRef.current + 1 : 0;
    const nextCorrectTrials = correctTrialsRef.current + (result.correct ? 1 : 0);

    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestComboRef.current, nextCombo));
    setCorrectTrials(nextCorrectTrials);
    setPhase("feedback");

    schedule(() => {
      if (currentIndexRef.current >= totalTrials - 1) {
        finishGame(nextScore, nextCorrectTrials);
        return;
      }

      beginTrial(currentIndexRef.current + 1);
    }, FEEDBACK_MS);
  }

  const tapSignal = () => {
    if (phaseRef.current !== "active" || !currentTrial) {
      return;
    }

    settleTrial(currentTrial, "tap");
  };

  const accuracyText = useMemo(() => {
    return `${Math.round((correctTrials / totalTrials) * 100)}%`;
  }, [correctTrials, totalTrials]);

  const renderDifficultyCard = (nextDifficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`difficulty-card ${difficulty === nextDifficulty ? "difficulty-card-active" : ""}`}
      onClick={() => setDifficulty(nextDifficulty)}
    >
      <Text className="difficulty-name">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="difficulty-copy">{copy}</Text>
    </View>
  );

  return (
    <View className="signal-sprint-page">
      {phase === "start" ? (
        <View className="signal-start">
          <View className="signal-hero">
            <Text className="hero-kicker">反应抑制训练</Text>
            <Text className="hero-title">信号冲刺</Text>
            <Text className="hero-copy">看到绿灯立刻出发，看到红灯稳住不点，练习反应速度和刹车能力。</Text>
            <View className="best-pill">
              <Text className="best-label">当前难度最高</Text>
              <Text className="best-value">{best}</Text>
            </View>
          </View>

          <View className="info-panel">
            <Text className="section-title">训练规则</Text>
            <Text className="rule-line">1. 绿灯出现时尽快点击出发。</Text>
            <Text className="rule-line">2. 红灯出现时不要点击，忍住就是得分。</Text>
            <Text className="rule-line">3. 连续正确会加分，红灯误触会扣分。</Text>
          </View>

          <View className="info-panel">
            <Text className="section-title">难度</Text>
            <View className="difficulty-grid">
              {renderDifficultyCard("normal", "22 个信号 · 节奏舒缓")}
              {renderDifficultyCard("hard", "26 个信号 · 窗口更短")}
            </View>
          </View>

          <View className="primary-button" onClick={startGame}>
            <Text className="primary-button-text">开始训练</Text>
          </View>
        </View>
      ) : null}

      {(phase === "ready" || phase === "active" || phase === "feedback") && currentTrial ? (
        <View className="signal-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{totalTrials}</Text>
              <Text className="status-label">信号</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{score}</Text>
              <Text className="status-label">得分</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{combo}</Text>
              <Text className="status-label">连击</Text>
            </View>
          </View>

          <View className={`signal-stage signal-stage-${phase === "active" ? currentTrial.signal : "ready"}`}>
            <Text className="stage-kicker">
              {phase === "ready" ? "准备" : currentTrial.cue}
            </Text>
            <Text className="stage-signal">
              {phase === "ready" ? "盯住信号" : currentTrial.label}
            </Text>
            <Text className="stage-copy">
              {phase === "ready"
                ? "信号马上出现"
                : currentTrial.signal === "go"
                  ? "现在点击下方按钮"
                  : "不要点击，等它过去"}
            </Text>
          </View>

          <View
            className={`tap-button ${phase === "active" && currentTrial.signal === "go" ? "tap-button-go" : ""}`}
            onClick={tapSignal}
          >
            <Text className="tap-button-text">出发</Text>
          </View>

          {phase === "feedback" ? (
            <View className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastResult?.correct ? "判断正确" : "节奏断开"}</Text>
              <Text className="feedback-copy">
                本信号 {lastResult && lastResult.scoreDelta > 0 ? "+" : ""}{lastResult?.scoreDelta ?? 0}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="signal-result">
          <View className="result-card">
            <Text className="result-kicker">训练完成</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              信号冲刺 · {getTrainingDifficultyLabel(difficulty)} {isNewBest ? "· 新最高" : ""}
            </Text>
            <View className="result-grid">
              <View className="result-item">
                <Text className="result-item-value">{accuracyText}</Text>
                <Text className="result-item-label">正确率</Text>
              </View>
              <View className="result-item">
                <Text className="result-item-value">{bestCombo}</Text>
                <Text className="result-item-label">最佳连击</Text>
              </View>
              <View className="result-item">
                <Text className="result-item-value">+{awardedPoints}</Text>
                <Text className="result-item-label">宠物积分</Text>
              </View>
            </View>
            <View className="result-actions">
              <View className="secondary-button" onClick={backToStart}>
                <Text className="secondary-button-text">返回设置</Text>
              </View>
              <View className="primary-button" onClick={startGame}>
                <Text className="primary-button-text">再练一局</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
