import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createLoopLineRun } from "./run";
import "./index.scss";

function readBest(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`loop_line_best_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getDifficultyCopy(difficulty: TrainingDifficulty) {
  return difficulty === "hard" ? "6 × 6 · 更多转折与隐藏线索" : "5 × 5 · 适合熟悉单环规则";
}

export default function LoopLineStart() {
  usePageShare("pages/loop-line/index");
  const preset = readGameGauntletModePreset();
  const isGauntletPreset = preset !== null;
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(preset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);

  useEffect(() => setBest(readBest(difficulty)), [difficulty]);

  const startGame = () => {
    const run = createLoopLineRun(difficulty);
    const url = `/pages/loop-line/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (isGauntletPreset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };

  useEffect(() => {
    if (isGauntletPreset) startGame();
    // Gauntlet enters a configured run without showing the normal start controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="loop-line-page">
      <View className="loop-line-start start-screen">
        <View className="header-section">
          <View className="loop-line-logo-icon">
            <Text className="loop-line-logo-emoji">○</Text>
          </View>
          <Text className="loop-line-title">环线谜踪</Text>
          <Text className="loop-line-subtitle">读懂数字，画出唯一不断开的闭环</Text>
          <View className="loop-line-best-pill">
            <Text className="loop-line-best-label">当前难度最高</Text>
            <Text className="loop-line-best-value">{best}</Text>
          </View>
        </View>
        <View className="rules-card">
          <Text className="loop-line-section-title">游戏规则</Text>
          <Text className="loop-line-rule-item">1. 数字表示它四边经过的线段数量。</Text>
          <Text className="loop-line-rule-item">2. 每个交点只能经过 0 或 2 段线。</Text>
          <Text className="loop-line-rule-item">3. 所有线段最后必须组成唯一闭环。</Text>
        </View>
        {!isGauntletPreset ? (
          <View className="summary-card">
            <Text className="loop-line-section-title">选择难度</Text>
            <View className="loop-line-difficulty-row">
              {(["normal", "hard"] as TrainingDifficulty[]).map((value) => (
                <View
                  key={value}
                  className={`loop-line-difficulty-card ${difficulty === value ? "loop-line-difficulty-card-active" : ""}`}
                  onClick={() => setDifficulty(value)}
                >
                  <Text className="loop-line-difficulty-name">
                    {getTrainingDifficultyLabel(value)}
                  </Text>
                  <Text className="loop-line-difficulty-copy">{getDifficultyCopy(value)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <View className="floating-start-action">
          <View className="loop-line-start-button audio-pressable" onClick={startGame}>
            <Text className="loop-line-start-button-text">开始挑战</Text>
          </View>
        </View>
        <View className="floating-start-spacer" />
      </View>
    </View>
  );
}
