import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import GameRouteResult from "../../components/game-route/GameRouteResult";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readMemoryChallengeRun } from "./run";
import "./index.scss";

export default function MemoryChallengeResult() {
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readMemoryChallengeRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/memory-challenge/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <GameRouteResult
      gameId="memory-challenge"
      title="奇趣记忆"
      score={run.result.score}
      awardedPoints={run.result.awardedPoints}
      isNewBest={run.result.isNewBest}
      details={`记忆等级 ${run.result.level}`}
      share={
        <StickerShareButton
          gameTitle="奇趣记忆"
          score={run.result.score}
          pagePath="pages/memory-challenge/index"
          isGauntlet={false}
        />
      }
    />
  );
}
