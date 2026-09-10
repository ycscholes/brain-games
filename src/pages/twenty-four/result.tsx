import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { goBackToGameStart } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { readTwentyFourRun } from "./run";
import "./index.scss";

export default function TwentyFourResult() {
  usePageShare("pages/twenty-four/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readTwentyFourRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result) {
      void Taro.redirectTo({ url: "/pages/twenty-four/index" });
    }
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <View className="twenty-four-page">
      <View className="tf-result">
        <Text className="tf-result-title">本局结束</Text>
        <Text className="tf-result-score">{run.result.score}</Text>
        <Text className="tf-result-copy">
          解出 {run.result.solvedCount} 题，游戏得分 {run.result.score}，获得{" "}
          {run.result.awardedPoints} 积分
        </Text>
        {run.result.isNewBest ? <Text className="tf-result-highlight">刷新历史最高</Text> : null}
        <View className="tf-result-actions">
          <StickerShareButton
            gameTitle="24 点"
            score={run.result.score}
            pagePath="pages/twenty-four/index"
            isGauntlet={false}
          />
          <View
            className="tf-primary-button"
            onClick={() => void Taro.redirectTo({ url: "/pages/twenty-four/index" })}
          >
            <Text className="tf-primary-button-text">再来一局</Text>
          </View>
          <View
            className="tf-secondary-button"
            onClick={() => void goBackToGameStart("twenty-four")}
          >
            <Text className="tf-secondary-button-text">返回首页</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
