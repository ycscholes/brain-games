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
  getRouteValues,
  NUMBER_ORDER_TOTAL_QUESTIONS,
  scoreNumberOrderQuestion,
  type NumberOrderQuestion,
  type NumberOrderQuestionResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "ready" | "revealing" | "answering" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "number_order_best";
const READY_MS = 520;
const FEEDBACK_MS = 1500;

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
  const [bestCombo, setBestCombo] = useState(0);
  const [masteredRules, setMasteredRules] = useState<string[]>([]);
  const [correctQuestions, setCorrectQuestions] = useState(0);
  const [lastResult, setLastResult] = useState<NumberOrderQuestionResult | null>(null);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);

  const currentQuestion = questions[currentIndex] ?? null;
  const answerProgress = currentQuestion ? `${Math.min(tappedIds.length + 1, currentQuestion.answerIds.length)}/${currentQuestion.answerIds.length}` : "0/0";
  const routeValues = currentQuestion ? getRouteValues(currentQuestion) : [];
  const routeValueText = routeValues.join(" -> ");
  const masteredRuleText = masteredRules.length > 0 ? masteredRules.join(" / ") : "继续探索";

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
    const nextBestCombo = Math.max(bestCombo, nextCombo);
    const nextMasteredRules = result.allCorrect && !masteredRules.includes(currentQuestion.routeRule.shortLabel)
      ? [...masteredRules, currentQuestion.routeRule.shortLabel]
      : masteredRules;
    const nextCorrectQuestions = correctQuestions + (result.allCorrect ? 1 : 0);

    setTappedIds(nextTappedIds);
    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(nextBestCombo);
    setMasteredRules(nextMasteredRules);
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
    bestCombo,
    combo,
    correctQuestions,
    currentIndex,
    currentQuestion,
    finishGame,
    masteredRules,
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
    setBestCombo(0);
    setMasteredRules([]);
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
    setBestCombo(0);
    setMasteredRules([]);
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

  const renderRouteSegment = (
    fromPoint: NumberOrderQuestion["points"][number] | undefined,
    toPoint: NumberOrderQuestion["points"][number] | undefined,
    className: string,
    key: string,
  ) => {
    if (!fromPoint || !toPoint) {
      return null;
    }

    const deltaX = toPoint.x - fromPoint.x;
    const deltaY = toPoint.y - fromPoint.y;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

    return (
      <View
        key={key}
        className={className}
        style={{
          left: `${fromPoint.x}%`,
          top: `${fromPoint.y}%`,
          width: `${length}%`,
          transform: `rotate(${angle}deg)`,
        }}
      />
    );
  };

  return (
    <View className="number-order-page">
      {phase === "start" ? (
        <View className="start-screen">
          <View className="hero-panel">
            <Text className="hero-kicker">空间工作记忆</Text>
            <Text className="hero-title">星图排序</Text>
            <Text className="hero-copy">记住星点线索，按航线规则点亮星路。</Text>
            <View className="route-preview" aria-hidden>
              <View className="preview-line preview-line-one" />
              <View className="preview-line preview-line-two" />
              <Text className="preview-star preview-star-one">4</Text>
              <Text className="preview-star preview-star-two">9</Text>
              <Text className="preview-star preview-star-three">12</Text>
              <Text className="preview-star preview-star-four">18</Text>
            </View>
            <View className="best-pill">
              <Text className="best-label">当前难度最高</Text>
              <Text className="best-value">{best}</Text>
            </View>
          </View>

          <View className="info-panel">
            <Text className="section-title">训练规则</Text>
            <Text className="rule-line">1. 看清数字、颜色和亮度线索。</Text>
            <Text className="rule-line">2. 线索隐藏后，按当前航线规则点亮。</Text>
            <Text className="rule-line">3. 回放会展示正确星路和本题得分。</Text>
          </View>

          <View className="info-panel">
            <Text className="section-title">难度</Text>
            <View className="difficulty-grid">
              {renderDifficultyCard("normal", "规则逐步加入 · 观察时间更宽")}
              {renderDifficultyCard("hard", "多规则混合 · 星点更多")}
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
              {phase === "ready"
                ? "准备观察星图"
                : phase === "revealing"
                  ? currentQuestion.routeRule.title
                  : phase === "answering"
                    ? `点亮第 ${answerProgress} 颗星`
                    : lastResult?.allCorrect
                      ? "星路完成"
                      : "星路中断"}
            </Text>
            <Text className="prompt-copy">
              {phase === "answering"
                ? currentQuestion.routeRule.description
                : phase === "feedback"
                  ? `${currentQuestion.replayText} · 本题 +${lastResult?.score ?? 0}`
                  : "保持专注，星点线索马上隐藏"}
            </Text>
          </View>

          <View className={`star-board star-board-${phase}`}>
            {tappedIds.slice(1).map((pointId, index) => {
              const fromPoint = currentQuestion.points.find((point) => point.id === tappedIds[index]);
              const toPoint = currentQuestion.points.find((point) => point.id === pointId);
              return renderRouteSegment(
                fromPoint,
                toPoint,
                "route-segment route-segment-player",
                `${tappedIds[index]}-${pointId}`,
              );
            })}
            {phase === "feedback" ? currentQuestion.answerIds.slice(1).map((pointId, index) => {
              const fromPoint = currentQuestion.points.find((point) => point.id === currentQuestion.answerIds[index]);
              const toPoint = currentQuestion.points.find((point) => point.id === pointId);
              return renderRouteSegment(
                fromPoint,
                toPoint,
                "route-segment route-segment-answer",
                `answer-${currentQuestion.answerIds[index]}-${pointId}`,
              );
            }) : null}
            {currentQuestion.points.map((point) => {
              const tapped = tappedIds.includes(point.id);
              const expectedPrefix = currentQuestion.answerIds.slice(0, tappedIds.length);
              const wrongTap = phase === "feedback" && tapped && !expectedPrefix.includes(point.id);
              const shouldShowValue = phase === "revealing" || phase === "feedback";
              return (
                <View
                  key={point.id}
                  className={`star-node star-node-${point.colorGroup} star-node-${point.brightness} ${tapped ? "star-node-tapped" : ""} ${wrongTap ? "star-node-wrong" : ""}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onClick={() => handlePointTap(point.id)}
                >
                  <Text className="star-node-text">{shouldShowValue ? point.value : tapped ? "✓" : ""}</Text>
                </View>
              );
            })}
            <View className="star-board-grid" />
          </View>

          {phase === "feedback" ? (
            <View className="route-replay-card">
              <Text className="route-replay-label">正确星路</Text>
              <Text className="route-replay-values">{routeValueText}</Text>
            </View>
          ) : null}
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
              <Text className="result-value">{bestCombo}</Text>
              <Text className="result-label">最佳连击</Text>
            </View>
            <View className="result-item">
              <Text className="result-value">{correctQuestions}/{NUMBER_ORDER_TOTAL_QUESTIONS}</Text>
              <Text className="result-label">完成航线</Text>
            </View>
            <View className="result-item result-item-wide">
              <Text className="result-value result-value-small">{masteredRuleText}</Text>
              <Text className="result-label">掌握规则</Text>
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
