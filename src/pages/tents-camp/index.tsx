import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { playComplete, playCorrect, playTap, playWrong } from "../../services/audio/audioFeedbackService";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { settleGame } from "../../services/gameSettlementService";
import {
  getTrainingDifficultyLabel,
  type TrainingDifficulty,
} from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import {
  TENTS_CAMP_TOTAL_PUZZLES,
  coordKey,
  countSelectedByAxis,
  createTentsCampSession,
  isTentSolutionCell,
  isTreeCell,
  scoreTentsCampPuzzle,
  type TentsCampCoord,
  type TentsCampPuzzle,
  type TentsCampResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "tents_camp_best";
const FEEDBACK_MS = 820;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function toCoord(index: number, size: number): TentsCampCoord {
  return {
    row: Math.floor(index / size),
    col: index % size,
  };
}

export default function TentsCamp() {
  usePageShare("pages/tents-camp/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;

  const [phase, setPhase] = useState<Phase>("start");
  useAmbientMusic(phase === "start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(gauntletPreset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);
  const [puzzles, setPuzzles] = useState<TentsCampPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTents, setSelectedTents] = useState<TentsCampCoord[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctPuzzles, setCorrectPuzzles] = useState(0);
  const [lastResult, setLastResult] = useState<TentsCampResult | null>(null);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const puzzleStartedAtRef = useRef(0);
  const finishedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const phaseRef = useRef<Phase>("start");
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const correctPuzzlesRef = useRef(0);
  const currentIndexRef = useRef(0);
  const selectedTentsRef = useRef<TentsCampCoord[]>([]);
  const currentPuzzle = puzzles[currentIndex] ?? null;

  const selectedKeys = useMemo(() => new Set(selectedTents.map(coordKey)), [selectedTents]);
  const rowSelectedCounts = useMemo(
    () => currentPuzzle ? countSelectedByAxis(selectedTents, currentPuzzle.size, "row") : [],
    [currentPuzzle, selectedTents],
  );
  const colSelectedCounts = useMemo(
    () => currentPuzzle ? countSelectedByAxis(selectedTents, currentPuzzle.size, "col") : [],
    [currentPuzzle, selectedTents],
  );

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
    return () => clearTimers();
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

  useEffect(() => {
    selectedTentsRef.current = selectedTents;
  }, [selectedTents]);

  const finishGame = useCallback((finalScore: number, finalCorrectPuzzles: number) => {
    if (finishedRef.current) return;

    finishedRef.current = true;
    clearTimers();
    playComplete();

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const settlement = settleGame({
      gameId: "tents-camp",
      score: finalScore,
      durationSeconds,
      difficulty,
      outcome: "completed",
    });
    if (settlement.gauntletHandled) {
      return;
    }
    const nextAwardedPoints = settlement.awardedPoints;

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
    setSelectedTents([]);
    setLastResult(null);
    puzzleStartedAtRef.current = Date.now();
    setPhase("playing");
  }, [clearTimers]);

  const startGame = useCallback(() => {
    playTap();
    clearTimers();
    const nextPuzzles = createTentsCampSession(difficulty);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setPuzzles(nextPuzzles);
    setCurrentIndex(0);
    setSelectedTents([]);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectPuzzles(0);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    beginPuzzle(0);
  }, [beginPuzzle, clearTimers, difficulty]);

  useEffect(() => {
    if (!isGauntletPreset || autoStartedRef.current || phase !== "start") return;
    autoStartedRef.current = true;
    startGame();
  }, [isGauntletPreset, phase, startGame]);

  const toggleTent = (coord: TentsCampCoord) => {
    if (phaseRef.current !== "playing" || !currentPuzzle || isTreeCell(currentPuzzle, coord)) return;

    playTap();
    const key = coordKey(coord);
    setSelectedTents((items) => {
      if (items.some((item) => coordKey(item) === key)) {
        return items.filter((item) => coordKey(item) !== key);
      }
      if (items.length >= currentPuzzle.tents.length) {
        return items;
      }
      return [...items, coord];
    });
  };

  const submitPuzzle = () => {
    if (phaseRef.current !== "playing" || !currentPuzzle) return;

    clearTimers();
    const result = scoreTentsCampPuzzle({
      puzzle: currentPuzzle,
      selectedTents: selectedTentsRef.current,
      answerMs: Date.now() - puzzleStartedAtRef.current,
      currentCombo: comboRef.current,
    });
    result.correct ? playCorrect() : playWrong();

    const nextScore = scoreRef.current + result.score;
    const nextCombo = result.correct ? comboRef.current + 1 : 0;
    const nextBestCombo = Math.max(bestComboRef.current, nextCombo);
    const nextCorrectPuzzles = correctPuzzlesRef.current + (result.correct ? 1 : 0);

    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(nextBestCombo);
    setCorrectPuzzles(nextCorrectPuzzles);
    setLastResult(result);
    setPhase("feedback");

    schedule(() => {
      if (currentIndexRef.current >= TENTS_CAMP_TOTAL_PUZZLES - 1) {
        finishGame(nextScore, nextCorrectPuzzles);
        return;
      }
      beginPuzzle(currentIndexRef.current + 1);
    }, FEEDBACK_MS);
  };

  const backToStart = () => {
    clearTimers();
    setPhase("start");
    setPuzzles([]);
    setCurrentIndex(0);
    setSelectedTents([]);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectPuzzles(0);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    finishedRef.current = false;
    refreshBest();
  };

  const accuracyText = `${Math.round((correctPuzzles / TENTS_CAMP_TOTAL_PUZZLES) * 100)}%`;

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
    <View className="tents-camp-page">
      {phase === "start" ? (
        <View className="tents-start start-screen">
          <View className="header-section">
            <View className="logo-icon">
              <Text className="logo-emoji">T</Text>
            </View>
            <Text className="game-title">帐篷营地</Text>
            <Text className="game-subtitle">根据树和行列数字布置帐篷</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">当前难度最高</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 每棵树旁边要有一个帐篷，帐篷只能放在上下左右相邻格。</Text>
            <Text className="rule-item">2. 帐篷之间不能相邻，包含斜向相邻。</Text>
            <Text className="rule-item">3. 边缘数字表示该行或该列需要的帐篷数量。</Text>
          </View>

          {!isGauntletPreset && (
            <View className="summary-card">
              <Text className="section-title">难度</Text>
              <View className="summary-grid">
                {renderDifficultyCard("normal", "6x6 · 5 顶帐篷")}
                {renderDifficultyCard("hard", "7x7 · 6 顶帐篷")}
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
        <View className="tents-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{TENTS_CAMP_TOTAL_PUZZLES}</Text>
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

          <View className="board-panel">
            <View className="corner-count" />
            <View className="column-counts" style={{ gridTemplateColumns: `repeat(${currentPuzzle.size}, 1fr)` }}>
              {currentPuzzle.colCounts.map((count, index) => (
                <Text key={`col-${index}`} className={`count-label ${colSelectedCounts[index] === count ? "count-label-ok" : ""}`}>{count}</Text>
              ))}
            </View>
            <View className="row-counts" style={{ gridTemplateRows: `repeat(${currentPuzzle.size}, 1fr)` }}>
              {currentPuzzle.rowCounts.map((count, index) => (
                <Text key={`row-${index}`} className={`count-label ${rowSelectedCounts[index] === count ? "count-label-ok" : ""}`}>{count}</Text>
              ))}
            </View>
            <View className="tents-board" style={{ gridTemplateColumns: `repeat(${currentPuzzle.size}, 1fr)` }}>
              {Array.from({ length: currentPuzzle.size * currentPuzzle.size }, (_, index) => {
                const coord = toCoord(index, currentPuzzle.size);
                const key = coordKey(coord);
                const isTree = isTreeCell(currentPuzzle, coord);
                const isSelected = selectedKeys.has(key);
                const isSolution = phase === "feedback" && isTentSolutionCell(currentPuzzle, coord);
                return (
                  <View
                    key={key}
                    className={`tent-cell ${isTree ? "tent-cell-tree" : ""} ${isSelected ? "tent-cell-selected" : ""} ${isSolution ? "tent-cell-solution" : ""}`}
                    onClick={() => toggleTent(coord)}
                  >
                    <Text className="tent-cell-text">{isTree ? "树" : isSelected || isSolution ? "帐" : ""}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="tents-actions">
            <Text className="tents-progress">已放置 {selectedTents.length}/{currentPuzzle.tents.length}</Text>
            <View className="primary-button compact-button" onClick={submitPuzzle}>
              <Text className="primary-button-text">提交营地</Text>
            </View>
          </View>

          {phase === "feedback" ? (
            <View className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastResult?.correct ? "营地成立" : "营地还不稳"}</Text>
              <Text className="feedback-copy">
                匹配帐篷 {lastResult?.matchedTents ?? 0}/{currentPuzzle.tents.length} · 本题 +{lastResult?.score ?? 0}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="tents-result">
          <View className="result-card">
            <Text className="result-kicker">训练完成</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              帐篷营地 · {getTrainingDifficultyLabel(difficulty)} {isNewBest ? "· 新最高" : ""}
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
              <StickerShareButton gameTitle="帐篷营地" score={score} pagePath="pages/tents-camp/index" isGauntlet={isGauntletPreset} />
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
