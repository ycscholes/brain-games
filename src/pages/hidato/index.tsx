import { useEffect } from "react";
import Taro from "@tarojs/taro";
import GameRouteStart from "../../components/game-route/GameRouteStart";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createHidatoRun } from "./run";
import "./index.scss";

export default function HidatoStart() {
  const preset = readGameGauntletModePreset();
  const startGame = () => {
    const run = createHidatoRun(preset?.difficulty ?? "normal");
    const url = `/pages/hidato/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (preset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };
  useEffect(() => {
    if (preset) startGame();
    // The gauntlet route enters directly into a run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <GameRouteStart
      gameId="hidato"
      title="连数迷阵"
      emoji="🔷"
      subtitle="连接连续数字，走出完整路径"
      rules={[
        "从已知数字出发连接相邻格。",
        "不能跳过连续数字。",
        "用更短路径完成棋盘可获得更高分。",
      ]}
      startLabel="开始解谜"
      gauntlet={Boolean(preset)}
      onStart={startGame}
    />
  );
}
