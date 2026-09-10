import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { readRockPaperScissorsHighScore } from "./highScoreStorage";
import { createRockPaperScissorsRun } from "./run";
import "./index.scss";

type Difficulty = 1 | 2 | 3 | 4;

const DIFFICULTY_CONFIG = {
  1: { label: "入门", color: "#4DBA87", time: 5 },
  2: { label: "简单", color: "#F2B544", time: 4 },
  3: { label: "中等", color: "#F07A4A", time: 3 },
  4: { label: "困难", color: "#D94B58", time: 2 },
} as const;

export default function RockPaperScissorsStart() {
  usePageShare("pages/rock-paper-scissors/index");
  const preset = readGameGauntletModePreset();
  const isGauntletPreset = preset !== null;
  const [difficulty, setDifficulty] = useState<Difficulty>(
    preset?.mode === "3" || preset?.difficulty === "hard" ? 3 : 1,
  );
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    const record = readRockPaperScissorsHighScore(
      Taro.getStorageSync(`rps_highscore_D${difficulty}`),
    );
    setHighScore(record?.score ?? 0);
  }, [difficulty]);

  const startGame = () => {
    const rewardDifficulty: TrainingDifficulty = difficulty >= 3 ? "hard" : "normal";
    const run = createRockPaperScissorsRun(rewardDifficulty, difficulty >= 3 ? 3 : 1, difficulty);
    const url = `/pages/rock-paper-scissors/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (isGauntletPreset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };

  useEffect(() => {
    if (isGauntletPreset) startGame();
    // Gauntlet enters a configured run without showing the normal start controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="rps-game">
      <View className="ambient ambient-one" />
      <View className="ambient ambient-two" />
      <View className="ambient-grid" />
      <View className="screen start-screen">
        <View className="header-section-rps">
          <View className="logo-container-rps">
            <View className="logo-icon-rps">
              <Text className="hero-mark-emoji hero-mark-emoji-rock">✊</Text>
              <Text className="hero-mark-emoji hero-mark-emoji-paper">📄</Text>
              <Text className="hero-mark-emoji hero-mark-emoji-scissors">✌️</Text>
            </View>
          </View>
          <Text className="game-title-rps">逆向猜拳</Text>
          <Text className="game-subtitle-rps">根据目标结果倒推答案，挑战你的反应和判断！</Text>
          <View className="high-score-badge-rps">
            <View className="high-score-icon-rps">
              <Text className="high-score-icon-text-rps">🏆</Text>
            </View>
            <View className="high-score-content-rps">
              <Text className="high-score-label-rps">当前难度最高分</Text>
              <Text className="high-score-value-rps">{highScore}</Text>
            </View>
          </View>
        </View>

        <View className="rules-card-rps">
          <View className="rules-header-rps">
            <View className="rules-icon-rps">
              <Text className="rules-icon-text-rps">📋</Text>
            </View>
            <Text className="rules-title-rps">游戏规则</Text>
          </View>
          <View className="rules-list-rps">
            <View className="rule-item-rps">
              <Text className="rule-number-rps">1.</Text>
              <Text className="rule-text-rps">先看电脑出的手势</Text>
            </View>
            <View className="rule-item-rps">
              <Text className="rule-number-rps">2.</Text>
              <Text className="rule-text-rps">再看本轮要求你赢、平或输</Text>
            </View>
            <View className="rule-item-rps">
              <Text className="rule-number-rps">3.</Text>
              <Text className="rule-text-rps">选出正确手势，答错或超时结束</Text>
            </View>
          </View>
        </View>

        {!isGauntletPreset && (
          <View className="difficulty-section-rps">
            <View className="difficulty-header-rps">
              <View className="difficulty-icon-rps">
                <Text className="difficulty-icon-text-rps">⏱️</Text>
              </View>
              <Text className="difficulty-title-rps">答题时间</Text>
            </View>
            <View className="difficulty-grid-rps">
              {([1, 2, 3, 4] as Difficulty[]).map((value) => {
                const config = DIFFICULTY_CONFIG[value];
                return (
                  <View
                    key={`diff-${value}`}
                    className={`difficulty-item ${difficulty === value ? "difficulty-item-selected" : ""}`}
                    onClick={() => setDifficulty(value)}
                  >
                    <View
                      className="difficulty-badge-rps"
                      style={{ backgroundColor: config.color }}
                    >
                      <Text className="difficulty-badge-text-rps">{config.time}s</Text>
                    </View>
                    <View className="difficulty-copy-rps">
                      <Text className="difficulty-label">{config.label}</Text>
                      <Text className="difficulty-reward-rps">
                        积分{getTrainingDifficultyLabel(value >= 3 ? "hard" : "normal")}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View className="start-button-container-rps floating-start-action">
          <View className="start-button-rps" onClick={startGame}>
            <Text className="start-button-text-rps">开始游戏</Text>
          </View>
        </View>
        <View className="floating-start-spacer" />
      </View>
    </View>
  );
}
