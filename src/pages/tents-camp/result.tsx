import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { TENTS_CAMP_TOTAL_PUZZLES } from "./gameLogic";
import { createTentsCampRun, readTentsCampRun } from "./run";
import "./index.scss";

export default function TentsCampResult() {
  usePageShare("pages/tents-camp/index");
  const isGauntletPreset = readGameGauntletModePreset() !== null;
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readTentsCampRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result) {
      void Taro.redirectTo({ url: "/pages/tents-camp/index" });
    }
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const restart = () => {
    const nextRun = createTentsCampRun(run.payload.difficulty);
    void replaceWithGamePlay("tents-camp", nextRun.runId, readGameRouteParams());
  };
  const accuracyText = `${Math.round((run.result.correctPuzzles / TENTS_CAMP_TOTAL_PUZZLES) * 100)}%`;
  return (
    <View className="tents-camp-page tents-camp-result-page">
      <View className="tents-result">
        <View className="result-card">
          <Text className="result-kicker">训练完成</Text>
          <Text className="result-score">{run.result.score}</Text>
          <Text className="result-copy">
            帐篷营地 · {getTrainingDifficultyLabel(run.payload.difficulty)}{" "}
            {run.result.isNewBest ? "· 新最高" : ""}
          </Text>
          <View className="result-grid">
            <View className="result-item">
              <Text className="result-item-value">{accuracyText}</Text>
              <Text className="result-item-label">正确率</Text>
            </View>
            <View className="result-item">
              <Text className="result-item-value">{run.result.bestCombo}</Text>
              <Text className="result-item-label">最佳连击</Text>
            </View>
            <View className="result-item">
              <Text className="result-item-value">+{run.result.awardedPoints}</Text>
              <Text className="result-item-label">宠物积分</Text>
            </View>
          </View>
          <View className="result-actions">
            <StickerShareButton
              gameTitle="帐篷营地"
              score={run.result.score}
              pagePath="pages/tents-camp/index"
              isGauntlet={isGauntletPreset}
            />
            <View className="secondary-button" onClick={() => void goBackToGameStart("tents-camp")}>
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
