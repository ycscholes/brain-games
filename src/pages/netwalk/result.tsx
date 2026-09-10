import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import GameRouteResult from "../../components/game-route/GameRouteResult";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readNetwalkRun } from "./run";
import "./index.scss";

export default function NetwalkResult() {
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readNetwalkRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/netwalk/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <GameRouteResult
      gameId="netwalk"
      title="网络回路"
      score={run.result.score}
      awardedPoints={run.result.awardedPoints}
      isNewBest={run.result.isNewBest}
      details={`旋转 ${run.result.moveCount} 次`}
      share={
        <StickerShareButton
          gameTitle="网络回路"
          score={run.result.score}
          pagePath="pages/netwalk/index"
          isGauntlet={false}
        />
      }
    />
  );
}
