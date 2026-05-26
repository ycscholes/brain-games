import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import { getAwardedPoints, recordTrainingSession } from "../../utils/trainingStorage";
import {
  PATTERN_QUESTION_BANK,
  type PatternOption,
  type PatternQuestion,
} from "./patterns";
import "./index.scss";

type Phase = "start" | "playing" | "finished";
type Feedback = "none" | "correct" | "wrong";

const STORAGE_KEY = "pattern_completion_best";
const TOTAL_QUESTIONS = PATTERN_QUESTION_BANK.length;
const MAX_TIME_BONUS = 10;
const TIME_BONUS_TARGET_SECONDS = 120;
const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

const difficultyLabelMap: Record<number, string> = {
  1: "入门",
  2: "入门",
  3: "入门",
  4: "进阶",
  5: "进阶",
  6: "进阶",
  7: "挑战",
  8: "挑战",
  9: "挑战",
  10: "大师",
};

const formatElapsed = (elapsedMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const calculateTimeBonus = (elapsedMs: number) => {
  const elapsedSeconds = Math.ceil(elapsedMs / 1000);
  const remaining = Math.max(0, TIME_BONUS_TARGET_SECONDS - elapsedSeconds);
  return Math.round((remaining / TIME_BONUS_TARGET_SECONDS) * MAX_TIME_BONUS);
};

function PatternToken({
  option,
  compact = false,
}: {
  option: PatternOption;
  compact?: boolean;
}) {
  return (
    <View className={`pattern-token ${compact ? "pattern-token-compact" : ""}`}>
      <View className="shape-shell">
        <View
          className={`shape shape-${option.shape}`}
          style={{ color: option.colorHex }}
        />
      </View>
      {!compact ? <Text className="token-label">{option.label}</Text> : null}
    </View>
  );
}

export default function PatternCompletion() {
  const [phase, setPhase] = useState<Phase>("start");
  const [best, setBest] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [feedback, setFeedback] = useState<Feedback>("none");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timeBonus, setTimeBonus] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const startTimeRef = useRef(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQuestion: PatternQuestion | null =
    phase === "playing" ? PATTERN_QUESTION_BANK[currentIndex] ?? null : null;

  const clearTicker = () => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  const clearTransitionTimer = () => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  };

  const refreshBest = useCallback(() => {
    const value = Number(Taro.getStorageSync(STORAGE_KEY) || 0);
    setBest(Number.isFinite(value) ? value : 0);
  }, []);

  useLoad(() => {
    refreshBest();
  });

  useDidShow(() => {
    refreshBest();
  });

  useEffect(() => {
    return () => {
      clearTicker();
      clearTransitionTimer();
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing") {
      clearTicker();
      return;
    }

    tickerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 250);

    return () => {
      clearTicker();
    };
  }, [phase]);

  const finishGame = useCallback(
    (settledCorrectCount: number) => {
      clearTicker();
      clearTransitionTimer();

      const settledElapsedMs = Date.now() - startTimeRef.current;
      const settledTimeBonus = calculateTimeBonus(settledElapsedMs);
      const settledFinalScore = settledCorrectCount + settledTimeBonus;
      const awardedPoints = getAwardedPoints("pattern-completion", settledFinalScore);

      setElapsedMs(settledElapsedMs);
      setCorrectCount(settledCorrectCount);
      setTimeBonus(settledTimeBonus);
      setFinalScore(settledFinalScore);
      addPointsToPet("pattern-completion", settledFinalScore);
      recordTrainingSession({
        gameId: "pattern-completion",
        score: settledFinalScore,
        awardedPoints,
        durationSeconds: Math.round(settledElapsedMs / 1000),
        outcome: "completed",
      });
      setPhase("finished");

      if (settledFinalScore > best) {
        Taro.setStorageSync(STORAGE_KEY, settledFinalScore);
        setBest(settledFinalScore);
        setIsNewBest(true);
      } else {
        setIsNewBest(false);
      }
    },
    [best]
  );

  const startGame = () => {
    clearTicker();
    clearTransitionTimer();

    startTimeRef.current = Date.now();
    setPhase("playing");
    setCurrentIndex(0);
    setCorrectCount(0);
    setSelectedOptionId("");
    setFeedback("none");
    setElapsedMs(0);
    setTimeBonus(0);
    setFinalScore(0);
    setIsNewBest(false);
  };

  const backToStart = () => {
    clearTicker();
    clearTransitionTimer();
    setPhase("start");
    setCurrentIndex(0);
    setCorrectCount(0);
    setSelectedOptionId("");
    setFeedback("none");
    setElapsedMs(0);
    setTimeBonus(0);
    setFinalScore(0);
    setIsNewBest(false);
    refreshBest();
  };

  const handleOptionSelect = (option: PatternOption) => {
    if (!currentQuestion || selectedOptionId) {
      return;
    }

    const isCorrect = option.id === currentQuestion.answer.id;
    const nextCorrectCount = correctCount + (isCorrect ? 1 : 0);

    setSelectedOptionId(option.id);
    setFeedback(isCorrect ? "correct" : "wrong");

    transitionTimerRef.current = setTimeout(() => {
      if (currentIndex >= TOTAL_QUESTIONS - 1) {
        finishGame(nextCorrectCount);
        return;
      }

      setCorrectCount(nextCorrectCount);
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionId("");
      setFeedback("none");
    }, 550);
  };

  return (
    <View className="pattern-page">
      {phase === "start" ? (
        <View className="start-screen">
          <View className="header-section">
            <View className="logo-icon">
              <Text className="logo-emoji">△</Text>
            </View>
            <Text className="game-title">找规律</Text>
            <Text className="game-subtitle">观察图形与颜色变化，推理下一个图案</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">最佳分数</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 每局共 10 题，每题观察 4 项序列并选择下一个图形。</Text>
            <Text className="rule-item">2. 选项为 3 到 4 个，图形只由圆形、方形、三角形与颜色组合构成。</Text>
            <Text className="rule-item">3. 难度会逐题提升，后面会出现颜色与形状的双重规律。</Text>
            <Text className="rule-item">4. 最终得分 = 正确题数 + 时间奖励，120 秒内完成越快奖励越高。</Text>
          </View>

          <View className="summary-card">
            <Text className="section-title">本局设定</Text>
            <View className="summary-grid">
              <View className="summary-item">
                <Text className="summary-value">{TOTAL_QUESTIONS}</Text>
                <Text className="summary-label">题目数量</Text>
              </View>
              <View className="summary-item">
                <Text className="summary-value">3</Text>
                <Text className="summary-label">图形类型</Text>
              </View>
              <View className="summary-item">
                <Text className="summary-value">{MAX_TIME_BONUS}</Text>
                <Text className="summary-label">时间奖励上限</Text>
              </View>
            </View>
          </View>

          <View className="primary-button" onClick={startGame}>
            <Text className="button-text">开始挑战</Text>
          </View>
          <View className="footer-gap" />
        </View>
      ) : null}

      {phase === "playing" && currentQuestion ? (
        <View className="game-screen">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{TOTAL_QUESTIONS}</Text>
              <Text className="status-label">当前进度</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{correctCount}</Text>
              <Text className="status-label">答对题数</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{formatElapsed(elapsedMs)}</Text>
              <Text className="status-label">已用时间</Text>
            </View>
          </View>

          <View className="question-card">
            <Text className="difficulty-tag">{difficultyLabelMap[currentQuestion.difficulty]}</Text>
            <Text className="question-title">选择这个序列中的下一个图形</Text>
            <Text className="question-subtitle">{currentQuestion.description}</Text>

            <View className="sequence-row">
              {currentQuestion.sequence.map((item) => (
                <PatternToken key={`${currentQuestion.id}-${item.id}`} option={item} compact />
              ))}
              <View className="answer-slot">
                <Text className="answer-slot-text">?</Text>
              </View>
            </View>
          </View>

          <View className="options-grid">
            {currentQuestion.options.map((option, optionIndex) => {
              const isSelected = selectedOptionId === option.id;
              const isCorrect = option.id === currentQuestion.answer.id;
              const classNames = [
                "option-card",
                isSelected ? "option-selected" : "",
                selectedOptionId && isCorrect ? "option-correct" : "",
                selectedOptionId && isSelected && !isCorrect ? "option-wrong" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <View key={`${currentQuestion.id}-${option.id}`} className={classNames} onClick={() => handleOptionSelect(option)}>
                  <Text className="option-letter">{OPTION_LETTERS[optionIndex]}</Text>
                  <PatternToken option={option} />
                </View>
              );
            })}
          </View>

          <View className={`feedback-card ${feedback !== "none" ? `feedback-${feedback}` : ""}`}>
            <Text className="feedback-text">
              {feedback === "none"
                ? "请从下方选项中作答"
                : feedback === "correct"
                  ? "回答正确，进入下一题"
                  : `回答错误，正确答案是 ${currentQuestion.answer.label}`}
            </Text>
          </View>
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="result-screen">
          <View className="result-card">
            <Text className="result-title">本局成绩</Text>
            <Text className="result-score">{finalScore}</Text>
            <Text className="result-desc">答对 {correctCount} / {TOTAL_QUESTIONS} 题</Text>
            <Text className="result-desc">完成用时 {formatElapsed(elapsedMs)}，时间奖励 {timeBonus}</Text>
            <Text className="result-desc">获得 {getAwardedPoints("pattern-completion", finalScore)} 积分</Text>
            <Text className="result-desc">
              历史最高 {best}
              {isNewBest ? <Text className="result-highlight">，刷新纪录</Text> : null}
            </Text>
          </View>

          <View className="result-actions">
            <View className="primary-button" onClick={startGame}>
              <Text className="button-text">再来一局</Text>
            </View>
            <View className="secondary-button" onClick={backToStart}>
              <Text className="button-text">返回开始页</Text>
            </View>
            <View className="secondary-button" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
              <Text className="button-text">返回游戏主页</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
