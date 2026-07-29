import { View, Text } from "@tarojs/components";

type FarmCountResultProps = {
  score: number;
  modeTitle: string;
  difficultyLabel: string;
  accuracyText: string;
  bestCombo: number;
  awardedPoints: number;
  isNewBest: boolean;
  onBack: () => void;
  onRestart: () => void;
};

export default function FarmCountResult({
  score,
  modeTitle,
  difficultyLabel,
  accuracyText,
  bestCombo,
  awardedPoints,
  isNewBest,
  onBack,
  onRestart,
}: FarmCountResultProps) {
  return (
    <View className="farm-result">
      <View className="result-card">
        <Text className="result-kicker">{isNewBest ? "刷新最高分" : "训练完成"}</Text>
        <Text className="result-score">{score}</Text>
        <Text className="result-copy">{modeTitle} · {difficultyLabel}</Text>
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
          <View className="secondary-button" onClick={onBack}>
            <Text className="secondary-button-text">返回设置</Text>
          </View>
          <View className="primary-button" onClick={onRestart}>
            <Text className="primary-button-text">再练一局</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
