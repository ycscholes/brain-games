import { useEffect, useState } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import type { TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import type { HeadCountDifficulty, HeadCountSpeedDifficulty } from "../head-count/gameLogic";
import FarmCountStartPanel, { type FarmCountMode } from "./components/FarmCountStartPanel";
import { createBirdCountRun } from "./run";
import "./index.scss";

function readBest(
  mode: FarmCountMode,
  difficulty: TrainingDifficulty,
  yardDifficulty: HeadCountDifficulty,
  speedDifficulty: HeadCountSpeedDifficulty,
) {
  const key =
    mode === "yard"
      ? `head_count_best_${yardDifficulty}_${speedDifficulty}`
      : `bird_count_best_${difficulty}`;
  const value = Number(
    Taro.getStorageSync(key) ||
      (mode === "yard" ? Taro.getStorageSync(`head_count_best_${yardDifficulty}`) : 0),
  );
  return Number.isFinite(value) ? value : 0;
}

export default function BirdCountStart() {
  usePageShare("pages/bird-count/index");
  const preset = readGameGauntletModePreset();
  const isGauntletPreset = preset !== null;
  const [mode, setMode] = useState<FarmCountMode>(preset?.farmMode ?? "speed");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(preset?.difficulty ?? "normal");
  const [yardDifficulty, setYardDifficulty] = useState<HeadCountDifficulty>(
    preset?.difficulty ?? "normal",
  );
  const [speedDifficulty, setSpeedDifficulty] = useState<HeadCountSpeedDifficulty>(
    preset?.yardSpeed ?? (preset?.difficulty === "hard" ? "standard" : "slow"),
  );
  const [best, setBest] = useState(0);

  useEffect(() => {
    setBest(readBest(mode, difficulty, yardDifficulty, speedDifficulty));
  }, [difficulty, mode, speedDifficulty, yardDifficulty]);

  const startGame = () => {
    const run = createBirdCountRun({
      difficulty: mode === "yard" ? yardDifficulty : difficulty,
      mode,
      yardSpeed: speedDifficulty,
    });
    const url = `/pages/bird-count/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (isGauntletPreset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };

  useEffect(() => {
    if (isGauntletPreset) startGame();
    // Gauntlet enters a configured run without showing the normal start controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="game-container">
      <FarmCountStartPanel
        mode={mode}
        difficulty={difficulty}
        yardDifficulty={yardDifficulty}
        speedDifficulty={speedDifficulty}
        best={best}
        isGauntletPreset={isGauntletPreset}
        onModeChange={setMode}
        onDifficultyChange={setDifficulty}
        onYardDifficultyChange={setYardDifficulty}
        onSpeedDifficultyChange={setSpeedDifficulty}
        onStart={startGame}
      />
    </View>
  );
}
