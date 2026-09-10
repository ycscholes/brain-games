import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import GameRouteResult from "../../components/game-route/GameRouteResult";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readHidatoRun } from "./run";
import "./index.scss";

export default function HidatoResult() {
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readHidatoRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/hidato/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <GameRouteResult
      gameId="hidato"
      title="连数迷阵"
      score={run.result.score}
      awardedPoints={run.result.awardedPoints}
      isNewBest={run.result.isNewBest}
      details={`移动 ${run.result.moveCount} 次`}
      share={
        <StickerShareButton
          gameTitle="连数迷阵"
          score={run.result.score}
          pagePath="pages/hidato/index"
          isGauntlet={false}
        />
      }
    />
  );
}
