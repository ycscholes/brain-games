import { useEffect, useMemo, useState } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { getTrainingDifficultyLabel } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import MentalMathStartPanel, { type MentalMathGameMode } from "./components/MentalMathStartPanel";
import {
  CUSTOM_MATH_STAGE_ID,
  DEFAULT_CUSTOM_MATH_CONFIG,
  DEFAULT_MATH_STAGE_ID,
  getCustomMathProfile,
  getMathStage,
  MATH_STAGES,
  type CustomMathConfig,
  type CustomMathOperation,
  type CustomMathRangeId,
  type MathStageId,
} from "./mathStages";
import { createMentalMathRun } from "./run";
import "./index.scss";

function readStoredScore(gameMode: MentalMathGameMode, stageId: MathStageId) {
  const raw =
    Taro.getStorageSync(`mental_math_high_score_${gameMode}_${stageId}`) ||
    (stageId === DEFAULT_MATH_STAGE_ID
      ? Taro.getStorageSync(`mental_math_high_score_${gameMode}`)
      : "");
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== "string" || !raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { score?: unknown };
    return typeof parsed.score === "number" && Number.isFinite(parsed.score) ? parsed.score : 0;
  } catch {
    return 0;
  }
}

export default function MentalMathStart() {
  usePageShare("pages/mental-math/index");
  const preset = readGameGauntletModePreset();
  const isGauntletPreset = preset !== null;
  const presetStageId =
    preset?.stageId && MATH_STAGES.some((stage) => stage.id === preset.stageId)
      ? (preset.stageId as MathStageId)
      : DEFAULT_MATH_STAGE_ID;
  const [gameMode, setGameMode] = useState<MentalMathGameMode>(
    preset?.mode === "death" ? "death" : "timed",
  );
  const [selectedStageId, setSelectedStageId] = useState<MathStageId>(presetStageId);
  const [customConfig, setCustomConfig] = useState<CustomMathConfig>(DEFAULT_CUSTOM_MATH_CONFIG);
  const [highScore, setHighScore] = useState(0);
  const selectedStage = useMemo(() => getMathStage(selectedStageId), [selectedStageId]);
  const customProfile = useMemo(() => getCustomMathProfile(customConfig), [customConfig]);
  const isCustomStage = selectedStageId === CUSTOM_MATH_STAGE_ID;

  useEffect(() => {
    setHighScore(readStoredScore(gameMode, selectedStageId));
  }, [gameMode, selectedStageId]);

  const getStageDifficulty = (stageId: MathStageId) =>
    stageId === CUSTOM_MATH_STAGE_ID ? customProfile.difficulty : getMathStage(stageId).difficulty;

  const toggleCustomOperation = (operation: CustomMathOperation | "all") => {
    if (operation === "all") {
      setCustomConfig((current) => ({
        ...current,
        operations: ["add", "subtract", "multiply", "divide"],
      }));
      return;
    }
    setCustomConfig((current) => {
      const hasOperation = current.operations.includes(operation);
      if (hasOperation && current.operations.length === 1) return current;
      const operations = ["add", "subtract", "multiply", "divide"].filter((item) =>
        hasOperation
          ? item !== operation && current.operations.includes(item as CustomMathOperation)
          : item === operation || current.operations.includes(item as CustomMathOperation),
      ) as CustomMathOperation[];
      return { ...current, operations };
    });
  };

  const startGame = () => {
    const difficulty = isCustomStage ? customProfile.difficulty : selectedStage.difficulty;
    const run = createMentalMathRun({
      difficulty,
      mode: gameMode,
      stageId: selectedStageId,
      customConfig: isCustomStage ? customConfig : undefined,
    });
    const url = `/pages/mental-math/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (isGauntletPreset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };

  useEffect(() => {
    if (isGauntletPreset) startGame();
    // Gauntlet enters a configured run without showing the normal start controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="game-container">
      <MentalMathStartPanel
        highScore={highScore}
        isGauntletPreset={isGauntletPreset}
        gameMode={gameMode}
        selectedStageId={selectedStageId}
        customConfig={customConfig}
        customProfileSummary={customProfile.summary}
        stages={MATH_STAGES}
        getStageDifficulty={getStageDifficulty}
        getDifficultyLabel={getTrainingDifficultyLabel}
        onStageChange={setSelectedStageId}
        onModeChange={setGameMode}
        onToggleCustomOperation={toggleCustomOperation}
        onSelectCustomRange={(rangeId: CustomMathRangeId) =>
          setCustomConfig((current) => ({ ...current, rangeId }))
        }
        onStart={startGame}
      />
    </View>
  );
}
