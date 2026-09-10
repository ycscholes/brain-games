import { View, Text } from "@tarojs/components";
import {
  getTrainingDifficultyLabel,
  type TrainingDifficulty,
} from "../../../utils/trainingStorage";
import {
  HEAD_COUNT_SPEED_LABELS,
  type HeadCountDifficulty,
  type HeadCountSpeedDifficulty,
} from "../../head-count/gameLogic";

export type FarmCountMode = "speed" | "yard";

export interface FarmCountStartPanelProps {
  mode: FarmCountMode;
  difficulty: TrainingDifficulty;
  yardDifficulty: HeadCountDifficulty;
  speedDifficulty: HeadCountSpeedDifficulty;
  best: number;
  isGauntletPreset: boolean;
  onModeChange: (mode: FarmCountMode) => void;
  onDifficultyChange: (difficulty: TrainingDifficulty) => void;
  onYardDifficultyChange: (difficulty: HeadCountDifficulty) => void;
  onSpeedDifficultyChange: (difficulty: HeadCountSpeedDifficulty) => void;
  onStart: () => void;
}

export default function FarmCountStartPanel({
  mode,
  difficulty,
  yardDifficulty,
  speedDifficulty,
  best,
  isGauntletPreset,
  onModeChange,
  onDifficultyChange,
  onYardDifficultyChange,
  onSpeedDifficultyChange,
  onStart,
}: FarmCountStartPanelProps) {
  const renderSpeedDifficultyCard = (nextDifficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`summary-item ${difficulty === nextDifficulty ? "summary-item-active" : ""}`}
      onClick={() => onDifficultyChange(nextDifficulty)}
    >
      <Text className="summary-value">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="summary-label">{copy}</Text>
    </View>
  );

  const renderYardDifficultyCard = (nextDifficulty: HeadCountDifficulty, copy: string) => (
    <View
      className={`summary-item ${yardDifficulty === nextDifficulty ? "summary-item-active" : ""}`}
      onClick={() => onYardDifficultyChange(nextDifficulty)}
    >
      <Text className="summary-value">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="summary-label">{copy}</Text>
    </View>
  );

  const renderSpeedCard = (nextSpeedDifficulty: HeadCountSpeedDifficulty, copy: string) => (
    <View
      className={`summary-item ${speedDifficulty === nextSpeedDifficulty ? "summary-item-active" : ""}`}
      onClick={() => onSpeedDifficultyChange(nextSpeedDifficulty)}
    >
      <Text className="summary-value">{HEAD_COUNT_SPEED_LABELS[nextSpeedDifficulty]}</Text>
      <Text className="summary-label">{copy}</Text>
    </View>
  );

  return (
    <View className="farm-start start-screen">
      <View className="header-section">
        <View className="logo-icon">
          <Text className="logo-emoji">数</Text>
        </View>
        <Text className="game-title">农场清点</Text>
        <Text className="game-subtitle">观察宠物，完成速数或进出清点</Text>
        <View className="high-score-badge">
          <Text className="high-score-label">当前设置最高</Text>
          <Text className="high-score-value">{best}</Text>
        </View>
      </View>

      {!isGauntletPreset && (
        <View className="summary-card">
          <Text className="section-title">游戏模式</Text>
          <View className="summary-grid">
            <View
              className={`summary-item ${mode === "speed" ? "summary-item-active" : ""}`}
              onClick={() => onModeChange("speed")}
            >
              <Text className="summary-value">宠物速数</Text>
              <Text className="summary-label">快速滚过一群宠物，只数指定宠物。</Text>
            </View>
            <View
              className={`summary-item ${mode === "yard" ? "summary-item-active" : ""}`}
              onClick={() => onModeChange("yard")}
            >
              <Text className="summary-value">农场进出</Text>
              <Text className="summary-label">观察宠物进出围栏，清点最后数量。</Text>
            </View>
          </View>
        </View>
      )}

      {!isGauntletPreset && (
        <>
          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            {mode === "yard" ? (
              <>
                <Text className="rule-item">1. 每局 8 题，先记住围栏里的初始宠物数。</Text>
                <Text className="rule-item">2. 宠物进出时不再显示总数，需要在心里清点。</Text>
                <Text className="rule-item">3. 事件结束后从 4 个选项中选择剩余数量。</Text>
              </>
            ) : (
              <>
                <Text className="rule-item">1. 每局 8 题，先看本题要数哪种宠物。</Text>
                <Text className="rule-item">2. 宠物经过农场时，只统计目标宠物。</Text>
                <Text className="rule-item">3. 速度会逐题提升，快速正确和连击有额外分。</Text>
              </>
            )}
          </View>

          <View className="summary-card">
            <Text className="section-title">{mode === "yard" ? "事件难度" : "难度"}</Text>
            <View className="summary-grid">
              {mode === "yard" ? (
                <>
                  {renderYardDifficultyCard("normal", "3-4 段事件 · 节奏清晰")}
                  {renderYardDifficultyCard("hard", "4-6 段事件 · 数量变化更大")}
                </>
              ) : (
                <>
                  {renderSpeedDifficultyCard("normal", "8-15 只宠物")}
                  {renderSpeedDifficultyCard("hard", "14-21 只宠物")}
                </>
              )}
            </View>
          </View>
        </>
      )}

      {!isGauntletPreset && mode === "yard" ? (
        <View className="summary-card">
          <Text className="section-title">出入速度</Text>
          <View className="summary-grid summary-grid-three">
            {renderSpeedCard("slow", "舒缓进出")}
            {renderSpeedCard("standard", "标准节奏")}
            {renderSpeedCard("fast", "快速切换")}
          </View>
        </View>
      ) : null}

      <View className="floating-start-action">
        <View className="primary-button" onClick={onStart}>
          <Text className="primary-button-text">开始训练</Text>
        </View>
      </View>
      <View className="floating-start-spacer" />
    </View>
  );
}
