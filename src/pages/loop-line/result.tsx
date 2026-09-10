import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import GameRouteResult from "../../components/game-route/GameRouteResult";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readLoopLineRun } from "./run";
import "./index.scss";

export default function LoopLineResult() {
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readLoopLineRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/loop-line/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <GameRouteResult
      gameId="loop-line"
      title="环线谜踪"
      score={run.result.score}
      awardedPoints={run.result.awardedPoints}
      isNewBest={run.result.isNewBest}
      details={`移动 ${run.result.moveCount} 次`}
      share={
        <StickerShareButton
          gameTitle="环线谜踪"
          score={run.result.score}
          pagePath="pages/loop-line/index"
          isGauntlet={false}
        />
      }
    />
  );
}
