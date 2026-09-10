import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { shouldRedirectInvalidGameRun } from "../../utils/gameRoute";
import { MAX_POINTS_PER_SESSION, type TrainingDifficulty } from "../../utils/trainingStorage";
import { isGameGauntletRun, readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { playTap } from "../../services/audio/audioFeedbackService";
import {
  readRockPaperScissorsHighScore,
  type RockPaperScissorsHighScore,
} from "./highScoreStorage";
import {
  abandonRockPaperScissorsRun,
  readRockPaperScissorsRun,
  settleRockPaperScissorsCompletion,
  updateRockPaperScissorsRun,
} from "./run";
import "./index.scss";

type GameState = "playing";
type Difficulty = 1 | 2 | 3 | 4;
type HandType = "rock" | "paper" | "scissors";
type OutcomeType = "win" | "draw" | "lose";

const DIFFICULTY_CONFIG = {
  1: { label: "入门", color: "#4DBA87", time: 5, description: "先熟悉规则和节奏" },
  2: { label: "简单", color: "#F2B544", time: 4, description: "开始考验反应速度" },
  3: { label: "中等", color: "#F07A4A", time: 3, description: "需要更快地逆向判断" },
  4: { label: "困难", color: "#D94B58", time: 2, description: "极限快答，容错极低" },
} as const;

const DIFFICULTY_POINTS: Record<number, number> = { 1: 2, 2: 3, 3: 3, 4: 4 };

const HAND_CONFIG: Record<
  HandType,
  { emoji: string; name: string; beats: HandType; losesTo: HandType }
> = {
  rock: { emoji: "✊", name: "石头", beats: "scissors", losesTo: "paper" },
  paper: { emoji: "✋", name: "布", beats: "rock", losesTo: "scissors" },
  scissors: { emoji: "✌️", name: "剪刀", beats: "paper", losesTo: "rock" },
};

const OUTCOME_CONFIG: Record<
  OutcomeType,
  { emoji: string; name: string; color: string; prompt: string }
> = {
  win: { emoji: "↑", name: "赢", color: "#4DBA87", prompt: "选能克制电脑的手势" },
  draw: { emoji: "=", name: "平", color: "#5F6FFF", prompt: "选和电脑相同的手势" },
  lose: { emoji: "↓", name: "输", color: "#D94B58", prompt: "故意选会被电脑克制的手势" },
};

export default function RockPaperScissors() {
  usePageShare("pages/rock-paper-scissors/index");
  const gauntletPreset = readGameGauntletModePreset();
  const presetDifficulty =
    gauntletPreset?.mode === "3" || gauntletPreset?.difficulty === "hard" ? 3 : 1;
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = readRockPaperScissorsRun(runId);
  const allowSettledRef = useRef(false);

  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, routeRun?.status, allowSettledRef.current)) {
      void Taro.redirectTo({ url: "/pages/rock-paper-scissors/index" });
    }
  }, [routeRun, runId]);

  const persistedState = routeRun?.payload.state;
  const [gameState] = useState<GameState>("playing");
  const [score, setScore] = useState(() => persistedState?.score ?? 0);
  const [streak, setStreak] = useState(() => persistedState?.streak ?? 0);
  const [bestStreak, setBestStreak] = useState(() => persistedState?.bestStreak ?? 0);
  const difficulty: Difficulty = routeRun?.payload.level ?? presetDifficulty;
  const [timeLeft, setTimeLeft] = useState(
    () => persistedState?.timeLeft ?? DIFFICULTY_CONFIG[difficulty].time,
  );
  const [currentHand, setCurrentHand] = useState<HandType | null>(
    () => persistedState?.currentHand ?? null,
  );
  const [targetOutcome, setTargetOutcome] = useState<OutcomeType | null>(
    () => persistedState?.targetOutcome ?? null,
  );
  const [feedback, setFeedback] = useState<"none" | "correct" | "wrong">(
    () => persistedState?.feedback ?? "none",
  );
  const [selectedHand, setSelectedHand] = useState<HandType | null>(
    () => persistedState?.selectedHand ?? null,
  );

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStartedRef = useRef(false);
  const startedAtRef = useRef(persistedState?.clockStartedAt ?? routeRun?.payload.startedAt ?? 0);
  const questionStartedAtRef = useRef(
    persistedState?.questionStartedAt ?? routeRun?.payload.startedAt ?? 0,
  );
  const scoreRef = useRef(persistedState?.score ?? 0);
  const streakRef = useRef(persistedState?.streak ?? 0);
  const bestStreakRef = useRef(persistedState?.bestStreak ?? 0);
  const restoredTransientRef = useRef(persistedState?.feedback !== "none");
  const generateQuestionRef = useRef<(() => void) | null>(null);
  const handleGameOverRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    scoreRef.current = score;
    streakRef.current = streak;
    bestStreakRef.current = bestStreak;
  }, [bestStreak, score, streak]);

  const persistRunState = useCallback(
    (
      nextCurrentHand: HandType | null,
      nextTargetOutcome: OutcomeType | null,
      nextFeedback: "none" | "correct" | "wrong",
      nextSelectedHand: HandType | null,
      nextTimeLeft: number,
      nextScore: number,
      nextStreak: number,
      nextBestStreak: number,
    ) => {
      if (!runId) return;
      updateRockPaperScissorsRun(runId, {
        state: {
          score: nextScore,
          streak: nextStreak,
          bestStreak: nextBestStreak,
          timeLeft: nextTimeLeft,
          currentHand: nextCurrentHand,
          targetOutcome: nextTargetOutcome,
          feedback: nextFeedback,
          selectedHand: nextSelectedHand,
          clockStartedAt: startedAtRef.current,
          questionStartedAt: questionStartedAtRef.current,
        },
      });
    },
    [runId],
  );

  const getCurrentHighScore = useCallback((): RockPaperScissorsHighScore | null => {
    const key = `rps_highscore_D${difficulty}`;
    const record = Taro.getStorageSync(key);
    return readRockPaperScissorsHighScore(record);
  }, [difficulty]);

  const updateHighScore = useCallback(
    (newScore: number) => {
      const key = `rps_highscore_D${difficulty}`;
      const currentRecord = getCurrentHighScore();

      if (!currentRecord || newScore > currentRecord.score) {
        const newRecord: RockPaperScissorsHighScore = {
          score: newScore,
          achievedAt: new Date().toISOString(),
        };
        Taro.setStorageSync(key, JSON.stringify(newRecord));
        return true;
      }

      return false;
    },
    [difficulty, getCurrentHighScore],
  );

  const generateQuestion = useCallback(() => {
    const hands: HandType[] = ["rock", "paper", "scissors"];
    const outcomes: OutcomeType[] = ["win", "draw", "lose"];

    const randomHand = hands[Math.floor(Math.random() * hands.length)];
    const randomOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    questionStartedAtRef.current = Date.now();

    setCurrentHand(randomHand);
    setTargetOutcome(randomOutcome);
    setFeedback("none");
    setSelectedHand(null);
    setTimeLeft(DIFFICULTY_CONFIG[difficulty].time);
    persistRunState(
      randomHand,
      randomOutcome,
      "none",
      null,
      DIFFICULTY_CONFIG[difficulty].time,
      scoreRef.current,
      streakRef.current,
      bestStreakRef.current,
    );
  }, [difficulty, persistRunState]);

  const checkAnswer = (playerHand: HandType): boolean => {
    if (!currentHand || !targetOutcome) return false;

    let result: OutcomeType;

    if (playerHand === currentHand) result = "draw";
    else if (HAND_CONFIG[playerHand].beats === currentHand) result = "win";
    else result = "lose";

    return result === targetOutcome;
  };

  const startGame = useCallback(() => {
    playTap();
    startedAtRef.current = Date.now();
    questionStartedAtRef.current = startedAtRef.current;
    scoreRef.current = 0;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setTimeLeft(DIFFICULTY_CONFIG[difficulty].time);
    generateQuestion();
  }, [difficulty, generateQuestion]);

  const restoreGame = useCallback(() => {
    if (!persistedState) {
      startGame();
      return;
    }
    startedAtRef.current = persistedState.clockStartedAt;
    questionStartedAtRef.current = persistedState.questionStartedAt;
    scoreRef.current = persistedState.score;
    streakRef.current = persistedState.streak;
    bestStreakRef.current = persistedState.bestStreak;
    setScore(persistedState.score);
    setStreak(persistedState.streak);
    setBestStreak(persistedState.bestStreak);
    setCurrentHand(persistedState.currentHand);
    setTargetOutcome(persistedState.targetOutcome);
    setSelectedHand(persistedState.selectedHand);
    setFeedback(persistedState.feedback);
    restoredTransientRef.current = persistedState.feedback !== "none";
    setTimeLeft(
      Math.max(
        0,
        Math.min(
          persistedState.timeLeft,
          DIFFICULTY_CONFIG[difficulty].time -
            (Date.now() - persistedState.questionStartedAt) / 1000,
        ),
      ),
    );
  }, [difficulty, persistedState, startGame]);

  useEffect(() => {
    if (!routeRun || routeRun.status !== "active" || autoStartedRef.current) return;
    autoStartedRef.current = true;
    restoreGame();
  }, [restoreGame, routeRun]);

  const getRewardDifficulty = useCallback((): TrainingDifficulty => {
    return difficulty >= 3 ? "hard" : "normal";
  }, [difficulty]);

  const handleGameOver = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const finalScore = Math.min(MAX_POINTS_PER_SESSION, scoreRef.current);
    const rewardDifficulty = getRewardDifficulty();
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1_000));
    const settlementInput = {
      gameId: "rock-paper-scissors",
      score: finalScore,
      mode: `D${difficulty}`,
      difficulty: rewardDifficulty,
      durationSeconds,
      outcome: "completed",
    } as const;
    const isNewBest = updateHighScore(finalScore);
    allowSettledRef.current = true;
    const routeSettlement = runId
      ? settleRockPaperScissorsCompletion(
          runId,
          {
            score: finalScore,
            awardedPoints: 0,
            durationSeconds,
            correctCount: Math.floor(finalScore / (DIFFICULTY_POINTS[difficulty] || 2)),
            bestStreak: bestStreakRef.current,
            isNewBest,
          },
          settlementInput,
        )
      : null;
    if (!routeSettlement) return;
    if (routeSettlement.settlement.gauntletHandled) return;
    void Taro.redirectTo({
      url: `/pages/rock-paper-scissors/result?runId=${encodeURIComponent(runId)}`,
    });
  }, [difficulty, getRewardDifficulty, runId, updateHighScore]);

  useEffect(() => {
    generateQuestionRef.current = generateQuestion;
  }, [generateQuestion]);

  useEffect(() => {
    handleGameOverRef.current = handleGameOver;
  }, [handleGameOver]);

  useEffect(() => {
    if (!restoredTransientRef.current || feedback === "none") return undefined;
    restoredTransientRef.current = false;
    const timer = setTimeout(
      () => {
        if (feedback === "wrong") {
          handleGameOverRef.current?.();
          return;
        }
        generateQuestionRef.current?.();
      },
      feedback === "wrong" ? 520 : 420,
    );
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleRouteBack = useCallback(() => {
    if (!runId || !routeRun || routeRun.status !== "active") return;
    abandonRockPaperScissorsRun(runId, {
      gameId: "rock-paper-scissors",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - routeRun.payload.startedAt) / 1_000)),
      mode: `D${routeRun.payload.level}`,
      difficulty: routeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [routeRun, runId]);
  useUnload(handleRouteBack);

  const handleSelect = (hand: HandType) => {
    if (gameState !== "playing" || feedback !== "none") return;

    setSelectedHand(hand);
    const isCorrect = checkAnswer(hand);

    if (isCorrect) {
      const nextStreak = streak + 1;
      const pts = DIFFICULTY_POINTS[difficulty] || 2;
      const newScore = Math.min(MAX_POINTS_PER_SESSION, score + pts);
      const nextBestStreak = Math.max(bestStreakRef.current, nextStreak);

      setFeedback("correct");
      setScore(newScore);
      setStreak(nextStreak);
      setBestStreak(nextBestStreak);
      scoreRef.current = newScore;
      streakRef.current = nextStreak;
      bestStreakRef.current = nextBestStreak;
      persistRunState(
        currentHand,
        targetOutcome,
        "correct",
        hand,
        timeLeft,
        newScore,
        nextStreak,
        nextBestStreak,
      );
      if (!isGameGauntletRun()) {
        Taro.setStorageSync("rps_streak", nextStreak);
      }

      setTimeout(() => {
        setTimeLeft(DIFFICULTY_CONFIG[difficulty].time);
        generateQuestion();
      }, 420);
      return;
    }

    setFeedback("wrong");
    setStreak(0);
    streakRef.current = 0;
    persistRunState(
      currentHand,
      targetOutcome,
      "wrong",
      hand,
      timeLeft,
      scoreRef.current,
      0,
      bestStreakRef.current,
    );
    if (!isGameGauntletRun()) {
      Taro.setStorageSync("rps_streak", 0);
    }

    setTimeout(() => {
      handleGameOver();
    }, 520);
  };

  useEffect(() => {
    if (gameState === "playing" && feedback === "none") {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 0.1) {
            handleGameOver();
            return 0;
          }
          return t - 0.1;
        });
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, feedback, handleGameOver]);

  const progressPercent = Math.max(0, (timeLeft / DIFFICULTY_CONFIG[difficulty].time) * 100);
  const urgencyClass = timeLeft <= 1.5 ? "is-critical" : timeLeft <= 2.5 ? "is-warning" : "";

  return (
    <View className="rps-game">
      <View className="ambient ambient-one" />
      <View className="ambient ambient-two" />
      <View className="ambient-grid" />

      {gameState === "playing" && currentHand && targetOutcome && (
        <View className="screen play-screen">
          <View className="top-bar-rps">
            <View className="top-bar-item-rps">
              <View className="top-bar-icon-rps top-bar-icon-eye-rps">
                <Text className="top-bar-icon-text-rps">👁️</Text>
              </View>
              <Text className="top-bar-text-rps">题目 {Math.floor(score / 10) + 1}</Text>
            </View>
            <View className="top-bar-item-rps">
              <View className="top-bar-icon-rps top-bar-icon-trophy-rps">
                <Text className="top-bar-icon-text-rps">🏆</Text>
              </View>
              <Text className="top-bar-text-rps">{score} 分</Text>
            </View>
          </View>

          <View className="main-card-rps">
            <View className="status-badge-rps">
              <Text className="status-badge-text-rps">
                {feedback === "correct"
                  ? "回答正确"
                  : feedback === "wrong"
                    ? "回答错误"
                    : "请选择正确手势"}
              </Text>
            </View>
            <View className="opponent-stage">
              <Text className="opponent-caption">电脑出的是</Text>
              <Text className="opponent-hand">{HAND_CONFIG[currentHand].emoji}</Text>
              <Text className="opponent-name">{HAND_CONFIG[currentHand].name}</Text>
            </View>

            <View
              className="target-strip"
              style={{ backgroundColor: `${OUTCOME_CONFIG[targetOutcome].color}16` }}
            >
              <Text className="target-strip-label">你的目标</Text>
              <View
                className="target-badge"
                style={{ backgroundColor: OUTCOME_CONFIG[targetOutcome].color }}
              >
                <Text className="target-badge-icon">{OUTCOME_CONFIG[targetOutcome].emoji}</Text>
                <Text className="target-badge-text">{OUTCOME_CONFIG[targetOutcome].name}</Text>
              </View>
              <Text className="target-strip-hint">{OUTCOME_CONFIG[targetOutcome].prompt}</Text>
            </View>

            <View className="countdown-rps">
              <Text className={`countdown-text-rps ${urgencyClass}`}>{timeLeft.toFixed(1)}</Text>
            </View>

            <View className="progress-bar-rps">
              <View className="progress-bar-fill-rps" style={{ width: `${progressPercent}%` }} />
            </View>
          </View>

          <View className="options-grid-rps">
            {(Object.keys(HAND_CONFIG) as HandType[]).map((hand) => {
              const isSelected = selectedHand === hand;
              let itemClass = "hand-option";
              if (isSelected) {
                if (feedback === "correct") itemClass += " hand-option-correct";
                else if (feedback === "wrong") itemClass += " hand-option-wrong";
              }

              return (
                <View key={hand} className={itemClass} onClick={() => handleSelect(hand)}>
                  <Text className="hand-option-emoji">{HAND_CONFIG[hand].emoji}</Text>
                  <View className="hand-option-copy">
                    <Text className="hand-option-name">{HAND_CONFIG[hand].name}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
