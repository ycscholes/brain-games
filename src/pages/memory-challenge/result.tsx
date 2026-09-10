import { useEffect, useState } from "react";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import { goBackToGameStart, readGameRouteParams, replaceWithGamePlay } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { getMemoryChallengeRewardCap } from "./gameLogic";
import MemoryChallengeResultPanel from "./components/MemoryChallengeResultPanel";
import { createMemoryChallengeRun, readMemoryChallengeRun } from "./run";
import "./index.scss";

const MODE_LABELS = { shape: "图形", pet: "宠物", calculation: "计算" } as const;
const MEMORY_LABELS = { 1: "1-Back", 2: "2-Back", 3: "3-Back", 4: "4-Back" } as const;

function readHighScore(mode: keyof typeof MODE_LABELS, n: 1 | 2 | 3 | 4) {
  const raw = Taro.getStorageSync(`memory_highscore_${mode}_M${n}`);
  if (typeof raw !== "string" || !raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { score?: unknown };
    return typeof parsed.score === "number" ? parsed.score : 0;
  } catch {
    return 0;
  }
}

export default function MemoryChallengeResult() {
  usePageShare("pages/memory-challenge/index");
  const runId = getCurrentInstance().router?.params?.runId ?? "";
  const [run] = useState(() => readMemoryChallengeRun(runId));
  useEffect(() => {
    if (!run || run.status !== "settled" || !run.result) {
      void Taro.redirectTo({ url: "/pages/memory-challenge/index" });
    }
  }, [run]);
  if (!run || run.status !== "settled" || !run.result) return null;
  const mode = run.payload.mode;
  const memoryN = run.payload.n;
  const restart = () => {
    const nextRun = createMemoryChallengeRun({
      difficulty: run.payload.difficulty,
      mode,
      n: memoryN,
    });
    void replaceWithGamePlay("memory-challenge", nextRun.runId, readGameRouteParams());
  };
  return (
    <MemoryChallengeResultPanel
      score={run.result.score}
      correctCount={run.result.correctCount}
      modeLabel={MODE_LABELS[mode]}
      memoryLabel={MEMORY_LABELS[memoryN]}
      awardedPoints={run.result.awardedPoints}
      rewardCap={getMemoryChallengeRewardCap(mode, memoryN)}
      highScore={readHighScore(mode, memoryN)}
      isNewRecord={run.result.isNewBest}
      isGauntlet={false}
      onRestart={restart}
      onBackToStart={() => void goBackToGameStart("memory-challenge")}
      onBackHome={() => void Taro.reLaunch({ url: "/pages/index/index" })}
    />
  );
}
