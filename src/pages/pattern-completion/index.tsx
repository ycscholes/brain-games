import { useCallback, useEffect, useRef, useState } from "react";
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
  generatePatternSession,
  PATTERN_HINTS_PER_SESSION,
  PATTERN_SESSION_LENGTH,
  scorePatternQuestion,
  type PatternCell,
  type PatternOption,
  type PatternQuestion,
  type PatternScoreResult,
} from "./patterns";
import "./index.scss";

type Phase = "start" | "playing" | "reveal" | "finished";

const STORAGE_KEY_PREFIX = "pattern_completion_best";
const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
const SPEED_TARGET_MS: Record<TrainingDifficulty, number> = {
  normal: 12000,
  hard: 9000,
};

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

function PatternToken({
  option,
  compact = false,
}: {
  option: PatternOption;
  compact?: boolean;
}) {
  const shapeItems = Array.from({ length: option.count }, (_, index) => index);

  return (
    <View className={`pattern-token ${compact ? "pattern-token-compact" : ""}`}>
      <View className={`shape-shell shape-shell-${option.size} shape-position-${option.position}`}>
        {shapeItems.map((item) => (
          <View
            key={`${option.id}-${item}`}
            className={`shape shape-${option.shape} shape-size-${option.size}`}
            style={{ color: option.colorHex }}
          />
        ))}
      </View>
      {!compact ? <Text className="token-label">{option.label}</Text> : null}
    </View>
  );
}

function PatternBoardCell({
  cell,
  index,
  isAnswerVisible,
  answer,
}: {
  cell: PatternCell;
  index: number;
  isAnswerVisible: boolean;
  answer: PatternOption;
}) {
  if (cell) {
    return <PatternToken key={`${cell.id}-${index}`} option={cell} compact />;
  }

  return (
    <View className={`answer-slot ${isAnswerVisible ? "answer-slot-revealed" : ""}`}>
      {isAnswerVisible ? <PatternToken option={answer} compact /> : <Text className="answer-slot-text">?</Text>}
    </View>
    );
}

function PatternBoard({
  question,
  isAnswerVisible,
}: {
  question: PatternQuestion;
  isAnswerVisible: boolean;
}) {
  const className = [
    question.layout === "grid" ? "pattern-grid" : "sequence-row",
    question.layout === "grid" ? `pattern-grid-${question.columns}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View className={className}>
      {question.cells.map((cell, index) => (
        <PatternBoardCell
          key={`${question.id}-cell-${index}`}
          cell={cell}
          index={index}
          isAnswerVisible={isAnswerVisible}
          answer={question.answer}
        />
      ))}
    </View>
  );
}

export default function PatternCompletion() {
  usePageShare("pages/pattern-completion/index");

  const [phase, setPhase] = useState<Phase>("start");
  const [rewardDifficulty, setRewardDifficulty] = useState<TrainingDifficulty>("normal");
  const [best, setBest] = useState(0);
  const [session, setSession] = useState<PatternQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const [hintUsedForCurrent, setHintUsedForCurrent] = useState(false);
  const [remainingHints, setRemainingHints] = useState(PATTERN_HINTS_PER_SESSION);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [longestCombo, setLongestCombo] = useState(0);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [currentScoreResult, setCurrentScoreResult] = useState<PatternScoreResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const startTimeRef = useRef(0);
  const questionStartedAtRef = useRef(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRecordedRef = useRef(false);

  const totalQuestions = session.length || PATTERN_SESSION_LENGTH;
  const currentQuestion =
    phase === "playing" || phase === "reveal" ? session[currentIndex] ?? null : null;
  const hintsUsed = PATTERN_HINTS_PER_SESSION - remainingHints;
  const multiruleCases = session.filter((question) => question.ruleCount >= 2).length;
  const selectedDistractorExplanation =
    currentQuestion && selectedOptionId
      ? currentQuestion.distractorExplanations?.[selectedOptionId] ?? ""
      : "";

  const clearTicker = () => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  const refreshBest = useCallback(() => {
    const value = Number(
      Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${rewardDifficulty}`) ||
        (rewardDifficulty === "normal" ? Taro.getStorageSync(STORAGE_KEY_PREFIX) : 0),
    );
    setBest(Number.isFinite(value) ? value : 0);
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
      clearTicker();
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing" && phase !== "reveal") {
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
    (settledFinalScore: number) => {
      if (finishRecordedRef.current) {
        setPhase("finished");
        return;
      }

      finishRecordedRef.current = true;
      clearTicker();

      const settledElapsedMs = Date.now() - startTimeRef.current;
      const awardedPoints = getAwardedPoints("pattern-completion", settledFinalScore, rewardDifficulty);
      const durationSeconds = Math.round(settledElapsedMs / 1000);
      if (completeGauntletLegIfNeeded({
        gameId: "pattern-completion",
        score: settledFinalScore,
        awardedPoints,
        durationSeconds,
        difficulty: rewardDifficulty,
        outcome: "completed",
      })) {
        return;
      }

      setElapsedMs(settledElapsedMs);
      setFinalScore(settledFinalScore);
      addPointsToPet("pattern-completion", settledFinalScore, rewardDifficulty);
      recordTrainingSession({
        gameId: "pattern-completion",
        score: settledFinalScore,
        awardedPoints,
        durationSeconds,
        difficulty: rewardDifficulty,
        outcome: "completed",
      });
      setPhase("finished");

      if (settledFinalScore > best) {
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${rewardDifficulty}`, settledFinalScore);
        setBest(settledFinalScore);
        setIsNewBest(true);
      } else {
        setIsNewBest(false);
      }
    },
    [best, rewardDifficulty],
  );

  const resetRoundState = () => {
    setSelectedOptionId("");
    setHintVisible(false);
    setHintUsedForCurrent(false);
    setCurrentScoreResult(null);
    setLastAnswerCorrect(false);
    questionStartedAtRef.current = Date.now();
  };

  const startGame = () => {
    clearTicker();

    const nextSession = generatePatternSession(rewardDifficulty);
    startTimeRef.current = Date.now();
    questionStartedAtRef.current = Date.now();
    finishRecordedRef.current = false;
    setSession(nextSession);
    setPhase("playing");
    setCurrentIndex(0);
    setCorrectCount(0);
    setRemainingHints(PATTERN_HINTS_PER_SESSION);
    setCurrentCombo(0);
    setLongestCombo(0);
    setElapsedMs(0);
    setFinalScore(0);
    setIsNewBest(false);
    resetRoundState();
  };

  const backToStart = () => {
    clearTicker();
    finishRecordedRef.current = false;
    setPhase("start");
    setSession([]);
    setCurrentIndex(0);
    setCorrectCount(0);
    setRemainingHints(PATTERN_HINTS_PER_SESSION);
    setCurrentCombo(0);
    setLongestCombo(0);
    setElapsedMs(0);
    setFinalScore(0);
    setIsNewBest(false);
    resetRoundState();
    refreshBest();
  };

  const handleHint = () => {
    if (!currentQuestion || phase !== "playing" || selectedOptionId || remainingHints <= 0 || hintUsedForCurrent) {
      return;
    }

    setRemainingHints((prev) => prev - 1);
    setHintUsedForCurrent(true);
    setHintVisible(true);
  };

  const handleOptionSelect = (option: PatternOption) => {
    if (!currentQuestion || selectedOptionId || phase !== "playing") {
      return;
    }

    const isCorrect = option.id === currentQuestion.answer.id;
    const questionElapsedMs = Date.now() - questionStartedAtRef.current;
    const scoreResult = scorePatternQuestion({
      isCorrect,
      currentCombo,
      elapsedMs: questionElapsedMs,
      targetMs: SPEED_TARGET_MS[rewardDifficulty],
      hintUsed: hintUsedForCurrent,
    });
    const nextCombo = isCorrect ? currentCombo + 1 : 0;
    const nextFinalScore = finalScore + scoreResult.score;

    setSelectedOptionId(option.id);
    setLastAnswerCorrect(isCorrect);
    setCurrentScoreResult(scoreResult);
    setFinalScore(nextFinalScore);
    setCorrectCount((prev) => prev + (isCorrect ? 1 : 0));
    setCurrentCombo(nextCombo);
    setLongestCombo((prev) => Math.max(prev, nextCombo));

    if (isCorrect) {
      if (currentIndex >= totalQuestions - 1) {
        finishGame(nextFinalScore);
        return;
      }

      setCurrentIndex((prev) => prev + 1);
      resetRoundState();
      setPhase("playing");
      return;
    }

    setPhase("reveal");
  };

  const handleNextCase = () => {
    if (phase !== "reveal") {
      return;
    }

    if (currentIndex >= totalQuestions - 1) {
      finishGame(finalScore);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    resetRoundState();
    setPhase("playing");
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
            <Text className="game-subtitle">先观察作答，再揭示隐藏规律</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">最佳分数</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 每局共 {PATTERN_SESSION_LENGTH} 个规律案件，包含序列和矩阵推理。</Text>
            <Text className="rule-item">2. 同时观察形状、颜色、数量、大小和位置，选择缺口答案。</Text>
            <Text className="rule-item">3. 答错时会揭示正确答案、完整规律和关键干扰项。</Text>
            <Text className="rule-item">4. 每局有 {PATTERN_HINTS_PER_SESSION} 次线索，只提示观察方向，不直接给答案。</Text>
            <Text className="rule-item">5. 分数来自答对、连击和快速识破；使用线索会少拿 1 分。</Text>
          </View>

          <View className="summary-card">
            <Text className="section-title">本局设定</Text>
            <View className="summary-grid">
              <View className="summary-item">
                <Text className="summary-value">{PATTERN_SESSION_LENGTH}</Text>
                <Text className="summary-label">案件数量</Text>
              </View>
              <View className="summary-item">
                <Text className="summary-value">4</Text>
                <Text className="summary-label">规律类型</Text>
              </View>
              <View className="summary-item">
                <Text className="summary-value">{PATTERN_HINTS_PER_SESSION}</Text>
                <Text className="summary-label">可用线索</Text>
              </View>
            </View>
          </View>

          <View className="summary-card">
            <Text className="section-title">难度</Text>
            <View className="summary-grid difficulty-grid">
              <View
                className={`summary-item ${rewardDifficulty === "normal" ? "summary-item-active" : ""}`}
                onClick={() => setRewardDifficulty("normal")}
              >
                <Text className="summary-value">普通</Text>
                <Text className="summary-label">双线索推理 · 1.0x</Text>
              </View>
              <View
                className={`summary-item ${rewardDifficulty === "hard" ? "summary-item-active" : ""}`}
                onClick={() => setRewardDifficulty("hard")}
              >
                <Text className="summary-value">困难</Text>
                <Text className="summary-label">多规则强干扰 · 1.5x</Text>
              </View>
            </View>
          </View>

          <View className="floating-start-action">
            <View className="primary-button" onClick={startGame}>
              <Text className="button-text">开始挑战</Text>
            </View>
          </View>
          <View className="footer-gap floating-start-spacer" />
        </View>
      ) : null}

      {(phase === "playing" || phase === "reveal") && currentQuestion ? (
        <View className="game-screen">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{totalQuestions}</Text>
              <Text className="status-label">当前案件</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{finalScore}</Text>
              <Text className="status-label">当前分数</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{formatElapsed(elapsedMs)}</Text>
              <Text className="status-label">已用时间</Text>
            </View>
          </View>

          <View className="question-card">
            <View className="question-meta-row">
              <Text className="difficulty-tag">{difficultyLabelMap[currentQuestion.difficulty]}</Text>
              <Text className="combo-tag">连击 {currentCombo}</Text>
              <Text className="hint-count-tag">线索 {remainingHints}</Text>
            </View>
            <Text className="question-title">{currentQuestion.title}</Text>
            <Text className="question-subtitle">{currentQuestion.prompt}</Text>

            <PatternBoard question={currentQuestion} isAnswerVisible={phase === "reveal"} />
          </View>

          {hintVisible ? (
            <View className="hint-card">
              <Text className="hint-title">线索</Text>
              <Text className="hint-text">{currentQuestion.hint}</Text>
            </View>
          ) : null}

          <View className="options-grid">
            {currentQuestion.options.map((option, optionIndex) => {
              const isSelected = selectedOptionId === option.id;
              const isCorrect = option.id === currentQuestion.answer.id;
              const classNames = [
                "option-card",
                isSelected ? "option-selected" : "",
                phase === "reveal" && isCorrect ? "option-correct" : "",
                phase === "reveal" && isSelected && !isCorrect ? "option-wrong" : "",
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

          {phase === "playing" ? (
            <View
              className={`hint-button ${remainingHints <= 0 || hintUsedForCurrent ? "hint-button-disabled" : ""}`}
              onClick={handleHint}
            >
              <Text className="hint-button-text">
                {remainingHints > 0 ? `给我线索（剩余 ${remainingHints}）` : "线索已用完"}
              </Text>
            </View>
          ) : null}

          {phase === "reveal" ? (
            <View className={`feedback-card ${lastAnswerCorrect ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastAnswerCorrect ? "识破规律" : "差一点"}</Text>
              <Text className="feedback-text">
                正确答案是 {currentQuestion.answer.label}
                {currentScoreResult ? `，本题 +${currentScoreResult.score}` : ""}
              </Text>
              {currentScoreResult ? (
                <View className="score-chip-row">
                  <Text className="score-chip">基础 {currentScoreResult.baseScore}</Text>
                  <Text className="score-chip">连击 +{currentScoreResult.comboBonus}</Text>
                  <Text className="score-chip">速度 +{currentScoreResult.speedBonus}</Text>
                  {currentScoreResult.hintPenalty > 0 ? <Text className="score-chip score-chip-penalty">线索 -1</Text> : null}
                </View>
              ) : null}
              <View className="rule-card">
                <Text className="rule-card-title">{currentQuestion.explanationTitle}</Text>
                <Text className="rule-card-summary">{currentQuestion.ruleSummary}</Text>
                <Text className="rule-card-text">{currentQuestion.explanation}</Text>
                {!lastAnswerCorrect && selectedDistractorExplanation ? (
                  <Text className="rule-card-text rule-card-distractor">{selectedDistractorExplanation}</Text>
                ) : null}
              </View>
              <View className="primary-button next-button" onClick={handleNextCase}>
                <Text className="button-text">{currentIndex >= totalQuestions - 1 ? "查看成绩" : "下一案"}</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="result-screen">
          <View className="result-card">
            <Text className="result-title">本局成绩</Text>
            <Text className="result-score">{finalScore}</Text>
            <Text className="result-desc">识破 {correctCount} / {totalQuestions} 个案件</Text>
            <Text className="result-desc">最长连击 {longestCombo}，使用线索 {hintsUsed} 次</Text>
            <Text className="result-desc">多规则案件 {multiruleCases} 个，最高单题 5 分</Text>
            <Text className="result-desc">完成用时 {formatElapsed(elapsedMs)}</Text>
            <Text className="result-desc">
              积分{getTrainingDifficultyLabel(rewardDifficulty)} · 获得 {getAwardedPoints("pattern-completion", finalScore, rewardDifficulty)} 积分
            </Text>
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
            <View className="secondary-button" onClick={() => Taro.reLaunch({ url: "/pages/index/index" })}>
              <Text className="button-text">返回游戏主页</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
