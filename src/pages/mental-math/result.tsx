import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import GameRouteResult from "../../components/game-route/GameRouteResult";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { readMentalMathRun } from "./run";
import "./index.scss";

export default function MentalMathResult() {
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readMentalMathRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/mental-math/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  return (
    <GameRouteResult
      gameId="mental-math"
      title="速算挑战"
      score={run.result.score}
      awardedPoints={run.result.awardedPoints}
      isNewBest={run.result.isNewBest}
      details={`${run.result.correctCount} 题正确 · ${getTrainingDifficultyLabel(run.payload.difficulty)}`}
      share={
        <StickerShareButton
          gameTitle="速算挑战"
          score={run.result.score}
          pagePath="pages/mental-math/index"
          isGauntlet={false}
        />
      }
    />
  );
}
