import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import GameRouteResult from "../../components/game-route/GameRouteResult";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { readDigitSpanRun } from "./run";
import "./index.scss";

export default function DigitSpanResult() {
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readDigitSpanRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/digit-span/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <GameRouteResult
      gameId="digit-span"
      title="数字广度记忆"
      score={run.result.score}
      awardedPoints={run.result.awardedPoints}
      isNewBest={run.result.isNewBest}
      details={`最高记忆长度 ${run.result.maxLength}`}
      share={
        <StickerShareButton
          gameTitle="数字广度记忆"
          score={run.result.score}
          pagePath="pages/digit-span/index"
          isGauntlet={false}
        />
      }
    />
  );
}
