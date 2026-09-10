import { useEffect } from "react";
import Taro from "@tarojs/taro";
import GameRouteStart from "../../components/game-route/GameRouteStart";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createTwentyFourRun } from "./run";
import "./index.scss";

export default function TwentyFourStart() {
  const preset = readGameGauntletModePreset();
  const startGame = () => {
    const run = createTwentyFourRun(preset?.difficulty ?? "normal");
    const url = `/pages/twenty-four/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (preset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };
  useEffect(() => {
    if (preset) startGame();
    // The gauntlet route enters directly into a run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <GameRouteStart
      gameId="twenty-four"
      title="24 点"
      emoji="🔢"
      subtitle="用四个数字组合出 24"
      rules={[
        "每个数字恰好使用一次。",
        "可以使用加、减、乘、除运算。",
        "完成后查看推理得分和训练记录。",
      ]}
      startLabel="开始挑战"
      gauntlet={Boolean(preset)}
      onStart={startGame}
    />
  );
}
