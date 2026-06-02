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
  BIRD_COUNT_TOTAL_QUESTIONS,
  createBirdCountSession,
  scoreBirdCountQuestion,
  type BirdCountQuestion,
  type BirdCountQuestionResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "ready" | "watching" | "answering" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "bird_count_best";
const READY_MS = 520;
const FEEDBACK_MS = 900;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function BirdCount() {
  usePageShare("pages/bird-count/index");

  const [phase, setPhase] = useState<Phase>("start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>("normal");
  const [best, setBest] = useState(0);
  const [questions, setQuestions] = useState<BirdCountQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctQuestions, setCorrectQuestions] = useState(0);
  const [lastResult, setLastResult] = useState<BirdCountQuestionResult | null>(null);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const answerStartedAtRef = useRef(0);
  const finishedRef = useRef(false);

  const currentQuestion = questions[currentIndex] ?? null;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timersRef.current.push(timer);
  }, []);

  const refreshBest = useCallback(() => {
    setBest(readBestScore(difficulty));
  }, [difficulty]);

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
    const nextAwardedPoints = getAwardedPoints("bird-count", finalScore, difficulty);
    addPointsToPet("bird-count", finalScore, difficulty);
    recordTrainingSession({
      gameId: "bird-count",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    });

    setAwardedPoints(nextAwardedPoints);
    setCorrectQuestions(finalCorrectQuestions);
    setPhase("finished");

    if (finalScore > best) {
      Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`, finalScore);
      setBest(finalScore);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }
  }, [best, clearTimers, difficulty]);

  const beginQuestion = useCallback((questionIndex: number, nextQuestions = questions) => {
    clearTimers();
    const question = nextQuestions[questionIndex];
    setCurrentIndex(questionIndex);
    setSelectedAnswer(null);
    setLastResult(null);
    setPhase("ready");

    schedule(() => {
      setPhase("watching");
      schedule(() => {
        answerStartedAtRef.current = Date.now();
        setPhase("answering");
      }, question?.revealMs ?? 1000);
    }, READY_MS);
  }, [clearTimers, questions, schedule]);

  const startGame = () => {
    clearTimers();
    const nextQuestions = createBirdCountSession(difficulty);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setQuestions(nextQuestions);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectQuestions(0);
    setSelectedAnswer(null);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    beginQuestion(0, nextQuestions);
  };

  const backToStart = () => {
    clearTimers();
    setPhase("start");
    setQuestions([]);
    setCurrentIndex(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectQuestions(0);
    setSelectedAnswer(null);
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

    const result = scoreBirdCountQuestion({
      selectedAnswer: answer,
      correctAnswer: currentQuestion.answer,
      answerMs: Date.now() - answerStartedAtRef.current,
      currentCombo: combo,
    });
    const nextScore = score + result.score;
    const nextCombo = result.correct ? combo + 1 : 0;
    const nextCorrectQuestions = correctQuestions + (result.correct ? 1 : 0);

    setSelectedAnswer(answer);
    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestCombo, nextCombo));
    setCorrectQuestions(nextCorrectQuestions);
    setPhase("feedback");

    schedule(() => {
      if (currentIndex >= BIRD_COUNT_TOTAL_QUESTIONS - 1) {
        finishGame(nextScore, nextCorrectQuestions);
        return;
      }

      beginQuestion(currentIndex + 1);
    }, FEEDBACK_MS);
  };

  const accuracyText = useMemo(() => {
    return `${Math.round((correctQuestions / BIRD_COUNT_TOTAL_QUESTIONS) * 100)}%`;
  }, [correctQuestions]);

  const renderDifficultyCard = (nextDifficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`difficulty-card ${difficulty === nextDifficulty ? "difficulty-card-active" : ""}`}
      onClick={() => setDifficulty(nextDifficulty)}
    >
      <Text className="difficulty-name">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="difficulty-copy">{copy}</Text>
    </View>
  );

  return (
    <View className="bird-count-page">
      {phase === "start" ? (
        <View className="bird-start">
          <View className="bird-hero">
            <Text className="hero-kicker">快速观察训练</Text>
            <Text className="hero-title">飞鸟速数</Text>
            <Text className="hero-copy">鸟群只出现一瞬间，记住数量后从选项中回答。</Text>
            <View className="best-pill">
              <Text className="best-label">当前难度最高</Text>
              <Text className="best-value">{best}</Text>
            </View>
          </View>

          <View className="info-panel">
            <Text className="section-title">训练规则</Text>
            <Text className="rule-line">1. 每局 8 题，先准备观察天空。</Text>
            <Text className="rule-line">2. 鸟群短暂出现后会隐藏。</Text>
            <Text className="rule-line">3. 选择刚才看到的鸟数量，快速正确有额外分。</Text>
          </View>

          <View className="info-panel">
            <Text className="section-title">难度</Text>
            <View className="difficulty-grid">
              {renderDifficultyCard("normal", "4-8 只鸟 · 显示时间更长")}
              {renderDifficultyCard("hard", "7-12 只鸟 · 闪现更快")}
            </View>
          </View>

          <View className="primary-button" onClick={startGame}>
            <Text className="primary-button-text">开始训练</Text>
          </View>
        </View>
      ) : null}

      {phase !== "start" && phase !== "finished" && currentQuestion ? (
        <View className="bird-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{BIRD_COUNT_TOTAL_QUESTIONS}</Text>
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

          <View className={`sky-card sky-card-${phase}`}>
            <Text className="sky-prompt">
              {phase === "ready" ? "准备观察" : phase === "watching" ? "现在数鸟" : phase === "answering" ? "刚才有几只" : lastResult?.correct ? "回答正确" : "正确数量"}
            </Text>
            {phase === "watching" || phase === "feedback" ? (
              <View className="sky-field">
                {currentQuestion.birds.map((bird) => (
                  <Text
                    key={bird.id}
                    className={`bird-token bird-${bird.size} bird-${bird.direction}`}
                    style={{ left: `${bird.x}%`, top: `${bird.y}%` }}
                  >
                    {bird.direction === "right" ? ">" : "<"}
                  </Text>
                ))}
              </View>
            ) : (
              <View className="sky-field sky-field-empty">
                <Text className="hidden-count">{phase === "answering" ? "?" : currentQuestion.answer}</Text>
              </View>
            )}
          </View>

          {phase === "answering" || phase === "feedback" ? (
            <View className="option-grid">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedAnswer === option;
                const isAnswer = phase === "feedback" && option === currentQuestion.answer;
                const isWrong = phase === "feedback" && isSelected && option !== currentQuestion.answer;
                return (
                  <View
                    key={option}
                    className={`option-card ${isAnswer ? "option-card-correct" : ""} ${isWrong ? "option-card-wrong" : ""}`}
                    onClick={() => handleAnswer(option)}
                  >
                    <Text className="option-text">{option}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {phase === "feedback" ? (
            <View className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastResult?.correct ? "计数准确" : "正确答案"}</Text>
              <Text className="feedback-copy">{currentQuestion.answer} 只 · 本题 +{lastResult?.score ?? 0}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="bird-result">
          <View className="result-card">
            <Text className="result-kicker">训练完成</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              飞鸟速数 · {getTrainingDifficultyLabel(difficulty)} {isNewBest ? "· 新最高" : ""}
            </Text>
            <View className="result-grid">
              <View className="result-item">
                <Text className="result-item-value">{accuracyText}</Text>
                <Text className="result-item-label">正确率</Text>
              </View>
              <View className="result-item">
                <Text className="result-item-value">{bestCombo}</Text>
                <Text className="result-item-label">最佳连击</Text>
              </View>
              <View className="result-item">
                <Text className="result-item-value">+{awardedPoints}</Text>
                <Text className="result-item-label">宠物积分</Text>
              </View>
            </View>
            <View className="result-actions">
              <View className="secondary-button" onClick={backToStart}>
                <Text className="secondary-button-text">返回设置</Text>
              </View>
              <View className="primary-button" onClick={startGame}>
                <Text className="primary-button-text">再练一局</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

