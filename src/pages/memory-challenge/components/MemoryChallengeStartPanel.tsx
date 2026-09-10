import { Text, View } from "@tarojs/components";
import type { MemoryChallengeMode, MemoryChallengeN } from "../gameLogic";

export interface MemoryChallengeModeConfig {
  label: string;
  icon: string;
  description: string;
}

export interface MemoryChallengeNConfig {
  label: string;
  color: string;
  description: string;
}

export interface MemoryChallengeStartPanelProps {
  memoryN: MemoryChallengeN;
  mode: MemoryChallengeMode;
  highScore: number;
  isGauntletPreset: boolean;
  isLoadingPets: boolean;
  answerTimeSeconds: number;
  modeConfig: Record<MemoryChallengeMode, MemoryChallengeModeConfig>;
  memoryConfig: Record<MemoryChallengeN, MemoryChallengeNConfig>;
  getRoundPoints: (mode: MemoryChallengeMode, memoryN: MemoryChallengeN) => number;
  onModeChange: (mode: MemoryChallengeMode) => void;
  onMemoryNChange: (memoryN: MemoryChallengeN) => void;
  onStart: () => void;
}

export default function MemoryChallengeStartPanel({
  memoryN,
  mode,
  highScore,
  isGauntletPreset,
  isLoadingPets,
  answerTimeSeconds,
  modeConfig,
  memoryConfig,
  getRoundPoints,
  onModeChange,
  onMemoryNChange,
  onStart,
}: MemoryChallengeStartPanelProps) {
  return (
    <View className="start-screen">
      <View className="header-section">
        <View className="logo-container">
          <View className="logo-icon">
            <Text className="logo-emoji">🎯</Text>
          </View>
        </View>
        <Text className="game-title">奇趣记忆</Text>
        <Text className="game-subtitle">6 秒判断，挑战持续更新记忆</Text>
        <View className="high-score-badge">
          <View className="high-score-icon">
            <Text className="high-score-icon-text">🏆</Text>
          </View>
          <View className="high-score-content">
            <Text className="high-score-label">当前模式最高分</Text>
            <Text className="high-score-value">{highScore}</Text>
          </View>
        </View>
      </View>

      <View className="rules-card">
        <View className="rules-header">
          <Text className="rules-icon-text">📋</Text>
          <Text className="rules-title">游戏规则</Text>
        </View>
        <View className="rules-list">
          <Text className="rule-text">1. 依次记住最开始的 {memoryN} 题</Text>
          <Text className="rule-text">2. 每轮选出前 {memoryN} 题的内容或答案</Text>
          <Text className="rule-text">3. 每题限时 {answerTimeSeconds} 秒，答错或超时结束</Text>
          <Text className="rule-text">4. 游戏分数无限累计，宠物积分按模式封顶</Text>
        </View>
      </View>

      {!isGauntletPreset && (
        <View className="difficulty-section">
          <View className="difficulty-header">
            <Text className="difficulty-icon-text">🎮</Text>
            <Text className="difficulty-title">游戏模式</Text>
          </View>
          <View className="mode-grid">
            {(Object.keys(modeConfig) as MemoryChallengeMode[]).map((itemMode) => {
              const config = modeConfig[itemMode];
              return (
                <View
                  key={itemMode}
                  className={`mode-item ${mode === itemMode ? "mode-item-selected" : ""}`}
                  onClick={() => onModeChange(itemMode)}
                >
                  <Text className="mode-icon">{config.icon}</Text>
                  <Text className="difficulty-label">{config.label}</Text>
                  <Text className="difficulty-desc">{config.description}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {!isGauntletPreset && (
        <View className="difficulty-section">
          <View className="difficulty-header">
            <Text className="difficulty-icon-text">🧠</Text>
            <Text className="difficulty-title">记忆数量</Text>
          </View>
          <View className="difficulty-grid">
            {([1, 2, 3, 4] as MemoryChallengeN[]).map((n) => {
              const config = memoryConfig[n];
              return (
                <View
                  key={n}
                  className={`difficulty-item ${memoryN === n ? "difficulty-item-selected" : ""}`}
                  onClick={() => onMemoryNChange(n)}
                >
                  <View className="difficulty-badge" style={{ backgroundColor: config.color }}>
                    <Text className="difficulty-badge-text">{n}</Text>
                  </View>
                  <Text className="difficulty-label">{config.label}</Text>
                  <Text className="difficulty-desc">
                    {mode === "calculation"
                      ? `计算 ${getRoundPoints(mode, n)} 分/题`
                      : config.description}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View className="start-button-container floating-start-action">
        <View
          className={`start-button ${isLoadingPets ? "start-button-disabled" : ""}`}
          onClick={onStart}
        >
          <Text className="start-button-text">
            {isLoadingPets ? "加载宠物图片..." : "开始游戏"}
          </Text>
        </View>
      </View>
      <View className="floating-start-spacer" />
    </View>
  );
}
