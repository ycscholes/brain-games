import { useEffect } from "react";
import Taro from "@tarojs/taro";
import GameRouteStart from "../../components/game-route/GameRouteStart";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createNetwalkRun } from "./run";
import "./index.scss";

export default function NetwalkStart() {
  const preset = readGameGauntletModePreset();
  const startGame = () => {
    const run = createNetwalkRun(preset?.difficulty ?? "normal");
    const url = `/pages/netwalk/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (preset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };
  useEffect(() => {
    if (preset) startGame();
    // The gauntlet route enters directly into a run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <GameRouteStart
      gameId="netwalk"
      title="网络回路"
      emoji="🕸️"
      subtitle="旋转线路，让所有节点重新连通"
      rules={[
        "点击节点顺时针旋转线路。",
        "每个终端都必须接入服务器。",
        "少走几步会获得更高推理分。",
      ]}
      startLabel="开始连线"
      gauntlet={Boolean(preset)}
      onStart={startGame}
    />
  );
}
