import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useLoad, useDidShow } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import "./index.scss";

type GameState = "start" | "playing" | "gameover";
type GameMode = "timed" | "death";

interface MathProblem {
  question: string;
  answer: number;
}

// 最高分记录接口
interface HighScoreRecord {
  score: number;
  achievedAt: string;
}

export default function MentalMath() {
  const [gameState, setGameState] = useState<GameState>("start");
  const [gameMode, setGameMode] = useState<GameMode>("timed");
  const [score, setScore] = useState(0);
  const [highScoreTimed, setHighScoreTimed] = useState(0);
  const [highScoreDeath, setHighScoreDeath] = useState(0);
  const [highScoreRecord, setHighScoreRecord] = useState<HighScoreRecord | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"none" | "correct" | "wrong">("none");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const correctCountRef = useRef(0);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep ref updated with latest correctCount for timer closure
  useEffect(() => {
    correctCountRef.current = correctCount;
  }, [correctCount]);

  // Clear all pending timers
  const clearAllTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  };

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  // Get current high score based on selected mode
  const getHighScore = () => {
    return gameMode === "timed" ? highScoreTimed : highScoreDeath;
  };

  // 获取难度等级基于最高分
  const getDifficultyLevel = (): 1 | 2 | 3 | 4 => {
    const hs = getHighScore();
    if (hs < 10) return 1;
    if (hs < 20) return 2;
    if (hs < 30) return 3;
    return 4;
  };

  // 生成随机数
  const randomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // 生成数学题
  const generateProblem = (): MathProblem => {
    const level = getDifficultyLevel();
    let a: number, b: number, c: number;
    let question: string;
    let answer: number;

    switch (level) {
      case 1:
        // Level 1: 1-2 digit addition/subtraction
        if (Math.random() > 0.5) {
          a = randomInt(1, 50);
          b = randomInt(1, 50);
          question = `${a} + ${b} = ?`;
          answer = a + b;
        } else {
          a = randomInt(10, 99);
          b = randomInt(1, a);
          question = `${a} - ${b} = ?`;
          answer = a - b;
        }
        break;

      case 2:
        // Level 2: 2-3 digit addition/subtraction
        if (Math.random() > 0.5) {
          a = randomInt(10, 150);
          b = randomInt(10, 150);
          question = `${a} + ${b} = ?`;
          answer = a + b;
        } else {
          a = randomInt(50, 200);
          b = randomInt(10, a);
          question = `${a} - ${b} = ?`;
          answer = a - b;
        }
        break;

      case 3:
        // Level 3: 1-digit multiplication
        if (Math.random() > 0.3) {
          a = randomInt(2, 12);
          b = randomInt(2, 12);
          question = `${a} × ${b} = ?`;
          answer = a * b;
        } else if (Math.random() > 0.5) {
          a = randomInt(10, 99);
          b = randomInt(1, 50);
          question = `${a} + ${b} = ?`;
          answer = a + b;
        } else {
          a = randomInt(50, 150);
          b = randomInt(10, a);
          question = `${a} - ${b} = ?`;
          answer = a - b;
        }
        break;

      case 4:
      default:
        // Level 4: Mixed operations
        const operationType = Math.random();
        if (operationType < 0.4) {
          a = randomInt(2, 12);
          b = randomInt(2, 12);
          c = randomInt(1, 20);
          if (Math.random() > 0.5) {
            question = `${a} × ${b} + ${c} = ?`;
            answer = a * b + c;
          } else {
            question = `${a} × ${b} - ${c} = ?`;
            answer = a * b - c;
          }
        } else if (operationType < 0.7) {
          a = randomInt(2, 12);
          b = randomInt(2, 12);
          question = `${a} × ${b} = ?`;
          answer = a * b;
        } else if (Math.random() > 0.5) {
          a = randomInt(50, 200);
          b = randomInt(20, 150);
          question = `${a} + ${b} = ?`;
          answer = a + b;
        } else {
          a = randomInt(100, 300);
          b = randomInt(20, 100);
          question = `${a} - ${b} = ?`;
          answer = a - b;
        }
        break;
    }

    return { question, answer };
  };

  // 生成选项
  const generateOptions = (correctAnswer: number): number[] => {
    const opts = [correctAnswer];
    const range = Math.max(10, Math.floor(correctAnswer * 0.3));

    while (opts.length < 4) {
      let offset = randomInt(-range, range);
      // 保证偏移不为0，并且结果是正数
      if (offset === 0) offset = 1;
      const wrong = correctAnswer + offset;
      if (wrong > 0 && !opts.includes(wrong)) {
        opts.push(wrong);
      }
    }

    return opts.sort(() => Math.random() - 0.5);
  };

  // 获取存储键名 based on mode
  const getStorageKey = (): string => {
    return gameMode === "timed" ? "mental_math_high_score_timed" : "mental_math_high_score_death";
  };

  // 获取当前最高分
  const getCurrentHighScore = (): HighScoreRecord | null => {
    const key = getStorageKey();
    const record = Taro.getStorageSync(key);
    if (record) {
      try {
        const parsed = JSON.parse(record);
        if (typeof parsed?.score === "number" && typeof parsed?.achievedAt === "string") {
          return parsed as HighScoreRecord;
        }
        return null;
      } catch {
        // Invalid JSON, clear bad data
        Taro.removeStorageSync(key);
        return null;
      }
    }
    return null;
  };

  // 更新最高分
  const updateHighScore = (newScore: number): boolean => {
    const key = getStorageKey();
    const currentRecord = getCurrentHighScore();

    if (!currentRecord || newScore > currentRecord.score) {
      const newRecord: HighScoreRecord = {
        score: newScore,
        achievedAt: new Date().toISOString(),
      };
      Taro.setStorageSync(key, JSON.stringify(newRecord));
      setHighScoreRecord(newRecord);
      setIsNewRecord(true);
      // Update the corresponding state based on current mode
      if (gameMode === "timed") {
        setHighScoreTimed(newScore);
      } else {
        setHighScoreDeath(newScore);
      }
      return true;
    }
    setIsNewRecord(false);
    return false;
  };

  // 刷新最高分
  const refreshHighScore = useCallback(() => {
    // Load both high scores for both modes
    const timedKey = "mental_math_high_score_timed";
    const deathKey = "mental_math_high_score_death";

    const timedRecord = Taro.getStorageSync(timedKey);
    const deathRecord = Taro.getStorageSync(deathKey);

    if (timedRecord) {
      try {
        const parsed = JSON.parse(timedRecord);
        setHighScoreTimed(typeof parsed?.score === "number" ? parsed.score : 0);
        if (typeof parsed?.score !== "number") {
          Taro.removeStorageSync(timedKey);
        }
      } catch {
        setHighScoreTimed(0);
        Taro.removeStorageSync(timedKey);
      }
    } else {
      setHighScoreTimed(0);
    }

    if (deathRecord) {
      try {
        const parsed = JSON.parse(deathRecord);
        setHighScoreDeath(typeof parsed?.score === "number" ? parsed.score : 0);
        if (typeof parsed?.score !== "number") {
          Taro.removeStorageSync(deathKey);
        }
      } catch {
        setHighScoreDeath(0);
        Taro.removeStorageSync(deathKey);
      }
    } else {
      setHighScoreDeath(0);
    }

    // Update current record for selected mode
    const record = getCurrentHighScore();
    if (record) {
      setHighScoreRecord(record);
    } else {
      setHighScoreRecord(null);
    }
  }, [gameMode]);

  // Update high score when mode changes
  useEffect(() => {
    const record = getCurrentHighScore();
    if (record) {
      setHighScoreRecord(record);
    } else {
      setHighScoreRecord(null);
    }
  }, [gameMode]);

  useLoad(() => {
    refreshHighScore();
  });

  useDidShow(() => {
    refreshHighScore();
  });

  // 开始新游戏
  const startGame = () => {
    clearAllTimers();
    setScore(0);
    setTimeLeft(30);
    setCorrectCount(0);
    setSelectedAnswer(null);
    setFeedback("none");
    nextProblem();
    setGameState("playing");
  };

  // 下一题
  const nextProblem = () => {
    const problem = generateProblem();
    const opts = generateOptions(problem.answer);
    setCurrentProblem(problem);
    setOptions(opts);
    setSelectedAnswer(null);
    setFeedback("none");
  };

  // 计时器
  useEffect(() => {
    if (gameState === "playing" && gameMode === "timed" && timeLeft > 0) {
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
  }, [gameState, gameMode]);

  // 处理答案选择
  const handleSelect = (answer: number) => {
    if (gameState !== "playing" || feedback !== "none" || !currentProblem) return;

    setSelectedAnswer(answer);

    if (answer === currentProblem.answer) {
      // Correct answer
      setFeedback("correct");
      setScore((s) => s + 1);
      setCorrectCount((c) => c + 1);

      feedbackTimerRef.current = setTimeout(() => {
        nextProblem();
      }, 300);
    } else {
      // Wrong answer
      setFeedback("wrong");
      if (gameMode === "death") {
        // In death mode: wrong answer ends game immediately
        feedbackTimerRef.current = setTimeout(() => {
          handleGameOver();
        }, 500);
      } else {
        // In timed mode: continue to next problem
        feedbackTimerRef.current = setTimeout(() => {
          nextProblem();
        }, 500);
      }
    }
  };

  // 游戏结束
  const handleGameOver = () => {
    clearAllTimers();
    const finalCorrectCount = correctCountRef.current;
    Taro.setStorageSync("mental_math_last_score", finalCorrectCount);
    addPointsToPet("mental-math", finalCorrectCount);
    setGameState("gameover");
    updateHighScore(finalCorrectCount);
  };

  // 获取选项样式
  const getOptionClass = (option: number): string => {
    if (selectedAnswer === null || feedback === "none") return "option-item";
    if (option === currentProblem?.answer) return "option-item option-correct";
    if (option === selectedAnswer && feedback === "wrong") return "option-item option-wrong";
    return "option-item";
  };

  return (
    <View className="game-container">
      {/* ---------------- START SCREEN ---------------- */}
      {gameState === "start" && (
        <View className="start-screen">
          <View className="header-section">
            <View className="logo-container">
              <View className="logo-icon">
                <Text className="logo-emoji">🧮</Text>
              </View>
            </View>
            <Text className="game-title">速算挑战</Text>
            <Text className="game-subtitle">30秒内尽可能答对更多题目</Text>

            <View className="high-score-badge">
              <View className="high-score-icon">
                <Text className="high-score-icon-text">🏆</Text>
              </View>
              <View className="high-score-content">
                <Text className="high-score-label">历史最高分</Text>
                <Text className="high-score-value">{getHighScore()}</Text>
              </View>
            </View>

            <View className="difficulty-info">
              <Text className="difficulty-text">
                当前难度：Lv{getDifficultyLevel()} · 随最高分自动提升
              </Text>
            </View>
          </View>

          {/* 模式选择 */}
          <View className="mode-section">
            <View className="mode-header">
              <View className="mode-icon">
                <Text className="mode-icon-text">🎮</Text>
              </View>
              <Text className="mode-title">选择模式</Text>
            </View>
            <View className="mode-grid">
              <View
                className={`mode-item ${gameMode === "timed" ? "mode-item-selected" : ""}`}
                onClick={() => setGameMode("timed")}
              >
                <View className="mode-name">限时模式</View>
                <View className="mode-desc">30秒倒计时</View>
              </View>
              <View
                className={`mode-item ${gameMode === "death" ? "mode-item-selected" : ""}`}
                onClick={() => setGameMode("death")}
              >
                <View className="mode-name">闯关模式</View>
                <View className="mode-desc">错一题就结束</View>
              </View>
            </View>
          </View>

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
                <Text className="rule-text">{gameMode === "timed" ? "30秒限时，越快越准越好" : "连续闯关，错一题结束"}</Text>
              </View>
              <View className="rule-item">
                <Text className="rule-number">2.</Text>
                <Text className="rule-text">点击四个选项中正确的答案</Text>
              </View>
              <View className="rule-item">
                <Text className="rule-number">3.</Text>
                <Text className="rule-text">{gameMode === "timed" ? "答错不结束，继续挑战下一题" : "答对一题进一关，答错立即结束"}</Text>
              </View>
              <View className="rule-item">
                <Text className="rule-number">4.</Text>
                <Text className="rule-text">难度随最高分自动提升</Text>
              </View>
            </View>
          </View>

          <View className="start-button-container">
            <View className="start-button" onClick={startGame}>
              <Text className="start-button-text">开始挑战</Text>
            </View>
          </View>
        </View>
      )}

      {/* ---------------- PLAYING SCREEN ---------------- */}
      {gameState === "playing" && currentProblem && (
        <View className="game-screen">
          <View className="top-bar">
            {gameMode === "timed" && (
              <View className="top-bar-item">
                <View className="top-bar-icon top-bar-icon-clock">
                  <Text className="top-bar-icon-text">⏱️</Text>
                </View>
                <Text className="top-bar-text">{Math.ceil(timeLeft)}s</Text>
              </View>
            )}
            <View className="top-bar-item">
              <View className="top-bar-icon top-bar-icon-trophy">
                <Text className="top-bar-icon-text">✅</Text>
              </View>
              <Text className="top-bar-text">{correctCount} 题</Text>
            </View>
          </View>

          {gameMode === "timed" && (
            <View className="progress-bar">
              <View
                className="progress-bar-fill"
                style={{
                  width: `${(timeLeft / 30) * 100}%`,
                }}
              />
            </View>
          )}

          {gameMode === "death" && (
            <View className="streak-progress">
              <Text className="streak-text">当前连对: {correctCount} 题</Text>
            </View>
          )}

          <View className="problem-card">
            <Text className="question-text">{currentProblem.question}</Text>
          </View>

          <View className="options-grid">
            {options.map((option) => (
              <View
                key={option}
                className={getOptionClass(option)}
                onClick={() => handleSelect(option)}
              >
                <Text className="option-text">{option}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ---------------- GAME OVER SCREEN ---------------- */}
      {gameState === "gameover" && (
        <View className="gameover-screen">
          <View className="gameover-icon-container">
            <Text className="gameover-icon">🏆</Text>
          </View>

          <Text className="gameover-title">{gameMode === "timed" ? "时间到！" : "闯关失败"}</Text>
          <Text className="gameover-subtitle">{gameMode === "timed" ? "挑战完成" : "本次闯关结束"}</Text>

          <View className="score-card">
            <Text className="score-label">连续答对</Text>
            <Text className="score-value">{correctCount}</Text>
            {isNewRecord && correctCount > 0 && (
              <View className="new-record-badge">
                <Text className="new-record-text">✨ 新纪录 NEW RECORD ✨</Text>
              </View>
            )}
          </View>

          <View className="stats-grid">
            <View className="stat-item">
              <Text className="stat-label">当前等级</Text>
              <Text className="stat-value">Lv{getDifficultyLevel()}</Text>
            </View>
            <View className="stat-item">
              <Text className="stat-label">历史最高</Text>
              <Text className="stat-value">{getHighScore()} 题</Text>
            </View>
          </View>

          <View className="tips-card">
            <View className="tips-header">
              <Text className="tips-icon">💡</Text>
              <Text className="tips-title">训练技巧</Text>
            </View>
            <View className="tips-list">
              <Text className="tips-item">• 每天坚持训练可以提升心算速度</Text>
              <Text className="tips-item">• 尝试心算而不是逐位计算</Text>
              <Text className="tips-item">• 正确率比速度更重要</Text>
            </View>
          </View>

          <View className="restart-button" onClick={startGame}>
            <Text className="restart-button-text">再来一局</Text>
          </View>

          <View className="back-home-button" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
            <Text className="back-home-button-text">返回游戏主页</Text>
          </View>
        </View>
      )}
    </View>
  );
}
