import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View } from "@tarojs/components";
import Taro, { useLoad, useDidShow } from "@tarojs/taro";
import { getAwardedPoints, getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { settleGame } from "../../services/gameSettlementService";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { playTap } from "../../services/audio/audioFeedbackService";
import {
  CUSTOM_MATH_STAGE_ID,
  DEFAULT_MATH_STAGE_ID,
  DEFAULT_CUSTOM_MATH_CONFIG,
  MATH_STAGES,
  generateMathOptions,
  generateMathProblem,
  getTimedMentalMathScore,
  getCustomMathProfile,
  getMathStage,
  type CustomMathOperation,
  type CustomMathRangeId,
  type MathProblem,
  type MathStageId,
} from "./mathStages";
import MentalMathPlayPanel from "./components/MentalMathPlayPanel";
import MentalMathResultPanel from "./components/MentalMathResultPanel";
import MentalMathStartPanel, { type MentalMathGameMode } from "./components/MentalMathStartPanel";
import "./index.scss";

type GameState = "start" | "playing" | "gameover";
type GameMode = MentalMathGameMode;

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
  const presetStageId =
    gauntletStageId && MATH_STAGES.some((stage) => stage.id === gauntletStageId)
      ? (gauntletStageId as MathStageId)
      : DEFAULT_MATH_STAGE_ID;

  const [gameState, setGameState] = useState<GameState>("start");
  useAmbientMusic(gameState === "start");
  const [gameMode, setGameMode] = useState<GameMode>(
    gauntletPreset?.mode === "death" ? "death" : "timed",
  );
  const [selectedStageId, setSelectedStageId] = useState<MathStageId>(presetStageId);
  const [customConfig, setCustomConfig] = useState(DEFAULT_CUSTOM_MATH_CONFIG);
  const [highScoreTimed, setHighScoreTimed] = useState(0);
  const [highScoreDeath, setHighScoreDeath] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"none" | "correct" | "wrong">("none");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const correctCountRef = useRef(0);
  const scoreRef = useRef(0);
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

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Clear all pending timers
  const clearAllTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Get current high score based on selected mode
  const getHighScore = () => {
    return gameMode === "timed" ? highScoreTimed : highScoreDeath;
  };

  // 生成数学题
  // 获取存储键名 based on mode and stage
  const getStorageKey = useCallback((): string => {
    return `mental_math_high_score_${gameMode}_${selectedStageId}`;
  }, [gameMode, selectedStageId]);

  // 获取当前最高分
  const getCurrentHighScore = useCallback((): HighScoreRecord | null => {
    const key = getStorageKey();
    const legacyKey =
      gameMode === "timed" ? "mental_math_high_score_timed" : "mental_math_high_score_death";
    const record =
      Taro.getStorageSync(key) ||
      (selectedStageId === DEFAULT_MATH_STAGE_ID ? Taro.getStorageSync(legacyKey) : "");
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
  }, [gameMode, getStorageKey, selectedStageId]);

  // 更新最高分
  const updateHighScore = useCallback(
    (newScore: number): boolean => {
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
    },
    [gameMode, getCurrentHighScore, getStorageKey],
  );

  // 刷新最高分
  const refreshHighScore = useCallback(() => {
    // Load both high scores for both modes
    const timedKey = `mental_math_high_score_timed_${selectedStageId}`;
    const deathKey = `mental_math_high_score_death_${selectedStageId}`;

    const timedRecord =
      Taro.getStorageSync(timedKey) ||
      (selectedStageId === DEFAULT_MATH_STAGE_ID
        ? Taro.getStorageSync("mental_math_high_score_timed")
        : "");
    const deathRecord =
      Taro.getStorageSync(deathKey) ||
      (selectedStageId === DEFAULT_MATH_STAGE_ID
        ? Taro.getStorageSync("mental_math_high_score_death")
        : "");

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
  }, [selectedStageId]);

  const getEffectiveScoreForPoints = useCallback(
    (rawScore: number) => {
      return isCustomStage ? rawScore * customProfile.coefficient : rawScore;
    },
    [customProfile.coefficient, isCustomStage],
  );

  const getTrainingModeRecord = useCallback(() => {
    if (!isCustomStage) {
      return `${gameMode}:${selectedStageId}`;
    }
    return `${gameMode}:${CUSTOM_MATH_STAGE_ID}:${customProfile.operationsKey}:${customProfile.rangeKey}:x${customProfile.coefficient}`;
  }, [
    customProfile.coefficient,
    customProfile.operationsKey,
    customProfile.rangeKey,
    gameMode,
    isCustomStage,
    selectedStageId,
  ]);

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
      const orderedOperations = (
        ["add", "subtract", "multiply", "divide"] satisfies CustomMathOperation[]
      ).filter((item) => nextOperations.includes(item));
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
    return stageId === CUSTOM_MATH_STAGE_ID
      ? customProfile.difficulty
      : getMathStage(stageId).difficulty;
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

  // 下一题
  const nextProblem = useCallback(() => {
    const problem = generateMathProblem(selectedStageId, customConfig);
    const opts = generateMathOptions(problem.answer);
    setCurrentProblem(problem);
    setOptions(opts);
    setSelectedAnswer(null);
    setFeedback("none");
  }, [customConfig, selectedStageId]);

  // 开始新游戏
  const startGame = useCallback(() => {
    playTap();
    clearAllTimers();
    setTimeLeft(30);
    setCorrectCount(0);
    correctCountRef.current = 0;
    setScore(0);
    scoreRef.current = 0;
    setSelectedAnswer(null);
    setFeedback("none");
    nextProblem();
    setGameState("playing");
  }, [clearAllTimers, nextProblem]);

  useEffect(() => {
    if (!isGauntletPreset || autoStartedRef.current || gameState !== "start") return;
    autoStartedRef.current = true;
    startGame();
  }, [gameState, isGauntletPreset, startGame]);

  // 游戏结束
  const handleGameOver = useCallback(() => {
    clearAllTimers();
    const finalScore = gameMode === "timed" ? scoreRef.current : correctCountRef.current;
    const effectiveScore = getEffectiveScoreForPoints(finalScore);
    const settlement = settleGame({
      gameId: "mental-math",
      score: finalScore,
      rewardScore: effectiveScore,
      mode: getTrainingModeRecord(),
      difficulty: rewardDifficulty,
      outcome: "completed",
    });
    if (settlement.gauntletHandled) {
      return;
    }

    Taro.setStorageSync("mental_math_last_score", finalScore);
    setGameState("gameover");
    updateHighScore(finalScore);
  }, [
    clearAllTimers,
    gameMode,
    getEffectiveScoreForPoints,
    getTrainingModeRecord,
    rewardDifficulty,
    updateHighScore,
  ]);

  // 计时器
  useEffect(() => {
    if (gameState === "playing" && gameMode === "timed") {
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
  }, [gameState, gameMode, handleGameOver]);

  // 处理答案选择
  const handleSelect = (answer: number) => {
    if (gameState !== "playing" || feedback !== "none" || !currentProblem) return;

    setSelectedAnswer(answer);

    if (answer === currentProblem.answer) {
      // Correct answer
      setFeedback("correct");
      setCorrectCount((c) => c + 1);
      setScore((currentScore) => {
        const nextScore = getTimedMentalMathScore(currentScore, true);
        scoreRef.current = nextScore;
        return nextScore;
      });

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
        setScore((currentScore) => {
          const nextScore = getTimedMentalMathScore(currentScore, false);
          scoreRef.current = nextScore;
          return nextScore;
        });
        // In timed mode: continue to next problem
        feedbackTimerRef.current = setTimeout(() => {
          nextProblem();
        }, 500);
      }
    }
  };

  const awardedPoints = getAwardedPoints(
    "mental-math",
    getEffectiveScoreForPoints(score),
    rewardDifficulty,
  );

  return (
    <View className="game-container">
      {gameState === "start" && (
        <MentalMathStartPanel
          highScore={getHighScore()}
          isGauntletPreset={isGauntletPreset}
          gameMode={gameMode}
          selectedStageId={selectedStageId}
          customConfig={customConfig}
          customProfileSummary={customProfile.summary}
          stages={MATH_STAGES}
          getStageDifficulty={getStageDifficulty}
          getDifficultyLabel={getTrainingDifficultyLabel}
          onStageChange={setSelectedStageId}
          onModeChange={setGameMode}
          onToggleCustomOperation={handleToggleCustomOperation}
          onSelectCustomRange={handleSelectCustomRange}
          onStart={startGame}
        />
      )}

      {gameState === "playing" && currentProblem && (
        <MentalMathPlayPanel
          gameMode={gameMode}
          stageTitle={selectedStage.name}
          stageShortName={selectedStageShortName}
          timeLeft={timeLeft}
          score={score}
          correctCount={correctCount}
          currentProblem={currentProblem}
          options={options}
          selectedAnswer={selectedAnswer}
          feedback={feedback}
          onSelect={handleSelect}
        />
      )}

      {gameState === "gameover" && (
        <MentalMathResultPanel
          score={score}
          correctCount={correctCount}
          gameMode={gameMode}
          stageTitle={selectedStage.name}
          stageShortName={selectedStageShortName}
          difficultyLabel={getTrainingDifficultyLabel(rewardDifficulty)}
          awardedPoints={awardedPoints}
          highScore={getHighScore()}
          isNewRecord={isNewRecord}
          isGauntlet={isGauntletPreset}
          onRestart={startGame}
          onBackToStart={() => setGameState("start")}
          onBackHome={() => Taro.reLaunch({ url: "/pages/index/index" })}
        />
      )}
    </View>
  );
}
