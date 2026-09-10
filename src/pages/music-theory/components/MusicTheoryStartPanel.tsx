import { Text, View } from "@tarojs/components";
import type { TrainingDifficulty } from "../../../utils/trainingStorage";

export interface MusicTheoryStartPanelProps {
  difficulty: TrainingDifficulty;
  onDifficultyChange: (difficulty: TrainingDifficulty) => void;
  onStart: () => void;
}

export default function MusicTheoryStartPanel({
  difficulty,
  onDifficultyChange,
  onStart,
}: MusicTheoryStartPanelProps) {
  return (
    <View className="music-start">
      <Text className="music-kicker">🎵 音乐岛</Text>
      <Text className="music-title">音符探险</Text>
      <Text className="music-subtitle">选一选 · 放一放</Text>
      <View className="music-card">
        <Text>8 张卡 · 4 次放</Text>
        <Text>C4 – G5</Text>
      </View>
      <View className="music-difficulty">
        <View
          className={difficulty === "normal" ? "active" : ""}
          onClick={() => onDifficultyChange("normal")}
        >
          <Text>普通</Text>
        </View>
        <View
          className={difficulty === "hard" ? "active" : ""}
          onClick={() => onDifficultyChange("hard")}
        >
          <Text>困难</Text>
        </View>
      </View>
      <View className="music-button" onClick={onStart}>
        <Text>出发 ✨</Text>
      </View>
    </View>
  );
}
