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
import {
  createHeadCountSession,
  HEAD_COUNT_TOTAL_QUESTIONS,
  scoreHeadCountQuestion,
  type HeadCountEvent,
  type HeadCountQuestion,
  type HeadCountQuestionResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "ready" | "playing-event" | "answering" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "head_count_best";
const READY_MS = 520;
const FEEDBACK_MS = 880;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function formatEvent(event: HeadCountEvent | null) {
  if (!event) return "观察房间人数变化";
  return event.direction === "enter" ? `进入 ${event.delta} 人` : `离开 ${event.delta} 人`;
}

function getRoomCountText(phase: Phase, displayCount: number, answer: number) {
  if (phase === "ready") return `${displayCount}`;
  if (phase === "feedback") return `${answer}`;
  if (phase === "answering") return "?";
  return "清点中";
}

export default function HeadCount() {
  const [phase, setPhase] = useState<Phase>("start");
  const [rewardDifficulty, setRewardDifficulty] = useState<TrainingDifficulty>("normal");
  const [best, setBest] = useState(0);
  const [questions, setQuestions] = useState<HeadCountQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [eventIndex, setEventIndex] = useState(-1);
  const [displayCount, setDisplayCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correctQuestions, setCorrectQuestions] = useState(0);
  const [lastResult, setLastResult] = useState<HeadCountQuestionResult | null>(null);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const answerStartedAtRef = useRef(0);
  const finishedRef = useRef(false);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentEvent = currentQuestion && eventIndex >= 0 ? currentQuestion.events[eventIndex] ?? null : null;
  const staticPeopleCount = currentQuestion && phase === "feedback"
    ? currentQuestion.answer
    : phase === "ready"
      ? displayCount
      : 0;
  const movingPeople = Array.from({ length: currentEvent?.delta ?? 0 }, (_, index) => index);

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
    const nextAwardedPoints = getAwardedPoints("head-count", finalScore, rewardDifficulty);
    addPointsToPet("head-count", finalScore, rewardDifficulty);
    recordTrainingSession({
      gameId: "head-count",
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
    const question = questions[questionIndex];
    setCurrentIndex(questionIndex);
    setSelectedAnswer(null);
    setLastResult(null);
    setEventIndex(-1);
    setDisplayCount(question?.initialCount ?? 0);
    setPhase("ready");

    schedule(() => {
      setPhase("playing-event");
      question?.events.forEach((event, index) => {
        schedule(() => {
          setEventIndex(index);
          setDisplayCount(event.afterCount);
        }, index * question.eventMs);
      });

      schedule(() => {
        answerStartedAtRef.current = Date.now();
        setEventIndex(-1);
        setPhase("answering");
      }, (question?.events.length ?? 0) * (question?.eventMs ?? 700) + 160);
    }, READY_MS);
  }, [questions]);

  const startGame = () => {
    clearTimers();
    const nextQuestions = createHeadCountSession(rewardDifficulty);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setQuestions(nextQuestions);
    setCurrentIndex(0);
    setEventIndex(-1);
    setDisplayCount(nextQuestions[0].initialCount);
    setSelectedAnswer(null);
    setScore(0);
    setCombo(0);
    setCorrectQuestions(0);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    setPhase("ready");

    schedule(() => {
      setPhase("playing-event");
      nextQuestions[0].events.forEach((event, index) => {
        schedule(() => {
          setEventIndex(index);
          setDisplayCount(event.afterCount);
        }, index * nextQuestions[0].eventMs);
      });

      schedule(() => {
        answerStartedAtRef.current = Date.now();
        setEventIndex(-1);
        setPhase("answering");
      }, nextQuestions[0].events.length * nextQuestions[0].eventMs + 160);
    }, READY_MS);
  };

  const backToStart = () => {
    clearTimers();
    setPhase("start");
    setQuestions([]);
    setCurrentIndex(0);
    setEventIndex(-1);
    setDisplayCount(0);
    setSelectedAnswer(null);
    setScore(0);
    setCombo(0);
    setCorrectQuestions(0);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    finishedRef.current = false;
    refreshBest();
  };

  const handleAnswer = (answer: number) => {
    if (phase !== "answering" || !currentQuestion || selectedAnswer !== null) {
      return;
    }

    const answerMs = Date.now() - answerStartedAtRef.current;
    const result = scoreHeadCountQuestion({
      selectedAnswer: answer,
      correctAnswer: currentQuestion.answer,
      answerMs,
      currentCombo: combo,
    });
    const nextScore = score + result.score;
    const nextCombo = result.correct ? combo + 1 : 0;
    const nextCorrectQuestions = correctQuestions + (result.correct ? 1 : 0);

    setSelectedAnswer(answer);
    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setCorrectQuestions(nextCorrectQuestions);
    setDisplayCount(currentQuestion.answer);
    setPhase("feedback");

    schedule(() => {
      if (currentIndex >= HEAD_COUNT_TOTAL_QUESTIONS - 1) {
        finishGame(nextScore, nextCorrectQuestions);
        return;
      }

      beginQuestion(currentIndex + 1);
    }, FEEDBACK_MS);
  };

  const accuracyText = useMemo(() => {
    return `${Math.round((correctQuestions / HEAD_COUNT_TOTAL_QUESTIONS) * 100)}%`;
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
    <View className="head-count-page">
      {phase === "start" ? (
        <View className="start-screen">
          <View className="hero-panel">
            <Text className="hero-kicker">持续注意训练</Text>
            <Text className="hero-title">小剧场清点</Text>
            <Text className="hero-copy">观察角色进出房间，最后判断舞台上还剩多少人。</Text>
            <View className="best-pill">
              <Text className="best-label">当前难度最高</Text>
              <Text className="best-value">{best}</Text>
            </View>
          </View>

          <View className="info-panel">
            <Text className="section-title">训练规则</Text>
            <Text className="rule-line">1. 每局 8 题，先看初始人数。</Text>
            <Text className="rule-line">2. 事件开始后不再显示总人数，需要在心里清点。</Text>
            <Text className="rule-line">3. 观察人物进出动画，结束后从 4 个选项中选择剩余人数。</Text>
          </View>

          <View className="info-panel">
            <Text className="section-title">难度</Text>
            <View className="difficulty-grid">
              {renderDifficultyCard("normal", "3-4 段事件 · 节奏清晰")}
              {renderDifficultyCard("hard", "4-6 段事件 · 变化更快")}
            </View>
          </View>

          <View className="primary-button" onClick={startGame}>
            <Text className="primary-button-text">开始训练</Text>
          </View>
        </View>
      ) : null}

      {phase !== "start" && phase !== "finished" && currentQuestion ? (
        <View className="play-screen">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{HEAD_COUNT_TOTAL_QUESTIONS}</Text>
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
              {phase === "ready" ? "记住初始人数" : phase === "playing-event" ? formatEvent(currentEvent) : phase === "answering" ? "现在还剩多少人" : lastResult?.correct ? "回答正确" : "回答偏差"}
            </Text>
            <Text className="prompt-copy">
              {phase === "feedback" ? `正确答案 ${currentQuestion.answer} · 本题 +${lastResult?.score ?? 0}` : "在心里更新人数，不需要点击"}
            </Text>
          </View>

          <View className={`stage-card stage-card-${phase}`}>
            <View className="door door-left">
              <Text className="door-label">入口</Text>
            </View>
            <View className="room">
              <Text className="room-title">
                {phase === "ready" ? "初始人数" : phase === "feedback" ? "正确人数" : "舞台人数"}
              </Text>
              <Text className={`room-count ${phase === "playing-event" ? "room-count-hidden" : ""}`}>
                {getRoomCountText(phase, displayCount, currentQuestion.answer)}
              </Text>
              <View className="people-row">
                {Array.from({ length: Math.min(staticPeopleCount, 10) }, (_, index) => (
                  <View key={`person-${index}`} className="person-token">
                    <Text className="person-text">人</Text>
                  </View>
                ))}
              </View>
              {phase === "playing-event" && currentEvent ? (
                <View className={`event-people-layer event-people-layer-${currentEvent.direction}`}>
                  {movingPeople.map((personIndex) => (
                    <View
                      key={`event-${eventIndex}-${personIndex}`}
                      className={`moving-person moving-person-${currentEvent.direction} moving-person-${rewardDifficulty}`}
                      style={{
                        top: `${34 + personIndex * 16}%`,
                        animationDelay: `${personIndex * 70}ms`,
                      }}
                    >
                      <Text className="moving-person-text">人</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            <View className="door door-right">
              <Text className="door-label">出口</Text>
            </View>
          </View>

          {phase === "answering" || phase === "feedback" ? (
            <View className="option-grid">
              {currentQuestion.options.map((option) => {
                const selected = selectedAnswer === option;
                const correct = phase === "feedback" && option === currentQuestion.answer;
                const wrong = phase === "feedback" && selected && option !== currentQuestion.answer;
                return (
                  <View
                    key={option}
                    className={`answer-option ${selected ? "answer-option-selected" : ""} ${correct ? "answer-option-correct" : ""} ${wrong ? "answer-option-wrong" : ""}`}
                    onClick={() => handleAnswer(option)}
                  >
                    <Text className="answer-option-text">{option}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="finished-screen">
          <View className="result-card">
            <Text className="result-kicker">{isNewBest ? "刷新最高分" : "训练完成"}</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">小剧场清点 · {getTrainingDifficultyLabel(rewardDifficulty)}</Text>
          </View>

          <View className="result-grid">
            <View className="result-item">
              <Text className="result-value">{accuracyText}</Text>
              <Text className="result-label">正确率</Text>
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
