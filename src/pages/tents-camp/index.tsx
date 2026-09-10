import { useEffect } from "react";
import Taro from "@tarojs/taro";
import GameRouteStart from "../../components/game-route/GameRouteStart";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createTentsCampRun } from "./run";
import "./index.scss";

export default function TentsCampStart() {
  const preset = readGameGauntletModePreset();
  const startGame = () => {
    const run = createTentsCampRun(preset?.difficulty ?? "normal");
    const url = `/pages/tents-camp/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (preset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };
  useEffect(() => {
    if (preset) startGame();
    // The gauntlet route enters directly into a run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <GameRouteStart
      gameId="tents-camp"
      title="帐篷营地"
      emoji="⛺"
      subtitle="根据行列线索安排帐篷"
      rules={["每棵树旁只能放置一顶帐篷。", "帐篷不能相邻。", "同时满足行列数量提示即可通关。"]}
      startLabel="开始布置"
      gauntlet={Boolean(preset)}
      onStart={startGame}
    />
  );
}
