import { useEffect } from "react";
import Taro from "@tarojs/taro";
import GameRouteStart from "../../components/game-route/GameRouteStart";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createBirdCountRun } from "./run";
import "./index.scss";

export default function BirdCountStart() {
  const preset = readGameGauntletModePreset();
  const startGame = () => {
    const run = createBirdCountRun({
      difficulty: preset?.difficulty ?? "normal",
      mode: preset?.farmMode ?? "speed",
      yardSpeed: preset?.yardSpeed ?? "slow",
    });
    const url = `/pages/bird-count/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (preset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };
  useEffect(() => {
    if (preset) startGame();
    // The gauntlet route enters directly into a run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <GameRouteStart
      gameId="bird-count"
      title="农场清点"
      emoji="🐥"
      subtitle="快速数清画面中的动物"
      rules={[
        "仔细观察农场里的动物变化。",
        "选择你看到的正确数量。",
        "速度和准确度都会影响最终得分。",
      ]}
      startLabel="开始清点"
      gauntlet={Boolean(preset)}
      onStart={startGame}
    />
  );
}
