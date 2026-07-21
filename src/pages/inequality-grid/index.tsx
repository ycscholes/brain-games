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
  INEQUALITY_GRID_TOTAL_PUZZLES,
  createInequalityGridSession,
  scoreInequalityGridPuzzle,
  type InequalityGridComparison,
  type InequalityGridPuzzle,
  type InequalityGridResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "inequality_grid_best";
const FEEDBACK_MS = 820;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getComparison(
  comparisons: InequalityGridComparison[],
  row: number,
  col: number,
  direction: "right" | "down",
) {
  return comparisons.find((comparison) =>
    comparison.row === row && comparison.col === col && comparison.direction === direction
  );
}

export default function InequalityGrid() {
  usePageShare("pages/inequality-grid/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;

  const [phase, setPhase] = useState<Phase>("start");
  useAmbientMusic(phase === "start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(gauntletPreset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);
  const [puzzles, setPuzzles] = useState<InequalityGridPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctPuzzles, setCorrectPuzzles] = useState(0);
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<InequalityGridResult | null>(null);
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

  useEffect(() => () => {
    clearTimers();
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
    const nextAwardedPoints = getAwardedPoints("inequality-grid", finalScore, difficulty);
    if (completeGauntletLegIfNeeded({
      gameId: "inequality-grid",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    })) {
      return;
    }

    addPointsToPet("inequality-grid", finalScore, difficulty);
    recordTrainingSession({
      gameId: "inequality-grid",
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
    value: number | null,
    puzzle = currentPuzzle,
    timedOut = false,
  ) => {
    if (phaseRef.current !== "playing" || !puzzle || answeredRef.current) {
      return;
    }

    answeredRef.current = true;
    clearTimers();
    const result = scoreInequalityGridPuzzle({
      selectedValue: timedOut ? null : value,
      answer: puzzle.answer,
      answerMs: Date.now() - puzzleStartedAtRef.current,
      currentCombo: comboRef.current,
    });
    if (!timedOut) {
      playTap();
      result.correct ? playCorrect() : playWrong();
    }
    const nextScore = scoreRef.current + result.score;
    const nextCombo = result.correct ? comboRef.current + 1 : 0;
    const nextCorrectPuzzles = correctPuzzlesRef.current + (result.correct ? 1 : 0);

    setSelectedValue(timedOut ? null : value);
    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestComboRef.current, nextCombo));
    setCorrectPuzzles(nextCorrectPuzzles);
    setPhase("feedback");

    schedule(() => {
      if (currentIndexRef.current >= INEQUALITY_GRID_TOTAL_PUZZLES - 1) {
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
    setSelectedValue(null);
    setLastResult(null);
    answeredRef.current = false;
    puzzleStartedAtRef.current = Date.now();
    setPhase("playing");

    schedule(() => {
      submitAnswer(null, puzzle, true);
    }, puzzle?.timeLimitMs ?? 8000);
  }, [clearTimers, puzzles, schedule, submitAnswer]);

  const startGame = useCallback(() => {
    playTap();
    clearTimers();
    const nextPuzzles = createInequalityGridSession(difficulty);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setPuzzles(nextPuzzles);
    setCurrentIndex(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectPuzzles(0);
    setSelectedValue(null);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    beginPuzzle(0, nextPuzzles);
  }, [beginPuzzle, clearTimers, difficulty]);

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
    setSelectedValue(null);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    finishedRef.current = false;
    refreshBest();
  };

  const accuracyText = useMemo(() => {
    return `${Math.round((correctPuzzles / INEQUALITY_GRID_TOTAL_PUZZLES) * 100)}%`;
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

  const renderPuzzleCell = (puzzle: InequalityGridPuzzle, row: number, col: number) => {
    const cell = puzzle.cells.find((item) => item.row === row && item.col === col);
    if (!cell) return null;
    const isTarget = cell.target;
    const shouldRevealAnswer = phase === "feedback" && isTarget;
    const value = shouldRevealAnswer
      ? puzzle.answer
      : isTarget
        ? selectedValue ?? "?"
        : cell.given
          ? cell.value
          : "";

    return (
      <View className={`grid-cell ${cell.given ? "grid-cell-given" : ""} ${isTarget ? "grid-cell-target" : ""} ${shouldRevealAnswer ? "grid-cell-answer" : ""}`}>
        <Text className="grid-cell-text">{value}</Text>
      </View>
    );
  };

  const renderPuzzleBoard = (puzzle: InequalityGridPuzzle) => (
    <View className={`logic-board board-size-${puzzle.size}`}>
      {Array.from({ length: puzzle.size }, (_, row) => (
        <View key={`row-${row}`} className="logic-row-wrap">
          <View className="logic-row">
            {Array.from({ length: puzzle.size }, (_, col) => {
              const rightComparison = getComparison(puzzle.comparisons, row, col, "right");
              return (
                <View key={`${row}-${col}`} className="logic-cell-wrap">
                  {renderPuzzleCell(puzzle, row, col)}
                  {col < puzzle.size - 1 ? (
                    <Text className={`logic-sign logic-sign-horizontal ${rightComparison ? "" : "logic-sign-muted"}`}>
                      {rightComparison?.sign ?? "·"}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
          {row < puzzle.size - 1 ? (
            <View className="logic-vertical-row">
              {Array.from({ length: puzzle.size }, (_, col) => {
                const downComparison = getComparison(puzzle.comparisons, row, col, "down");
                return (
                  <View key={`down-${row}-${col}`} className="logic-vertical-slot">
                    <Text className={`logic-sign logic-sign-vertical ${downComparison ? "" : "logic-sign-muted"}`}>
                      {downComparison?.sign === "<" ? "∨" : downComparison?.sign === ">" ? "∧" : "·"}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );

  return (
    <View className="inequality-grid-page">
      {phase === "start" ? (
        <View className="inequality-start start-screen">
          <View className="header-section">
            <View className="logo-icon">
              <Text className="logo-emoji">≠</Text>
            </View>
            <Text className="game-title">大小迷阵</Text>
            <Text className="game-subtitle">根据数字和不等号，找出唯一能填入的数字</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">当前难度最高</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 每行、每列不能出现重复数字。</Text>
            <Text className="rule-item">2. 观察相邻格之间的大于小于关系。</Text>
            <Text className="rule-item">3. 从 4 个选项里选出高亮格唯一合法数字。</Text>
          </View>

          {!isGauntletPreset && (
            <View className="summary-card">
              <Text className="section-title">难度</Text>
              <View className="summary-grid">
                {renderDifficultyCard("normal", "4 x 4 盘面 · 节奏宽松")}
                {renderDifficultyCard("hard", "5 x 5 盘面 · 线索更密")}
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
        <View className="inequality-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{INEQUALITY_GRID_TOTAL_PUZZLES}</Text>
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

          <View className="puzzle-card">
            <Text className="question-kicker">填入高亮格</Text>
            {renderPuzzleBoard(currentPuzzle)}
            <Text className="target-copy">横向符号从左读，纵向符号尖端指向较小数字</Text>
          </View>

          <View className="number-option-grid">
            {currentPuzzle.options.map((option, index) => {
              const isSelected = selectedValue === option;
              const isAnswer = phase === "feedback" && option === currentPuzzle.answer;
              return (
                <View
                  key={option}
                  className={`number-option option-tone-${index + 1} ${isSelected ? "number-option-selected" : ""} ${isAnswer ? "number-option-answer" : ""}`}
                  onClick={() => submitAnswer(option)}
                >
                  <Text className="number-option-value">{option}</Text>
                </View>
              );
            })}
          </View>

          {phase === "feedback" ? (
            <View className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastResult?.correct ? "推理正确" : "正确数字已标出"}</Text>
              <Text className="feedback-copy">本题 +{lastResult?.score ?? 0}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="inequality-result">
          <View className="result-card">
            <Text className="result-kicker">训练完成</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              大小迷阵 · {getTrainingDifficultyLabel(difficulty)} {isNewBest ? "· 新最高" : ""}
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
