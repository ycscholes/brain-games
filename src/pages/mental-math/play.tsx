import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import GameRouteBack from "../../components/game-route/GameRouteBack";
import { usePageShare } from "../../utils/share";
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
  type MathProblem,
  type MathStageId,
} from "./mathStages";
import MentalMathPlayPanel from "./components/MentalMathPlayPanel";
import { type MentalMathGameMode } from "./components/MentalMathStartPanel";
import { abandonMentalMathRun, readMentalMathRun, settleMentalMathCompletion } from "./run";
import "./index.scss";

type GameState = "playing";
type GameMode = MentalMathGameMode;

// 最高分记录接口
interface HighScoreRecord {
  score: number;
  achievedAt: string;
}

export default function MentalMath() {
  usePageShare("pages/mental-math/index");
  const gauntletPreset = readGameGauntletModePreset();
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = readMentalMathRun(runId);

  useEffect(() => {
    if (!runId || !routeRun || routeRun.status !== "active") {
      void Taro.redirectTo({ url: "/pages/mental-math/index" });
    }
  }, [routeRun, runId]);
  const gauntletStageId = gauntletPreset?.stageId;
  const presetStageId =
    gauntletStageId && MATH_STAGES.some((stage) => stage.id === gauntletStageId)
      ? (gauntletStageId as MathStageId)
      : DEFAULT_MATH_STAGE_ID;
  const routeStageId = routeRun?.payload.stageId;
  const initialStageId =
    routeStageId && MATH_STAGES.some((stage) => stage.id === routeStageId)
      ? routeStageId
      : presetStageId;

  const [gameState] = useState<GameState>("playing");
  const [gameMode] = useState<GameMode>(
    routeRun?.payload.mode ?? (gauntletPreset?.mode === "death" ? "death" : "timed"),
  );
  const [selectedStageId] = useState<MathStageId>(initialStageId);
  const [customConfig] = useState(routeRun?.payload.customConfig ?? DEFAULT_CUSTOM_MATH_CONFIG);
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
        return true;
      }
      return false;
    },
    [getCurrentHighScore, getStorageKey],
  );

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
  }, [clearAllTimers, nextProblem]);

  useEffect(() => {
    if (!routeRun || routeRun.status !== "active" || autoStartedRef.current) return;
    autoStartedRef.current = true;
    startGame();
  }, [routeRun, startGame]);

  // 游戏结束
  const handleGameOver = useCallback(() => {
    clearAllTimers();
    const finalScore = gameMode === "timed" ? scoreRef.current : correctCountRef.current;
    const effectiveScore = getEffectiveScoreForPoints(finalScore);
    const settlementInput = {
      gameId: "mental-math",
      score: finalScore,
      rewardScore: effectiveScore,
      mode: getTrainingModeRecord(),
      difficulty: rewardDifficulty,
      outcome: "completed",
    } as const;
    const nextIsNewBest = updateHighScore(finalScore);
    const routeSettlement = runId
      ? settleMentalMathCompletion(
          runId,
          {
            score: finalScore,
            awardedPoints: 0,
            durationSeconds: Math.max(
              1,
              Math.round((Date.now() - (routeRun?.payload.startedAt ?? Date.now())) / 1_000),
            ),
            correctCount: correctCountRef.current,
            isNewBest: nextIsNewBest,
          },
          settlementInput,
        )
      : null;
    const settlement = routeSettlement?.settlement ?? null;
    if (!settlement) return;
    if (settlement.gauntletHandled) {
      return;
    }

    void Taro.redirectTo({ url: `/pages/mental-math/result?runId=${encodeURIComponent(runId)}` });
  }, [
    clearAllTimers,
    gameMode,
    getEffectiveScoreForPoints,
    getTrainingModeRecord,
    rewardDifficulty,
    routeRun,
    runId,
    updateHighScore,
  ]);

  const handleRouteBack = useCallback(() => {
    if (!runId || !routeRun || routeRun.status !== "active") return;
    abandonMentalMathRun(runId, {
      gameId: "mental-math",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - routeRun.payload.startedAt) / 1_000)),
      mode: `${routeRun.payload.mode}:${routeRun.payload.stageId}`,
      difficulty: routeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [routeRun, runId]);
  useUnload(handleRouteBack);

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

  return (
    <View className="game-container">
      <GameRouteBack gameId="mental-math" runId={runId} onAbandon={handleRouteBack} />

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
    </View>
  );
}
