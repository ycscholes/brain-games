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
  createWordScrambleSession,
  scoreWordScrambleQuestion,
  WORD_SCRAMBLE_TOTAL_QUESTIONS,
  type WordScrambleQuestion,
  type WordScrambleQuestionResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "word_scramble_best";
const FEEDBACK_MS = 850;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function WordScramble() {
  usePageShare("pages/word-scramble/index");

  const [phase, setPhase] = useState<Phase>("start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>("normal");
  const [best, setBest] = useState(0);
  const [questions, setQuestions] = useState<WordScrambleQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState("");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctQuestions, setCorrectQuestions] = useState(0);
  const [lastResult, setLastResult] = useState<WordScrambleQuestionResult | null>(null);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const questionStartedAtRef = useRef(0);
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
    const nextAwardedPoints = getAwardedPoints("word-scramble", finalScore, difficulty);
    addPointsToPet("word-scramble", finalScore, difficulty);
    recordTrainingSession({
      gameId: "word-scramble",
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

  const beginQuestion = useCallback((questionIndex: number) => {
    setCurrentIndex(questionIndex);
    setSelectedWord("");
    setLastResult(null);
    questionStartedAtRef.current = Date.now();
    setPhase("playing");
  }, []);

  const startGame = () => {
    clearTimers();
    const nextQuestions = createWordScrambleSession(difficulty);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setQuestions(nextQuestions);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectQuestions(0);
    setSelectedWord("");
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    beginQuestion(0);
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
    setSelectedWord("");
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    finishedRef.current = false;
    refreshBest();
  };

  const handleAnswer = (word: string) => {
    if (phase !== "playing" || !currentQuestion || selectedWord) {
      return;
    }

    const result = scoreWordScrambleQuestion({
      selectedWord: word,
      correctWord: currentQuestion.target.word,
      answerMs: Date.now() - questionStartedAtRef.current,
      currentCombo: combo,
    });
    const nextScore = score + result.score;
    const nextCombo = result.correct ? combo + 1 : 0;
    const nextCorrectQuestions = correctQuestions + (result.correct ? 1 : 0);

    setSelectedWord(word);
    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestCombo, nextCombo));
    setCorrectQuestions(nextCorrectQuestions);
    setPhase("feedback");

    schedule(() => {
      if (currentIndex >= WORD_SCRAMBLE_TOTAL_QUESTIONS - 1) {
        finishGame(nextScore, nextCorrectQuestions);
        return;
      }

      beginQuestion(currentIndex + 1);
    }, FEEDBACK_MS);
  };

  const accuracyText = useMemo(() => {
    return `${Math.round((correctQuestions / WORD_SCRAMBLE_TOTAL_QUESTIONS) * 100)}%`;
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
    <View className="word-scramble-page">
      {phase === "start" ? (
        <View className="word-start">
          <View className="word-hero">
            <Text className="hero-kicker">语言处理训练</Text>
            <Text className="hero-title">词语拼盘</Text>
            <Text className="hero-copy">看乱序汉字和提示，在四个词语里快速找出正确答案。</Text>
            <View className="best-pill">
              <Text className="best-label">当前难度最高</Text>
              <Text className="best-value">{best}</Text>
            </View>
          </View>

          <View className="info-panel">
            <Text className="section-title">训练规则</Text>
            <Text className="rule-line">1. 每局 8 题，先看打乱的汉字。</Text>
            <Text className="rule-line">2. 结合线索，在四个候选词里选出原词。</Text>
            <Text className="rule-line">3. 连续正确和快速作答会获得额外分。</Text>
          </View>

          <View className="info-panel">
            <Text className="section-title">难度</Text>
            <View className="difficulty-grid">
              {renderDifficultyCard("normal", "2 字常用词 · 线索更直接")}
              {renderDifficultyCard("hard", "3-5 字词组 · 判断更紧")}
            </View>
          </View>

          <View className="primary-button" onClick={startGame}>
            <Text className="primary-button-text">开始训练</Text>
          </View>
        </View>
      ) : null}

      {(phase === "playing" || phase === "feedback") && currentQuestion ? (
        <View className="word-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{WORD_SCRAMBLE_TOTAL_QUESTIONS}</Text>
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

          <View className="scramble-card">
            <Text className="question-kicker">{currentQuestion.target.category}</Text>
            <View className="char-row">
              {currentQuestion.scrambledChars.map((char, index) => (
                <View key={`${char}-${index}`} className="char-tile">
                  <Text className="char-text">{char}</Text>
                </View>
              ))}
            </View>
            <Text className="hint-text">{currentQuestion.target.hint}</Text>
          </View>

          <View className="option-grid">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedWord === option;
              const isAnswer = phase === "feedback" && option === currentQuestion.target.word;
              const isWrong = phase === "feedback" && isSelected && option !== currentQuestion.target.word;
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

          {phase === "feedback" ? (
            <View className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastResult?.correct ? "回答正确" : "正确词语"}</Text>
              <Text className="feedback-copy">{currentQuestion.target.word} · 本题 +{lastResult?.score ?? 0}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="word-result">
          <View className="result-card">
            <Text className="result-kicker">训练完成</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              词语拼盘 · {getTrainingDifficultyLabel(difficulty)} {isNewBest ? "· 新最高" : ""}
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

