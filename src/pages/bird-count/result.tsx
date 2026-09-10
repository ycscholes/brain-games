import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import GameRouteResult from "../../components/game-route/GameRouteResult";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readBirdCountRun } from "./run";
import "./index.scss";

export default function BirdCountResult() {
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readBirdCountRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/bird-count/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <GameRouteResult
      gameId="bird-count"
      title="农场清点"
      score={run.result.score}
      awardedPoints={run.result.awardedPoints}
      isNewBest={run.result.isNewBest}
      details={`${run.result.correctCount} 题判断正确`}
      share={
        <StickerShareButton
          gameTitle="农场清点"
          score={run.result.score}
          pagePath="pages/bird-count/index"
          isGauntlet={false}
        />
      }
    />
  );
}
