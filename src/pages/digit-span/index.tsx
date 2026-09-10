import { useEffect } from "react";
import Taro from "@tarojs/taro";
import GameRouteStart from "../../components/game-route/GameRouteStart";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createDigitSpanRun } from "./run";
import "./index.scss";

export default function DigitSpanStart() {
  const preset = readGameGauntletModePreset();
  const startGame = () => {
    const run = createDigitSpanRun(preset?.difficulty ?? "normal");
    const url = `/pages/digit-span/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (preset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };
  useEffect(() => {
    if (preset) startGame();
    // The gauntlet route enters directly into a run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <GameRouteStart
      gameId="digit-span"
      title="数字广度记忆"
      emoji="🔢"
      subtitle="记住刚刚出现的数字序列"
      rules={["数字会逐轮变长。", "按正确顺序输入刚刚看到的数字。", "坚持得越久，记忆得分越高。"]}
      startLabel="开始记忆"
      gauntlet={Boolean(preset)}
      onStart={startGame}
    />
  );
}
