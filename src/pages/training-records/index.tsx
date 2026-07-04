import { View, Text } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import {
  getTrainingDifficultyLabel,
  readTrainingRecords,
  readDashboardStats,
  type TrainingGameId,
  type TrainingRecord,
} from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import "./index.scss";

const GAME_TITLES: Record<TrainingGameId, string> = {
  memory: "记忆图形",
  "memory-challenge": "记忆图形",
  rps: "逆向猜拳",
  "rock-paper-scissors": "逆向猜拳",
  "dual-task": "多任务处理",
  "mental-math": "速算挑战",
  "twenty-four": "24 点",
  "digit-span": "数字广度记忆",
  mot: "追踪任务",
  "multiple-object-tracking": "追踪任务",
  pattern: "找规律",
  "pattern-completion": "找规律",
  "number-order": "星链回响",
  "signal-sprint": "信号冲刺",
  "head-count": "小剧场清点",
  "word-scramble": "词语拼盘",
  "bird-count": "宠物速数",
};

function formatPlayedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  const now = Date.now();
  const diffMinutes = Math.max(1, Math.floor((now - date.getTime()) / (1000 * 60)));
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

export default function TrainingRecords() {
  usePageShare("pages/training-records/index");

  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [dashboard, setDashboard] = useState({ totalSessions: 0, totalAwardedPoints: 0 });

  useDidShow(() => {
    setRecords(readTrainingRecords());
    setDashboard(readDashboardStats());
  });

  const goBack = () => {
    Taro.navigateBack();
  };

  return (
    <View className="training-records-page">
      <View className="page-header">
        <View className="back-button" onClick={goBack} aria-label="返回上一页">
          <Text className="back-icon">‹</Text>
        </View>
        <Text className="page-title">训练记录</Text>
      </View>

      <View className="records-summary">
        <View className="summary-item">
          <Text className="summary-value">{dashboard.totalSessions}</Text>
          <Text className="summary-label">累计训练</Text>
        </View>
        <View className="summary-item">
          <Text className="summary-value">{dashboard.totalAwardedPoints}</Text>
          <Text className="summary-label">累计积分</Text>
        </View>
      </View>

      {records.length > 0 ? (
        <View className="records-list">
          {records.map((record) => (
            <View key={record.id} className="record-item-full">
              <View className="record-main">
                <View className="record-copy">
                  <Text className="record-game-title">{GAME_TITLES[record.gameId] || record.gameId}</Text>
                  <Text className="record-meta">
                    {record.difficulty ? `${getTrainingDifficultyLabel(record.difficulty)} · ` : ""}
                    {record.outcome === "completed" ? "正常完成" : "中途返回"} · {formatPlayedAt(record.playedAt)}
                  </Text>
                </View>
                <View className="record-score-block">
                  <Text className="record-score">{record.score}</Text>
                  <Text className="record-points">+{record.awardedPoints} 积分</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="empty-records">
          <Text className="empty-icon">0</Text>
          <Text className="empty-title">还没有训练记录</Text>
          <Text className="empty-copy">从任意一项游戏开始，这里会自动汇总你的训练轨迹。</Text>
        </View>
      )}
    </View>
  );
}
