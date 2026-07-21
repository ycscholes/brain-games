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
  cellKey,
  createSumpleteGridCells,
  createSumpleteGridPuzzle,
  cycleSumpleteCellState,
  evaluateSumpleteGrid,
  scoreSumpleteGrid,
  type SumpleteGridCell,
  type SumpleteGridEvaluation,
  type SumpleteGridPuzzle,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "finished";

const STORAGE_KEY_PREFIX = "sumplete_grid_best";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SumpleteGrid() {
  usePageShare("pages/sumplete-grid/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;

  const [phase, setPhase] = useState<Phase>("start");
  useAmbientMusic(phase === "start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(gauntletPreset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);
  const [puzzle, setPuzzle] = useState<SumpleteGridPuzzle | null>(null);
  const [cells, setCells] = useState<SumpleteGridCell[]>([]);
  const [evaluation, setEvaluation] = useState<SumpleteGridEvaluation | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [score, setScore] = useState(0);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);
  const autoStartedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
      clearTimer();
    };
  }, [clearTimer]);

  const currentEvaluation = useMemo(() => {
    return puzzle ? evaluateSumpleteGrid(puzzle, cells) : null;
  }, [cells, puzzle]);

  const decidedCount = useMemo(() => cells.filter((cell) => cell.state !== "unknown").length, [cells]);
  const totalCells = puzzle ? puzzle.size * puzzle.size : 0;
  const completionText = totalCells > 0 ? `${decidedCount}/${totalCells}` : "0/0";

  const finishGame = useCallback((finalScore: number, finalElapsedSeconds: number) => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    clearTimer();
    playComplete();

    const nextAwardedPoints = getAwardedPoints("sumplete-grid", finalScore, difficulty);
    if (completeGauntletLegIfNeeded({
      gameId: "sumplete-grid",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds: finalElapsedSeconds,
      difficulty,
      outcome: "completed",
    })) {
      return;
    }

    addPointsToPet("sumplete-grid", finalScore, difficulty);
    recordTrainingSession({
      gameId: "sumplete-grid",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds: finalElapsedSeconds,
      difficulty,
      outcome: "completed",
    });

    setElapsedSeconds(finalElapsedSeconds);
    setScore(finalScore);
    setAwardedPoints(nextAwardedPoints);
    setPhase("finished");

    if (finalScore > best) {
      Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`, finalScore);
      setBest(finalScore);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }
  }, [best, clearTimer, difficulty]);

  const startGame = useCallback(() => {
    playTap();
    clearTimer();
    const nextPuzzle = createSumpleteGridPuzzle(difficulty);
    const nextCells = createSumpleteGridCells(nextPuzzle);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setPuzzle(nextPuzzle);
    setCells(nextCells);
    setEvaluation(null);
    setMistakes(0);
    setElapsedSeconds(0);
    setScore(0);
    setAwardedPoints(0);
    setIsNewBest(false);
    setPhase("playing");
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);
  }, [clearTimer, difficulty]);

  useEffect(() => {
    if (!isGauntletPreset || autoStartedRef.current || phase !== "start") return;
    autoStartedRef.current = true;
    startGame();
  }, [isGauntletPreset, phase, startGame]);

  const toggleCell = (target: SumpleteGridCell) => {
    if (phase !== "playing") return;
    playTap();
    setEvaluation(null);
    setCells((items) =>
      items.map((cell) => (
        cell.row === target.row && cell.col === target.col
          ? { ...cell, state: cycleSumpleteCellState(cell.state) }
          : cell
      )),
    );
  };

  const submitPuzzle = () => {
    if (!puzzle || !currentEvaluation || phase !== "playing") {
      return;
    }

    playTap();
    setEvaluation(currentEvaluation);
    if (!currentEvaluation.complete || !currentEvaluation.correct) {
      playWrong();
      setMistakes((value) => value + 1);
      return;
    }

    playCorrect();
    const finalElapsedSeconds = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
    const finalScore = scoreSumpleteGrid({
      difficulty,
      elapsedSeconds: finalElapsedSeconds,
      mistakes,
    });
    finishGame(finalScore, finalElapsedSeconds);
  };

  const backToStart = () => {
    clearTimer();
    setPhase("start");
    setPuzzle(null);
    setCells([]);
    setEvaluation(null);
    setMistakes(0);
    setElapsedSeconds(0);
    setScore(0);
    setAwardedPoints(0);
    setIsNewBest(false);
    finishedRef.current = false;
    refreshBest();
  };

  const renderDifficultyCard = (nextDifficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`summary-item ${difficulty === nextDifficulty ? "summary-item-active" : ""}`}
      onClick={() => setDifficulty(nextDifficulty)}
    >
      <Text className="summary-value">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="summary-label">{copy}</Text>
    </View>
  );

  const wrongCells = new Set(evaluation?.wrongCellKeys ?? []);

  return (
    <View className="sumplete-grid-page">
      {phase === "start" ? (
        <View className="sumplete-start start-screen">
          <View className="header-section">
            <View className="logo-icon">
              <Text className="logo-emoji">∑</Text>
            </View>
            <Text className="game-title">删数求和</Text>
            <Text className="game-subtitle">保留合适数字，让每行每列凑出目标和</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">当前难度最高</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 点击格子在“保留、划掉、未定”之间切换。</Text>
            <Text className="rule-item">2. 每行右侧、每列底部显示需要保留的数字之和。</Text>
            <Text className="rule-item">3. 全部格子判断完成后提交，越快且越少失误得分越高。</Text>
          </View>

          {!isGauntletPreset && (
            <View className="summary-card">
              <Text className="section-title">难度</Text>
              <View className="summary-grid">
                {renderDifficultyCard("normal", "4 x 4 · 适合热身")}
                {renderDifficultyCard("hard", "5 x 5 · 干扰更多")}
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

      {phase === "playing" && puzzle ? (
        <View className="sumplete-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{formatTime(elapsedSeconds)}</Text>
              <Text className="status-label">用时</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{completionText}</Text>
              <Text className="status-label">已判断</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{mistakes}</Text>
              <Text className="status-label">失误</Text>
            </View>
          </View>

          <View className="sumplete-board-card">
            <View
              className={`sumplete-board sumplete-board-${puzzle.size}`}
              style={{
                gridTemplateColumns: `repeat(${puzzle.size}, 1fr) 74rpx`,
                gridTemplateRows: `repeat(${puzzle.size}, 1fr) 74rpx`,
              }}
            >
              {cells.map((cell) => (
                <View
                  key={cellKey(cell.row, cell.col)}
                  className={`sumplete-cell sumplete-cell-${cell.state} ${wrongCells.has(cellKey(cell.row, cell.col)) ? "sumplete-cell-wrong" : ""}`}
                  style={{ gridColumn: cell.col + 1, gridRow: cell.row + 1 }}
                  onClick={() => toggleCell(cell)}
                >
                  <Text className="sumplete-cell-value">{cell.value}</Text>
                </View>
              ))}
              {puzzle.rowTargets.map((target, index) => (
                <View
                  key={`row-${index}`}
                  className="sumplete-target sumplete-row-target"
                  style={{ gridColumn: puzzle.size + 1, gridRow: index + 1 }}
                >
                  <Text className="sumplete-target-value">{target}</Text>
                </View>
              ))}
              {puzzle.colTargets.map((target, index) => (
                <View
                  key={`col-${index}`}
                  className="sumplete-target sumplete-col-target"
                  style={{ gridColumn: index + 1, gridRow: puzzle.size + 1 }}
                >
                  <Text className="sumplete-target-value">{target}</Text>
                </View>
              ))}
              <View
                className="sumplete-corner"
                style={{ gridColumn: puzzle.size + 1, gridRow: puzzle.size + 1 }}
              >
                <Text className="sumplete-corner-text">目标</Text>
              </View>
            </View>
          </View>

          {evaluation ? (
            <View className={`feedback-card ${evaluation.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">
                {evaluation.correct ? "求和完成" : evaluation.complete ? "有数字判断不对" : "还有格子未判断"}
              </Text>
              <Text className="feedback-copy">
                {evaluation.correct ? "每行每列目标都已匹配" : "看右侧和底部目标，再调整保留与划掉"}
              </Text>
            </View>
          ) : null}

          <View className="submit-panel">
            <View className="secondary-button" onClick={backToStart}>
              <Text className="secondary-button-text">返回设置</Text>
            </View>
            <View className="primary-button" onClick={submitPuzzle}>
              <Text className="primary-button-text">提交答案</Text>
            </View>
          </View>
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="sumplete-result">
          <View className="result-card">
            <Text className="result-kicker">训练完成</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              删数求和 · {getTrainingDifficultyLabel(difficulty)} {isNewBest ? "· 新最高" : ""}
            </Text>
            <View className="result-grid">
              <View className="result-item">
                <Text className="result-item-value">{formatTime(elapsedSeconds)}</Text>
                <Text className="result-item-label">完成用时</Text>
              </View>
              <View className="result-item">
                <Text className="result-item-value">{mistakes}</Text>
                <Text className="result-item-label">失误</Text>
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
