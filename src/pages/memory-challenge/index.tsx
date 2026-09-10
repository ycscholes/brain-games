import { useEffect, useState } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import MemoryChallengeStartPanel from "./components/MemoryChallengeStartPanel";
import {
  getMemoryChallengeRoundPoints,
  type MemoryChallengeMode,
  type MemoryChallengeN,
} from "./gameLogic";
import { createMemoryChallengeRun } from "./run";
import "./index.scss";

const MODE_CONFIG: Record<
  MemoryChallengeMode,
  { label: string; icon: string; description: string }
> = {
  shape: { label: "图形", icon: "🔷", description: "记住抽象图形" },
  pet: { label: "宠物", icon: "🐾", description: "记住云端宠物" },
  calculation: { label: "计算", icon: "➕", description: "记住算式答案" },
};

const MEMORY_CONFIG: Record<
  MemoryChallengeN,
  { label: string; color: string; description: string }
> = {
  1: { label: "1-Back", color: "#22C55E", description: "每题基础 1 分" },
  2: { label: "2-Back", color: "#EAB308", description: "每题基础 2 分" },
  3: { label: "3-Back", color: "#F97316", description: "每题基础 4 分" },
  4: { label: "4-Back", color: "#EF4444", description: "每题基础 8 分" },
};

function readHighScore(mode: MemoryChallengeMode, n: MemoryChallengeN) {
  const raw = Taro.getStorageSync(`memory_highscore_${mode}_M${n}`);
  if (typeof raw !== "string" || !raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { score?: unknown };
    return typeof parsed.score === "number" ? parsed.score : 0;
  } catch {
    return 0;
  }
}

export default function MemoryChallengeStart() {
  usePageShare("pages/memory-challenge/index");
  const preset = readGameGauntletModePreset();
  const isGauntletPreset = preset !== null;
  const [mode, setMode] = useState<MemoryChallengeMode>(preset?.memoryMode ?? "shape");
  const [memoryN, setMemoryN] = useState<MemoryChallengeN>(preset?.memoryN === "3" ? 3 : 1);
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    setHighScore(readHighScore(mode, memoryN));
  }, [memoryN, mode]);

  const startGame = () => {
    const difficulty = memoryN >= 3 ? "hard" : "normal";
    const run = createMemoryChallengeRun({ difficulty, mode, n: memoryN });
    const url = `/pages/memory-challenge/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (isGauntletPreset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };

  useEffect(() => {
    if (isGauntletPreset) startGame();
    // Gauntlet enters a configured run without showing the normal start controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="game-container">
      <MemoryChallengeStartPanel
        memoryN={memoryN}
        mode={mode}
        highScore={highScore}
        isGauntletPreset={isGauntletPreset}
        isLoadingPets={false}
        answerTimeSeconds={6}
        modeConfig={MODE_CONFIG}
        memoryConfig={MEMORY_CONFIG}
        getRoundPoints={getMemoryChallengeRoundPoints}
        onModeChange={setMode}
        onMemoryNChange={setMemoryN}
        onStart={startGame}
      />
    </View>
  );
}
