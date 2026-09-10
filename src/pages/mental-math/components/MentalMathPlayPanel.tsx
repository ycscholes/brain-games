import { Text, View } from "@tarojs/components";
import type { MathProblem } from "../mathStages";
import type { MentalMathGameMode } from "./MentalMathStartPanel";

export interface MentalMathPlayPanelProps {
  gameMode: MentalMathGameMode;
  stageTitle: string;
  stageShortName: string;
  timeLeft: number;
  score: number;
  correctCount: number;
  currentProblem: MathProblem;
  options: number[];
  selectedAnswer: number | null;
  feedback: "none" | "correct" | "wrong";
  onSelect: (answer: number) => void;
}

export default function MentalMathPlayPanel({
  gameMode,
  stageTitle,
  stageShortName,
  timeLeft,
  score,
  correctCount,
  currentProblem,
  options,
  selectedAnswer,
  feedback,
  onSelect,
}: MentalMathPlayPanelProps) {
  const getOptionClass = (option: number): string => {
    if (selectedAnswer === null || feedback === "none") return "option-item";
    if (option === currentProblem.answer) return "option-item option-correct";
    if (option === selectedAnswer && feedback === "wrong") return "option-item option-wrong";
    return "option-item";
  };

  return (
    <View className="game-screen">
      <View className="top-bar">
        <View className="top-bar-stage">
          <Text className="top-bar-stage-text">
            {stageTitle} · {stageShortName}
          </Text>
        </View>
        {gameMode === "timed" && (
          <View className="top-bar-item">
            <View className="top-bar-icon top-bar-icon-clock">
              <Text className="top-bar-icon-text">⏱️</Text>
            </View>
            <Text className="top-bar-text">{Math.ceil(timeLeft)}s</Text>
          </View>
        )}
        <View className="top-bar-item">
          <View className="top-bar-icon top-bar-icon-trophy">
            <Text className="top-bar-icon-text">✅</Text>
          </View>
          <Text className="top-bar-text">
            {gameMode === "timed" ? `${score} 分` : `${correctCount} 题`}
          </Text>
        </View>
      </View>

      {gameMode === "timed" && (
        <View className="progress-bar">
          <View
            className="progress-bar-fill"
            style={{
              width: `${(timeLeft / 30) * 100}%`,
            }}
          />
        </View>
      )}

      {gameMode === "death" && (
        <View className="streak-progress">
          <Text className="streak-text">当前连对: {correctCount} 题</Text>
        </View>
      )}

      <View className="problem-card">
        <Text className="question-text">{currentProblem.question}</Text>
      </View>

      <View className="options-grid">
        {options.map((option) => (
          <View key={option} className={getOptionClass(option)} onClick={() => onSelect(option)}>
            <Text className="option-text">{option}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
