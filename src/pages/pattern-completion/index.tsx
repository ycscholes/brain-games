import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  type TrainingDifficulty,
} from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { settleGame } from "../../services/gameSettlementService";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import {
  generatePatternSession,
  PATTERN_HINTS_PER_SESSION,
  PATTERN_SESSION_LENGTH,
  scorePatternQuestion,
  type PatternOption,
  type PatternQuestion,
  type PatternScoreResult,
} from "./patterns";
import PatternPlayPanel from "./components/PatternPlayPanel";
import PatternResultPanel from "./components/PatternResultPanel";
import PatternStartPanel from "./components/PatternStartPanel";
import "./index.scss";

type Phase = "start" | "playing" | "reveal" | "finished";

const STORAGE_KEY_PREFIX = "pattern_completion_best";
const SPEED_TARGET_MS: Record<TrainingDifficulty, number> = {
  normal: 12000,
  hard: 9000,
};

const difficultyLabelMap: Record<number, string> = {
  1: "入门",
  2: "入门",
  3: "入门",
  4: "进阶",
  5: "进阶",
  6: "进阶",
  7: "挑战",
  8: "挑战",
  9: "挑战",
  10: "大师",
};

const formatElapsed = (elapsedMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export default function PatternCompletion() {
  usePageShare("pages/pattern-completion/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;

  const [phase, setPhase] = useState<Phase>("start");
  useAmbientMusic(phase === "start");
  const [rewardDifficulty, setRewardDifficulty] = useState<TrainingDifficulty>(
    gauntletPreset?.difficulty ?? "normal",
  );
  const [best, setBest] = useState(0);
  const [session, setSession] = useState<PatternQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const [hintUsedForCurrent, setHintUsedForCurrent] = useState(false);
  const [remainingHints, setRemainingHints] = useState(PATTERN_HINTS_PER_SESSION);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [longestCombo, setLongestCombo] = useState(0);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [currentScoreResult, setCurrentScoreResult] = useState<PatternScoreResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const startTimeRef = useRef(0);
  const questionStartedAtRef = useRef(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRecordedRef = useRef(false);
  const autoStartedRef = useRef(false);

  const totalQuestions = session.length || PATTERN_SESSION_LENGTH;
  const currentQuestion =
    phase === "playing" || phase === "reveal" ? (session[currentIndex] ?? null) : null;
  const hintsUsed = PATTERN_HINTS_PER_SESSION - remainingHints;
  const multiruleCases = session.filter((question) => question.ruleCount >= 2).length;
  const selectedDistractorExplanation =
    currentQuestion && selectedOptionId
      ? (currentQuestion.distractorExplanations?.[selectedOptionId] ?? "")
      : "";

  const clearTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const refreshBest = useCallback(() => {
    const value = Number(
      Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${rewardDifficulty}`) ||
        (rewardDifficulty === "normal" ? Taro.getStorageSync(STORAGE_KEY_PREFIX) : 0),
    );
    setBest(Number.isFinite(value) ? value : 0);
  }, [rewardDifficulty]);

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
      clearTicker();
    };
  }, [clearTicker]);

  useEffect(() => {
    if (phase !== "playing" && phase !== "reveal") {
      clearTicker();
      return;
    }

    tickerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 250);

    return () => {
      clearTicker();
    };
  }, [clearTicker, phase]);

  const finishGame = useCallback(
    (settledFinalScore: number) => {
      if (finishRecordedRef.current) {
        setPhase("finished");
        return;
      }

      finishRecordedRef.current = true;
      clearTicker();
      playComplete();

      const settledElapsedMs = Date.now() - startTimeRef.current;
      const durationSeconds = Math.round(settledElapsedMs / 1000);
      const settlement = settleGame({
        gameId: "pattern-completion",
        score: settledFinalScore,
        durationSeconds,
        difficulty: rewardDifficulty,
        outcome: "completed",
      });
      if (settlement.gauntletHandled) {
        return;
      }

      setElapsedMs(settledElapsedMs);
      setFinalScore(settledFinalScore);
      setPhase("finished");

      if (settledFinalScore > best) {
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${rewardDifficulty}`, settledFinalScore);
        setBest(settledFinalScore);
        setIsNewBest(true);
      } else {
        setIsNewBest(false);
      }
    },
    [best, clearTicker, rewardDifficulty],
  );

  const resetRoundState = useCallback(() => {
    setSelectedOptionId("");
    setHintVisible(false);
    setHintUsedForCurrent(false);
    setCurrentScoreResult(null);
    setLastAnswerCorrect(false);
    questionStartedAtRef.current = Date.now();
  }, []);

  const startGame = useCallback(() => {
    playTap();
    clearTicker();

    const nextSession = generatePatternSession(rewardDifficulty);
    startTimeRef.current = Date.now();
    questionStartedAtRef.current = Date.now();
    finishRecordedRef.current = false;
    setSession(nextSession);
    setPhase("playing");
    setCurrentIndex(0);
    setCorrectCount(0);
    setRemainingHints(PATTERN_HINTS_PER_SESSION);
    setCurrentCombo(0);
    setLongestCombo(0);
    setElapsedMs(0);
    setFinalScore(0);
    setIsNewBest(false);
    resetRoundState();
  }, [clearTicker, resetRoundState, rewardDifficulty]);

  useEffect(() => {
    if (!isGauntletPreset || autoStartedRef.current || phase !== "start") return;
    autoStartedRef.current = true;
    startGame();
  }, [isGauntletPreset, phase, startGame]);

  const backToStart = () => {
    clearTicker();
    finishRecordedRef.current = false;
    setPhase("start");
    setSession([]);
    setCurrentIndex(0);
    setCorrectCount(0);
    setRemainingHints(PATTERN_HINTS_PER_SESSION);
    setCurrentCombo(0);
    setLongestCombo(0);
    setElapsedMs(0);
    setFinalScore(0);
    setIsNewBest(false);
    resetRoundState();
    refreshBest();
  };

  const handleHint = () => {
    if (
      !currentQuestion ||
      phase !== "playing" ||
      selectedOptionId ||
      remainingHints <= 0 ||
      hintUsedForCurrent
    ) {
      return;
    }

    setRemainingHints((prev) => prev - 1);
    setHintUsedForCurrent(true);
    setHintVisible(true);
  };

  const handleOptionSelect = (option: PatternOption) => {
    if (!currentQuestion || selectedOptionId || phase !== "playing") {
      return;
    }

    const isCorrect = option.id === currentQuestion.answer.id;
    playTap();
    isCorrect ? playCorrect() : playWrong();
    const questionElapsedMs = Date.now() - questionStartedAtRef.current;
    const scoreResult = scorePatternQuestion({
      isCorrect,
      currentCombo,
      elapsedMs: questionElapsedMs,
      targetMs: SPEED_TARGET_MS[rewardDifficulty],
      hintUsed: hintUsedForCurrent,
    });
    const nextCombo = isCorrect ? currentCombo + 1 : 0;
    const nextFinalScore = finalScore + scoreResult.score;

    setSelectedOptionId(option.id);
    setLastAnswerCorrect(isCorrect);
    setCurrentScoreResult(scoreResult);
    setFinalScore(nextFinalScore);
    setCorrectCount((prev) => prev + (isCorrect ? 1 : 0));
    setCurrentCombo(nextCombo);
    setLongestCombo((prev) => Math.max(prev, nextCombo));

    if (isCorrect) {
      if (currentIndex >= totalQuestions - 1) {
        finishGame(nextFinalScore);
        return;
      }

      setCurrentIndex((prev) => prev + 1);
      resetRoundState();
      setPhase("playing");
      return;
    }

    setPhase("reveal");
  };

  const handleNextCase = () => {
    if (phase !== "reveal") {
      return;
    }

    if (currentIndex >= totalQuestions - 1) {
      finishGame(finalScore);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    resetRoundState();
    setPhase("playing");
  };

  const awardedPoints = getAwardedPoints("pattern-completion", finalScore, rewardDifficulty);

  return (
    <View className="pattern-page">
      {phase === "start" ? (
        <PatternStartPanel
          best={best}
          rewardDifficulty={rewardDifficulty}
          isGauntletPreset={isGauntletPreset}
          sessionLength={PATTERN_SESSION_LENGTH}
          hintsPerSession={PATTERN_HINTS_PER_SESSION}
          onDifficultyChange={setRewardDifficulty}
          onStart={startGame}
        />
      ) : null}

      {(phase === "playing" || phase === "reveal") && currentQuestion ? (
        <PatternPlayPanel
          currentIndex={currentIndex}
          totalQuestions={totalQuestions}
          finalScore={finalScore}
          elapsedText={formatElapsed(elapsedMs)}
          difficultyLabel={difficultyLabelMap[currentQuestion.difficulty]}
          currentCombo={currentCombo}
          remainingHints={remainingHints}
          currentQuestion={currentQuestion}
          phase={phase}
          hintVisible={hintVisible}
          hintUsedForCurrent={hintUsedForCurrent}
          selectedOptionId={selectedOptionId}
          lastAnswerCorrect={lastAnswerCorrect}
          currentScoreResult={currentScoreResult}
          selectedDistractorExplanation={selectedDistractorExplanation}
          onOptionSelect={handleOptionSelect}
          onHint={handleHint}
          onNextCase={handleNextCase}
        />
      ) : null}

      {phase === "finished" ? (
        <PatternResultPanel
          finalScore={finalScore}
          correctCount={correctCount}
          totalQuestions={totalQuestions}
          longestCombo={longestCombo}
          hintsUsed={hintsUsed}
          multiruleCases={multiruleCases}
          elapsedText={formatElapsed(elapsedMs)}
          difficultyLabel={getTrainingDifficultyLabel(rewardDifficulty)}
          awardedPoints={awardedPoints}
          best={best}
          isNewBest={isNewBest}
          isGauntlet={isGauntletPreset}
          onRestart={startGame}
          onBackToStart={backToStart}
          onBackHome={() => Taro.reLaunch({ url: "/pages/index/index" })}
        />
      ) : null}
    </View>
  );
}
