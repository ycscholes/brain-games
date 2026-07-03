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
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [isHintVisible, setIsHintVisible] = useState(false);
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
  const phaseRef = useRef<Phase>("start");
  const selectedWordRef = useRef("");
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const correctQuestionsRef = useRef(0);
  const currentIndexRef = useRef(0);

  const currentQuestion = questions[currentIndex] ?? null;
  const selectedChars = useMemo(() => {
    if (!currentQuestion) {
      return [];
    }

    return selectedCharIds
      .map((id) => currentQuestion.charChoices.find((choice) => choice.id === id)?.char || "")
      .filter(Boolean);
  }, [currentQuestion, selectedCharIds]);

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

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    selectedWordRef.current = selectedWord;
  }, [selectedWord]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    bestComboRef.current = bestCombo;
  }, [bestCombo]);

  useEffect(() => {
    correctQuestionsRef.current = correctQuestions;
  }, [correctQuestions]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const finishGame = useCallback((finalScore: number, finalCorrectQuestions: number) => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    clearTimers();

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const nextAwardedPoints = getAwardedPoints("word-scramble", finalScore, difficulty);
    if (completeGauntletLegIfNeeded({
      gameId: "word-scramble",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    })) {
      return;
    }

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

  const beginQuestion = (questionIndex: number, nextQuestions = questions) => {
    clearTimers();
    const question = nextQuestions[questionIndex];
    setCurrentIndex(questionIndex);
    setSelectedWord("");
    setSelectedCharIds([]);
    setIsHintVisible(false);
    setLastResult(null);
    questionStartedAtRef.current = Date.now();
    setPhase("playing");

    schedule(() => {
      setIsHintVisible(true);
    }, question?.hintDelayMs ?? 0);

    schedule(() => {
      if (!question) {
        return;
      }

      submitAnswer("", question, true);
    }, question?.timeLimitMs ?? 6000);
  };

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
    setSelectedCharIds([]);
    setIsHintVisible(false);
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
    setSelectedWord("");
    setSelectedCharIds([]);
    setIsHintVisible(false);
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    finishedRef.current = false;
    refreshBest();
  };

  const submitAnswer = (word: string, question = currentQuestion, timedOut = false) => {
    if (phaseRef.current !== "playing" || !question || selectedWordRef.current) {
      return;
    }

    clearTimers();
    const result = scoreWordScrambleQuestion({
      selectedWord: timedOut ? "" : word,
      correctWord: question.target.word,
      answerMs: Date.now() - questionStartedAtRef.current,
      currentCombo: comboRef.current,
    });
    const nextScore = scoreRef.current + result.score;
    const nextCombo = result.correct ? comboRef.current + 1 : 0;
    const nextCorrectQuestions = correctQuestionsRef.current + (result.correct ? 1 : 0);

    setSelectedWord(timedOut ? "超时" : word);
    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestComboRef.current, nextCombo));
    setCorrectQuestions(nextCorrectQuestions);
    setPhase("feedback");

    schedule(() => {
      if (currentIndexRef.current >= WORD_SCRAMBLE_TOTAL_QUESTIONS - 1) {
        finishGame(nextScore, nextCorrectQuestions);
        return;
      }

      beginQuestion(currentIndexRef.current + 1);
    }, FEEDBACK_MS);
  };

  const handleCharTap = (choiceId: string) => {
    if (
      phase !== "playing" ||
      !currentQuestion ||
      selectedWord ||
      selectedCharIds.includes(choiceId) ||
      selectedCharIds.length >= currentQuestion.target.word.length
    ) {
      return;
    }

    const nextSelectedCharIds = [...selectedCharIds, choiceId];
    const nextWord = nextSelectedCharIds
      .map((id) => currentQuestion.charChoices.find((choice) => choice.id === id)?.char || "")
      .join("");

    setSelectedCharIds(nextSelectedCharIds);

    if (nextWord.length >= currentQuestion.target.word.length) {
      schedule(() => {
        submitAnswer(nextWord, currentQuestion);
      }, 120);
    }
  };

  const undoChar = () => {
    if (phase !== "playing" || selectedWord) {
      return;
    }

    setSelectedCharIds((ids) => ids.slice(0, -1));
  };

  const clearSelection = () => {
    if (phase !== "playing" || selectedWord) {
      return;
    }

    setSelectedCharIds([]);
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
            <Text className="hero-copy">从混入干扰字的字盘里点选汉字，按顺序拼出目标词。</Text>
            <View className="best-pill">
              <Text className="best-label">当前难度最高</Text>
              <Text className="best-value">{best}</Text>
            </View>
          </View>

          <View className="info-panel">
            <Text className="section-title">训练规则</Text>
            <Text className="rule-line">1. 每局 8 题，字盘会混入无关汉字。</Text>
            <Text className="rule-line">2. 按正确顺序点字，字数满后自动判定。</Text>
            <Text className="rule-line">3. 困难模式提示会延迟出现，限时更紧。</Text>
          </View>

          <View className="info-panel">
            <Text className="section-title">难度</Text>
            <View className="difficulty-grid">
              {renderDifficultyCard("normal", "2 字词 · 2-3 个干扰字")}
              {renderDifficultyCard("hard", "3-5 字词组 · 4-6 个干扰字")}
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
            <View className="answer-rack">
              {Array.from(currentQuestion.target.word).map((_, index) => (
                <View key={`slot-${index}`} className={`answer-slot ${selectedChars[index] ? "answer-slot-filled" : ""}`}>
                  <Text className="answer-slot-text">{selectedChars[index] || ""}</Text>
                </View>
              ))}
            </View>
            <Text className="hint-text">
              {isHintVisible ? currentQuestion.target.hint : "提示蓄力中，先靠字形和类别判断"}
            </Text>
            <View className="tool-row">
              <View className="tool-button" onClick={undoChar}>
                <Text className="tool-button-text">撤销</Text>
              </View>
              <View className="tool-button" onClick={clearSelection}>
                <Text className="tool-button-text">清空</Text>
              </View>
            </View>
          </View>

          <View className="char-bank">
            {currentQuestion.charChoices.map((choice) => {
              const isUsed = selectedCharIds.includes(choice.id);
              return (
                <View
                  key={choice.id}
                  className={`char-tile ${isUsed ? "char-tile-used" : ""} ${phase === "feedback" && choice.isTarget ? "char-tile-answer" : ""}`}
                  onClick={() => handleCharTap(choice.id)}
                >
                  <Text className="char-text">{choice.char}</Text>
                </View>
              );
            })}
          </View>

          {phase === "feedback" ? (
            <View className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastResult?.correct ? "拼盘完成" : "正确词语"}</Text>
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
