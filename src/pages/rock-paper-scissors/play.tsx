import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { MAX_POINTS_PER_SESSION, type TrainingDifficulty } from "../../utils/trainingStorage";
import { isGameGauntletRun, readGameGauntletModePreset } from "../../utils/gameGauntlet";
import GameRouteBack from "../../components/game-route/GameRouteBack";
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

  useEffect(() => {
    if (!runId || !routeRun || routeRun.status !== "active") {
      void Taro.redirectTo({ url: "/pages/rock-paper-scissors/index" });
    }
  }, [routeRun, runId]);

  const [gameState] = useState<GameState>("playing");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const difficulty: Difficulty = routeRun?.payload.level ?? presetDifficulty;
  const [timeLeft, setTimeLeft] = useState(5);
  const [currentHand, setCurrentHand] = useState<HandType | null>(null);
  const [targetOutcome, setTargetOutcome] = useState<OutcomeType | null>(null);
  const [feedback, setFeedback] = useState<"none" | "correct" | "wrong">("none");
  const [selectedHand, setSelectedHand] = useState<HandType | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStartedRef = useRef(false);
  const startedAtRef = useRef(0);

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

    setCurrentHand(randomHand);
    setTargetOutcome(randomOutcome);
    setFeedback("none");
    setSelectedHand(null);
  }, []);

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
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setTimeLeft(DIFFICULTY_CONFIG[difficulty].time);
    generateQuestion();
  }, [difficulty, generateQuestion]);

  useEffect(() => {
    if (!routeRun || routeRun.status !== "active" || autoStartedRef.current) return;
    autoStartedRef.current = true;
    startGame();
  }, [routeRun, startGame]);

  const getRewardDifficulty = useCallback((): TrainingDifficulty => {
    return difficulty >= 3 ? "hard" : "normal";
  }, [difficulty]);

  const handleGameOver = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const finalScore = Math.min(MAX_POINTS_PER_SESSION, score);
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
    const routeSettlement = runId
      ? settleRockPaperScissorsCompletion(
          runId,
          {
            score: finalScore,
            awardedPoints: 0,
            durationSeconds,
            correctCount: Math.floor(finalScore / (DIFFICULTY_POINTS[difficulty] || 2)),
            bestStreak,
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
  }, [bestStreak, difficulty, getRewardDifficulty, runId, score, updateHighScore]);

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

      setFeedback("correct");
      setScore(newScore);
      setStreak(nextStreak);
      setBestStreak((prev) => Math.max(prev, nextStreak));
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
      {runId ? (
        <GameRouteBack gameId="rock-paper-scissors" runId={runId} onAbandon={handleRouteBack} />
      ) : null}
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
