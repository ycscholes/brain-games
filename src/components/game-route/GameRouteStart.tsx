import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { usePageShare, type SharePagePath } from "../../utils/share";
import "./index.scss";

export interface GameRouteStartProps {
  gameId: string;
  title: string;
  emoji: string;
  subtitle: string;
  rules: string[];
  startLabel?: string;
  gauntlet?: boolean;
  onStart: () => void;
}

export default function GameRouteStart({
  gameId,
  title,
  emoji,
  subtitle,
  rules,
  startLabel = "开始训练",
  gauntlet = false,
  onStart,
}: GameRouteStartProps) {
  usePageShare(`pages/${gameId}/index` as SharePagePath);

  return (
    <View className="game-route-page">
      <View className="game-route-start">
        <View className="game-route-hero">
          <Text className="game-route-emoji">{emoji}</Text>
          <Text className="game-route-title">{title}</Text>
          <Text className="game-route-subtitle">{subtitle}</Text>
        </View>
        <View className="game-route-rules">
          <Text className="game-route-section-title">游戏规则</Text>
          {rules.map((rule) => (
            <Text className="game-route-rule" key={rule}>
              {rule}
            </Text>
          ))}
        </View>
        <View className="game-route-start-button" onClick={onStart}>
          <Text className="game-route-start-text">{startLabel}</Text>
        </View>
        {!gauntlet ? (
          <View
            className="game-route-home-button"
            onClick={() =>
              void Taro.navigateBack().catch(() => Taro.reLaunch({ url: "/pages/index/index" }))
            }
          >
            <Text className="game-route-home-text">返回</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
