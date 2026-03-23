import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useLoad, useDidShow } from "@tarojs/taro";
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

  const handleGameOver = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    Taro.setStorageSync("rps_last_score", score);
    setGameState("gameover");
    updateHighScore(score);
  }, [score]);

  const handleSelect = (hand: HandType) => {
    if (gameState !== "playing" || feedback !== "none") return;

    setSelectedHand(hand);
    const isCorrect = checkAnswer(hand);

    if (isCorrect) {
      const nextStreak = streak + 1;
      const newScore = score + 10 + streak * 2;

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

  const coachDetail = useMemo(() => {
    if (!currentHand) return "先判断相同、克制它、被它克制这三种关系，再匹配目标。";
    return `面对${HAND_CONFIG[currentHand].name}时，先想“跟它一样、克制它、被它克制”三种关系，再选符合目标的那个。`;
  }, [currentHand]);

  const progressPercent = Math.max(0, (timeLeft / DIFFICULTY_CONFIG[difficulty].time) * 100);
  const urgencyClass = timeLeft <= 1.5 ? "is-critical" : timeLeft <= 2.5 ? "is-warning" : "";

  return (
    <View className="rps-game">
      <View className="ambient ambient-one" />
      <View className="ambient ambient-two" />
      <View className="ambient-grid" />

      {gameState === "start" && (
        <View className="screen start-screen">
          <View className="hero-card panel-card">
            <View className="hero-mark">
              <Text className="hero-mark-text">RPS</Text>
            </View>
            <Text className="hero-eyebrow">REVERSE MODE</Text>
            <Text className="game-title">逆向猜拳</Text>
            <Text className="game-subtitle">看目标结果倒推手势，重点不是会猜拳，而是够不够快。</Text>

            <View className="hero-metrics">
              <View className="metric-card metric-card-highlight">
                <Text className="metric-label">当前难度最高分</Text>
                <Text className="metric-value">{highScore}</Text>
              </View>
              <View className="metric-card">
                <Text className="metric-label">本轮时限</Text>
                <Text className="metric-value">{DIFFICULTY_CONFIG[difficulty].time}s</Text>
              </View>
            </View>
          </View>

          <View className="panel-card quick-guide-card">
            <View className="section-head">
              <Text className="section-kicker">操作说明</Text>
              <Text className="section-title">三步完成判断</Text>
            </View>
            <View className="guide-track">
              <View className="guide-step">
                <Text className="guide-index">1</Text>
                <Text className="guide-text">先看电脑出的手势</Text>
              </View>
              <View className="guide-step">
                <Text className="guide-index">2</Text>
                <Text className="guide-text">再看本轮要求你赢、平或输</Text>
              </View>
              <View className="guide-step">
                <Text className="guide-index">3</Text>
                <Text className="guide-text">点底部大按钮直接作答</Text>
              </View>
            </View>
            <View className="memory-tip">
              <Text className="memory-tip-label">口诀</Text>
              <Text className="memory-tip-text">想赢就克制它，想平就跟它一样，想输就故意被它克制。</Text>
            </View>
          </View>

          <View className="panel-card difficulty-card">
            <View className="section-head">
              <Text className="section-kicker">难度选择</Text>
              <Text className="section-title">按手速挑节奏</Text>
            </View>
            <View className="difficulty-list">
              {([1, 2, 3, 4] as Difficulty[]).map((d) => {
                const isSelected = difficulty === d;
                const config = DIFFICULTY_CONFIG[d];
                return (
                  <View
                    key={`diff-${d}`}
                    className={`difficulty-item ${isSelected ? "difficulty-item-selected" : ""}`}
                    onClick={() => setDifficulty(d)}
                  >
                    <View className="difficulty-main">
                      <View className="difficulty-dot" style={{ backgroundColor: config.color }} />
                      <View className="difficulty-copy">
                        <Text className="difficulty-label">{config.label}</Text>
                        <Text className="difficulty-desc">{config.description}</Text>
                      </View>
                    </View>
                    <View className="difficulty-time-badge">
                      <Text className="difficulty-time-text">{config.time}s</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="start-action">
            <View className="primary-button" onClick={startGame}>
              <Text className="primary-button-text">开始挑战</Text>
              <Text className="primary-button-subtext">拇指直接点按即可开始</Text>
            </View>
          </View>
        </View>
      )}

      {gameState === "playing" && currentHand && targetOutcome && (
        <View className="screen play-screen">
          <View className="play-top panel-card">
            <View className="compact-stat">
              <Text className="compact-stat-label">得分</Text>
              <Text className="compact-stat-value">{score}</Text>
            </View>
            <View className="compact-stat">
              <Text className="compact-stat-label">连胜</Text>
              <Text className="compact-stat-value">{streak}</Text>
            </View>
            <View className="compact-stat compact-stat-tight">
              <Text className="compact-stat-label">难度</Text>
              <Text className="compact-stat-value compact-stat-value-small">{DIFFICULTY_CONFIG[difficulty].label}</Text>
            </View>
          </View>

          <View className="play-main panel-card">
            <Text className="round-label">第 {Math.floor(score / 10) + 1} 轮</Text>
            <View className="opponent-stage">
              <Text className="opponent-caption">电脑出</Text>
              <Text className="opponent-hand">{HAND_CONFIG[currentHand].emoji}</Text>
              <Text className="opponent-name">{HAND_CONFIG[currentHand].name}</Text>
            </View>

            <View className="target-strip" style={{ borderColor: OUTCOME_CONFIG[targetOutcome].color }}>
              <Text className="target-strip-label">你的目标</Text>
              <View className="target-badge" style={{ backgroundColor: OUTCOME_CONFIG[targetOutcome].color }}>
                <Text className="target-badge-icon">{OUTCOME_CONFIG[targetOutcome].emoji}</Text>
                <Text className="target-badge-text">{OUTCOME_CONFIG[targetOutcome].name}</Text>
              </View>
            </View>

            <View className="coach-card">
              <Text className="coach-title">提示思路</Text>
              <Text className="coach-text">{OUTCOME_CONFIG[targetOutcome].prompt}</Text>
              <Text className="coach-answer">{coachDetail}</Text>
            </View>
          </View>

          <View className={`timer-card panel-card ${urgencyClass}`}>
            <View className="timer-head">
              <Text className="timer-label">剩余时间</Text>
              <Text className="timer-value">{timeLeft.toFixed(1)}s</Text>
            </View>
            <View className="timer-track">
              <View className="timer-fill" style={{ width: `${progressPercent}%` }} />
            </View>
          </View>

          <View className="action-dock">
            <Text className="action-dock-title">选择你的手势</Text>
            <View className="action-grid">
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
                      <Text className="hand-option-hint">点按作答</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {gameState === "gameover" && (
        <View className="screen gameover-screen">
          <View className="result-hero panel-card">
            <Text className="result-kicker">本局结束</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-caption">最终得分</Text>
            {isNewRecord && score > 0 && (
              <View className="record-badge">
                <Text className="record-badge-text">刷新当前难度纪录</Text>
              </View>
            )}
          </View>

          <View className="result-stats">
            <View className="result-stat panel-card">
              <Text className="result-stat-label">最高连胜</Text>
              <Text className="result-stat-value">{bestStreak}</Text>
            </View>
            <View className="result-stat panel-card">
              <Text className="result-stat-label">本局难度</Text>
              <Text className="result-stat-value">{DIFFICULTY_CONFIG[difficulty].label}</Text>
            </View>
            <View className="result-stat panel-card">
              <Text className="result-stat-label">当前最高分</Text>
              <Text className="result-stat-value">{highScoreRecord?.score ?? highScore}</Text>
            </View>
          </View>

          <View className="panel-card result-tip-card">
            <Text className="section-kicker">复盘建议</Text>
            <Text className="section-title">继续提速的关键</Text>
            <Text className="result-tip-text">把判断顺序固定成“看电脑 -> 看目标 -> 直接点答案”，不要在脑中重复完整规则。</Text>
          </View>

          <View className="result-actions">
            <View className="primary-button" onClick={startGame}>
              <Text className="primary-button-text">再来一局</Text>
              <Text className="primary-button-subtext">保持当前难度继续挑战</Text>
            </View>
            <View className="secondary-button" onClick={() => setGameState("start")}>
              <Text className="secondary-button-text">重新选择难度</Text>
            </View>
            <View className="ghost-button" onClick={() => Taro.reLaunch({ url: "/pages/index/index" })}>
              <Text className="ghost-button-text">返回游戏主页</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
