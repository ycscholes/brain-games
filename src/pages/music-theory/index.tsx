import { useCallback, useEffect, useState } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { type TrainingDifficulty } from "../../utils/trainingStorage";
import { createMusicTheoryRun } from "./run";
import MusicTheoryStartPanel from "./components/MusicTheoryStartPanel";
import "./index.scss";

export default function MusicTheoryStart() {
  usePageShare("pages/music-theory/index");
  const preset = readGameGauntletModePreset();
  const isGauntlet = preset !== null;
  useAmbientMusic(!isGauntlet);
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(preset?.difficulty ?? "normal");
  const startGame = useCallback(() => {
    const run = createMusicTheoryRun(difficulty);
    const query = buildGameRouteQuery(run.runId, readGameRouteParams());
    void (isGauntlet ? Taro.redirectTo : Taro.navigateTo)({
      url: `/pages/music-theory/play?${query}`,
    });
  }, [difficulty, isGauntlet]);
  useEffect(() => {
    if (isGauntlet) startGame();
  }, [isGauntlet, startGame]);
  return (
    <View className="music-theory-page">
      <MusicTheoryStartPanel
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        onStart={startGame}
      />
    </View>
  );
}
