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
import { completeGauntletLegIfNeeded } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import {
  createNumberOrderSession,
  getRouteValues,
  isCorrectPathPrefix,
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
const PLAYBACK_END_PAUSE_MS = 260;

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
  const [correctQuestions, setCorrectQuestions] = useState(0);
  const [lastResult, setLastResult] = useState<NumberOrderQuestionResult | null>(null);
  const [activeEchoIndex, setActiveEchoIndex] = useState(-1);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);

  const currentQuestion = questions[currentIndex] ?? null;
  const answerProgress = currentQuestion ? `${Math.min(tappedIds.length + 1, currentQuestion.answerIds.length)}/${currentQuestion.answerIds.length}` : "0/0";
  const routeValues = currentQuestion ? getRouteValues(currentQuestion) : [];
  const routeValueText = routeValues.join(" -> ");
  const longestEchoLength = questions.reduce((max, question) => Math.max(max, question.answerIds.length), 0);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timersRef.current.push(timer);
  }, []);

  const scheduleEchoPlayback = useCallback((question: NumberOrderQuestion) => {
    question.answerIds.forEach((_, index) => {
      schedule(() => {
        setActiveEchoIndex(index);
      }, question.playbackIntervalMs * index);
    });

    schedule(() => {
      setActiveEchoIndex(-1);
      setPhase("answering");
    }, question.revealMs + PLAYBACK_END_PAUSE_MS);
  }, [schedule]);

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
  }, [clearTimers]);

  const finishGame = useCallback((finalScore: number, finalCorrectQuestions: number) => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    clearTimers();

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const nextAwardedPoints = getAwardedPoints("number-order", finalScore, rewardDifficulty);
    if (completeGauntletLegIfNeeded({
      gameId: "number-order",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty: rewardDifficulty,
      outcome: "completed",
    })) {
      return;
    }

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
  }, [best, clearTimers, rewardDifficulty]);

  const beginQuestion = useCallback((questionIndex: number) => {
    clearTimers();
    setCurrentIndex(questionIndex);
    setTappedIds([]);
    setLastResult(null);
    setActiveEchoIndex(-1);
    setPhase("ready");

    schedule(() => {
      setPhase("revealing");
      const question = questions[questionIndex];
      if (question) {
        scheduleEchoPlayback(question);
      }
    }, READY_MS);
  }, [clearTimers, questions, schedule, scheduleEchoPlayback]);

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
    const nextCorrectQuestions = correctQuestions + (result.allCorrect ? 1 : 0);

    setTappedIds(nextTappedIds);
    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(nextBestCombo);
    setCorrectQuestions(nextCorrectQuestions);
    setActiveEchoIndex(-1);
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
    phase,
    schedule,
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
    setCorrectQuestions(0);
    setLastResult(null);
    setActiveEchoIndex(-1);
    setAwardedPoints(0);
    setIsNewBest(false);
    setPhase("ready");

    schedule(() => {
      setPhase("revealing");
      scheduleEchoPlayback(nextQuestions[0]);
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
    setCorrectQuestions(0);
    setLastResult(null);
    setActiveEchoIndex(-1);
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

    if (!isCorrectPathPrefix(currentQuestion, nextTappedIds) || nextTappedIds.length === currentQuestion.answerIds.length) {
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
            <Text className="hero-kicker">路径工作记忆</Text>
            <Text className="hero-title">星链回响</Text>
            <Text className="hero-copy">记住星点闪现的路径，按同样顺序连回星链。</Text>
            <View className="route-preview" aria-hidden>
              <View className="preview-line preview-line-one" />
              <View className="preview-line preview-line-two" />
              <Text className="preview-star preview-star-one">1</Text>
              <Text className="preview-star preview-star-two">2</Text>
              <Text className="preview-star preview-star-three">3</Text>
              <Text className="preview-star preview-star-four">4</Text>
            </View>
            <View className="best-pill">
              <Text className="best-label">当前难度最高</Text>
              <Text className="best-value">{best}</Text>
            </View>
          </View>

          <View className="info-panel">
            <Text className="section-title">训练规则</Text>
            <Text className="rule-line">1. 观察星点依次闪现的路径。</Text>
            <Text className="rule-line">2. 回响结束后，按原顺序点亮星链。</Text>
            <Text className="rule-line">3. 错误后会回放正确路径和本题得分。</Text>
          </View>

          <View className="info-panel">
            <Text className="section-title">难度</Text>
            <View className="difficulty-grid">
              {renderDifficultyCard("normal", "3-5 步星链 · 播放更舒缓")}
              {renderDifficultyCard("hard", "4-7 步星链 · 节奏更紧")}
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
                ? "准备聆听回响"
                : phase === "revealing"
                  ? `记住第 ${Math.max(activeEchoIndex + 1, 1)}/${currentQuestion.answerIds.length} 颗星`
                  : phase === "answering"
                    ? `点亮第 ${answerProgress} 颗星`
                    : lastResult?.allCorrect
                      ? "星链复现完成"
                      : "星链回放"}
            </Text>
            <Text className="prompt-copy">
              {phase === "answering"
                ? "沿着刚才的闪现顺序连回星链"
                : phase === "feedback"
                  ? `${currentQuestion.replayText} · 本题 +${lastResult?.score ?? 0}`
                  : "保持专注，星点会依次发光"}
            </Text>
          </View>

          <View className={`star-board star-board-${phase}`}>
            {phase === "revealing" && activeEchoIndex > 0 ? currentQuestion.answerIds.slice(1, activeEchoIndex + 1).map((pointId, index) => {
              const fromPoint = currentQuestion.points.find((point) => point.id === currentQuestion.answerIds[index]);
              const toPoint = currentQuestion.points.find((point) => point.id === pointId);
              return renderRouteSegment(
                fromPoint,
                toPoint,
                "route-segment route-segment-echo",
                `echo-${currentQuestion.answerIds[index]}-${pointId}`,
              );
            }) : null}
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
              const activeEchoId = activeEchoIndex >= 0 ? currentQuestion.answerIds[activeEchoIndex] : "";
              const activeEcho = phase === "revealing" && activeEchoId === point.id;
              const answerRank = currentQuestion.answerIds.indexOf(point.id);
              const shouldShowValue = phase === "feedback";
              return (
                <View
                  key={point.id}
                  className={`star-node star-node-${point.colorGroup} star-node-${point.brightness} ${tapped ? "star-node-tapped" : ""} ${wrongTap ? "star-node-wrong" : ""} ${activeEcho ? "star-node-echo-active" : ""}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onClick={() => handlePointTap(point.id)}
                >
                  <Text className="star-node-text">{shouldShowValue && answerRank >= 0 ? answerRank + 1 : tapped ? "✓" : activeEcho ? "•" : ""}</Text>
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
            <Text className="result-copy">星链回响 · {getTrainingDifficultyLabel(rewardDifficulty)}</Text>
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
              <Text className="result-label">完整回响</Text>
            </View>
            <View className="result-item result-item-wide">
              <Text className="result-value result-value-small">{longestEchoLength} 步</Text>
              <Text className="result-label">最长星链</Text>
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
