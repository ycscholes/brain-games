import { Text, View } from "@tarojs/components";
import type { PatternCell, PatternOption, PatternQuestion, PatternScoreResult } from "../patterns";

export interface PatternPlayPanelProps {
  currentIndex: number;
  totalQuestions: number;
  finalScore: number;
  elapsedText: string;
  difficultyLabel: string;
  currentCombo: number;
  remainingHints: number;
  currentQuestion: PatternQuestion;
  phase: "playing" | "reveal";
  hintVisible: boolean;
  hintUsedForCurrent: boolean;
  selectedOptionId: string;
  lastAnswerCorrect: boolean;
  currentScoreResult: PatternScoreResult | null;
  selectedDistractorExplanation: string;
  onOptionSelect: (option: PatternOption) => void;
  onHint: () => void;
  onNextCase: () => void;
}

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

function PatternToken({ option, compact = false }: { option: PatternOption; compact?: boolean }) {
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
      {isAnswerVisible ? (
        <PatternToken option={answer} compact />
      ) : (
        <Text className="answer-slot-text">?</Text>
      )}
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

export default function PatternPlayPanel({
  currentIndex,
  totalQuestions,
  finalScore,
  elapsedText,
  difficultyLabel,
  currentCombo,
  remainingHints,
  currentQuestion,
  phase,
  hintVisible,
  hintUsedForCurrent,
  selectedOptionId,
  lastAnswerCorrect,
  currentScoreResult,
  selectedDistractorExplanation,
  onOptionSelect,
  onHint,
  onNextCase,
}: PatternPlayPanelProps) {
  return (
    <View className="game-screen">
      <View className="status-row">
        <View className="status-card">
          <Text className="status-value">
            {currentIndex + 1}/{totalQuestions}
          </Text>
          <Text className="status-label">当前案件</Text>
        </View>
        <View className="status-card">
          <Text className="status-value">{finalScore}</Text>
          <Text className="status-label">当前分数</Text>
        </View>
        <View className="status-card">
          <Text className="status-value">{elapsedText}</Text>
          <Text className="status-label">已用时间</Text>
        </View>
      </View>

      <View className="question-card">
        <View className="question-meta-row">
          <Text className="difficulty-tag">{difficultyLabel}</Text>
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
            <View
              key={`${currentQuestion.id}-${option.id}`}
              className={classNames}
              onClick={() => onOptionSelect(option)}
            >
              <Text className="option-letter">{OPTION_LETTERS[optionIndex]}</Text>
              <PatternToken option={option} />
            </View>
          );
        })}
      </View>

      {phase === "playing" ? (
        <View
          className={`hint-button ${remainingHints <= 0 || hintUsedForCurrent ? "hint-button-disabled" : ""}`}
          onClick={onHint}
        >
          <Text className="hint-button-text">
            {remainingHints > 0 ? `给我线索（剩余 ${remainingHints}）` : "线索已用完"}
          </Text>
        </View>
      ) : null}

      {phase === "reveal" ? (
        <View
          className={`feedback-card ${lastAnswerCorrect ? "feedback-correct" : "feedback-wrong"}`}
        >
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
              {currentScoreResult.hintPenalty > 0 ? (
                <Text className="score-chip score-chip-penalty">线索 -1</Text>
              ) : null}
            </View>
          ) : null}
          <View className="rule-card">
            <Text className="rule-card-title">{currentQuestion.explanationTitle}</Text>
            <Text className="rule-card-summary">{currentQuestion.ruleSummary}</Text>
            <Text className="rule-card-text">{currentQuestion.explanation}</Text>
            {!lastAnswerCorrect && selectedDistractorExplanation ? (
              <Text className="rule-card-text rule-card-distractor">
                {selectedDistractorExplanation}
              </Text>
            ) : null}
          </View>
          <View className="primary-button next-button" onClick={onNextCase}>
            <Text className="button-text">
              {currentIndex >= totalQuestions - 1 ? "查看成绩" : "下一案"}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
