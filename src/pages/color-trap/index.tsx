import { useCallback, useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { createColorTrapRun } from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "color_trap_best";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function ColorTrapStart() {
  usePageShare("pages/color-trap/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(
    gauntletPreset?.difficulty ?? "normal",
  );
  const [best, setBest] = useState(0);
  useAmbientMusic(!isGauntletPreset);

  const refreshBest = useCallback(() => setBest(readBestScore(difficulty)), [difficulty]);
  useLoad(refreshBest);
  useDidShow(refreshBest);
  useEffect(refreshBest, [refreshBest]);

  const startGame = useCallback(() => {
    const run = createColorTrapRun(difficulty);
    const query = buildGameRouteQuery(run.runId, readGameRouteParams());
    void (isGauntletPreset ? Taro.redirectTo : Taro.navigateTo)({
      url: `/pages/color-trap/play?${query}`,
    });
  }, [difficulty, isGauntletPreset]);

  useEffect(() => {
    if (isGauntletPreset) startGame();
  }, [isGauntletPreset, startGame]);

  const renderDifficultyCard = (nextDifficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`summary-item ${difficulty === nextDifficulty ? "summary-item-active" : ""}`}
      onClick={() => setDifficulty(nextDifficulty)}
    >
      <Text className="summary-value">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="summary-label">{copy}</Text>
    </View>
  );

  return (
    <View className="color-trap-page">
      <View className="trap-start start-screen">
        <View className="header-section">
          <View className="logo-icon">
            <Text className="logo-emoji">色</Text>
          </View>
          <Text className="game-title">颜色陷阱</Text>
          <Text className="game-subtitle">在文字含义和字体颜色之间快速切换</Text>
          <View className="high-score-badge">
            <Text className="high-score-label">当前难度最高</Text>
            <Text className="high-score-value">{best}</Text>
          </View>
        </View>

        <View className="rules-card">
          <Text className="section-title">游戏规则</Text>
          <Text className="rule-item">1. 每局 8 题，按提示选择颜色。</Text>
          <Text className="rule-item">2. “字体颜色”看字的颜色，“文字含义”看字本身。</Text>
          <Text className="rule-item">3. 快速答对和连续答对会获得额外得分。</Text>
        </View>

        {!isGauntletPreset && (
          <View className="summary-card">
            <Text className="section-title">难度</Text>
            <View className="summary-grid">
              {renderDifficultyCard("normal", "规则交替 · 节奏舒缓")}
              {renderDifficultyCard("hard", "更多颜色干扰 · 限时更紧")}
            </View>
          </View>
        )}

        <View className="floating-start-action">
          <View className="primary-button" onClick={startGame}>
            <Text className="primary-button-text">开始训练</Text>
          </View>
        </View>
        <View className="floating-start-spacer" />
      </View>
    </View>
  );
}
