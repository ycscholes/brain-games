import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { goBackToGameStart } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { readLoopLineRun } from "./run";
import "./index.scss";

export default function LoopLineResult() {
  usePageShare("pages/loop-line/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readLoopLineRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result) {
      void Taro.redirectTo({ url: "/pages/loop-line/index" });
    }
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <View className="loop-line-page">
      <View className="loop-line-finished summary-card">
        <Text className="loop-line-finished-kicker">CIRCUIT CLOSED</Text>
        <Text className="loop-line-finished-title">路线闭合成功</Text>
        <Text className="loop-line-finished-copy">
          用时 {run.result.durationSeconds} 秒 · 使用 {run.result.hintCount} 次提示
        </Text>
        <View className="loop-line-result-grid">
          <View>
            <Text className="loop-line-result-value">{run.result.score}</Text>
            <Text className="loop-line-result-label">游戏得分</Text>
          </View>
          <View>
            <Text className="loop-line-result-value">+{run.result.awardedPoints}</Text>
            <Text className="loop-line-result-label">宠物积分</Text>
          </View>
        </View>
        {run.result.isNewBest ? <Text className="loop-line-new-best">新的最高分</Text> : null}
        <StickerShareButton
          gameTitle="环线谜踪"
          score={run.result.score}
          pagePath="pages/loop-line/index"
          isGauntlet={false}
        />
        <View
          className="loop-line-start-button floating-start-action audio-pressable"
          onClick={() => void Taro.redirectTo({ url: "/pages/loop-line/index" })}
        >
          <Text className="loop-line-start-button-text">再来一局</Text>
        </View>
        <View
          className="loop-line-finished-copy"
          onClick={() => void goBackToGameStart("loop-line")}
        >
          返回开始页
        </View>
      </View>
    </View>
  );
}
