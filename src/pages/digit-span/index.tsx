import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import type { TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createDigitSpanRun } from "./run";
import "./index.scss";

const INITIAL_LENGTH: Record<TrainingDifficulty, number> = { normal: 3, hard: 4 };
const STORAGE_KEY_PREFIX = "digit_span_best";

function readBest(difficulty: TrainingDifficulty) {
  const value = Number(
    Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) ||
      (difficulty === "normal" ? Taro.getStorageSync(STORAGE_KEY_PREFIX) : 0),
  );
  return Number.isFinite(value) ? value : 0;
}

export default function DigitSpanStart() {
  usePageShare("pages/digit-span/index");
  const preset = readGameGauntletModePreset();
  const isGauntletPreset = preset !== null;
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(preset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);

  useEffect(() => {
    setBest(readBest(difficulty));
  }, [difficulty]);

  const startGame = () => {
    const run = createDigitSpanRun(difficulty);
    const url = `/pages/digit-span/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (isGauntletPreset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };

  useEffect(() => {
    if (isGauntletPreset) startGame();
    // Gauntlet enters a configured run without showing the normal start controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="digit-span-page">
      <View className="start-screen">
        <View className="header-section">
          <View className="logo-icon">
            <Text className="logo-emoji">123</Text>
          </View>
          <Text className="game-title">数字广度记忆</Text>
          <Text className="game-subtitle">按顺序回忆完整数字串</Text>
          <View className="high-score-badge">
            <Text className="high-score-label">历史最高</Text>
            <Text className="high-score-value">{best}</Text>
          </View>
        </View>

        <View className="rules-card">
          <Text className="section-title">游戏规则</Text>
          <Text className="rule-item">1. 每轮从 3 位数字开始，数字逐个展示，每个持续 1 秒。</Text>
          <Text className="rule-item">2. 展示结束后，使用数字键盘输入完整序列。</Text>
          <Text className="rule-item">3. 回答正确则长度 +1，回答错误则本局结束。</Text>
          <Text className="rule-item">4. 最终得分等于你成功记住的最大长度。</Text>
        </View>

        <View className="summary-card">
          <Text className="section-title">训练提示</Text>
          <View className="summary-grid">
            <View className="summary-item">
              <Text className="summary-value">{INITIAL_LENGTH[difficulty]}</Text>
              <Text className="summary-label">起始位数</Text>
            </View>
            <View className="summary-item">
              <Text className="summary-value">{Math.max(best, INITIAL_LENGTH[difficulty])}</Text>
              <Text className="summary-label">当前挑战线</Text>
            </View>
          </View>
        </View>

        {!isGauntletPreset && (
          <View className="summary-card">
            <Text className="section-title">难度</Text>
            <View className="summary-grid">
              <View
                className={`summary-item ${difficulty === "normal" ? "summary-item-active" : ""}`}
                onClick={() => setDifficulty("normal")}
              >
                <Text className="summary-value">普通</Text>
                <Text className="summary-label">3 位起步 · 1.0x</Text>
              </View>
              <View
                className={`summary-item ${difficulty === "hard" ? "summary-item-active" : ""}`}
                onClick={() => setDifficulty("hard")}
              >
                <Text className="summary-value">困难</Text>
                <Text className="summary-label">4 位起步 · 1.5x</Text>
              </View>
            </View>
          </View>
        )}

        <View className="floating-start-action">
          <View className="primary-button" onClick={startGame}>
            <Text className="button-text">开始挑战</Text>
          </View>
        </View>
        <View className="footer-gap floating-start-spacer" />
      </View>
    </View>
  );
}
