import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { BIRD_COUNT_TOTAL_QUESTIONS } from "./gameLogic";
import {
  HEAD_COUNT_SPEED_LABELS,
  HEAD_COUNT_TOTAL_QUESTIONS,
  getHeadCountRewardDifficulty,
} from "../head-count/gameLogic";
import FarmCountResult from "./components/FarmCountResult";
import { createBirdCountRun, readBirdCountRun } from "./run";
import "./index.scss";

export default function BirdCountResult() {
  usePageShare("pages/bird-count/index");
  const isGauntletPreset = readGameGauntletModePreset() !== null;
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readBirdCountRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result) {
      void Taro.redirectTo({ url: "/pages/bird-count/index" });
    }
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;

  const isYard = run.payload.mode === "yard";
  const totalQuestions = isYard ? HEAD_COUNT_TOTAL_QUESTIONS : BIRD_COUNT_TOTAL_QUESTIONS;
  const rewardDifficulty = isYard
    ? getHeadCountRewardDifficulty(run.payload.difficulty, run.payload.yardSpeed ?? "slow")
    : run.payload.difficulty;
  const modeTitle = isYard ? "农场进出" : "宠物速数";
  const difficultyLabel = isYard
    ? `${getTrainingDifficultyLabel(run.payload.difficulty)} · ${HEAD_COUNT_SPEED_LABELS[run.payload.yardSpeed ?? "slow"]} · 积分${getTrainingDifficultyLabel(rewardDifficulty)}`
    : getTrainingDifficultyLabel(run.payload.difficulty);
  const restart = () => {
    const nextRun = createBirdCountRun({
      difficulty: run.payload.difficulty,
      mode: run.payload.mode,
      yardSpeed: run.payload.yardSpeed,
    });
    void replaceWithGamePlay("bird-count", nextRun.runId, readGameRouteParams());
  };
  return (
    <FarmCountResult
      score={run.result.score}
      modeTitle={modeTitle}
      difficultyLabel={difficultyLabel}
      accuracyText={`${run.result.correctCount}/${totalQuestions}`}
      bestCombo={run.result.bestCombo}
      awardedPoints={run.result.awardedPoints}
      isNewBest={run.result.isNewBest}
      isGauntlet={isGauntletPreset}
      onBack={() => void goBackToGameStart("bird-count")}
      onRestart={restart}
    />
  );
}
