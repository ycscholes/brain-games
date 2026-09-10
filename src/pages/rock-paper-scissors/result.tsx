import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import GameRouteResult from "../../components/game-route/GameRouteResult";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readRockPaperScissorsRun } from "./run";
import "./index.scss";

export default function RockPaperScissorsResult() {
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readRockPaperScissorsRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/rock-paper-scissors/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <GameRouteResult
      gameId="rock-paper-scissors"
      title="逆向猜拳"
      score={run.result.score}
      awardedPoints={run.result.awardedPoints}
      isNewBest={run.result.isNewBest}
      details={`${run.result.correctCount} 次判断正确`}
      share={
        <StickerShareButton
          gameTitle="逆向猜拳"
          score={run.result.score}
          pagePath="pages/rock-paper-scissors/index"
          isGauntlet={false}
        />
      }
    />
  );
}
