import { useEffect, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import PatternResultPanel from "./components/PatternResultPanel";
import { createPatternCompletionRun, readPatternCompletionRun } from "./run";
import "./index.scss";

const formatElapsed = (elapsedMs: number) => {
  const seconds = Math.floor(elapsedMs / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
};

export default function PatternCompletionResult() {
  usePageShare("pages/pattern-completion/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readPatternCompletionRun(runId));
  const isGauntletPreset = readGameGauntletModePreset() !== null;
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/pattern-completion/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const restart = () => {
    const nextRun = createPatternCompletionRun(run.payload.difficulty);
    void replaceWithGamePlay("pattern-completion", nextRun.runId, readGameRouteParams());
  };
  return (
    <View className="pattern-page">
      <PatternResultPanel
        finalScore={run.result.score}
        correctCount={run.result.correctCount}
        totalQuestions={run.result.totalQuestions}
        longestCombo={run.result.longestCombo}
        hintsUsed={run.result.hintsUsed}
        multiruleCases={run.result.multiruleCases}
        elapsedText={formatElapsed(run.result.elapsedMs)}
        difficultyLabel={getTrainingDifficultyLabel(run.payload.difficulty)}
        awardedPoints={run.result.awardedPoints}
        best={run.result.best}
        isNewBest={run.result.isNewBest}
        isGauntlet={isGauntletPreset}
        onRestart={restart}
        onBackToStart={() => void goBackToGameStart("pattern-completion")}
        onBackHome={() => void Taro.reLaunch({ url: "/pages/index/index" })}
      />
    </View>
  );
}
