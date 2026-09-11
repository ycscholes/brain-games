import { useCallback, useEffect, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createPatternCompletionRun } from "./run";
import PatternStartPanel from "./components/PatternStartPanel";
import "./index.scss";

const STORAGE_KEY_PREFIX = "pattern_completion_best";

export default function PatternCompletionStart() {
  usePageShare("pages/pattern-completion/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;
  const [rewardDifficulty, setRewardDifficulty] = useState<TrainingDifficulty>(
    gauntletPreset?.difficulty ?? "normal",
  );
  const [best, setBest] = useState(0);
  useAmbientMusic(!isGauntletPreset);

  const refreshBest = useCallback(() => {
    const value = Number(
      Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${rewardDifficulty}`) ||
        (rewardDifficulty === "normal" ? Taro.getStorageSync(STORAGE_KEY_PREFIX) : 0),
    );
    setBest(Number.isFinite(value) ? value : 0);
  }, [rewardDifficulty]);

  useLoad(refreshBest);
  useDidShow(refreshBest);
  useEffect(refreshBest, [refreshBest]);

  const startGame = useCallback(() => {
    const run = createPatternCompletionRun(rewardDifficulty);
    const query = buildGameRouteQuery(run.runId, readGameRouteParams());
    void (isGauntletPreset ? Taro.redirectTo : Taro.navigateTo)({
      url: `/pages/pattern-completion/play?${query}`,
    });
  }, [isGauntletPreset, rewardDifficulty]);

  useEffect(() => {
    if (isGauntletPreset) startGame();
  }, [isGauntletPreset, startGame]);

  return (
    <View className="pattern-page">
      <PatternStartPanel
        best={best}
        rewardDifficulty={rewardDifficulty}
        isGauntletPreset={isGauntletPreset}
        sessionLength={8}
        hintsPerSession={2}
        onDifficultyChange={setRewardDifficulty}
        onStart={startGame}
      />
    </View>
  );
}
