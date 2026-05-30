import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  recordTrainingSession,
  type TrainingDifficulty,
} from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import {
  createNumberOrderSession,
  NUMBER_ORDER_TOTAL_QUESTIONS,
  scoreNumberOrderQuestion,
  type NumberOrderQuestion,
  type NumberOrderQuestionResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "ready" | "revealing" | "answering" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "number_order_best";
const READY_MS = 520;
const FEEDBACK_MS = 880;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function NumberOrder() {
  usePageShare("pages/number-order/index");

  const [phase, setPhase] = useState<Phase>("start");
  const [rewardDifficulty, setRewardDifficulty] = useState<TrainingDifficulty>("normal");
  const [best, setBest] = useState(0);
  const [questions, setQuestions] = useState<NumberOrderQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tappedIds, setTappedIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correctQuestions, setCorrectQuestions] = useState(0);
  const [lastResult, setLastResult] = useState<NumberOrderQuestionResult | null>(null);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);

  const currentQuestion = questions[currentIndex] ?? null;
  const visibleNumbers = phase === "revealing" || phase === "feedback";
  const answerProgress = currentQuestion ? `${Math.min(tappedIds.length + 1, currentQuestion.answerIds.length)}/${currentQuestion.answerIds.length}` : "0/0";

  const clearTimers = () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timersRef.current.push(timer);
  };

  const refreshBest = useCallback(() => {
    setBest(readBestScore(rewardDifficulty));
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
      clearTimers();
    };
  }, []);

  const finishGame = useCallback((finalScore: number, finalCorrectQuestions: number) => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    clearTimers();

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const nextAwardedPoints = getAwardedPoints("number-order", finalScore, rewardDifficulty);
    addPointsToPet("number-order", finalScore, rewardDifficulty);
    recordTrainingSession({
      gameId: "number-order",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty: rewardDifficulty,
      outcome: "completed",
    });

    setAwardedPoints(nextAwardedPoints);
    setCorrectQuestions(finalCorrectQuestions);
    setPhase("finished");

    if (finalScore > best) {
      Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${rewardDifficulty}`, finalScore);
      setBest(finalScore);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }
  }, [best, rewardDifficulty]);

  const beginQuestion = useCallback((questionIndex: number) => {
    clearTimers();
    setCurrentIndex(questionIndex);
    setTappedIds([]);
    setLastResult(null);
    setPhase("ready");

    schedule(() => {
      setPhase("revealing");
      const question = questions[questionIndex];
      schedule(() => {
        setPhase("answering");
      }, question?.revealMs ?? 1600);
    }, READY_MS);
  }, [questions]);

  const settleQuestion = useCallback((nextTappedIds: string[]) => {
    if (!currentQuestion || phase !== "answering") {
      return;
    }

    const result = scoreNumberOrderQuestion({
      question: currentQuestion,
      tappedIds: nextTappedIds,
      currentCombo: combo,
    });
    const nextScore = score + result.score;
    const nextCombo = result.allCorrect ? combo + 1 : 0;
    const nextCorrectQuestions = correctQuestions + (result.allCorrect ? 1 : 0);

    setTappedIds(nextTappedIds);
    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setCorrectQuestions(nextCorrectQuestions);
    setPhase("feedback");

    schedule(() => {
      if (currentIndex >= NUMBER_ORDER_TOTAL_QUESTIONS - 1) {
        finishGame(nextScore, nextCorrectQuestions);
        return;
      }

      beginQuestion(currentIndex + 1);
    }, FEEDBACK_MS);
  }, [
    beginQuestion,
    combo,
    correctQuestions,
    currentIndex,
    currentQuestion,
    finishGame,
    phase,
    score,
  ]);

  const startGame = () => {
    clearTimers();
    const nextQuestions = createNumberOrderSession(rewardDifficulty);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setQuestions(nextQuestions);
    setCurrentIndex(0);
    setTappedIds([]);
    setScore(0);
    setCombo(0);
    setCorrectQuestions(0);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    setPhase("ready");

    schedule(() => {
      setPhase("revealing");
      schedule(() => {
        setPhase("answering");
      }, nextQuestions[0].revealMs);
    }, READY_MS);
  };

  const backToStart = () => {
    clearTimers();
    setPhase("start");
    setQuestions([]);
    setCurrentIndex(0);
    setTappedIds([]);
    setScore(0);
    setCombo(0);
    setCorrectQuestions(0);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    finishedRef.current = false;
    refreshBest();
  };

  const handlePointTap = (pointId: string) => {
    if (phase !== "answering" || !currentQuestion || tappedIds.includes(pointId)) {
      return;
    }

    const nextTappedIds = [...tappedIds, pointId];
    const expectedId = currentQuestion.answerIds[tappedIds.length];

    if (pointId !== expectedId || nextTappedIds.length === currentQuestion.answerIds.length) {
      settleQuestion(nextTappedIds);
      return;
    }

    setTappedIds(nextTappedIds);
  };

  const accuracyText = useMemo(() => {
    return `${Math.round((correctQuestions / NUMBER_ORDER_TOTAL_QUESTIONS) * 100)}%`;
  }, [correctQuestions]);

  const renderDifficultyCard = (difficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`difficulty-card ${rewardDifficulty === difficulty ? "difficulty-card-active" : ""}`}
      onClick={() => setRewardDifficulty(difficulty)}
    >
      <Text className="difficulty-name">{getTrainingDifficultyLabel(difficulty)}</Text>
      <Text className="difficulty-copy">{copy}</Text>
    </View>
  );

  return (
    <View className="number-order-page">
      {phase === "start" ? (
        <View className="start-screen">
          <View className="hero-panel">
            <Text className="hero-kicker">空间工作记忆</Text>
            <Text className="hero-title">星图排序</Text>
            <Text className="hero-copy">记住星点数字，隐藏后按从小到大依次点亮。</Text>
            <View className="best-pill">
              <Text className="best-label">当前难度最高</Text>
              <Text className="best-value">{best}</Text>
            </View>
          </View>

          <View className="info-panel">
            <Text className="section-title">训练规则</Text>
            <Text className="rule-line">1. 每局 8 题，先看数字星点。</Text>
            <Text className="rule-line">2. 数字隐藏后，按升序点击位置。</Text>
            <Text className="rule-line">3. 连续整题全对会获得额外连击分。</Text>
          </View>

          <View className="info-panel">
            <Text className="section-title">难度</Text>
            <View className="difficulty-grid">
              {renderDifficultyCard("normal", "4-6 个数字 · 节奏舒展")}
              {renderDifficultyCard("hard", "5-7 个数字 · 展示更短")}
            </View>
          </View>

          <View className="floating-start-action">
            <View className="primary-button" onClick={startGame}>
              <Text className="primary-button-text">开始训练</Text>
            </View>
          </View>
          <View className="floating-start-spacer" />
        </View>
      ) : null}

      {phase !== "start" && phase !== "finished" && currentQuestion ? (
        <View className="play-screen">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{NUMBER_ORDER_TOTAL_QUESTIONS}</Text>
              <Text className="status-label">题目</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{score}</Text>
              <Text className="status-label">得分</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{combo}</Text>
              <Text className="status-label">连击</Text>
            </View>
          </View>

          <View className="prompt-card">
            <Text className="prompt-title">
              {phase === "ready" ? "准备观察星图" : phase === "revealing" ? "记住数字和位置" : phase === "answering" ? `点击第 ${answerProgress} 个星点` : lastResult?.allCorrect ? "整题全对" : "顺序中断"}
            </Text>
            <Text className="prompt-copy">
              {phase === "answering" ? "按从小到大的顺序点击" : phase === "feedback" ? `本题 +${lastResult?.score ?? 0}` : "保持专注，星点马上隐藏"}
            </Text>
          </View>

          <View className={`star-board star-board-${phase}`}>
            {currentQuestion.points.map((point) => {
              const tapped = tappedIds.includes(point.id);
              const wrongTap = phase === "feedback" && tapped && !currentQuestion.answerIds.slice(0, tappedIds.length).includes(point.id);
              return (
                <View
                  key={point.id}
                  className={`star-node ${tapped ? "star-node-tapped" : ""} ${wrongTap ? "star-node-wrong" : ""}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onClick={() => handlePointTap(point.id)}
                >
                  <Text className="star-node-text">{visibleNumbers ? point.value : tapped ? "OK" : ""}</Text>
                </View>
              );
            })}
            <View className="star-board-grid" />
          </View>
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="finished-screen">
          <View className="result-card">
            <Text className="result-kicker">{isNewBest ? "刷新最高分" : "训练完成"}</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">星图排序 · {getTrainingDifficultyLabel(rewardDifficulty)}</Text>
          </View>

          <View className="result-grid">
            <View className="result-item">
              <Text className="result-value">{accuracyText}</Text>
              <Text className="result-label">整题正确率</Text>
            </View>
            <View className="result-item">
              <Text className="result-value">{best}</Text>
              <Text className="result-label">历史最高</Text>
            </View>
            <View className="result-item">
              <Text className="result-value">{awardedPoints}</Text>
              <Text className="result-label">宠物积分</Text>
            </View>
            <View className="result-item">
              <Text className="result-value">{combo}</Text>
              <Text className="result-label">最终连击</Text>
            </View>
          </View>

          <View className="primary-button" onClick={startGame}>
            <Text className="primary-button-text">再玩一局</Text>
          </View>
          <View className="secondary-button" onClick={backToStart}>
            <Text className="secondary-button-text">返回设置</Text>
          </View>
          <View className="secondary-button" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
            <Text className="secondary-button-text">返回首页</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
