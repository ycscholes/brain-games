import { useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import { WORD_SCRAMBLE_TOTAL_QUESTIONS } from "./gameLogic";
import { createWordScrambleRun, readWordScrambleRun } from "./run";
import "./index.scss";

export default function WordScrambleResult() {
  usePageShare("pages/word-scramble/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readWordScrambleRun(runId));
  const isGauntletPreset = readGameGauntletModePreset() !== null;
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/word-scramble/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const accuracyText = `${Math.round((run.result.correctQuestions / WORD_SCRAMBLE_TOTAL_QUESTIONS) * 100)}%`;
  const restart = () => {
    const nextRun = createWordScrambleRun(run.payload.difficulty);
    void replaceWithGamePlay("word-scramble", nextRun.runId, readGameRouteParams());
  };
  return (
    <View className="word-scramble-page word-scramble-result-page">
      <View className="word-result">
        <View className="result-card">
          <Text className="result-kicker">训练完成</Text>
          <Text className="result-score">{run.result.score}</Text>
          <Text className="result-copy">
            词语拼盘 · {getTrainingDifficultyLabel(run.payload.difficulty)}{" "}
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
              gameTitle="词语拼盘"
              score={run.result.score}
              pagePath="pages/word-scramble/index"
              isGauntlet={isGauntletPreset}
            />
            <View
              className="secondary-button"
              onClick={() => void goBackToGameStart("word-scramble")}
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
