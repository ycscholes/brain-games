import { useEffect } from "react";
import Taro from "@tarojs/taro";
import GameRouteStart from "../../components/game-route/GameRouteStart";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createRockPaperScissorsRun } from "./run";
import "./index.scss";

export default function RockPaperScissorsStart() {
  const preset = readGameGauntletModePreset();
  const startGame = () => {
    const run = createRockPaperScissorsRun(
      preset?.difficulty ?? "normal",
      preset?.mode === "3" ? 3 : 1,
    );
    const url = `/pages/rock-paper-scissors/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (preset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };
  useEffect(() => {
    if (preset) startGame();
    // The gauntlet route enters directly into a run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <GameRouteStart
      gameId="rock-paper-scissors"
      title="逆向猜拳"
      emoji="✊"
      subtitle="看清提示，做出相反选择"
      rules={["根据提示选择目标手势。", "先抑制直觉，再完成判断。", "连续答对会带来更高分数。"]}
      startLabel="开始猜拳"
      gauntlet={Boolean(preset)}
      onStart={startGame}
    />
  );
}
