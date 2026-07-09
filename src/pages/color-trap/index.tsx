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
import { completeGauntletLegIfNeeded, readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import {
  COLOR_TRAP_TOTAL_QUESTIONS,
  createColorTrapSession,
  scoreColorTrapQuestion,
  type ColorTrapColorId,
  type ColorTrapQuestion,
  type ColorTrapQuestionResult,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "feedback" | "finished";

const STORAGE_KEY_PREFIX = "color_trap_best";
const FEEDBACK_MS = 760;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function ColorTrap() {
  usePageShare("pages/color-trap/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;

  const [phase, setPhase] = useState<Phase>("start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(gauntletPreset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);
  const [questions, setQuestions] = useState<ColorTrapQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctQuestions, setCorrectQuestions] = useState(0);
  const [selectedColorId, setSelectedColorId] = useState<ColorTrapColorId | "">("");
  const [lastResult, setLastResult] = useState<ColorTrapQuestionResult | null>(null);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const questionStartedAtRef = useRef(0);
  const finishedRef = useRef(false);
  const answeredRef = useRef(false);
  const autoStartedRef = useRef(false);
  const phaseRef = useRef<Phase>("start");
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const correctQuestionsRef = useRef(0);
  const currentIndexRef = useRef(0);
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

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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
    const nextAwardedPoints = getAwardedPoints("color-trap", finalScore, difficulty);
    if (completeGauntletLegIfNeeded({
      gameId: "color-trap",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    })) {
      return;
    }

    addPointsToPet("color-trap", finalScore, difficulty);
    recordTrainingSession({
      gameId: "color-trap",
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

  const submitAnswer = useCallback((
    colorId: ColorTrapColorId | "",
    question = currentQuestion,
    timedOut = false,
  ) => {
    if (phaseRef.current !== "playing" || !question || answeredRef.current) {
      return;
    }

    answeredRef.current = true;
    clearTimers();
    const result = scoreColorTrapQuestion({
      selectedColorId: timedOut ? "" : colorId,
      correctColorId: question.answer,
      answerMs: Date.now() - questionStartedAtRef.current,
      currentCombo: comboRef.current,
    });
    const nextScore = scoreRef.current + result.score;
    const nextCombo = result.correct ? comboRef.current + 1 : 0;
    const nextCorrectQuestions = correctQuestionsRef.current + (result.correct ? 1 : 0);

    setSelectedColorId(timedOut ? "" : colorId);
    setLastResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestComboRef.current, nextCombo));
    setCorrectQuestions(nextCorrectQuestions);
    setPhase("feedback");

    schedule(() => {
      if (currentIndexRef.current >= COLOR_TRAP_TOTAL_QUESTIONS - 1) {
        finishGame(nextScore, nextCorrectQuestions);
        return;
      }

      beginQuestion(currentIndexRef.current + 1);
    }, FEEDBACK_MS);
  }, [clearTimers, currentQuestion, finishGame, schedule, selectedColorId]);

  const beginQuestion = useCallback((questionIndex: number, nextQuestions = questions) => {
    clearTimers();
    const question = nextQuestions[questionIndex];
    setCurrentIndex(questionIndex);
    setSelectedColorId("");
    setLastResult(null);
    answeredRef.current = false;
    questionStartedAtRef.current = Date.now();
    setPhase("playing");

    schedule(() => {
      submitAnswer("", question, true);
    }, question?.timeLimitMs ?? 4000);
  }, [clearTimers, questions, schedule, submitAnswer]);

  const startGame = () => {
    clearTimers();
    const nextQuestions = createColorTrapSession(difficulty);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setQuestions(nextQuestions);
    setCurrentIndex(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectQuestions(0);
    setSelectedColorId("");
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    beginQuestion(0, nextQuestions);
  };

  useEffect(() => {
    if (!isGauntletPreset || autoStartedRef.current || phase !== "start") return;
    autoStartedRef.current = true;
    startGame();
  }, [isGauntletPreset, phase, startGame]);

  const backToStart = () => {
    clearTimers();
    setPhase("start");
    setQuestions([]);
    setCurrentIndex(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectQuestions(0);
    setSelectedColorId("");
    setLastResult(null);
    setAwardedPoints(0);
    setIsNewBest(false);
    finishedRef.current = false;
    refreshBest();
  };

  const accuracyText = useMemo(() => {
    return `${Math.round((correctQuestions / COLOR_TRAP_TOTAL_QUESTIONS) * 100)}%`;
  }, [correctQuestions]);

  const renderDifficultyCard = (nextDifficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`summary-item ${difficulty === nextDifficulty ? "summary-item-active" : ""}`}
      onClick={() => setDifficulty(nextDifficulty)}
    >
      <Text className="summary-value">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="summary-label">{copy}</Text>
    </View>
  );

  return (
    <View className="color-trap-page">
      {phase === "start" ? (
        <View className="trap-start start-screen">
          <View className="header-section">
            <View className="logo-icon">
              <Text className="logo-emoji">色</Text>
            </View>
            <Text className="game-title">颜色陷阱</Text>
            <Text className="game-subtitle">在文字含义和字体颜色之间快速切换</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">当前难度最高</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 每局 8 题，按提示选择颜色。</Text>
            <Text className="rule-item">2. “字体颜色”看字的颜色，“文字含义”看字本身。</Text>
            <Text className="rule-item">3. 快速答对和连续答对会获得额外得分。</Text>
          </View>

          {!isGauntletPreset && (
          <View className="summary-card">
            <Text className="section-title">难度</Text>
            <View className="summary-grid">
              {renderDifficultyCard("normal", "规则交替 · 节奏舒缓")}
              {renderDifficultyCard("hard", "更多颜色干扰 · 限时更紧")}
            </View>
          </View>
          )}

          <View className="floating-start-action">
            <View className="primary-button" onClick={startGame}>
              <Text className="primary-button-text">开始训练</Text>
            </View>
          </View>
          <View className="floating-start-spacer" />
        </View>
      ) : null}

      {(phase === "playing" || phase === "feedback") && currentQuestion ? (
        <View className="trap-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{COLOR_TRAP_TOTAL_QUESTIONS}</Text>
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

          <View className="stimulus-card">
            <Text className="question-kicker">
              {currentQuestion.rule === "ink" ? "选择字体颜色" : "选择文字含义"}
            </Text>
            <Text
              className="color-word"
              style={{ color: currentQuestion.inkColor.hex }}
            >
              {currentQuestion.wordColor.label}
            </Text>
            <Text className="stimulus-copy">
              {currentQuestion.rule === "ink"
                ? "忽略字的意思，只看它显示成什么颜色"
                : "忽略显示颜色，只看这个字写的是什么"}
            </Text>
          </View>

          <View className="option-grid">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedColorId === option.id;
              const isAnswer = phase === "feedback" && option.id === currentQuestion.answer;
              return (
                <View
                  key={option.id}
                  className={`option-card ${isSelected ? "option-selected" : ""} ${isAnswer ? "option-answer" : ""}`}
                  onClick={() => submitAnswer(option.id)}
                >
                  <View className="option-swatch" style={{ backgroundColor: option.hex }} />
                  <Text className="option-text">{option.label}</Text>
                </View>
              );
            })}
          </View>

          {phase === "feedback" ? (
            <View className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastResult?.correct ? "判断正确" : "正确答案"}</Text>
              <Text className="feedback-copy">
                {currentQuestion.options.find((option) => option.id === currentQuestion.answer)?.label}
                色 · 本题 +{lastResult?.score ?? 0}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="trap-result">
          <View className="result-card">
            <Text className="result-kicker">训练完成</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              颜色陷阱 · {getTrainingDifficultyLabel(difficulty)} {isNewBest ? "· 新最高" : ""}
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
