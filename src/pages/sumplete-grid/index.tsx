import { useCallback, useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { createSumpleteGridRun } from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "sumplete_grid_best";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function SumpleteGridStart() {
  usePageShare("pages/sumplete-grid/index");
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
    const run = createSumpleteGridRun(difficulty);
    const query = buildGameRouteQuery(run.runId, readGameRouteParams());
    void (isGauntletPreset ? Taro.redirectTo : Taro.navigateTo)({
      url: `/pages/sumplete-grid/play?${query}`,
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
    <View className="sumplete-grid-page">
      <View className="sumplete-start start-screen">
        <View className="header-section">
          <View className="logo-icon">
            <Text className="logo-emoji">∑</Text>
          </View>
          <Text className="game-title">删数求和</Text>
          <Text className="game-subtitle">保留合适数字，让每行每列凑出目标和</Text>
          <View className="high-score-badge">
            <Text className="high-score-label">当前难度最高</Text>
            <Text className="high-score-value">{best}</Text>
          </View>
        </View>
        <View className="rules-card">
          <Text className="section-title">游戏规则</Text>
          <Text className="rule-item">1. 点击格子在“保留、划掉、未定”之间切换。</Text>
          <Text className="rule-item">2. 每行右侧、每列底部显示需要保留的数字之和。</Text>
          <Text className="rule-item">3. 全部格子判断完成后提交，越快且越少失误得分越高。</Text>
        </View>
        {!isGauntletPreset && (
          <View className="summary-card">
            <Text className="section-title">难度</Text>
            <View className="summary-grid">
              {renderDifficultyCard("normal", "4 x 4 · 适合热身")}
              {renderDifficultyCard("hard", "5 x 5 · 干扰更多")}
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
