import { Text, View } from "@tarojs/components";
import type { TrainingDifficulty } from "../../../utils/trainingStorage";

export interface PatternStartPanelProps {
  best: number;
  rewardDifficulty: TrainingDifficulty;
  isGauntletPreset: boolean;
  sessionLength: number;
  hintsPerSession: number;
  onDifficultyChange: (difficulty: TrainingDifficulty) => void;
  onStart: () => void;
}

export default function PatternStartPanel({
  best,
  rewardDifficulty,
  isGauntletPreset,
  sessionLength,
  hintsPerSession,
  onDifficultyChange,
  onStart,
}: PatternStartPanelProps) {
  return (
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
        <Text className="rule-item">
          1. 每局共 {sessionLength} 个规律案件，包含序列和矩阵推理。
        </Text>
        <Text className="rule-item">2. 同时观察形状、颜色、数量、大小和位置，选择缺口答案。</Text>
        <Text className="rule-item">3. 答错时会揭示正确答案、完整规律和关键干扰项。</Text>
        <Text className="rule-item">
          4. 每局有 {hintsPerSession} 次线索，只提示观察方向，不直接给答案。
        </Text>
        <Text className="rule-item">5. 分数来自答对、连击和快速识破；使用线索会少拿 1 分。</Text>
      </View>

      <View className="summary-card">
        <Text className="section-title">本局设定</Text>
        <View className="summary-grid">
          <View className="summary-item">
            <Text className="summary-value">{sessionLength}</Text>
            <Text className="summary-label">案件数量</Text>
          </View>
          <View className="summary-item">
            <Text className="summary-value">4</Text>
            <Text className="summary-label">规律类型</Text>
          </View>
          <View className="summary-item">
            <Text className="summary-value">{hintsPerSession}</Text>
            <Text className="summary-label">可用线索</Text>
          </View>
        </View>
      </View>

      {!isGauntletPreset && (
        <View className="summary-card">
          <Text className="section-title">难度</Text>
          <View className="summary-grid difficulty-grid">
            <View
              className={`summary-item ${rewardDifficulty === "normal" ? "summary-item-active" : ""}`}
              onClick={() => onDifficultyChange("normal")}
            >
              <Text className="summary-value">普通</Text>
              <Text className="summary-label">双线索推理 · 1.0x</Text>
            </View>
            <View
              className={`summary-item ${rewardDifficulty === "hard" ? "summary-item-active" : ""}`}
              onClick={() => onDifficultyChange("hard")}
            >
              <Text className="summary-value">困难</Text>
              <Text className="summary-label">多规则强干扰 · 1.5x</Text>
            </View>
          </View>
        </View>
      )}

      <View className="floating-start-action">
        <View className="primary-button" onClick={onStart}>
          <Text className="button-text">开始挑战</Text>
        </View>
      </View>
      <View className="footer-gap floating-start-spacer" />
    </View>
  );
}
