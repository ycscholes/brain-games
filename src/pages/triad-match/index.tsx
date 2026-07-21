import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
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
  TRIAD_MATCH_TOTAL_PUZZLES,
  createTriadMatchSession,
  findTriadMatches,
  scoreTriadMatchSelection,
  type TriadMatchCard,
  type TriadMatchPuzzle,
  type TriadMatchResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "triad_match_best";
const FEEDBACK_MS = 900;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getShapeLabel(shape: TriadMatchCard["shape"]) {
  const labels: Record<TriadMatchCard["shape"], string> = {
    gem: "棱",
    leaf: "叶",
    moon: "弧",
  };
  return labels[shape];
}

function getShadingLabel(shading: TriadMatchCard["shading"]) {
  const labels: Record<TriadMatchCard["shading"], string> = {
    solid: "满",
    stripe: "纹",
    hollow: "空",
  };
  return labels[shading];
}

function renderTriadCard(card: TriadMatchCard, selected: boolean, matched: boolean, onClick: () => void) {
  return (
    <View
      className={`triad-card triad-${card.color} triad-${card.shape} triad-${card.shading} ${
        selected ? "triad-card-selected" : ""
      } ${matched ? "triad-card-match" : ""}`}
      onClick={onClick}
    >
      <View className="triad-card-header">
        <Text className="triad-card-code">{getShapeLabel(card.shape)}</Text>
        <Text className="triad-card-code">{getShadingLabel(card.shading)}</Text>
      </View>
      <View className="triad-symbol-stack">
        {Array.from({ length: card.count }, (_, index) => (
          <View key={`${card.id}-${index}`} className="triad-symbol">
            <View className="triad-symbol-inner" />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function TriadMatch() {
  usePageShare("pages/triad-match/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;

  const [phase, setPhase] = useState<Phase>("start");
  useAmbientMusic(phase === "start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(gauntletPreset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);
  const [puzzles, setPuzzles] = useState<TriadMatchPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctPuzzles, setCorrectPuzzles] = useState(0);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<TriadMatchResult | null>(null);
  const [lastMatchIds, setLastMatchIds] = useState<string[]>([]);
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
    const nextAwardedPoints = getAwardedPoints("triad-match", finalScore, difficulty);
    if (completeGauntletLegIfNeeded({
      gameId: "triad-match",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    })) {
      return;
    }

    addPointsToPet("triad-match", finalScore, difficulty);
    recordTrainingSession({
      gameId: "triad-match",
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

  const beginPuzzle = useCallback((puzzleIndex: number, nextPuzzles = puzzles) => {
    clearTimers();
    const puzzle = nextPuzzles[puzzleIndex];
    setCurrentIndex(puzzleIndex);
    setSelectedCardIds([]);
    setLastResult(null);
    setLastMatchIds([]);
    answeredRef.current = false;
    puzzleStartedAtRef.current = Date.now();
    setPhase("playing");

    schedule(() => {
      submitSelection([], puzzle, true);
    }, puzzle?.timeLimitMs ?? 14000);
  }, [clearTimers, puzzles, schedule]);

  const submitSelection = useCallback((
    selectedCards: TriadMatchCard[],
    puzzle = currentPuzzle,
    timedOut = false,
  ) => {
    if (phaseRef.current !== "playing" || !puzzle || answeredRef.current) {
      return;
    }

    answeredRef.current = true;
    clearTimers();
    const result = scoreTriadMatchSelection({
      selectedCards: timedOut ? [] : selectedCards,
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

    setSelectedCardIds(timedOut ? [] : selectedCards.map((card) => card.id));
    setLastResult(result);
    setLastMatchIds(result.correct ? selectedCards.map((card) => card.id) : findTriadMatches(puzzle.cards)[0]?.map((card) => card.id) ?? []);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestComboRef.current, nextCombo));
    setCorrectPuzzles(nextCorrectPuzzles);
    setPhase("feedback");

    schedule(() => {
      if (currentIndexRef.current >= TRIAD_MATCH_TOTAL_PUZZLES - 1) {
        finishGame(nextScore, nextCorrectPuzzles);
        return;
      }

      beginPuzzle(currentIndexRef.current + 1);
    }, FEEDBACK_MS);
  }, [beginPuzzle, clearTimers, currentPuzzle, finishGame, schedule]);

  const startGame = () => {
    playTap();
    clearTimers();
    const nextPuzzles = createTriadMatchSession(difficulty);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setPuzzles(nextPuzzles);
    setCurrentIndex(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectPuzzles(0);
    setSelectedCardIds([]);
    setLastResult(null);
    setLastMatchIds([]);
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
    setSelectedCardIds([]);
    setLastResult(null);
    setLastMatchIds([]);
    setAwardedPoints(0);
    setIsNewBest(false);
    finishedRef.current = false;
    refreshBest();
  };

  const toggleCard = (card: TriadMatchCard) => {
    if (phaseRef.current !== "playing" || answeredRef.current || !currentPuzzle) {
      return;
    }

    const exists = selectedCardIds.includes(card.id);
    const nextIds = exists
      ? selectedCardIds.filter((cardId) => cardId !== card.id)
      : [...selectedCardIds, card.id].slice(0, 3);
    setSelectedCardIds(nextIds);

    if (!exists && nextIds.length === 3) {
      const selectedCards = currentPuzzle.cards.filter((item) => nextIds.includes(item.id));
      submitSelection(selectedCards, currentPuzzle);
    }
  };

  const accuracyText = useMemo(() => {
    return `${Math.round((correctPuzzles / TRIAD_MATCH_TOTAL_PUZZLES) * 100)}%`;
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
    <View className="triad-match-page">
      {phase === "start" ? (
        <View className="triad-start start-screen">
          <View className="header-section">
            <View className="logo-icon">
              <Text className="logo-emoji">3</Text>
            </View>
            <Text className="game-title">特征三连</Text>
            <Text className="game-subtitle">找出三张同时满足同异规则的卡牌</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">当前难度最高</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 每题从 12 张卡里选择 3 张。</Text>
            <Text className="rule-item">2. 数量、形状、纹理、颜色都必须分别全相同或全不同。</Text>
            <Text className="rule-item">3. 三张选满后自动判定，快速答对和连续答对加分。</Text>
          </View>

          {!isGauntletPreset && (
            <View className="summary-card">
              <Text className="section-title">难度</Text>
              <View className="summary-grid">
                {renderDifficultyCard("normal", "时间宽松 · 练规则观察")}
                {renderDifficultyCard("hard", "节奏更紧 · 练快速归纳")}
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
        <View className="triad-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{TRIAD_MATCH_TOTAL_PUZZLES}</Text>
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

          <View className="triad-rule-strip">
            <Text className="triad-rule-title">同异规则</Text>
            <Text className="triad-rule-copy">四个属性都要分别做到“全同”或“全不同”</Text>
            <Text className="triad-picked-count">{selectedCardIds.length}/3</Text>
          </View>

          <View className="triad-card-grid">
            {currentPuzzle.cards.map((card) => {
              const selected = selectedCardIds.includes(card.id);
              const matched = phase === "feedback" && lastMatchIds.includes(card.id);
              return renderTriadCard(card, selected, matched, () => toggleCard(card));
            })}
          </View>

          {phase === "feedback" ? (
            <View className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastResult?.correct ? "三连成立" : "已标出一个可行三连"}</Text>
              <Text className="feedback-copy">本题 +{lastResult?.score ?? 0}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="triad-result">
          <View className="result-card">
            <Text className="result-kicker">训练完成</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              特征三连 · {getTrainingDifficultyLabel(difficulty)} {isNewBest ? "· 新最高" : ""}
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
