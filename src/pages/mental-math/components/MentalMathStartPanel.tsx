import { Text, View } from "@tarojs/components";
import type { TrainingDifficulty } from "../../../utils/trainingStorage";
import {
  CUSTOM_MATH_STAGE_ID,
  CUSTOM_OPERATION_OPTIONS,
  CUSTOM_RANGE_OPTIONS,
  type CustomMathConfig,
  type CustomMathOperation,
  type CustomMathRangeId,
  type MathStage,
  type MathStageId,
} from "../mathStages";

export type MentalMathGameMode = "timed" | "death";

export interface MentalMathStartPanelProps {
  highScore: number;
  isGauntletPreset: boolean;
  gameMode: MentalMathGameMode;
  selectedStageId: MathStageId;
  customConfig: CustomMathConfig;
  customProfileSummary: string;
  stages: MathStage[];
  getStageDifficulty: (stageId: MathStageId) => TrainingDifficulty;
  getDifficultyLabel: (difficulty: TrainingDifficulty) => string;
  onStageChange: (stageId: MathStageId) => void;
  onModeChange: (mode: MentalMathGameMode) => void;
  onToggleCustomOperation: (operation: CustomMathOperation | "all") => void;
  onSelectCustomRange: (rangeId: CustomMathRangeId) => void;
  onStart: () => void;
}

export default function MentalMathStartPanel({
  highScore,
  isGauntletPreset,
  gameMode,
  selectedStageId,
  customConfig,
  customProfileSummary,
  stages,
  getStageDifficulty,
  getDifficultyLabel,
  onStageChange,
  onModeChange,
  onToggleCustomOperation,
  onSelectCustomRange,
  onStart,
}: MentalMathStartPanelProps) {
  const isCustomStage = selectedStageId === CUSTOM_MATH_STAGE_ID;

  return (
    <View className="start-screen">
      <View className="header-section">
        <View className="logo-container">
          <View className="logo-icon">
            <Text className="logo-emoji">🧮</Text>
          </View>
        </View>
        <Text className="game-title">速算挑战</Text>

        <View className="high-score-badge">
          <View className="high-score-icon">
            <Text className="high-score-icon-text">🏆</Text>
          </View>
          <View className="high-score-content">
            <Text className="high-score-label">历史最高分</Text>
            <Text className="high-score-value">{highScore}</Text>
          </View>
        </View>
      </View>

      {!isGauntletPreset && (
        <View className="mode-section">
          <View className="mode-header">
            <View className="mode-icon">
              <Text className="mode-icon-text">⚡</Text>
            </View>
            <Text className="mode-title">选择训练内容</Text>
          </View>
          <View className="stage-grid">
            {stages.map((stage) => (
              <View
                key={stage.id}
                className={`stage-item ${selectedStageId === stage.id ? "stage-item-selected" : ""}`}
                onClick={() => onStageChange(stage.id)}
              >
                <View className="stage-item-header">
                  <Text className="stage-name">{stage.name}</Text>
                  <Text
                    className={`stage-difficulty stage-difficulty-${getStageDifficulty(stage.id)}`}
                  >
                    积分{getDifficultyLabel(getStageDifficulty(stage.id))}
                  </Text>
                </View>
                <Text className="stage-short-name">
                  {stage.id === CUSTOM_MATH_STAGE_ID
                    ? `${stage.shortName}: ${customProfileSummary}`
                    : stage.shortName}
                </Text>
                <Text className="stage-desc">{stage.summary}</Text>
              </View>
            ))}
          </View>
          {isCustomStage && (
            <View className="custom-panel">
              <View className="custom-group">
                <Text className="custom-label">运算</Text>
                <View className="custom-chip-row">
                  {CUSTOM_OPERATION_OPTIONS.map((operation) => {
                    const selected =
                      operation.id === "all"
                        ? customConfig.operations.length === 4
                        : customConfig.operations.includes(operation.id);
                    return (
                      <View
                        key={operation.id}
                        className={`custom-chip ${selected ? "custom-chip-selected" : ""}`}
                        onClick={() => onToggleCustomOperation(operation.id)}
                      >
                        <Text className="custom-chip-text">{operation.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View className="custom-group">
                <Text className="custom-label">数字范围</Text>
                <View className="custom-chip-row">
                  {CUSTOM_RANGE_OPTIONS.map((range) => (
                    <View
                      key={range.id}
                      className={`custom-chip ${customConfig.rangeId === range.id ? "custom-chip-selected" : ""}`}
                      onClick={() => onSelectCustomRange(range.id)}
                    >
                      <Text className="custom-chip-text">{range.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {!isGauntletPreset && (
        <View className="mode-section">
          <View className="mode-header">
            <View className="mode-icon">
              <Text className="mode-icon-text">🎮</Text>
            </View>
            <Text className="mode-title">选择模式</Text>
          </View>
          <View className="mode-grid">
            <View
              className={`mode-item ${gameMode === "timed" ? "mode-item-selected" : ""}`}
              onClick={() => onModeChange("timed")}
            >
              <View className="mode-name">限时模式</View>
              <View className="mode-desc">30秒倒计时</View>
            </View>
            <View
              className={`mode-item ${gameMode === "death" ? "mode-item-selected" : ""}`}
              onClick={() => onModeChange("death")}
            >
              <View className="mode-name">闯关模式</View>
              <View className="mode-desc">错一题就结束</View>
            </View>
          </View>
        </View>
      )}

      <View className="rules-card">
        <View className="rules-header">
          <View className="rules-icon">
            <Text className="rules-icon-text">📋</Text>
          </View>
          <Text className="rules-title">游戏规则</Text>
        </View>
        <View className="rules-list">
          <View className="rule-item">
            <Text className="rule-number">1.</Text>
            <Text className="rule-text">
              {gameMode === "timed" ? "30秒限时，越快越准越好" : "连续闯关，错一题结束"}
            </Text>
          </View>
          <View className="rule-item">
            <Text className="rule-number">2.</Text>
            <Text className="rule-text">点击四个选项中正确的答案</Text>
          </View>
          <View className="rule-item">
            <Text className="rule-number">3.</Text>
            <Text className="rule-text">
              {gameMode === "timed" ? "答错不结束，继续挑战下一题" : "答对一题进一关，答错立即结束"}
            </Text>
          </View>
        </View>
      </View>

      <View className="start-button-container floating-start-action">
        <View className="start-button" onClick={onStart}>
          <Text className="start-button-text">开始挑战</Text>
        </View>
      </View>
    </View>
  );
}
