import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { playComplete, playCorrect, playTap, playWrong } from "../../services/audio/audioFeedbackService";
import { completeGauntletLegIfNeeded, readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { addPointsToPet } from "../../utils/petStorage";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  recordTrainingSession,
  type TrainingDifficulty,
} from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import {
  calculateCodeBreakerFinalScore,
  createSecretCode,
  getCodeBreakerConfig,
  getCodeBreakerSymbols,
  scoreCodeBreakerGuess,
  type CodeBreakerGuessResult,
  type CodeBreakerSymbol,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "finished";
type GuessSlot = CodeBreakerSymbol | null;

interface GuessHistoryItem {
  guess: CodeBreakerSymbol[];
  result: CodeBreakerGuessResult;
}

const STORAGE_KEY_PREFIX = "code_breaker_best";

const SYMBOL_LABELS: Record<CodeBreakerSymbol, string> = {
  amber: "A",
  jade: "B",
  cyan: "C",
  rose: "D",
  violet: "E",
  slate: "F",
};

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function emptyGuess(length: number): GuessSlot[] {
  return Array.from({ length }, () => null);
}

function renderCodeChip(symbol: CodeBreakerSymbol | null, index: number, hidden = false) {
  return (
    <View
      key={`${symbol ?? "empty"}-${index}`}
      className={`code-chip ${symbol ? `code-chip-${symbol}` : "code-chip-empty"} ${hidden ? "code-chip-hidden" : ""}`}
    >
      <Text className="code-chip-text">{hidden ? "?" : symbol ? SYMBOL_LABELS[symbol] : ""}</Text>
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
  const [hiddenCode, setHiddenCode] = useState<CodeBreakerSymbol[]>([]);
  const [currentGuess, setCurrentGuess] = useState<GuessSlot[]>(emptyGuess(getCodeBreakerConfig(difficulty).codeLength));
  const [history, setHistory] = useState<GuessHistoryItem[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [score, setScore] = useState(0);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [solved, setSolved] = useState(false);

  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const hiddenCodeRef = useRef<CodeBreakerSymbol[]>([]);
  const bestFeedbackRef = useRef({ exact: 0, present: 0 });
  const difficultyRef = useRef<TrainingDifficulty>(difficulty);

  const config = useMemo(() => getCodeBreakerConfig(difficulty), [difficulty]);
  const symbols = useMemo(() => getCodeBreakerSymbols(difficulty), [difficulty]);
  const guessReady = currentGuess.every(Boolean);
  const remainingGuesses = Math.max(0, config.maxGuesses - history.length);

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
    difficultyRef.current = difficulty;
    if (phase === "start") {
      setCurrentGuess(emptyGuess(config.codeLength));
      refreshBest();
    }
  }, [config.codeLength, difficulty, phase, refreshBest]);

  useEffect(() => {
    if (phase !== "playing") return undefined;

    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  const finishGame = useCallback((
    nextHistory: GuessHistoryItem[],
    didSolve: boolean,
    latestResult: CodeBreakerGuessResult,
  ) => {
    if (finishedRef.current) return;

    finishedRef.current = true;
    didSolve ? playComplete() : playWrong();

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const bestFeedback = {
      exact: Math.max(bestFeedbackRef.current.exact, latestResult.exact),
      present: Math.max(bestFeedbackRef.current.present, latestResult.present),
    };
    const finalScore = calculateCodeBreakerFinalScore({
      solved: didSolve,
      attemptsUsed: nextHistory.length,
      maxGuesses: config.maxGuesses,
      elapsedSeconds: durationSeconds,
      bestExact: bestFeedback.exact,
      bestPresent: bestFeedback.present,
    });
    const nextAwardedPoints = getAwardedPoints("code-breaker", finalScore, difficultyRef.current);

    if (completeGauntletLegIfNeeded({
      gameId: "code-breaker",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty: difficultyRef.current,
      outcome: "completed",
    })) {
      return;
    }

    addPointsToPet("code-breaker", finalScore, difficultyRef.current);
    recordTrainingSession({
      gameId: "code-breaker",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty: difficultyRef.current,
      outcome: "completed",
    });

    setElapsedSeconds(durationSeconds);
    setScore(finalScore);
    setAwardedPoints(nextAwardedPoints);
    setSolved(didSolve);
    setPhase("finished");

    if (finalScore > best) {
      Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${difficultyRef.current}`, finalScore);
      setBest(finalScore);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }
  }, [best, config.maxGuesses]);

  const startGame = useCallback(() => {
    playTap();
    const nextHiddenCode = createSecretCode(difficulty);
    startedAtRef.current = Date.now();
    finishedRef.current = false;
    hiddenCodeRef.current = nextHiddenCode;
    bestFeedbackRef.current = { exact: 0, present: 0 };
    setHiddenCode(nextHiddenCode);
    setCurrentGuess(emptyGuess(config.codeLength));
    setHistory([]);
    setElapsedSeconds(0);
    setScore(0);
    setAwardedPoints(0);
    setIsNewBest(false);
    setSolved(false);
    setPhase("playing");
  }, [config.codeLength, difficulty]);

  useEffect(() => {
    if (!isGauntletPreset || autoStartedRef.current || phase !== "start") return;
    autoStartedRef.current = true;
    startGame();
  }, [isGauntletPreset, phase, startGame]);

  const selectSymbol = (symbol: CodeBreakerSymbol) => {
    if (phase !== "playing") return;
    playTap();
    setCurrentGuess((items) => {
      const nextItems = [...items];
      const index = nextItems.findIndex((item) => item === null);
      nextItems[index === -1 ? nextItems.length - 1 : index] = symbol;
      return nextItems;
    });
  };

  const clearSlot = (index: number) => {
    if (phase !== "playing") return;
    playTap();
    setCurrentGuess((items) => items.map((item, itemIndex) => (itemIndex === index ? null : item)));
  };

  const clearGuess = () => {
    if (phase !== "playing") return;
    playTap();
    setCurrentGuess(emptyGuess(config.codeLength));
  };

  const submitGuess = () => {
    if (phase !== "playing" || !guessReady || finishedRef.current) return;

    const guess = currentGuess.filter(Boolean) as CodeBreakerSymbol[];
    const result = scoreCodeBreakerGuess(hiddenCodeRef.current, guess);
    const nextHistory = [...history, { guess, result }];
    bestFeedbackRef.current = {
      exact: Math.max(bestFeedbackRef.current.exact, result.exact),
      present: Math.max(bestFeedbackRef.current.present, result.present),
    };

    result.solved ? playCorrect() : playWrong();
    setHistory(nextHistory);
    setCurrentGuess(emptyGuess(config.codeLength));

    if (result.solved || nextHistory.length >= config.maxGuesses) {
      finishGame(nextHistory, result.solved, result);
    }
  };

  const backToStart = () => {
    playTap();
    finishedRef.current = false;
    setPhase("start");
    setHiddenCode([]);
    setCurrentGuess(emptyGuess(config.codeLength));
    setHistory([]);
    setElapsedSeconds(0);
    setScore(0);
    setAwardedPoints(0);
    setIsNewBest(false);
    setSolved(false);
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

  return (
    <View className="code-breaker-page">
      {phase === "start" ? (
        <View className="code-breaker-start start-screen">
          <View className="header-section">
            <View className="logo-icon code-breaker-logo">
              <Text className="logo-emoji">#</Text>
            </View>
            <Text className="game-title">逻辑破译</Text>
            <Text className="game-subtitle">用反馈线索推断隐藏的多符号密码</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">当前难度最高</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 每局有一组隐藏密码，选择符号后提交猜测。</Text>
            <Text className="rule-item">2. 命中表示符号和位置都正确，错位表示符号存在但位置不对。</Text>
            <Text className="rule-item">3. 用更少次数、更短时间破译，可获得更高分。</Text>
          </View>

          {!isGauntletPreset && (
            <View className="summary-card">
              <Text className="section-title">难度</Text>
              <View className="summary-grid">
                {renderDifficultyCard("normal", "不重复 · 8 次机会")}
                {renderDifficultyCard("hard", "可重复 · 7 次机会")}
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

      {phase === "playing" ? (
        <View className="code-breaker-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{history.length}/{config.maxGuesses}</Text>
              <Text className="status-label">已猜</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{remainingGuesses}</Text>
              <Text className="status-label">剩余</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{elapsedSeconds}s</Text>
              <Text className="status-label">用时</Text>
            </View>
          </View>

          <View className="hidden-code-panel">
            <Text className="question-kicker">隐藏密码</Text>
            <View className="code-row">
              {hiddenCode.map((symbol, index) => renderCodeChip(symbol, index, true))}
            </View>
          </View>

          <View className="guess-panel">
            <Text className="question-kicker">本次猜测</Text>
            <View className="code-row">
              {currentGuess.map((symbol, index) => (
                <View key={`slot-${index}`} onClick={() => clearSlot(index)}>
                  {renderCodeChip(symbol, index)}
                </View>
              ))}
            </View>
          </View>

          <View className="symbol-palette">
            {symbols.map((symbol) => (
              <View key={symbol} className={`palette-chip code-chip-${symbol}`} onClick={() => selectSymbol(symbol)}>
                <Text className="palette-chip-text">{SYMBOL_LABELS[symbol]}</Text>
              </View>
            ))}
          </View>

          <View className="guess-actions">
            <View className="secondary-button compact-button" onClick={clearGuess}>
              <Text className="secondary-button-text">清空</Text>
            </View>
            <View className={`primary-button compact-button ${guessReady ? "" : "primary-button-disabled"}`} onClick={submitGuess}>
              <Text className="primary-button-text">提交</Text>
            </View>
          </View>

          <View className="history-list">
            {history.map((item, index) => (
              <View key={`guess-${index}`} className="history-item">
                <Text className="history-index">#{index + 1}</Text>
                <View className="history-code-row">
                  {item.guess.map((symbol, chipIndex) => renderCodeChip(symbol, chipIndex))}
                </View>
                <View className="feedback-pins">
                  <Text className="feedback-pin feedback-pin-exact">命中 {item.result.exact}</Text>
                  <Text className="feedback-pin feedback-pin-present">错位 {item.result.present}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="code-breaker-result">
          <View className="result-card">
            <Text className="result-kicker">{solved ? "破译完成" : "本局结束"}</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              逻辑破译 · {getTrainingDifficultyLabel(difficulty)} {isNewBest ? "· 新最高" : ""}
            </Text>
            <View className="result-hidden-code">
              <Text className="question-kicker">本局密码</Text>
              <View className="code-row">
                {hiddenCode.map((symbol, index) => renderCodeChip(symbol, index))}
              </View>
            </View>
            <View className="result-grid">
              <View className="result-item">
                <Text className="result-item-value">{history.length}</Text>
                <Text className="result-item-label">猜测次数</Text>
              </View>
              <View className="result-item">
                <Text className="result-item-value">{elapsedSeconds}s</Text>
                <Text className="result-item-label">用时</Text>
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
