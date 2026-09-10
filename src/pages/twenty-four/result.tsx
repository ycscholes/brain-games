import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import GameRouteResult from "../../components/game-route/GameRouteResult";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readTwentyFourRun } from "./run";
import "./index.scss";

export default function TwentyFourResult() {
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readTwentyFourRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/twenty-four/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <GameRouteResult
      gameId="twenty-four"
      title="24 点"
      score={run.result.score}
      awardedPoints={run.result.awardedPoints}
      isNewBest={run.result.isNewBest}
      details={`${run.result.solvedCount} 题完成`}
      share={
        <StickerShareButton
          gameTitle="24 点"
          score={run.result.score}
          pagePath="pages/twenty-four/index"
          isGauntlet={false}
        />
      }
    />
  );
}
