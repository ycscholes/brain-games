import { useEffect } from "react";
import Taro from "@tarojs/taro";
import GameRouteStart from "../../components/game-route/GameRouteStart";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createMemoryChallengeRun } from "./run";
import "./index.scss";

export default function MemoryChallengeStart() {
  const preset = readGameGauntletModePreset();
  const startGame = () => {
    const run = createMemoryChallengeRun({
      difficulty: preset?.difficulty ?? "normal",
      mode: preset?.memoryMode ?? "shape",
      n: preset?.memoryN === "3" ? 3 : 1,
    });
    const url = `/pages/memory-challenge/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (preset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };
  useEffect(() => {
    if (preset) startGame();
    // The gauntlet route enters directly into a run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <GameRouteStart
      gameId="memory-challenge"
      title="奇趣记忆"
      emoji="🧠"
      subtitle="在变化中记住目标信息"
      rules={[
        "观察每一轮出现的内容。",
        "判断当前内容是否匹配目标记忆。",
        "连续坚持可解锁更高记忆等级。",
      ]}
      startLabel="开始记忆"
      gauntlet={Boolean(preset)}
      onStart={startGame}
    />
  );
}
