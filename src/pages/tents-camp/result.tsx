import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import GameRouteResult from "../../components/game-route/GameRouteResult";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readTentsCampRun } from "./run";
import "./index.scss";

export default function TentsCampResult() {
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readTentsCampRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/tents-camp/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <GameRouteResult
      gameId="tents-camp"
      title="帐篷营地"
      score={run.result.score}
      awardedPoints={run.result.awardedPoints}
      isNewBest={run.result.isNewBest}
      details={`放置 ${run.result.placedCount} 顶帐篷`}
      share={
        <StickerShareButton
          gameTitle="帐篷营地"
          score={run.result.score}
          pagePath="pages/tents-camp/index"
          isGauntlet={false}
        />
      }
    />
  );
}
