import { useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import { NUMBER_ORDER_TOTAL_QUESTIONS } from "./gameLogic";
import { createNumberOrderRun, readNumberOrderRun } from "./run";
import "./index.scss";

export default function NumberOrderResult() {
  usePageShare("pages/number-order/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readNumberOrderRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/number-order/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const { result } = run;
  const accuracyText = `${Math.round((result.correctQuestions / NUMBER_ORDER_TOTAL_QUESTIONS) * 100)}%`;
  const longestEchoLength = run.payload.questions.reduce(
    (max, question) => Math.max(max, question.answerIds.length),
    0,
  );
  const restart = () => {
    const nextRun = createNumberOrderRun(run.payload.difficulty);
    void replaceWithGamePlay("number-order", nextRun.runId, readGameRouteParams());
  };
  return (
    <View className="number-order-page number-order-result-page">
      <View className="finished-screen">
        <View className="result-card">
          <Text className="result-kicker">{result.isNewBest ? "刷新最高分" : "训练完成"}</Text>
          <Text className="result-score">{result.score}</Text>
          <Text className="result-copy">
            星链回响 · {getTrainingDifficultyLabel(run.payload.difficulty)}
          </Text>
        </View>
        <View className="result-grid">
          <View className="result-item">
            <Text className="result-value">{accuracyText}</Text>
            <Text className="result-label">整题正确率</Text>
          </View>
          <View className="result-item">
            <Text className="result-value">
              {Number(Taro.getStorageSync(`number_order_best_${run.payload.difficulty}`) || 0) ||
                result.score}
            </Text>
            <Text className="result-label">历史最高</Text>
          </View>
          <View className="result-item">
            <Text className="result-value">{result.awardedPoints}</Text>
            <Text className="result-label">宠物积分</Text>
          </View>
          <View className="result-item">
            <Text className="result-value">{result.bestCombo}</Text>
            <Text className="result-label">最佳连击</Text>
          </View>
          <View className="result-item">
            <Text className="result-value">
              {result.correctQuestions}/{NUMBER_ORDER_TOTAL_QUESTIONS}
            </Text>
            <Text className="result-label">完整回响</Text>
          </View>
          <View className="result-item result-item-wide">
            <Text className="result-value result-value-small">{longestEchoLength} 步</Text>
            <Text className="result-label">最长星链</Text>
          </View>
        </View>
        <View className="primary-button" onClick={restart}>
          <Text className="primary-button-text">再玩一局</Text>
        </View>
        <StickerShareButton
          gameTitle="星链回响"
          score={result.score}
          pagePath="pages/number-order/index"
          isGauntlet={false}
        />
        <View className="secondary-button" onClick={() => void goBackToGameStart("number-order")}>
          <Text className="secondary-button-text">返回设置</Text>
        </View>
        <View
          className="secondary-button"
          onClick={() => Taro.reLaunch({ url: "/pages/index/index" })}
        >
          <Text className="secondary-button-text">返回首页</Text>
        </View>
      </View>
    </View>
  );
}
