import { Text, View } from "@tarojs/components";
import StickerShareButton from "../../../components/stickers/StickerShareButton";

export interface PatternResultPanelProps {
  finalScore: number;
  correctCount: number;
  totalQuestions: number;
  longestCombo: number;
  hintsUsed: number;
  multiruleCases: number;
  elapsedText: string;
  difficultyLabel: string;
  awardedPoints: number;
  best: number;
  isNewBest: boolean;
  isGauntlet: boolean;
  onRestart: () => void;
  onBackToStart: () => void;
  onBackHome: () => void;
}

export default function PatternResultPanel({
  finalScore,
  correctCount,
  totalQuestions,
  longestCombo,
  hintsUsed,
  multiruleCases,
  elapsedText,
  difficultyLabel,
  awardedPoints,
  best,
  isNewBest,
  isGauntlet,
  onRestart,
  onBackToStart,
  onBackHome,
}: PatternResultPanelProps) {
  return (
    <View className="result-screen">
      <View className="result-card">
        <Text className="result-title">本局成绩</Text>
        <Text className="result-score">{finalScore}</Text>
        <Text className="result-desc">
          识破 {correctCount} / {totalQuestions} 个案件
        </Text>
        <Text className="result-desc">
          最长连击 {longestCombo}，使用线索 {hintsUsed} 次
        </Text>
        <Text className="result-desc">多规则案件 {multiruleCases} 个，最高单题 5 分</Text>
        <Text className="result-desc">完成用时 {elapsedText}</Text>
        <Text className="result-desc">
          积分{difficultyLabel} · 获得 {awardedPoints} 积分
        </Text>
        <Text className="result-desc">
          历史最高 {best}
          {isNewBest ? <Text className="result-highlight">，刷新纪录</Text> : null}
        </Text>
      </View>

      <View className="result-actions">
        <StickerShareButton
          gameTitle="找规律"
          score={finalScore}
          pagePath="pages/pattern-completion/index"
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
