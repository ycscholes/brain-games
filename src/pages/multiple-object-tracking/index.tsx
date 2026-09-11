import { useCallback, useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import {
  getBoardSize,
  INITIAL_TARGET_COUNT,
  MAX_TARGET_COUNT,
  STORAGE_KEY_PREFIX,
  TRACKING_DURATION,
} from "./gameLogic";
import { createMultipleObjectTrackingRun } from "./run";
import "./index.scss";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(
    Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) ||
      (difficulty === "normal" ? Taro.getStorageSync(STORAGE_KEY_PREFIX) : 0),
  );
  return Number.isFinite(value) ? value : 0;
}

export default function MultipleObjectTrackingStart() {
  usePageShare("pages/multiple-object-tracking/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;
  const [rewardDifficulty, setRewardDifficulty] = useState<TrainingDifficulty>(
    gauntletPreset?.difficulty ?? "normal",
  );
  const [best, setBest] = useState(0);
  useAmbientMusic(!isGauntletPreset);

  const refreshBest = useCallback(
    () => setBest(readBestScore(rewardDifficulty)),
    [rewardDifficulty],
  );
  useLoad(refreshBest);
  useDidShow(refreshBest);
  useEffect(refreshBest, [refreshBest]);

  const startGame = useCallback(() => {
    const run = createMultipleObjectTrackingRun(
      rewardDifficulty,
      Date.now(),
      getBoardSize(Taro.getWindowInfo().windowWidth),
    );
    const query = buildGameRouteQuery(run.runId, readGameRouteParams());
    void (isGauntletPreset ? Taro.redirectTo : Taro.navigateTo)({
      url: `/pages/multiple-object-tracking/play?${query}`,
    });
  }, [isGauntletPreset, rewardDifficulty]);

  useEffect(() => {
    if (isGauntletPreset) startGame();
  }, [isGauntletPreset, startGame]);

  return (
    <View className="mot-page">
      <View className="start-screen">
        <View className="header-section">
          <View className="logo-icon">
            <Text className="logo-emoji">◎</Text>
          </View>
          <Text className="game-title">追踪任务</Text>
          <Text className="game-subtitle">在移动干扰中持续锁定目标圆圈</Text>
          <View className="high-score-badge">
            <Text className="high-score-label">最佳分数</Text>
            <Text className="high-score-value">{best}</Text>
          </View>
        </View>

        <View className="rules-card">
          <Text className="section-title">游戏规则</Text>
          <Text className="rule-item">1. 每局从 2 个目标圆圈开始，先短暂高亮提示。</Text>
          <Text className="rule-item">2. 所有圆圈统一外观后移动 5 秒，并带有碰撞反弹。</Text>
          <Text className="rule-item">3. 停止后点击选出目标并提交，必须全部正确才算过关。</Text>
          <Text className="rule-item">
            4. 每轮成功后自动进入下一轮，目标数最多 4 个，速度持续提升。
          </Text>
        </View>

        <View className="summary-card">
          <Text className="section-title">当前设定</Text>
          <View className="summary-grid">
            <View className="summary-item">
              <Text className="summary-value">{INITIAL_TARGET_COUNT[rewardDifficulty]}</Text>
              <Text className="summary-label">起始目标</Text>
            </View>
            <View className="summary-item">
              <Text className="summary-value">{TRACKING_DURATION[rewardDifficulty] / 1000}s</Text>
              <Text className="summary-label">移动时长</Text>
            </View>
            <View className="summary-item">
              <Text className="summary-value">{MAX_TARGET_COUNT}</Text>
              <Text className="summary-label">目标上限</Text>
            </View>
          </View>
        </View>

        {!isGauntletPreset ? (
          <View className="summary-card">
            <Text className="section-title">难度</Text>
            <View className="summary-grid">
              {(["normal", "hard"] as const).map((difficulty) => (
                <View
                  key={difficulty}
                  className={`summary-item ${rewardDifficulty === difficulty ? "summary-item-active" : ""}`}
                  onClick={() => setRewardDifficulty(difficulty)}
                >
                  <Text className="summary-value">{getTrainingDifficultyLabel(difficulty)}</Text>
                  <Text className="summary-label">
                    {difficulty === "normal" ? "2 目标 · 1.0x" : "3 目标 · 1.5x"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

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
