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
import {
  SPATIAL_ROTATION_GRID_SIZE,
  SPATIAL_ROTATION_TOTAL_PUZZLES,
  createSpatialRotationSession,
  scoreSpatialRotationPuzzle,
  type SpatialRotationCell,
  type SpatialRotationOption,
  type SpatialRotationPuzzle,
  type SpatialRotationResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "spatial_rotation_best";
const FEEDBACK_MS = 760;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function renderShape(cells: SpatialRotationCell[]) {
  const activeCells = new Set(cells.map(([row, col]) => cellKey(row, col)));
  return (
    <View className="shape-grid">
      {Array.from({ length: SPATIAL_ROTATION_GRID_SIZE * SPATIAL_ROTATION_GRID_SIZE }, (_, index) => {
        const row = Math.floor(index / SPATIAL_ROTATION_GRID_SIZE);
        const col = index % SPATIAL_ROTATION_GRID_SIZE;
        return (
          <View
            key={cellKey(row, col)}
            className={`shape-cell ${activeCells.has(cellKey(row, col)) ? "shape-cell-active" : ""}`}
          />
        );
      })}
    </View>
  );
}

export default function SpatialRotation() {
  usePageShare("pages/spatial-rotation/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;

  const [phase, setPhase] = useState<Phase>("start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(gauntletPreset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);
  const [puzzles, setPuzzles] = useState<SpatialRotationPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctPuzzles, setCorrectPuzzles] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [lastResult, setLastResult] = useState<SpatialRotationResult | null>(null);
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

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const nextAwardedPoints = getAwardedPoints("spatial-rotation", finalScore, difficulty);
    if (completeGauntletLegIfNeeded({
      gameId: "spatial-rotation",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    })) {
      return;
    }

    addPointsToPet("spatial-rotation", finalScore, difficulty);
    recordTrainingSession({
      gameId: "spatial-rotation",
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

  const submitAnswer = useCallback((
    option: SpatialRotationOption | null,
    puzzle = currentPuzzle,
    timedOut = false,
  ) => {
    if (phaseRef.current !== "playing" || !puzzle || answeredRef.current) {
      return;
    }

    answeredRef.current = true;
    clearTimers();
    const result = scoreSpatialRotationPuzzle({
      selectedOptionId: timedOut ? "" : option?.id ?? "",
      answerOptionId: puzzle.answerOptionId,
      answerMs: Date.now() - puzzleStartedAtRef.current,
      currentCombo: comboRef.current,
    });
    const nextScore = scoreRef.current + result.score;
    const nextCombo = result.correct ? comboRef.current + 1 : 0;
    const nextCorrectPuzzles = correctPuzzlesRef.current + (result.correct ? 1 : 0);

    setSelectedOptionId(timedOut ? "" : option?.id ?? "");
    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestComboRef.current, nextCombo));
    setCorrectPuzzles(nextCorrectPuzzles);
    setPhase("feedback");

    schedule(() => {
      if (currentIndexRef.current >= SPATIAL_ROTATION_TOTAL_PUZZLES - 1) {
        finishGame(nextScore, nextCorrectPuzzles);
        return;
      }

      beginPuzzle(currentIndexRef.current + 1);
    }, FEEDBACK_MS);
  }, [clearTimers, currentPuzzle, finishGame, schedule]);

  const beginPuzzle = useCallback((puzzleIndex: number, nextPuzzles = puzzles) => {
    clearTimers();
    const puzzle = nextPuzzles[puzzleIndex];
    setCurrentIndex(puzzleIndex);
    setSelectedOptionId("");
    setLastResult(null);
    answeredRef.current = false;
    puzzleStartedAtRef.current = Date.now();
    setPhase("playing");

    schedule(() => {
      submitAnswer(null, puzzle, true);
    }, puzzle?.timeLimitMs ?? 6000);
  }, [clearTimers, puzzles, schedule, submitAnswer]);

  const startGame = () => {
    clearTimers();
    const nextPuzzles = createSpatialRotationSession(difficulty);
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
    beginPuzzle(0, nextPuzzles);
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
    return `${Math.round((correctPuzzles / SPATIAL_ROTATION_TOTAL_PUZZLES) * 100)}%`;
  }, [correctPuzzles]);

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
    <View className="spatial-rotation-page">
      {phase === "start" ? (
        <View className="rotation-start start-screen">
          <View className="header-section">
            <View className="logo-icon">
              <Text className="logo-emoji">◇</Text>
            </View>
            <Text className="game-title">旋影辨形</Text>
            <Text className="game-subtitle">在旋转候选里找出同一个形状</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">当前难度最高</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 每局 8 题，目标图形可以旋转但不能镜像。</Text>
            <Text className="rule-item">2. 选择和目标完全相同的一项。</Text>
            <Text className="rule-item">3. 快速答对和连续答对会获得额外得分。</Text>
          </View>

          {!isGauntletPreset && (
            <View className="summary-card">
              <Text className="section-title">难度</Text>
              <View className="summary-grid">
                {renderDifficultyCard("normal", "时间宽松 · 干扰较少")}
                {renderDifficultyCard("hard", "节奏更快 · 镜像干扰更强")}
              </View>
            </View>
          )}

          <View className="floating-start-action">
            <View className="primary-button" onClick={startGame}>
              <Text className="primary-button-text">开始训练</Text>
            </View>
          </View>
          <View className="floating-start-spacer" />
        </View>
      ) : null}

      {(phase === "playing" || phase === "feedback") && currentPuzzle ? (
        <View className="rotation-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{SPATIAL_ROTATION_TOTAL_PUZZLES}</Text>
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

          <View className="target-card">
            <Text className="question-kicker">目标图形</Text>
            {renderShape(currentPuzzle.targetCells)}
            <Text className="target-copy">可以旋转，不可以翻面镜像</Text>
          </View>

          <View className="rotation-option-grid">
            {currentPuzzle.options.map((option, index) => {
              const isSelected = selectedOptionId === option.id;
              const isAnswer = phase === "feedback" && option.id === currentPuzzle.answerOptionId;
              return (
                <View
                  key={option.id}
                  className={`rotation-option option-tone-${index + 1} ${isSelected ? "rotation-option-selected" : ""} ${isAnswer ? "rotation-option-answer" : ""}`}
                  onClick={() => submitAnswer(option)}
                >
                  {renderShape(option.cells)}
                  <Text className="option-label">{String.fromCharCode(65 + index)}</Text>
                </View>
              );
            })}
          </View>

          {phase === "feedback" ? (
            <View className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastResult?.correct ? "辨认正确" : "正确答案已标出"}</Text>
              <Text className="feedback-copy">本题 +{lastResult?.score ?? 0}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="rotation-result">
          <View className="result-card">
            <Text className="result-kicker">训练完成</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              旋影辨形 · {getTrainingDifficultyLabel(difficulty)} {isNewBest ? "· 新最高" : ""}
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
