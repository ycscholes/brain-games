import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import { STORAGE_KEY_PREFIX } from "./gameLogic";
import { createMultipleObjectTrackingRun, readMultipleObjectTrackingRun } from "./run";
import "./index.scss";

export default function MultipleObjectTrackingResult() {
  usePageShare("pages/multiple-object-tracking/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readMultipleObjectTrackingRun(runId));
  const isGauntletPreset = readGameGauntletModePreset() !== null;

  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result) {
      void Taro.redirectTo({ url: "/pages/multiple-object-tracking/index" });
    }
  }, [run]);

  if (!run || run.status !== "settled" || !run.result) return null;
  const { result } = run;
  const best =
    Number(
      Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${run.payload.difficulty}`) ||
        (run.payload.difficulty === "normal" ? Taro.getStorageSync(STORAGE_KEY_PREFIX) : 0),
    ) || result.score;
  const restart = () => {
    const nextRun = createMultipleObjectTrackingRun(run.payload.difficulty);
    void replaceWithGamePlay("multiple-object-tracking", nextRun.runId, readGameRouteParams());
  };

  return (
    <View className="mot-page multiple-object-tracking-result-page">
      <View className="result-screen">
        <View className="result-card">
          <Text className="result-title">本局成绩</Text>
          <Text className="result-score">{result.score}</Text>
          <Text className="result-desc">连续 {result.score} 轮正确</Text>
          <Text className="result-desc">
            积分{getTrainingDifficultyLabel(run.payload.difficulty)} · 获得 {result.awardedPoints}{" "}
            积分
          </Text>
          <Text className="result-desc">
            历史最高 {best}
            {result.isNewBest ? <Text className="result-highlight">，刷新纪录</Text> : null}
          </Text>
        </View>

        <View className="result-actions">
          <StickerShareButton
            gameTitle="追踪任务"
            score={result.score}
            pagePath="pages/multiple-object-tracking/index"
            isGauntlet={isGauntletPreset}
          />
          <View className="primary-button" onClick={restart}>
            <Text className="button-text">再来一局</Text>
          </View>
          <View
            className="secondary-button"
            onClick={() => void goBackToGameStart("multiple-object-tracking")}
          >
            <Text className="button-text">返回开始页</Text>
          </View>
          <View
            className="secondary-button"
            onClick={() => Taro.reLaunch({ url: "/pages/index/index" })}
          >
            <Text className="button-text">返回游戏主页</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
