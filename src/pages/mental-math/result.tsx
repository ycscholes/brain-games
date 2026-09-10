import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import MentalMathResultPanel from "./components/MentalMathResultPanel";
import { getCustomMathProfile, getMathStage, CUSTOM_MATH_STAGE_ID } from "./mathStages";
import { readGameRouteParams, replaceWithGamePlay, goBackToGameStart } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { createMentalMathRun, readMentalMathRun } from "./run";
import "./index.scss";

function readBest(run: NonNullable<ReturnType<typeof readMentalMathRun>>) {
  const stageId = run.payload.stageId;
  const raw =
    Taro.getStorageSync(`mental_math_high_score_${run.payload.mode}_${stageId}`) ||
    (stageId === "G1A" ? Taro.getStorageSync(`mental_math_high_score_${run.payload.mode}`) : "");
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string" || !raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { score?: unknown };
    return typeof parsed.score === "number" ? parsed.score : 0;
  } catch {
    return 0;
  }
}

export default function MentalMathResult() {
  usePageShare("pages/mental-math/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readMentalMathRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result) {
      void Taro.redirectTo({ url: "/pages/mental-math/index" });
    }
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;

  const restart = () => {
    const nextRun = createMentalMathRun({
      difficulty: run.payload.difficulty,
      mode: run.payload.mode,
      stageId: run.payload.stageId,
      customConfig: run.payload.customConfig,
    });
    void replaceWithGamePlay("mental-math", nextRun.runId, readGameRouteParams());
  };

  const isCustom = run.payload.stageId === CUSTOM_MATH_STAGE_ID;
  const stage = getMathStage(run.payload.stageId);
  const customProfile = getCustomMathProfile(
    run.payload.customConfig ?? {
      operations: ["add", "subtract"],
      rangeId: "within100",
    },
  );
  return (
    <MentalMathResultPanel
      score={run.result.score}
      correctCount={run.result.correctCount}
      gameMode={run.payload.mode}
      stageTitle={isCustom ? "自定义训练" : stage.name}
      stageShortName={isCustom ? customProfile.summary : stage.shortName}
      difficultyLabel={getTrainingDifficultyLabel(run.payload.difficulty)}
      awardedPoints={run.result.awardedPoints}
      highScore={readBest(run)}
      isNewRecord={run.result.isNewBest}
      isGauntlet={false}
      onRestart={restart}
      onBackToStart={() => void goBackToGameStart("mental-math")}
      onBackHome={() => void Taro.reLaunch({ url: "/pages/index/index" })}
    />
  );
}
