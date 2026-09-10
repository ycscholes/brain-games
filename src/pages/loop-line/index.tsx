import { useEffect } from "react";
import Taro from "@tarojs/taro";
import GameRouteStart from "../../components/game-route/GameRouteStart";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createLoopLineRun } from "./run";
import "./index.scss";

export default function LoopLineStart() {
  const preset = readGameGauntletModePreset();
  const startGame = () => {
    const run = createLoopLineRun(preset?.difficulty ?? "normal");
    const url = `/pages/loop-line/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (preset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };
  useEffect(() => {
    if (preset) startGame();
    // The gauntlet route enters directly into a run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <GameRouteStart
      gameId="loop-line"
      title="环线谜踪"
      emoji="⭕"
      subtitle="让所有线段组成一条完整环线"
      rules={["点击边线切换连接状态。", "所有节点都要满足线索数量。", "最终线路必须形成单一闭环。"]}
      startLabel="开始连线"
      gauntlet={Boolean(preset)}
      onStart={startGame}
    />
  );
}
