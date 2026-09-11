import { useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import { createSumpleteGridRun, readSumpleteGridRun } from "./run";
import "./index.scss";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SumpleteGridResult() {
  usePageShare("pages/sumplete-grid/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readSumpleteGridRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/sumplete-grid/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const { result } = run;
  const restart = () => {
    const nextRun = createSumpleteGridRun(run.payload.difficulty);
    void replaceWithGamePlay("sumplete-grid", nextRun.runId, readGameRouteParams());
  };
  return (
    <View className="sumplete-grid-page sumplete-result-page">
      <View className="sumplete-result">
        <View className="result-card">
          <Text className="result-kicker">训练完成</Text>
          <Text className="result-score">{result.score}</Text>
          <Text className="result-copy">
            删数求和 · {getTrainingDifficultyLabel(run.payload.difficulty)}{" "}
            {result.isNewBest ? "· 新最高" : ""}
          </Text>
          <View className="result-grid">
            <View className="result-item">
              <Text className="result-item-value">{formatTime(result.durationSeconds)}</Text>
              <Text className="result-item-label">完成用时</Text>
            </View>
            <View className="result-item">
              <Text className="result-item-value">{result.mistakes}</Text>
              <Text className="result-item-label">失误</Text>
            </View>
            <View className="result-item">
              <Text className="result-item-value">+{result.awardedPoints}</Text>
              <Text className="result-item-label">宠物积分</Text>
            </View>
          </View>
          <View className="result-actions">
            <StickerShareButton
              gameTitle="删数求和"
              score={result.score}
              pagePath="pages/sumplete-grid/index"
              isGauntlet={false}
            />
            <View
              className="secondary-button"
              onClick={() => void goBackToGameStart("sumplete-grid")}
            >
              <Text className="secondary-button-text">返回设置</Text>
            </View>
            <View className="primary-button" onClick={restart}>
              <Text className="primary-button-text">再练一局</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
