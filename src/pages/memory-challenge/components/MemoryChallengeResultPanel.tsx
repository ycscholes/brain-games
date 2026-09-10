import { Text, View } from "@tarojs/components";
import StickerShareButton from "../../../components/stickers/StickerShareButton";

export interface MemoryChallengeResultPanelProps {
  score: number;
  correctCount: number;
  modeLabel: string;
  memoryLabel: string;
  awardedPoints: number;
  rewardCap: number;
  highScore: number;
  isNewRecord: boolean;
  isGauntlet: boolean;
  onRestart: () => void;
  onBackToStart: () => void;
  onBackHome: () => void;
}

export default function MemoryChallengeResultPanel({
  score,
  correctCount,
  modeLabel,
  memoryLabel,
  awardedPoints,
  rewardCap,
  highScore,
  isNewRecord,
  isGauntlet,
  onRestart,
  onBackToStart,
  onBackHome,
}: MemoryChallengeResultPanelProps) {
  return (
    <View className="result-screen">
      <View className="result-card">
        <Text className="result-title">本局成绩</Text>
        <Text className="result-score">{score}</Text>
        <Text className="result-desc">答对 {correctCount} 题</Text>
        <Text className="result-desc">
          {modeLabel} · {memoryLabel}
        </Text>
        <Text className="result-desc">
          获得 {awardedPoints} 宠物积分，上限 {rewardCap}
        </Text>
        <Text className="result-desc">
          历史最高 {highScore}
          {isNewRecord && score > 0 ? <Text className="result-highlight">刷新纪录</Text> : null}
        </Text>
      </View>

      <View className="result-actions">
        <StickerShareButton
          gameTitle="奇趣记忆"
          score={score}
          pagePath="pages/memory-challenge/index"
          isGauntlet={isGauntlet}
        />
        <View className="primary-button" onClick={onRestart}>
          <Text className="button-text">再来一局</Text>
        </View>
        <View className="secondary-button" onClick={onBackToStart}>
          <Text className="button-text">返回开始页</Text>
        </View>
        <View className="secondary-button" onClick={onBackHome}>
          <Text className="button-text">返回游戏主页</Text>
        </View>
      </View>
    </View>
  );
}
