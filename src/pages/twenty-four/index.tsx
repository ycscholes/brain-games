import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createTwentyFourRun } from "./run";
import { GAME_SECONDS } from "./gameLogic";
import "./index.scss";

const STORAGE_KEY_PREFIX = "twenty_four_best";

export default function TwentyFourStart() {
  usePageShare("pages/twenty-four/index");
  const preset = readGameGauntletModePreset();
  const [best, setBest] = useState(0);

  useEffect(() => {
    const value = Number(
      Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_normal`) ||
        Taro.getStorageSync(STORAGE_KEY_PREFIX),
    );
    setBest(Number.isFinite(value) ? value : 0);
  }, []);

  const startGame = () => {
    const run = createTwentyFourRun(preset?.difficulty ?? "normal");
    const url = `/pages/twenty-four/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (preset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };

  useEffect(() => {
    if (preset) startGame();
    // Gauntlet enters a configured run without showing the normal start controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="twenty-four-page">
      <View className="tf-start start-screen">
        <View className="header-section">
          <View className="logo-icon">
            <Text className="logo-emoji">24</Text>
          </View>
          <Text className="game-title">24 点</Text>
          <Text className="game-subtitle">用四个数字和四则运算凑出 24</Text>
          <View className="high-score-badge">
            <Text className="high-score-label">历史最高</Text>
            <Text className="high-score-value">{best}</Text>
          </View>
        </View>

        <View className="rules-card">
          <Text className="section-title">游戏规则</Text>
          <Text className="rule-item">1. 每轮四张数字牌都必须使用一次。</Text>
          <Text className="rule-item">2. 可以使用 +、-、×、÷ 和括号。</Text>
          <Text className="rule-item">
            3. 数字范围为 1 至 10，初始每题 2 分，每答对 3 题后续每题加 1 分。
          </Text>
        </View>

        <View className="summary-card">
          <Text className="section-title">训练提示</Text>
          <View className="summary-grid summary-grid-three">
            <View className="summary-item">
              <Text className="summary-value">{GAME_SECONDS}s</Text>
              <Text className="summary-label">固定限时</Text>
            </View>
            <View className="summary-item">
              <Text className="summary-value">1-10</Text>
              <Text className="summary-label">数字范围</Text>
            </View>
            <View className="summary-item">
              <Text className="summary-value">+2</Text>
              <Text className="summary-label">起始单题</Text>
            </View>
          </View>
        </View>

        <View className="floating-start-action">
          <View className="tf-primary-button" onClick={startGame}>
            <Text className="tf-primary-button-text">开始挑战</Text>
          </View>
        </View>
        <View className="floating-start-spacer" />
      </View>
    </View>
  );
}
