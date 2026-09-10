import { useEffect } from "react";
import Taro from "@tarojs/taro";
import GameRouteStart from "../../components/game-route/GameRouteStart";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import {
  DEFAULT_MATH_STAGE_ID,
  MATH_STAGES,
  DEFAULT_CUSTOM_MATH_CONFIG,
  type MathStageId,
} from "./mathStages";
import { createMentalMathRun } from "./run";
import "./index.scss";

export default function MentalMathStart() {
  const preset = readGameGauntletModePreset();
  const stageId = (
    preset?.stageId && MATH_STAGES.some((stage) => stage.id === preset.stageId)
      ? preset.stageId
      : DEFAULT_MATH_STAGE_ID
  ) as MathStageId;
  const startGame = () => {
    const run = createMentalMathRun({
      difficulty: preset?.difficulty ?? "normal",
      mode: preset?.mode === "death" ? "death" : "timed",
      stageId,
      customConfig: DEFAULT_CUSTOM_MATH_CONFIG,
    });
    const url = `/pages/mental-math/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (preset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };
  useEffect(() => {
    if (preset) startGame();
    // The route is intentionally started once when entered by the gauntlet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <GameRouteStart
      gameId="mental-math"
      title="速算挑战"
      emoji="🧮"
      subtitle="在有限时间里快速算出答案"
      rules={[
        "选择正确答案，连续答题会获得更高分。",
        "错误答案会影响当前训练节奏。",
        "完成后可查看本次得分与宠物积分。",
      ]}
      startLabel="开始速算"
      gauntlet={Boolean(preset)}
      onStart={startGame}
    />
  );
}
