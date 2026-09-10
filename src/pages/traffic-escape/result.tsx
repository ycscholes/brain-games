import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readTrafficEscapeRun } from "./run";
import "./index.scss";

export default function TrafficEscapeResult() {
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readTrafficEscapeRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/traffic-escape/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const { result } = run;
  return (
    <View className="traffic-escape-page">
      <View className="traffic-finish">
        <View className="traffic-finish-panel">
          <Text className="traffic-kicker">TRAFFIC CLEARED</Text>
          <Text className="traffic-finish-title">
            {result.isNewBest ? "路线纪录刷新" : "红车已驶离"}
          </Text>
          <Text className="traffic-finish-score">{result.score}</Text>
          <Text className="traffic-finish-copy">
            获得 {result.awardedPoints} 宠物积分 · 调度 {result.moveCount} 次 · 提示{" "}
            {result.hintCount} 次
          </Text>
          <View className="traffic-finish-actions">
            <StickerShareButton
              gameTitle="车阵突围"
              score={result.score}
              pagePath="pages/traffic-escape/index"
              isGauntlet={false}
            />
            <View
              className="traffic-primary-button"
              onClick={() => Taro.redirectTo({ url: "/pages/traffic-escape/index" })}
            >
              <Text className="traffic-primary-button-text">再闯一条路线</Text>
            </View>
            <View
              className="traffic-secondary-button"
              onClick={() => Taro.redirectTo({ url: "/pages/traffic-escape/index" })}
            >
              <Text className="traffic-secondary-button-text">返回游戏主页</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
