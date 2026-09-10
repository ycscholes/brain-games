import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { goBackToGameStart } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { readNetwalkRun } from "./run";
import "./index.scss";

export default function NetwalkResult() {
  usePageShare("pages/netwalk/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readNetwalkRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result) {
      void Taro.redirectTo({ url: "/pages/netwalk/index" });
    }
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <View className="netwalk-page">
      <View className="netwalk-finish finish-screen">
        <View className="netwalk-finish-panel">
          <Text className="netwalk-kicker">
            NETWORK ONLINE · {getTrainingDifficultyLabel(run.payload.difficulty)}
          </Text>
          <Text className="netwalk-finish-title">
            {run.result.isNewBest ? "连通纪录刷新" : "全网已接通"}
          </Text>
          <Text className="netwalk-finish-score">{run.result.score}</Text>
          <Text className="netwalk-finish-copy">
            获得 {run.result.awardedPoints} 宠物积分 · 旋转 {run.result.moveCount} 次 · 提示{" "}
            {run.result.hintCount} 次
          </Text>
          <View className="netwalk-finish-actions">
            <StickerShareButton
              gameTitle="网络回路"
              score={run.result.score}
              pagePath="pages/netwalk/index"
              isGauntlet={false}
            />
            <View
              className="netwalk-primary-button"
              onClick={() => void Taro.redirectTo({ url: "/pages/netwalk/index" })}
            >
              <Text className="netwalk-primary-button-text">再接一张网络</Text>
            </View>
            <View
              className="netwalk-secondary-button"
              onClick={() => void goBackToGameStart("netwalk")}
            >
              <Text className="netwalk-secondary-button-text">返回难度选择</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
