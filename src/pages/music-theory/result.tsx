import { useEffect, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import MusicTheoryResultPanel from "./components/MusicTheoryResultPanel";
import { createMusicTheoryRun, readMusicTheoryRun } from "./run";
import "./index.scss";

export default function MusicTheoryResult() {
  usePageShare("pages/music-theory/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readMusicTheoryRun(runId));
  const isGauntletPreset = readGameGauntletModePreset() !== null;
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result)
      void Taro.redirectTo({ url: "/pages/music-theory/index" });
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const restart = () => {
    const nextRun = createMusicTheoryRun(run.payload.difficulty);
    void replaceWithGamePlay("music-theory", nextRun.runId, readGameRouteParams());
  };
  return (
    <View className="music-theory-page">
      <MusicTheoryResultPanel
        score={run.result.score}
        awardedPoints={run.result.awardedPoints}
        isGauntlet={isGauntletPreset}
        onRestart={restart}
      />
    </View>
  );
}
