import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { createDigitSpanRun, readDigitSpanRun } from "./run";
import "./index.scss";

export default function DigitSpanResult() {
  usePageShare("pages/digit-span/index");
  const isGauntletPreset = readGameGauntletModePreset() !== null;
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readDigitSpanRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result) {
      void Taro.redirectTo({ url: "/pages/digit-span/index" });
    }
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const restart = () => {
    const nextRun = createDigitSpanRun(run.payload.difficulty);
    void replaceWithGamePlay("digit-span", nextRun.runId, readGameRouteParams());
  };
  const best = run.result.isNewBest
    ? run.result.score
    : Number(Taro.getStorageSync(`digit_span_best_${run.payload.difficulty}`) || 0);
  return (
    <View className="digit-span-page digit-span-result-page">
      <View className="result-screen">
        <View className="result-card">
          <Text className="result-title">本局成绩</Text>
          <Text className="result-score">{run.result.score}</Text>
          <Text className="result-desc">成功回忆 {run.result.maxLength} 位数字</Text>
          <Text className="result-desc">
            积分{getTrainingDifficultyLabel(run.payload.difficulty)} · 获得{" "}
            {run.result.awardedPoints} 积分
          </Text>
          <Text className="result-desc">
            历史最高 {best}
            {run.result.isNewBest ? <Text className="result-highlight">，刷新纪录</Text> : null}
          </Text>
        </View>
        <View className="result-actions">
          <StickerShareButton
            gameTitle="数字广度记忆"
            score={run.result.score}
            pagePath="pages/digit-span/index"
            isGauntlet={isGauntletPreset}
          />
          <View className="primary-button" onClick={restart}>
            <Text className="button-text">再来一局</Text>
          </View>
          <View className="secondary-button" onClick={() => void goBackToGameStart("digit-span")}>
            <Text className="button-text">返回开始页</Text>
          </View>
          <View
            className="secondary-button"
            onClick={() => void Taro.reLaunch({ url: "/pages/index/index" })}
          >
            <Text className="button-text">返回游戏主页</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
