import { Text, View } from "@tarojs/components";
import StickerShareButton from "../../../components/stickers/StickerShareButton";
import type { MentalMathGameMode } from "./MentalMathStartPanel";

export interface MentalMathResultPanelProps {
  score: number;
  correctCount: number;
  gameMode: MentalMathGameMode;
  stageTitle: string;
  stageShortName: string;
  difficultyLabel: string;
  awardedPoints: number;
  highScore: number;
  isNewRecord: boolean;
  isGauntlet: boolean;
  onRestart: () => void;
  onBackToStart: () => void;
  onBackHome: () => void;
}

export default function MentalMathResultPanel({
  score,
  correctCount,
  gameMode,
  stageTitle,
  stageShortName,
  difficultyLabel,
  awardedPoints,
  highScore,
  isNewRecord,
  isGauntlet,
  onRestart,
  onBackToStart,
  onBackHome,
}: MentalMathResultPanelProps) {
  return (
    <View className="result-screen">
      <View className="result-card">
        <Text className="result-title">本局成绩</Text>
        <Text className="result-score">{score}</Text>
        <Text className="result-desc">
          {gameMode === "timed"
            ? `得分 ${score} 分 · 答对 ${correctCount} 题`
            : `答对 ${correctCount} 题`}{" "}
          · {stageTitle} · {stageShortName}
        </Text>
        <Text className="result-desc">
          {gameMode === "timed" ? "限时模式" : "闯关模式"} · 积分{difficultyLabel}
        </Text>
        <Text className="result-desc">获得 {awardedPoints} 积分</Text>
        <Text className="result-desc">
          历史最高 {highScore}
          {isNewRecord && score > 0 ? <Text className="result-highlight">，刷新纪录</Text> : null}
        </Text>
      </View>

      <View className="result-actions">
        <StickerShareButton
          gameTitle="速算挑战"
          score={score}
          pagePath="pages/mental-math/index"
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
