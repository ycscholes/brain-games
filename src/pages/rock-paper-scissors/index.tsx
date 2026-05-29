import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useLoad, useDidShow } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  MAX_POINTS_PER_SESSION,
  recordTrainingSession,
  type TrainingDifficulty,
} from "../../utils/trainingStorage";
import "./index.scss";

type GameState = "start" | "playing" | "gameover";
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

const HAND_CONFIG: Record<HandType, { emoji: string; name: string; beats: HandType; losesTo: HandType }> = {
  rock: { emoji: "✊", name: "石头", beats: "scissors", losesTo: "paper" },
  paper: { emoji: "✋", name: "布", beats: "rock", losesTo: "scissors" },
  scissors: { emoji: "✌️", name: "剪刀", beats: "paper", losesTo: "rock" },
};

const OUTCOME_CONFIG: Record<OutcomeType, { emoji: string; name: string; color: string; prompt: string }> = {
  win: { emoji: "↑", name: "赢", color: "#4DBA87", prompt: "选能克制电脑的手势" },
  draw: { emoji: "=", name: "平", color: "#5F6FFF", prompt: "选和电脑相同的手势" },
  lose: { emoji: "↓", name: "输", color: "#D94B58", prompt: "故意选会被电脑克制的手势" },
};

interface HighScoreRecord {
  score: number;
  achievedAt: string;
}

export default function RockPaperScissors() {
  const [gameState, setGameState] = useState<GameState>("start");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [timeLeft, setTimeLeft] = useState(5);
  const [currentHand, setCurrentHand] = useState<HandType | null>(null);
  const [targetOutcome, setTargetOutcome] = useState<OutcomeType | null>(null);
  const [feedback, setFeedback] = useState<"none" | "correct" | "wrong">("none");
  const [selectedHand, setSelectedHand] = useState<HandType | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [highScoreRecord, setHighScoreRecord] = useState<HighScoreRecord | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getHighScoreKey = () => `rps_highscore_D${difficulty}`;

  const getCurrentHighScore = (): HighScoreRecord | null => {
    const key = getHighScoreKey();
    const record = Taro.getStorageSync(key);
    if (record) return JSON.parse(record) as HighScoreRecord;
    return null;
  };

  const updateHighScore = (newScore: number) => {
    const key = getHighScoreKey();
    const currentRecord = getCurrentHighScore();

    if (!currentRecord || newScore > currentRecord.score) {
      const newRecord: HighScoreRecord = {
        score: newScore,
        achievedAt: new Date().toISOString(),
      };
      Taro.setStorageSync(key, JSON.stringify(newRecord));
      setHighScoreRecord(newRecord);
      setIsNewRecord(true);
      return true;
    }

    setIsNewRecord(false);
    return false;
  };

  const refreshHighScore = useCallback(() => {
    const record = getCurrentHighScore();
    if (record) {
      setHighScoreRecord(record);
      setHighScore(record.score);
    } else {
      setHighScoreRecord(null);
      setHighScore(0);
    }
  }, [difficulty]);

  useLoad(() => {
    const storedStreak = Taro.getStorageSync("rps_streak");
    if (storedStreak) setStreak(parseInt(storedStreak, 10));
    refreshHighScore();
  });

  useDidShow(() => {
    refreshHighScore();
  });

  useEffect(() => {
    refreshHighScore();
  }, [difficulty, refreshHighScore]);

  useEffect(() => {
    if (gameState === "start") refreshHighScore();
  }, [gameState, refreshHighScore]);

  const generateQuestion = () => {
    const hands: HandType[] = ["rock", "paper", "scissors"];
    const outcomes: OutcomeType[] = ["win", "draw", "lose"];

    const randomHand = hands[Math.floor(Math.random() * hands.length)];
    const randomOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];

    setCurrentHand(randomHand);
    setTargetOutcome(randomOutcome);
    setFeedback("none");
    setSelectedHand(null);
  };

  const checkAnswer = (playerHand: HandType): boolean => {
    if (!currentHand || !targetOutcome) return false;

    let result: OutcomeType;

    if (playerHand === currentHand) result = "draw";
    else if (HAND_CONFIG[playerHand].beats === currentHand) result = "win";
    else result = "lose";

    return result === targetOutcome;
  };

  const startGame = () => {
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setIsNewRecord(false);
    setTimeLeft(DIFFICULTY_CONFIG[difficulty].time);
    setGameState("playing");
    generateQuestion();
  };

  const getRewardDifficulty = (): TrainingDifficulty => {
    return difficulty >= 3 ? "hard" : "normal";
  };

  const handleGameOver = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const finalScore = Math.min(MAX_POINTS_PER_SESSION, score);
    const rewardDifficulty = getRewardDifficulty();
    const awardedPoints = getAwardedPoints("rock-paper-scissors", finalScore, rewardDifficulty);
    Taro.setStorageSync("rps_last_score", finalScore);
    addPointsToPet("rock-paper-scissors", finalScore, rewardDifficulty);
    recordTrainingSession({
      gameId: "rock-paper-scissors",
      score: finalScore,
      awardedPoints,
      mode: `D${difficulty}`,
      difficulty: rewardDifficulty,
      outcome: "completed",
    });
    setGameState("gameover");
    updateHighScore(finalScore);
  }, [difficulty, score]);

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
      Taro.setStorageSync("rps_streak", nextStreak);

      setTimeout(() => {
        setTimeLeft(DIFFICULTY_CONFIG[difficulty].time);
        generateQuestion();
      }, 420);
      return;
    }

    setFeedback("wrong");
    setStreak(0);
    Taro.setStorageSync("rps_streak", 0);

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

      {gameState === "start" && (
        <View className="screen start-screen">
          <View className="header-section-rps">
            <View className="logo-container-rps">
              <View className="logo-icon-rps">
                <Text className="hero-mark-emoji hero-mark-emoji-rock">✊</Text>
                <Text className="hero-mark-emoji hero-mark-emoji-paper">📄</Text>
                <Text className="hero-mark-emoji hero-mark-emoji-scissors">✌️</Text>
              </View>
            </View>
            <Text className="game-title-rps">逆向猜拳</Text>
            <Text className="game-subtitle-rps">根据目标结果倒推答案，挑战你的反应和判断！</Text>

            <View className="high-score-badge-rps">
              <View className="high-score-icon-rps">
                <Text className="high-score-icon-text-rps">🏆</Text>
              </View>
              <View className="high-score-content-rps">
                <Text className="high-score-label-rps">当前难度最高分</Text>
                <Text className="high-score-value-rps">{highScore}</Text>
              </View>
            </View>
          </View>

          <View className="rules-card-rps">
            <View className="rules-header-rps">
              <View className="rules-icon-rps">
                <Text className="rules-icon-text-rps">📋</Text>
              </View>
              <Text className="rules-title-rps">游戏规则</Text>
            </View>
            <View className="rules-list-rps">
              <View className="rule-item-rps">
                <Text className="rule-number-rps">1.</Text>
                <Text className="rule-text-rps">先看电脑出的手势</Text>
              </View>
              <View className="rule-item-rps">
                <Text className="rule-number-rps">2.</Text>
                <Text className="rule-text-rps">再看本轮要求你赢、平或输</Text>
              </View>
              <View className="rule-item-rps">
                <Text className="rule-number-rps">3.</Text>
                <Text className="rule-text-rps">选出正确手势，答错或超时结束</Text>
              </View>
            </View>
          </View>

          <View className="difficulty-section-rps">
            <View className="difficulty-header-rps">
              <View className="difficulty-icon-rps">
                <Text className="difficulty-icon-text-rps">⏱️</Text>
              </View>
              <Text className="difficulty-title-rps">答题时间</Text>
            </View>
            <View className="difficulty-grid-rps">
              {([1, 2, 3, 4] as Difficulty[]).map((d) => {
                const isSelected = difficulty === d;
                const config = DIFFICULTY_CONFIG[d];
                return (
                  <View
                    key={`diff-${d}`}
                    className={`difficulty-item ${isSelected ? "difficulty-item-selected" : ""}`}
                    onClick={() => setDifficulty(d)}
                  >
                    <View className="difficulty-badge-rps" style={{ backgroundColor: config.color }}>
                      <Text className="difficulty-badge-text-rps">{config.time}s</Text>
                    </View>
                    <View className="difficulty-copy-rps">
                      <Text className="difficulty-label">{config.label}</Text>
                      <Text className="difficulty-reward-rps">
                        积分{getTrainingDifficultyLabel(d >= 3 ? "hard" : "normal")}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="start-button-container-rps floating-start-action">
            <View className="start-button-rps" onClick={startGame}>
              <Text className="start-button-text-rps">开始游戏</Text>
            </View>
          </View>
          <View className="floating-start-spacer" />
        </View>
      )}

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
                {feedback === "correct" ? "回答正确" : feedback === "wrong" ? "回答错误" : "请选择正确手势"}
              </Text>
            </View>
            <View className="opponent-stage">
              <Text className="opponent-caption">电脑出的是</Text>
              <Text className="opponent-hand">{HAND_CONFIG[currentHand].emoji}</Text>
              <Text className="opponent-name">{HAND_CONFIG[currentHand].name}</Text>
            </View>

            <View className="target-strip" style={{ backgroundColor: `${OUTCOME_CONFIG[targetOutcome].color}16` }}>
              <Text className="target-strip-label">你的目标</Text>
              <View className="target-badge" style={{ backgroundColor: OUTCOME_CONFIG[targetOutcome].color }}>
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

      {gameState === "gameover" && (
        <View className="result-screen">
          <View className="result-card">
            <Text className="result-title">本局成绩</Text>
            <Text className="result-score">{Math.min(MAX_POINTS_PER_SESSION, score)}</Text>
            <Text className="result-desc">
              答对 {Math.floor(score / (DIFFICULTY_POINTS[difficulty] || 2))} 题 · 最高连击 {bestStreak} · {DIFFICULTY_CONFIG[difficulty].label}
            </Text>
            <Text className="result-desc">
              积分{getTrainingDifficultyLabel(getRewardDifficulty())} · 获得 {getAwardedPoints("rock-paper-scissors", Math.min(MAX_POINTS_PER_SESSION, score), getRewardDifficulty())} 积分
            </Text>
            <Text className="result-desc">
              历史最高 {highScore}
              {isNewRecord && score > 0 ? <Text className="result-highlight">，刷新纪录</Text> : null}
            </Text>
          </View>

          <View className="result-actions">
            <View className="primary-button" onClick={startGame}>
              <Text className="button-text">再来一局</Text>
            </View>
            <View className="secondary-button" onClick={() => setGameState("start")}>
              <Text className="button-text">返回开始页</Text>
            </View>
            <View className="secondary-button" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
              <Text className="button-text">返回游戏主页</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
