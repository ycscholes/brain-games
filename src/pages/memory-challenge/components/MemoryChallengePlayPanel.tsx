import { Image, Text, View } from "@tarojs/components";
import type { MemoryChallengeItem, MemoryChallengeOption } from "../gameLogic";

export interface MemoryChallengePlayPanelProps {
  gameState: "memorize" | "playing";
  modeIcon: string;
  round: number;
  score: number;
  statusText: string;
  currentItem: MemoryChallengeItem;
  timeLeft: number;
  answerTimeSeconds: number;
  options: MemoryChallengeOption[];
  selectedId: string | null;
  feedback: "none" | "correct" | "wrong";
  onSelect: (id: string) => void;
}

function renderItemContent(item: MemoryChallengeItem, className: string) {
  if (item.imageSrc) {
    return <Image src={item.imageSrc} className={className} mode="aspectFit" />;
  }
  return <Text className={`${className} calculation-text`}>{item.prompt}</Text>;
}

export default function MemoryChallengePlayPanel({
  gameState,
  modeIcon,
  round,
  score,
  statusText,
  currentItem,
  timeLeft,
  answerTimeSeconds,
  options,
  selectedId,
  feedback,
  onSelect,
}: MemoryChallengePlayPanelProps) {
  return (
    <View className="game-screen">
      <View className="top-bar">
        <View className="top-bar-item">
          <Text className="top-bar-icon-text">{modeIcon}</Text>
          <Text className="top-bar-text">题目 {round}</Text>
        </View>
        <View className="top-bar-item">
          <Text className="top-bar-icon-text">🏆</Text>
          <Text className="top-bar-text">{score} 分</Text>
        </View>
      </View>

      <View className="main-card">
        <View
          className={`status-badge ${gameState === "memorize" ? "status-badge-memorize" : "status-badge-play"}`}
        >
          <Text className="status-badge-text">{statusText}</Text>
        </View>
        <View className="shape-display">{renderItemContent(currentItem, "shape-image")}</View>

        {gameState === "playing" && (
          <>
            <View className="countdown">
              <Text className={`countdown-text ${timeLeft < 3 ? "countdown-urgent" : ""}`}>
                {timeLeft.toFixed(1)}
              </Text>
            </View>
            <View className="progress-bar">
              <View
                className="progress-bar-fill"
                style={{ width: `${(timeLeft / answerTimeSeconds) * 100}%` }}
              />
            </View>
          </>
        )}
      </View>

      {gameState === "playing" ? (
        <View className="options-grid">
          {options.map((option) => {
            const isSelected = selectedId === option.id;
            const optionClass = isSelected
              ? `option-item ${feedback === "correct" ? "option-item-correct" : "option-item-wrong"}`
              : "option-item";
            return (
              <View key={option.id} className={optionClass} onClick={() => onSelect(option.id)}>
                {option.imageSrc ? (
                  <Image src={option.imageSrc} className="option-image" mode="aspectFit" />
                ) : (
                  <Text className="option-number">{option.label}</Text>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View className="loading-section">
          <View className="loading-dots">
            <View className="loading-dot" />
            <View className="loading-dot loading-dot-delay-1" />
            <View className="loading-dot loading-dot-delay-2" />
          </View>
        </View>
      )}
    </View>
  );
}
