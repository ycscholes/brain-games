import { useCallback, useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { createWordScrambleRun } from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "word_scramble_best";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function WordScrambleStart() {
  usePageShare("pages/word-scramble/index");
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
    const run = createWordScrambleRun(difficulty);
    const query = buildGameRouteQuery(run.runId, readGameRouteParams());
    void (isGauntletPreset ? Taro.redirectTo : Taro.navigateTo)({
      url: `/pages/word-scramble/play?${query}`,
    });
  }, [difficulty, isGauntletPreset]);
  useEffect(() => {
    if (isGauntletPreset) startGame();
  }, [isGauntletPreset, startGame]);
  const renderDifficultyCard = (nextDifficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`difficulty-card ${difficulty === nextDifficulty ? "difficulty-card-active" : ""}`}
      onClick={() => setDifficulty(nextDifficulty)}
    >
      <Text className="difficulty-name">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="difficulty-copy">{copy}</Text>
    </View>
  );
  return (
    <View className="word-scramble-page">
      <View className="word-start">
        <View className="word-hero">
          <Text className="hero-kicker">语言处理训练</Text>
          <Text className="hero-title">词语拼盘</Text>
          <Text className="hero-copy">从混入干扰字的字盘里点选汉字，按顺序拼出目标词。</Text>
          <View className="best-pill">
            <Text className="best-label">当前难度最高</Text>
            <Text className="best-value">{best}</Text>
          </View>
        </View>
        <View className="info-panel">
          <Text className="section-title">训练规则</Text>
          <Text className="rule-line">1. 每局 8 题，字盘会混入无关汉字。</Text>
          <Text className="rule-line">2. 按正确顺序点字，字数满后自动判定。</Text>
          <Text className="rule-line">3. 困难模式提示会延迟出现，限时更紧。</Text>
        </View>
        {!isGauntletPreset && (
          <View className="info-panel">
            <Text className="section-title">难度</Text>
            <View className="difficulty-grid">
              {renderDifficultyCard("normal", "2 字词 · 2-3 个干扰字")}
              {renderDifficultyCard("hard", "3-5 字词组 · 4-6 个干扰字")}
            </View>
          </View>
        )}
        <View className="primary-button" onClick={startGame}>
          <Text className="primary-button-text">开始训练</Text>
        </View>
      </View>
    </View>
  );
}
