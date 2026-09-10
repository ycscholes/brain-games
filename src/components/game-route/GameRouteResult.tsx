import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import type { ReactNode } from "react";
import StickerShareButton from "../stickers/StickerShareButton";
import { usePageShare, type SharePagePath } from "../../utils/share";
import { getGamePageUrl, goBackToGameStart } from "../../utils/gameRoute";
import "./index.scss";

export interface GameRouteResultProps {
  gameId: string;
  title: string;
  score: number;
  awardedPoints: number;
  details?: string;
  isNewBest?: boolean;
  isGauntlet?: boolean;
  showShare?: boolean;
  share?: ReactNode;
}

export default function GameRouteResult({
  gameId,
  title,
  score,
  awardedPoints,
  details = "训练完成",
  isNewBest = false,
  isGauntlet = false,
  showShare = true,
  share,
}: GameRouteResultProps) {
  usePageShare(`pages/${gameId}/index` as SharePagePath);

  return (
    <View className="game-route-page">
      <View className="game-route-result">
        <Text className="game-route-result-kicker">TRAINING COMPLETE</Text>
        <Text className="game-route-result-title">{isNewBest ? "刷新纪录" : `${title}完成`}</Text>
        <Text className="game-route-result-score">{score}</Text>
        <Text className="game-route-result-copy">
          获得 {awardedPoints} 宠物积分 · {details}
        </Text>
        <View className="game-route-result-actions">
          {share ??
            (showShare ? (
              <StickerShareButton
                gameTitle={title}
                score={score}
                pagePath={`pages/${gameId}/index`}
                isGauntlet={isGauntlet}
              />
            ) : null)}
          {!isGauntlet ? (
            <View
              className="game-route-start-button"
              onClick={() => Taro.redirectTo({ url: getGamePageUrl(gameId as never, "index") })}
            >
              <Text className="game-route-start-text">再来一局</Text>
            </View>
          ) : null}
          <View
            className="game-route-home-button"
            onClick={() => void goBackToGameStart(gameId as never)}
          >
            <Text className="game-route-home-text">返回游戏主页</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
