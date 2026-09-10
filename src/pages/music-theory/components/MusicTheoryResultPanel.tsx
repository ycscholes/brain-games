import { Text, View } from "@tarojs/components";
import StickerShareButton from "../../../components/stickers/StickerShareButton";

export interface MusicTheoryResultPanelProps {
  score: number;
  awardedPoints: number;
  isGauntlet: boolean;
  onRestart: () => void;
}

export default function MusicTheoryResultPanel({
  score,
  awardedPoints,
  isGauntlet,
  onRestart,
}: MusicTheoryResultPanelProps) {
  return (
    <View className="music-finish">
      <Text className="music-kicker">🌈 完成</Text>
      <Text className="music-title">太棒啦！</Text>
      <Text className="final-score">{score} 分</Text>
      <Text>+{awardedPoints} 积分</Text>
      <StickerShareButton
        gameTitle="音符小探险"
        score={score}
        pagePath="pages/music-theory/index"
        isGauntlet={isGauntlet}
      />
      <View className="music-button" onClick={onRestart}>
        <Text>再来一次</Text>
      </View>
    </View>
  );
}
