import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { getTrainingDifficultyLabel, MAX_POINTS_PER_SESSION } from "../../utils/trainingStorage";
import { readRockPaperScissorsHighScore } from "./highScoreStorage";
import { createRockPaperScissorsRun, readRockPaperScissorsRun } from "./run";
import "./index.scss";

const DIFFICULTY_CONFIG = {
  1: { label: "入门" },
  2: { label: "简单" },
  3: { label: "中等" },
  4: { label: "困难" },
} as const;
export default function RockPaperScissorsResult() {
  usePageShare("pages/rock-paper-scissors/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readRockPaperScissorsRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result) {
      void Taro.redirectTo({ url: "/pages/rock-paper-scissors/index" });
    }
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const restart = () => {
    const nextRun = createRockPaperScissorsRun(
      run.payload.difficulty,
      run.payload.rounds,
      run.payload.level,
    );
    void replaceWithGamePlay("rock-paper-scissors", nextRun.runId, readGameRouteParams());
  };
  const level = run.payload.level;
  const score = Math.min(MAX_POINTS_PER_SESSION, run.result.score);
  const rewardDifficulty = run.payload.difficulty;
  const storedBest = readRockPaperScissorsHighScore(Taro.getStorageSync(`rps_highscore_D${level}`));
  const best = run.result.isNewBest ? score : (storedBest?.score ?? 0);
  return (
    <View className="rps-game">
      <View className="result-screen">
        <View className="result-card">
          <Text className="result-title">本局成绩</Text>
          <Text className="result-score">{score}</Text>
          <Text className="result-desc">
            答对 {run.result.correctCount} 题 · 最高连击 {run.result.bestStreak} ·{" "}
            {DIFFICULTY_CONFIG[level].label}
          </Text>
          <Text className="result-desc">
            积分{getTrainingDifficultyLabel(rewardDifficulty)} · 获得 {run.result.awardedPoints}{" "}
            积分
          </Text>
          <Text className="result-desc">
            历史最高 {Number.isFinite(best) ? best : score}
            {run.result.isNewBest && score > 0 ? (
              <Text className="result-highlight">，刷新纪录</Text>
            ) : null}
          </Text>
        </View>
        <View className="result-actions">
          <StickerShareButton
            gameTitle="石头剪刀布"
            score={score}
            pagePath="pages/rock-paper-scissors/index"
            isGauntlet={false}
          />
          <View className="primary-button" onClick={restart}>
            <Text className="button-text">再来一局</Text>
          </View>
          <View
            className="secondary-button"
            onClick={() => void goBackToGameStart("rock-paper-scissors")}
          >
            <Text className="button-text">返回开始页</Text>
          </View>
          <View
            className="secondary-button"
            onClick={() => void Taro.reLaunch({ url: "/pages/index/index" })}
          >
            <Text className="button-text">返回游戏主页</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
