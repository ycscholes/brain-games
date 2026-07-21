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
import { completeGauntletLegIfNeeded, readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { playComplete, playCorrect, playTap, playWrong } from "../../services/audio/audioFeedbackService";
import {
  CODE_BREAKER_TOTAL_PUZZLES,
  createCodeBreakerSession,
  formatCode,
  scoreCodeBreakerPuzzle,
  type CodeBreakerOption,
  type CodeBreakerPuzzle,
  type CodeBreakerResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "code_breaker_best";
const FEEDBACK_MS = 900;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function renderCodeChips(code: string[], className = "") {
  return (
    <View className={`code-chip-row ${className}`}>
      {code.map((digit, index) => (
        <Text key={`${digit}-${index}`} className="code-chip">{digit}</Text>
      ))}
    </View>
  );
}

export default function CodeBreaker() {
  usePageShare("pages/code-breaker/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;

  const [phase, setPhase] = useState<Phase>("start");
  useAmbientMusic(phase === "start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(gauntletPreset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);
  const [puzzles, setPuzzles] = useState<CodeBreakerPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctPuzzles, setCorrectPuzzles] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [lastResult, setLastResult] = useState<CodeBreakerResult | null>(null);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const puzzleStartedAtRef = useRef(0);
  const finishedRef = useRef(false);
  const answeredRef = useRef(false);
  const autoStartedRef = useRef(false);
  const phaseRef = useRef<Phase>("start");
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const correctPuzzlesRef = useRef(0);
  const currentIndexRef = useRef(0);
  const currentPuzzle = puzzles[currentIndex] ?? null;

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
    correctPuzzlesRef.current = correctPuzzles;
  }, [correctPuzzles]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const finishGame = useCallback((finalScore: number, finalCorrectPuzzles: number) => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    clearTimers();
    playComplete();

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const nextAwardedPoints = getAwardedPoints("code-breaker", finalScore, difficulty);
    if (completeGauntletLegIfNeeded({
      gameId: "code-breaker",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    })) {
      return;
    }

    addPointsToPet("code-breaker", finalScore, difficulty);
    recordTrainingSession({
      gameId: "code-breaker",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    });

    setAwardedPoints(nextAwardedPoints);
    setCorrectPuzzles(finalCorrectPuzzles);
    setPhase("finished");

    if (finalScore > best) {
      Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`, finalScore);
      setBest(finalScore);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }
  }, [best, clearTimers, difficulty]);

  const beginPuzzle = useCallback((puzzleIndex: number) => {
    clearTimers();
    setCurrentIndex(puzzleIndex);
    setSelectedOptionId("");
    setLastResult(null);
    answeredRef.current = false;
    puzzleStartedAtRef.current = Date.now();
    setPhase("playing");
  }, [clearTimers]);

  const submitAnswer = useCallback((option: CodeBreakerOption) => {
    if (phaseRef.current !== "playing" || !currentPuzzle || answeredRef.current) {
      return;
    }

    answeredRef.current = true;
    clearTimers();
    playTap();

    const result = scoreCodeBreakerPuzzle({
      selectedOptionId: option.id,
      answerOptionId: currentPuzzle.answerOptionId,
      answerMs: Date.now() - puzzleStartedAtRef.current,
      currentCombo: comboRef.current,
    });
    result.correct ? playCorrect() : playWrong();

    const nextScore = scoreRef.current + result.score;
    const nextCombo = result.correct ? comboRef.current + 1 : 0;
    const nextCorrectPuzzles = correctPuzzlesRef.current + (result.correct ? 1 : 0);

    setSelectedOptionId(option.id);
    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestComboRef.current, nextCombo));
    setCorrectPuzzles(nextCorrectPuzzles);
    setPhase("feedback");

    schedule(() => {
      if (currentIndexRef.current >= CODE_BREAKER_TOTAL_PUZZLES - 1) {
        finishGame(nextScore, nextCorrectPuzzles);
        return;
      }

      beginPuzzle(currentIndexRef.current + 1);
    }, FEEDBACK_MS);
  }, [beginPuzzle, clearTimers, currentPuzzle, finishGame, schedule]);

  const startGame = () => {
    playTap();
    clearTimers();
    const nextPuzzles = createCodeBreakerSession(difficulty);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setPuzzles(nextPuzzles);
    setCurrentIndex(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectPuzzles(0);
    setSelectedOptionId("");
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    puzzleStartedAtRef.current = Date.now();
    answeredRef.current = false;
    setPhase("playing");
  };

  useEffect(() => {
    if (!isGauntletPreset || autoStartedRef.current || phase !== "start") return;
    autoStartedRef.current = true;
    startGame();
  }, [isGauntletPreset, phase, startGame]);

  const backToStart = () => {
    clearTimers();
    setPhase("start");
    setPuzzles([]);
    setCurrentIndex(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectPuzzles(0);
    setSelectedOptionId("");
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    finishedRef.current = false;
    refreshBest();
  };

  const accuracyText = useMemo(() => {
    return `${Math.round((correctPuzzles / CODE_BREAKER_TOTAL_PUZZLES) * 100)}%`;
  }, [correctPuzzles]);

  const answerOption = currentPuzzle?.options.find((option) => option.id === currentPuzzle.answerOptionId);
  const answerCodeText = answerOption ? formatCode(answerOption.code) : "";

  const renderDifficultyCard = (nextDifficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`summary-item ${difficulty === nextDifficulty ? "summary-item-active" : ""}`}
      onClick={() => setDifficulty(nextDifficulty)}
    >
      <Text className="summary-value">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="summary-label">{copy}</Text>
    </View>
  );

  return (
    <View className="code-breaker-page">
      {phase === "start" ? (
        <View className="breaker-start start-screen">
          <View className="header-section">
            <View className="logo-icon breaker-logo">
              <Text className="logo-emoji">码</Text>
            </View>
            <Text className="game-title">密码推理</Text>
            <Text className="game-subtitle">根据反馈线索，找出唯一正确的数字密码</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">当前难度最高</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 每局 8 题，阅读历史猜测和反馈。</Text>
            <Text className="rule-item">2. “位置正确”代表数字和位置都对，“数字存在”代表数字对但位置错。</Text>
            <Text className="rule-item">3. 从 4 个候选密码中选出唯一满足全部线索的答案。</Text>
          </View>

          {!isGauntletPreset && (
          <View className="summary-card">
            <Text className="section-title">难度</Text>
            <View className="summary-grid">
              {renderDifficultyCard("normal", "3 位密码 · 3 条线索")}
              {renderDifficultyCard("hard", "4 位密码 · 4 条线索")}
            </View>
          </View>
          )}

          <View className="floating-start-action">
            <View className="primary-button" onClick={startGame}>
              <Text className="primary-button-text">开始推理</Text>
            </View>
          </View>
          <View className="floating-start-spacer" />
        </View>
      ) : null}

      {(phase === "playing" || phase === "feedback") && currentPuzzle ? (
        <View className="breaker-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{CODE_BREAKER_TOTAL_PUZZLES}</Text>
              <Text className="status-label">题目</Text>
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

          <View className="clue-board">
            <Text className="question-kicker">线索记录</Text>
            <Text className="board-copy">
              {currentPuzzle.answerCode.length} 位数字，每条反馈都来自同一个隐藏密码
            </Text>
            <View className="clue-list">
              {currentPuzzle.clues.map((clue) => (
                <View key={clue.id} className="clue-row">
                  {renderCodeChips(clue.guess)}
                  <View className="feedback-track">
                    <Text className="feedback-pill exact-pill">位置正确 {clue.feedback.exact}</Text>
                    <Text className="feedback-pill misplaced-pill">数字存在 {clue.feedback.misplaced}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="breaker-option-grid">
            {currentPuzzle.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const isAnswer = phase === "feedback" && option.id === currentPuzzle.answerOptionId;
              return (
                <View
                  key={option.id}
                  className={`breaker-option ${isSelected ? "breaker-option-selected" : ""} ${isAnswer ? "breaker-option-answer" : ""}`}
                  onClick={() => submitAnswer(option)}
                >
                  {renderCodeChips(option.code, "option-code")}
                </View>
              );
            })}
          </View>

          {phase === "feedback" ? (
            <View className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastResult?.correct ? "推理正确" : "正确密码"}</Text>
              <Text className="feedback-copy">
                {answerCodeText} · 本题 +{lastResult?.score ?? 0}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="breaker-result">
          <View className="result-card">
            <Text className="result-kicker">训练完成</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              密码推理 · {getTrainingDifficultyLabel(difficulty)} {isNewBest ? "· 新最高" : ""}
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
