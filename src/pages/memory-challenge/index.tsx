import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Image } from "@tarojs/components";
import Taro, { useLoad, useDidShow } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import "./index.scss";

// Import Shapes
import shape01 from "../../assets/shapes/shape_01.svg";
import shape02 from "../../assets/shapes/shape_02.svg";
import shape03 from "../../assets/shapes/shape_03.svg";
import shape04 from "../../assets/shapes/shape_04.svg";
import shape05 from "../../assets/shapes/shape_05.svg";
import shape06 from "../../assets/shapes/shape_06.svg";
import shape07 from "../../assets/shapes/shape_07.svg";
import shape08 from "../../assets/shapes/shape_08.svg";
import shape09 from "../../assets/shapes/shape_09.svg";
import shape10 from "../../assets/shapes/shape_10.svg";

const ALL_SHAPES = [
  { id: "shape_01", src: shape01 },
  { id: "shape_02", src: shape02 },
  { id: "shape_03", src: shape03 },
  { id: "shape_04", src: shape04 },
  { id: "shape_05", src: shape05 },
  { id: "shape_06", src: shape06 },
  { id: "shape_07", src: shape07 },
  { id: "shape_08", src: shape08 },
  { id: "shape_09", src: shape09 },
  { id: "shape_10", src: shape10 },
];

type GameState = "start" | "memorize" | "playing" | "gameover";
type TimeDifficulty = 1 | 2 | 3 | 4;
type MemoryDifficulty = 1 | 2 | 3 | 4;

// 时间维度配置（答题时间）
const TIME_CONFIG = {
  1: { label: "简单", color: "#22C55E", time: 8 },
  2: { label: "中等", color: "#EAB308", time: 6 },
  3: { label: "困难", color: "#F97316", time: 4 },
  4: { label: "专家", color: "#EF4444", time: 2 },
} as const;

// 记忆维度配置（N-Back的N值）
const MEMORY_CONFIG = {
  1: { label: "1-Back", color: "#22C55E", n: 1, desc: "记忆前1个" },
  2: { label: "2-Back", color: "#EAB308", n: 2, desc: "记忆前2个" },
  3: { label: "3-Back", color: "#F97316", n: 3, desc: "记忆前3个" },
  4: { label: "4-Back", color: "#EF4444", n: 4, desc: "记忆前4个" },
} as const;

// 最高分记录接口
interface HighScoreRecord {
  score: number;
  achievedAt: string;
}

export default function MemoryChallenge() {
  const [gameState, setGameState] = useState<GameState>("start");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [highScoreRecord, setHighScoreRecord] = useState<HighScoreRecord | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(8);
  const [timeDifficulty, setTimeDifficulty] = useState<TimeDifficulty>(1);
  const [memoryDifficulty, setMemoryDifficulty] = useState<MemoryDifficulty>(1);

  const [history, setHistory] = useState<(typeof ALL_SHAPES)[0][]>([]);
  const [currentShape, setCurrentShape] = useState<(typeof ALL_SHAPES)[0] | null>(null);
  const [targetShape, setTargetShape] = useState<(typeof ALL_SHAPES)[0] | null>(null);
  const [memorizeShapes, setMemorizeShapes] = useState<(typeof ALL_SHAPES)[0][]>([]);
  const [memorizeIndex, setMemorizeIndex] = useState(0);

  const [options, setOptions] = useState<(typeof ALL_SHAPES)[0][]>([]);

  const [feedback, setFeedback] = useState<"none" | "correct" | "wrong">("none");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [correctCount, setCorrectCount] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const memorizeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 获取当前难度组合的存储键名
  const getHighScoreKey = () => {
    return `memory_highscore_T${timeDifficulty}M${memoryDifficulty}`;
  };

  // 获取当前难度组合的最高分
  const getCurrentHighScore = (): HighScoreRecord | null => {
    const key = getHighScoreKey();
    const record = Taro.getStorageSync(key);
    if (record) {
      return JSON.parse(record) as HighScoreRecord;
    }
    return null;
  };

  // 更新当前难度组合的最高分
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

  // 刷新最高分显示
  const refreshHighScore = useCallback(() => {
    const record = getCurrentHighScore();
    if (record) {
      setHighScoreRecord(record);
      setHighScore(record.score);
    } else {
      setHighScoreRecord(null);
      setHighScore(0);
    }
  }, [timeDifficulty, memoryDifficulty]);

  useLoad(() => {
    // 加载连胜记录
    const storedStreak = Taro.getStorageSync("game_streak");
    if (storedStreak) setStreak(parseInt(storedStreak));

    // 加载当前难度组合的最高分
    refreshHighScore();
  });

  // 每次页面显示时刷新最高分
  useDidShow(() => {
    refreshHighScore();
  });

  // 监听难度变化，更新显示的最高分
  useEffect(() => {
    refreshHighScore();
  }, [timeDifficulty, memoryDifficulty, refreshHighScore]);

  // 监听游戏状态变化，当返回首页时刷新最高分
  useEffect(() => {
    if (gameState === "start") {
      refreshHighScore();
    }
  }, [gameState, refreshHighScore]);

  const playSound = (type: "success" | "fail") => {
    // Audio placeholder
  };

  const getMaxTime = () => {
    return TIME_CONFIG[timeDifficulty].time;
  };

  const getNValue = () => {
    return MEMORY_CONFIG[memoryDifficulty].n;
  };

  const getRandomShape = () => {
    const idx = Math.floor(Math.random() * ALL_SHAPES.length);
    return ALL_SHAPES[idx];
  };

  const generateOptions = (correctShape: (typeof ALL_SHAPES)[0]) => {
    const opts = [correctShape];
    while (opts.length < 4) {
      const random = getRandomShape();
      if (!opts.find((o) => o.id === random.id)) {
        opts.push(random);
      }
    }
    return opts.sort(() => Math.random() - 0.5);
  };

  const startGame = () => {
    const n = getNValue();
    const initialShapes: (typeof ALL_SHAPES)[0][] = [];

    // 生成N个初始图形用于记忆
    for (let i = 0; i < n; i++) {
      initialShapes.push(getRandomShape());
    }

    setScore(0);
    setRound(1);
    setCorrectCount(0);
    setHistory([...initialShapes]);
    setMemorizeShapes([...initialShapes]);
    setMemorizeIndex(0);
    setCurrentShape(initialShapes[0]);
    setTargetShape(null);
    setGameState("memorize");
    setFeedback("none");
    setSelectedId(null);

    // 依次展示N个图形，每个1.5秒
    let index = 0;
    const showNextShape = () => {
      index++;
      if (index < n) {
        setMemorizeIndex(index);
        setCurrentShape(initialShapes[index]);
        memorizeTimerRef.current = setTimeout(showNextShape, 1500);
      } else {
        // 展示完毕，开始游戏
        setTimeout(() => {
          startPlaying([...initialShapes]);
        }, 1500);
      }
    };

    memorizeTimerRef.current = setTimeout(showNextShape, 1500);
  };

  const startPlaying = (currentHistory: (typeof ALL_SHAPES)[0][]) => {
    const n = getNValue();
    const next = getRandomShape();
    const newHistory = [...currentHistory, next];

    setHistory(newHistory);
    setCurrentShape(next);
    // 目标是要回忆前N个图形
    setTargetShape(newHistory[newHistory.length - n - 1]);
    setOptions(generateOptions(newHistory[newHistory.length - n - 1]));

    setGameState("playing");
    setFeedback("none");
    setSelectedId(null);
    setTimeLeft(getMaxTime());
  };

  const nextRound = () => {
    const n = getNValue();
    const next = getRandomShape();
    const newHistory = [...history, next];

    setHistory(newHistory);
    setCurrentShape(next);
    // 目标是要回忆前N个图形
    setTargetShape(newHistory[newHistory.length - n - 1]);
    setOptions(generateOptions(newHistory[newHistory.length - n - 1]));

    setRound((r) => r + 1);
    setFeedback("none");
    setSelectedId(null);
    setTimeLeft(getMaxTime());
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
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, feedback]);

  const handleSelect = (id: string) => {
    if (gameState !== "playing" || feedback !== "none" || !targetShape) return;

    setSelectedId(id);

    if (id === targetShape.id) {
      setFeedback("correct");
      playSound("success");
      setScore((s) => s + 10);
      setCorrectCount((c) => c + 1);
      setStreak((s) => {
        const newStreak = s + 1;
        Taro.setStorageSync("game_streak", newStreak);
        return newStreak;
      });

      setTimeout(() => {
        nextRound();
      }, 500);
    } else {
      setFeedback("wrong");
      playSound("fail");
      setStreak(0);
      Taro.setStorageSync("game_streak", 0);

      setTimeout(() => {
        handleGameOver();
      }, 500);
    }
  };

  const handleGameOver = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    Taro.setStorageSync("memory_last_score", score);
    addPointsToPet("memory-challenge", score);
    setGameState("gameover");
    // 更新当前难度组合的最高分
    updateHighScore(score);
  };

  const getStatusText = () => {
    const n = getNValue();
    if (gameState === "memorize") {
      return `请记住第 ${memorizeIndex + 1}/${n} 个图形`;
    }
    return `请选择前${n}个图形`;
  };

  return (
    <View className="game-container">
      {/* ---------------- START SCREEN ---------------- */}
      {gameState === "start" && (
        <View className="start-screen">
          {/* Header Section */}
          <View className="header-section">
            <View className="logo-container">
              <View className="logo-icon">
                <Text className="logo-emoji">🎯</Text>
              </View>
            </View>
            <Text className="game-title">奇趣图形记忆</Text>
            <Text className="game-subtitle">挑战你的大脑，记住每一个图形！</Text>

            {/* High Score Display */}
            <View className="high-score-badge">
              <View className="high-score-icon">
                <Text className="high-score-icon-text">🏆</Text>
              </View>
              <View className="high-score-content">
                <Text className="high-score-label">当前难度最高分</Text>
                <Text className="high-score-value">{highScore}</Text>
              </View>
            </View>
          </View>

          {/* Rules Section */}
          <View className="rules-card">
            <View className="rules-header">
              <View className="rules-icon">
                <Text className="rules-icon-text">📋</Text>
              </View>
              <Text className="rules-title">游戏规则</Text>
            </View>
            <View className="rules-list">
              <View className="rule-item">
                <Text className="rule-number">1.</Text>
                <Text className="rule-text">选择时间和记忆数量难度</Text>
              </View>
              <View className="rule-item">
                <Text className="rule-number">2.</Text>
                <Text className="rule-text">系统展示图形，请记住它们</Text>
              </View>
              <View className="rule-item">
                <Text className="rule-number">3.</Text>
                <Text className="rule-text">选出前N个出现的图形（N由难度决定）</Text>
              </View>
              <View className="rule-item">
                <Text className="rule-number">4.</Text>
                <Text className="rule-text">答对得分，答错或超时游戏结束</Text>
              </View>
            </View>
          </View>

          {/* Time Difficulty Section */}
          <View className="difficulty-section">
            <View className="difficulty-header">
              <View className="difficulty-icon">
                <Text className="difficulty-icon-text">⏱️</Text>
              </View>
              <Text className="difficulty-title">答题时间</Text>
            </View>
            <View className="difficulty-grid">
              {([1, 2, 3, 4] as TimeDifficulty[]).map((d) => {
                const isSelected = timeDifficulty === d;
                const config = TIME_CONFIG[d];

                return (
                  <View
                    key={`time-${d}`}
                    className={`difficulty-item ${isSelected ? "difficulty-item-selected" : ""}`}
                    onClick={() => setTimeDifficulty(d)}
                  >
                    <View
                      className="difficulty-badge"
                      style={{ backgroundColor: config.color }}
                    >
                      <Text className="difficulty-badge-text">{config.time}s</Text>
                    </View>
                    <Text className="difficulty-label">{config.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Memory Difficulty Section */}
          <View className="difficulty-section">
            <View className="difficulty-header">
              <View className="difficulty-icon">
                <Text className="difficulty-icon-text">🧠</Text>
              </View>
              <Text className="difficulty-title">记忆数量</Text>
            </View>
            <View className="difficulty-grid">
              {([1, 2, 3, 4] as MemoryDifficulty[]).map((d) => {
                const isSelected = memoryDifficulty === d;
                const config = MEMORY_CONFIG[d];

                return (
                  <View
                    key={`memory-${d}`}
                    className={`difficulty-item ${isSelected ? "difficulty-item-selected" : ""}`}
                    onClick={() => setMemoryDifficulty(d)}
                  >
                    <View
                      className="difficulty-badge"
                      style={{ backgroundColor: config.color }}
                    >
                      <Text className="difficulty-badge-text">{config.n}</Text>
                    </View>
                    <Text className="difficulty-label">{config.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Start Button */}
          <View className="start-button-container">
            <View className="start-button" onClick={startGame}>
              <Text className="start-button-text">开始游戏</Text>
            </View>
          </View>
        </View>
      )}

      {/* ---------------- MEMORIZE & PLAYING SCREEN ---------------- */}
      {(gameState === "memorize" || gameState === "playing") && currentShape && (
        <View className="game-screen">
          {/* Top Bar */}
          <View className="top-bar">
            <View className="top-bar-item">
              <View className="top-bar-icon top-bar-icon-eye">
                <Text className="top-bar-icon-text">👁️</Text>
              </View>
              <Text className="top-bar-text">题目 {round}</Text>
            </View>
            <View className="top-bar-item">
              <View className="top-bar-icon top-bar-icon-trophy">
                <Text className="top-bar-icon-text">🏆</Text>
              </View>
              <Text className="top-bar-text">{score} 分</Text>
            </View>
          </View>

          {/* Main Card */}
          <View className="main-card">
            <View
              className={`status-badge ${gameState === "memorize" ? "status-badge-memorize" : "status-badge-play"}`}
            >
              <Text className="status-badge-text">{getStatusText()}</Text>
            </View>

            <View className="shape-display">
              <Image src={currentShape.src} className="shape-image" />
            </View>

            {/* Countdown Number */}
            {gameState === "playing" && (
              <View className="countdown">
                <Text className={`countdown-text ${timeLeft < 3 ? "countdown-urgent" : ""}`}>
                  {timeLeft.toFixed(1)}
                </Text>
              </View>
            )}

            {/* Progress Bar */}
            {gameState === "playing" && (
              <View className="progress-bar">
                <View
                  className="progress-bar-fill"
                  style={{
                    width: `${(timeLeft / getMaxTime()) * 100}%`,
                  }}
                />
              </View>
            )}
          </View>

          {/* Options Grid */}
          {gameState === "playing" ? (
            <View className="options-grid">
              {options.map((shape) => {
                const isSelected = selectedId === shape.id;
                let itemClass = "option-item";

                if (isSelected) {
                  if (feedback === "correct") {
                    itemClass += " option-item-correct";
                  } else if (feedback === "wrong") {
                    itemClass += " option-item-wrong";
                  }
                }

                return (
                  <View
                    key={shape.id}
                    className={itemClass}
                    onClick={() => handleSelect(shape.id)}
                  >
                    <Image src={shape.src} className="option-image" />
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="loading-section">
              <View className="loading-dots">
                <View className="loading-dot" />
                <View className="loading-dot loading-dot-delay-1" />
                <View className="loading-dot loading-dot-delay-2" />
              </View>
            </View>
          )}
        </View>
      )}

      {/* ---------------- GAME OVER SCREEN ---------------- */}
      {gameState === "gameover" && (
        <View className="gameover-screen">
          <View className="gameover-icon-container">
            <Text className="gameover-icon">🏆</Text>
          </View>

          <Text className="gameover-title">游戏结束</Text>
          <Text className="gameover-subtitle">感谢参与挑战！</Text>

          <View className="score-card">
            <Text className="score-label">最终得分</Text>
            <Text className="score-value">{score}</Text>
            {isNewRecord && score > 0 && (
              <View className="new-record-badge">
                <Text className="new-record-text">✨ 新纪录 NEW RECORD ✨</Text>
              </View>
            )}
          </View>

          <View className="stats-grid">
            <View className="stat-item">
              <Text className="stat-label">当前连胜</Text>
              <Text className="stat-value">{streak}</Text>
            </View>
            <View className="stat-item">
              <Text className="stat-label">答对题数</Text>
              <Text className="stat-value">{correctCount}</Text>
            </View>
          </View>

          <View className="tips-card">
            <View className="tips-header">
              <Text className="tips-icon">💡</Text>
              <Text className="tips-title">提升技巧</Text>
            </View>
            <View className="tips-list">
              <Text className="tips-item">• 在展示阶段，尝试在脑海中复述图形特征</Text>
              <Text className="tips-item">• 使用记忆宫殿法，将图形与具体场景关联</Text>
            </View>
          </View>

          <View className="restart-button" onClick={startGame}>
            <Text className="restart-button-text">再来一局</Text>
          </View>

          <View className="back-button" onClick={() => setGameState("start")}>
            <Text className="back-button-text">重新选择难度</Text>
          </View>

          <View className="back-home-button" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
            <Text className="back-home-button-text">返回游戏主页</Text>
          </View>
        </View>
      )}
    </View>
  );
}
