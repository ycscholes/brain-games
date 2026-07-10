import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useLoad, useDidShow } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  recordTrainingSession,
} from "../../utils/trainingStorage";
import { completeGauntletLegIfNeeded, readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { playTap } from "../../services/audio/audioFeedbackService";
import {
  CUSTOM_MATH_STAGE_ID,
  CUSTOM_OPERATION_OPTIONS,
  CUSTOM_RANGE_OPTIONS,
  DEFAULT_MATH_STAGE_ID,
  DEFAULT_CUSTOM_MATH_CONFIG,
  MATH_STAGES,
  generateMathOptions,
  generateMathProblem,
  getCustomMathProfile,
  getMathStage,
  type CustomMathOperation,
  type CustomMathRangeId,
  type MathProblem,
  type MathStageId,
} from "./mathStages";
import "./index.scss";

type GameState = "start" | "playing" | "gameover";
type GameMode = "timed" | "death";

// 最高分记录接口
interface HighScoreRecord {
  score: number;
  achievedAt: string;
}

export default function MentalMath() {
  usePageShare("pages/mental-math/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;
  const gauntletStageId = gauntletPreset?.stageId;
  const presetStageId = gauntletStageId && MATH_STAGES.some((stage) => stage.id === gauntletStageId)
    ? gauntletStageId as MathStageId
    : DEFAULT_MATH_STAGE_ID;

  const [gameState, setGameState] = useState<GameState>("start");
  useAmbientMusic(gameState === "start");
  const [gameMode, setGameMode] = useState<GameMode>(gauntletPreset?.mode === "death" ? "death" : "timed");
  const [selectedStageId, setSelectedStageId] = useState<MathStageId>(presetStageId);
  const [customConfig, setCustomConfig] = useState(DEFAULT_CUSTOM_MATH_CONFIG);
  const [highScoreTimed, setHighScoreTimed] = useState(0);
  const [highScoreDeath, setHighScoreDeath] = useState(0);
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
  const autoStartedRef = useRef(false);
  const selectedStage = useMemo(() => getMathStage(selectedStageId), [selectedStageId]);
  const customProfile = useMemo(() => getCustomMathProfile(customConfig), [customConfig]);
  const isCustomStage = selectedStageId === CUSTOM_MATH_STAGE_ID;
  const rewardDifficulty = isCustomStage ? customProfile.difficulty : selectedStage.difficulty;
  const selectedStageShortName = isCustomStage ? customProfile.summary : selectedStage.shortName;

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

  // 生成数学题
  const generateProblem = (): MathProblem => {
    return generateMathProblem(selectedStageId, customConfig);
  };

  // 生成选项
  const generateOptions = (correctAnswer: number): number[] => {
    return generateMathOptions(correctAnswer);
  };

  // 获取存储键名 based on mode and stage
  const getStorageKey = (): string => {
    return `mental_math_high_score_${gameMode}_${selectedStageId}`;
  };

  // 获取当前最高分
  const getCurrentHighScore = (): HighScoreRecord | null => {
    const key = getStorageKey();
    const legacyKey = gameMode === "timed" ? "mental_math_high_score_timed" : "mental_math_high_score_death";
    const record = Taro.getStorageSync(key) || (selectedStageId === DEFAULT_MATH_STAGE_ID ? Taro.getStorageSync(legacyKey) : "");
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
    const timedKey = `mental_math_high_score_timed_${selectedStageId}`;
    const deathKey = `mental_math_high_score_death_${selectedStageId}`;

    const timedRecord =
      Taro.getStorageSync(timedKey) ||
      (selectedStageId === DEFAULT_MATH_STAGE_ID ? Taro.getStorageSync("mental_math_high_score_timed") : "");
    const deathRecord =
      Taro.getStorageSync(deathKey) ||
      (selectedStageId === DEFAULT_MATH_STAGE_ID ? Taro.getStorageSync("mental_math_high_score_death") : "");

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

  }, [gameMode, selectedStageId]);

  const getEffectiveScoreForPoints = (score: number) => {
    return isCustomStage ? score * customProfile.coefficient : score;
  };

  const getTrainingModeRecord = () => {
    if (!isCustomStage) {
      return `${gameMode}:${selectedStageId}`;
    }
    return `${gameMode}:${CUSTOM_MATH_STAGE_ID}:${customProfile.operationsKey}:${customProfile.rangeKey}:x${customProfile.coefficient}`;
  };

  const handleToggleCustomOperation = (operation: CustomMathOperation | "all") => {
    if (operation === "all") {
      setCustomConfig((config) => ({
        ...config,
        operations: ["add", "subtract", "multiply", "divide"],
      }));
      return;
    }

    setCustomConfig((config) => {
      const hasOperation = config.operations.includes(operation);
      if (hasOperation && config.operations.length === 1) {
        return config;
      }
      const nextOperations = hasOperation
        ? config.operations.filter((item) => item !== operation)
        : [...config.operations, operation];
      const orderedOperations = (["add", "subtract", "multiply", "divide"] satisfies CustomMathOperation[]).filter((item) =>
        nextOperations.includes(item),
      );
    return {
      ...config,
      operations: orderedOperations,
    };
  });
};

const handleSelectCustomRange = (rangeId: CustomMathRangeId) => {
  setCustomConfig((config) => ({
    ...config,
    rangeId,
  }));
};

const getStageDifficulty = (stageId: MathStageId) => {
  return stageId === CUSTOM_MATH_STAGE_ID ? customProfile.difficulty : getMathStage(stageId).difficulty;
};

// Update high scores when mode or stage changes
useEffect(() => {
  refreshHighScore();
}, [refreshHighScore]);

useLoad(() => {
  refreshHighScore();
});

useDidShow(() => {
  refreshHighScore();
});

// 开始新游戏
const startGame = () => {
  playTap();
  clearAllTimers();
  setTimeLeft(30);
  setCorrectCount(0);
  setSelectedAnswer(null);
  setFeedback("none");
  nextProblem();
  setGameState("playing");
};

useEffect(() => {
  if (!isGauntletPreset || autoStartedRef.current || gameState !== "start") return;
  autoStartedRef.current = true;
  startGame();
}, [gameState, isGauntletPreset]);

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
  const effectiveScore = getEffectiveScoreForPoints(finalCorrectCount);
  const awardedPoints = getAwardedPoints("mental-math", effectiveScore, rewardDifficulty);
  if (completeGauntletLegIfNeeded({
    gameId: "mental-math",
    score: finalCorrectCount,
    awardedPoints,
    mode: getTrainingModeRecord(),
    difficulty: rewardDifficulty,
    outcome: "completed",
  })) {
    return;
  }

  Taro.setStorageSync("mental_math_last_score", finalCorrectCount);
  addPointsToPet("mental-math", effectiveScore, rewardDifficulty);
  recordTrainingSession({
    gameId: "mental-math",
    score: finalCorrectCount,
    awardedPoints,
    mode: getTrainingModeRecord(),
    difficulty: rewardDifficulty,
    outcome: "completed",
  });
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

          <View className="high-score-badge">
            <View className="high-score-icon">
              <Text className="high-score-icon-text">🏆</Text>
            </View>
            <View className="high-score-content">
              <Text className="high-score-label">历史最高分</Text>
              <Text className="high-score-value">{getHighScore()}</Text>
            </View>
          </View>
        </View>

        {!isGauntletPreset && (
        <View className="mode-section">
          <View className="mode-header">
            <View className="mode-icon">
              <Text className="mode-icon-text">⚡</Text>
            </View>
            <Text className="mode-title">选择训练内容</Text>
          </View>
          <View className="stage-grid">
            {MATH_STAGES.map((stage) => (
              <View
                key={stage.id}
                className={`stage-item ${selectedStageId === stage.id ? "stage-item-selected" : ""}`}
                onClick={() => setSelectedStageId(stage.id)}
              >
                <View className="stage-item-header">
                  <Text className="stage-name">{stage.name}</Text>
                  <Text className={`stage-difficulty stage-difficulty-${getStageDifficulty(stage.id)}`}>
                    积分{getTrainingDifficultyLabel(getStageDifficulty(stage.id))}
                  </Text>
                </View>
                <Text className="stage-short-name">{stage.id === CUSTOM_MATH_STAGE_ID ? customProfile.summary : stage.shortName}</Text>
                <Text className="stage-desc">{stage.id === CUSTOM_MATH_STAGE_ID ? `积分系数 x${customProfile.coefficient}` : stage.summary}</Text>
              </View>
            ))}
          </View>
          {isCustomStage && (
            <View className="custom-panel">
              <View className="custom-group">
                <Text className="custom-label">运算</Text>
                <View className="custom-chip-row">
                  {CUSTOM_OPERATION_OPTIONS.map((operation) => {
                    const selected =
                      operation.id === "all"
                        ? customConfig.operations.length === 4
                        : customConfig.operations.includes(operation.id);
                    return (
                      <View
                        key={operation.id}
                        className={`custom-chip ${selected ? "custom-chip-selected" : ""}`}
                        onClick={() => handleToggleCustomOperation(operation.id)}
                      >
                        <Text className="custom-chip-text">{operation.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View className="custom-group">
                <Text className="custom-label">数字范围</Text>
                <View className="custom-chip-row">
                  {CUSTOM_RANGE_OPTIONS.map((range) => (
                    <View
                      key={range.id}
                      className={`custom-chip ${customConfig.rangeId === range.id ? "custom-chip-selected" : ""}`}
                      onClick={() => handleSelectCustomRange(range.id)}
                    >
                      <Text className="custom-chip-text">{range.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>
        )}

        {/* 模式选择 */}
        {!isGauntletPreset && (
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
        )}

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
          </View>
        </View>

        <View className="start-button-container floating-start-action">
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
          <View className="top-bar-stage">
            <Text className="top-bar-stage-text">{selectedStage.name} · {selectedStageShortName}</Text>
          </View>
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
      <View className="result-screen">
        <View className="result-card">
          <Text className="result-title">本局成绩</Text>
          <Text className="result-score">{correctCount}</Text>
          <Text className="result-desc">
            答对 {correctCount} 题 · {selectedStage.name} · {selectedStageShortName}
          </Text>
          <Text className="result-desc">
            {gameMode === "timed" ? "限时模式" : "闯关模式"} · 积分{getTrainingDifficultyLabel(rewardDifficulty)}
          </Text>
          <Text className="result-desc">
            获得 {getAwardedPoints("mental-math", getEffectiveScoreForPoints(correctCount), rewardDifficulty)} 积分
            </Text>
          <Text className="result-desc">
            历史最高 {getHighScore()}
            {isNewRecord && correctCount > 0 ? <Text className="result-highlight">，刷新纪录</Text> : null}
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
