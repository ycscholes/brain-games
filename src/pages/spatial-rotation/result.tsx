import { useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import { SPATIAL_ROTATION_TOTAL_PUZZLES } from "./gameLogic";
import { createSpatialRotationRun, readSpatialRotationRun } from "./run";
import "./index.scss";

export default function SpatialRotationResult() {
  usePageShare("pages/spatial-rotation/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readSpatialRotationRun(runId));
  const isGauntletPreset = readGameGauntletModePreset() !== null;
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/spatial-rotation/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const accuracyText = `${Math.round((run.result.correctQuestions / SPATIAL_ROTATION_TOTAL_PUZZLES) * 100)}%`;
  const restart = () => {
    const nextRun = createSpatialRotationRun(run.payload.difficulty);
    void replaceWithGamePlay("spatial-rotation", nextRun.runId, readGameRouteParams());
  };
  return (
    <View className="spatial-rotation-page spatial-rotation-result-page">
      <View className="rotation-result">
        <View className="result-card">
          <Text className="result-kicker">训练完成</Text>
          <Text className="result-score">{run.result.score}</Text>
          <Text className="result-copy">
            旋影辨形 · {getTrainingDifficultyLabel(run.payload.difficulty)}{" "}
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
              gameTitle="空间旋转"
              score={run.result.score}
              pagePath="pages/spatial-rotation/index"
              isGauntlet={isGauntletPreset}
            />
            <View
              className="secondary-button"
              onClick={() => void goBackToGameStart("spatial-rotation")}
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
