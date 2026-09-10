import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { createHidatoRun, readHidatoRun } from "./run";
import "./index.scss";

export default function HidatoResult() {
  usePageShare("pages/hidato/index");
  const isGauntletPreset = readGameGauntletModePreset() !== null;
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readHidatoRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result) {
      void Taro.redirectTo({ url: "/pages/hidato/index" });
    }
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const restart = () => {
    const nextRun = createHidatoRun(run.payload.difficulty);
    void replaceWithGamePlay("hidato", nextRun.runId, readGameRouteParams());
  };
  return (
    <View className="hidato-page">
      <View className="finish-screen">
        <View className="finish-panel">
          <Text className="finish-kicker">
            连数迷阵 · {getTrainingDifficultyLabel(run.payload.difficulty)}
          </Text>
          <Text className="finish-title">{run.result.isNewBest ? "刷新最高分" : "训练完成"}</Text>
          <Text className="finish-score">{run.result.score}</Text>
          <Text className="finish-copy">
            获得 {run.result.awardedPoints} 宠物积分 · 错误 {run.result.mistakeCount} · 提示{" "}
            {run.result.hintCount}
          </Text>
          <View className="finish-actions">
            <StickerShareButton
              gameTitle="连数迷阵"
              score={run.result.score}
              pagePath="pages/hidato/index"
              isGauntlet={isGauntletPreset}
            />
            <View className="primary-button" onClick={restart}>
              <Text className="primary-button-text">再来一局</Text>
            </View>
            <View
              className="secondary-button secondary-button-quiet"
              onClick={() => void goBackToGameStart("hidato")}
            >
              <Text className="secondary-button-text">返回难度</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
