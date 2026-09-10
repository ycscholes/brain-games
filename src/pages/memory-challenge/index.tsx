import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { resolvePetSpriteUrl } from "../../config/remoteAssets";
import { syncPetData } from "../../utils/petStorage";
import { resolveCustomPetSpriteUrl } from "../../services/custom-pet/customPetService";
import { type TrainingDifficulty, type TrainingRewardPolicy } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { settleGame } from "../../services/gameSettlementService";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { playTap } from "../../services/audio/audioFeedbackService";
import { buildPetDisplayPool } from "../pet/petDisplayPool";
import MemoryChallengePlayPanel from "./components/MemoryChallengePlayPanel";
import MemoryChallengeResultPanel from "./components/MemoryChallengeResultPanel";
import MemoryChallengeStartPanel from "./components/MemoryChallengeStartPanel";
import {
  addMemoryChallengeRoundScore,
  createCalculationItem,
  createNumericOptions,
  createVisualOptions,
  getMemoryChallengeModeRecord,
  getMemoryChallengeRewardCap,
  getMemoryChallengeRoundPoints,
  getNBackTarget,
  getUnlockedPetItems,
  loadPetMemoryItemsFromAssets,
  PET_MOOD_UNLOCK_ORDER,
  type MemoryChallengeItem,
  type MemoryChallengeMode,
  type MemoryChallengeN,
  type MemoryChallengeOption,
} from "./gameLogic";
import "./index.scss";

import shape01 from "../../assets/shapes/shape_01.svg";
import shape02 from "../../assets/shapes/shape_02.svg";
import shape03 from "../../assets/shapes/shape_03.svg";
import shape04 from "../../assets/shapes/shape_04.svg";
import shape05 from "../../assets/shapes/shape_05.svg";
import shape06 from "../../assets/shapes/shape_06.svg";
import shape07 from "../../assets/shapes/shape_07.svg";
import shape08 from "../../assets/shapes/shape_08.svg";
import shape09 from "../../assets/shapes/shape_09.svg";
import shape10 from "../../assets/shapes/shape_10.svg";

type GameState = "start" | "memorize" | "playing" | "gameover";

interface HighScoreRecord {
  score: number;
  achievedAt: string;
}

const ANSWER_TIME_SECONDS = 6;
const MEMORIZE_ITEM_MS = 1500;
const FEEDBACK_MS = 500;

const SHAPE_ITEMS: MemoryChallengeItem[] = [
  shape01,
  shape02,
  shape03,
  shape04,
  shape05,
  shape06,
  shape07,
  shape08,
  shape09,
  shape10,
].map((imageSrc, index) => {
  const id = `shape_${`${index + 1}`.padStart(2, "0")}`;
  return {
    id,
    prompt: id,
    answerId: id,
    answerLabel: `图形${index + 1}`,
    imageSrc,
  };
});

const MODE_CONFIG: Record<
  MemoryChallengeMode,
  {
    label: string;
    icon: string;
    description: string;
  }
> = {
  shape: {
    label: "图形",
    icon: "🔷",
    description: "记住抽象图形",
  },
  pet: {
    label: "宠物",
    icon: "🐾",
    description: "记住云端宠物",
  },
  calculation: {
    label: "计算",
    icon: "➕",
    description: "记住算式答案",
  },
};

const MEMORY_CONFIG: Record<
  MemoryChallengeN,
  {
    label: string;
    color: string;
    description: string;
  }
> = {
  1: { label: "1-Back", color: "#22C55E", description: "每题基础 1 分" },
  2: { label: "2-Back", color: "#EAB308", description: "每题基础 2 分" },
  3: { label: "3-Back", color: "#F97316", description: "每题基础 4 分" },
  4: { label: "4-Back", color: "#EF4444", description: "每题基础 8 分" },
};

function getHighScoreKey(mode: MemoryChallengeMode, n: MemoryChallengeN) {
  return `memory_highscore_${mode}_M${n}`;
}

function readHighScore(mode: MemoryChallengeMode, n: MemoryChallengeN): HighScoreRecord | null {
  const raw = Taro.getStorageSync(getHighScoreKey(mode, n));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as HighScoreRecord;
    return typeof parsed.score === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function preloadImage(url: string) {
  return new Promise<boolean>((resolve) => {
    Taro.getImageInfo({
      src: url,
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
}

async function resolvePetItems(): Promise<MemoryChallengeItem[]> {
  const petData = syncPetData({ markChanged: false });
  const pets = buildPetDisplayPool(petData);
  return loadPetMemoryItemsFromAssets(
    pets,
    PET_MOOD_UNLOCK_ORDER,
    (assetRef, skin, mood, options) =>
      assetRef.kind === "custom"
        ? resolveCustomPetSpriteUrl(assetRef.customAssetId, mood, options)
        : resolvePetSpriteUrl(skin, mood, options),
    preloadImage,
  );
}

function getRewardDifficulty(n: MemoryChallengeN): TrainingDifficulty {
  return n >= 3 ? "hard" : "normal";
}

function getRewardPolicy(mode: MemoryChallengeMode, n: MemoryChallengeN): TrainingRewardPolicy {
  return {
    applyDifficultyMultiplier: false,
    maxPoints: getMemoryChallengeRewardCap(mode, n),
  };
}

function pickRandomItem(items: MemoryChallengeItem[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export default function MemoryChallenge() {
  usePageShare("pages/memory-challenge/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;
  const presetMode = gauntletPreset?.memoryMode ?? "shape";
  const presetN: MemoryChallengeN = gauntletPreset?.memoryN === "3" ? 3 : 1;

  const [gameState, setGameState] = useState<GameState>("start");
  useAmbientMusic(gameState === "start");
  const [mode, setMode] = useState<MemoryChallengeMode>(presetMode);
  const [memoryN, setMemoryN] = useState<MemoryChallengeN>(presetN);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(ANSWER_TIME_SECONDS);
  const [currentItem, setCurrentItem] = useState<MemoryChallengeItem | null>(null);
  const [targetItem, setTargetItem] = useState<MemoryChallengeItem | null>(null);
  const [memorizeIndex, setMemorizeIndex] = useState(0);
  const [options, setOptions] = useState<MemoryChallengeOption[]>([]);
  const [feedback, setFeedback] = useState<"none" | "correct" | "wrong">("none");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isLoadingPets, setIsLoadingPets] = useState(false);
  const [petItems, setPetItems] = useState<MemoryChallengeItem[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const historyRef = useRef<MemoryChallengeItem[]>([]);
  const scoreRef = useRef(0);
  const correctCountRef = useRef(0);
  const finishedRef = useRef(false);
  const activeModeRef = useRef<MemoryChallengeMode>("shape");
  const activeNRef = useRef<MemoryChallengeN>(1);
  const activePoolRef = useRef<MemoryChallengeItem[]>(SHAPE_ITEMS);
  const allPetItemsRef = useRef<MemoryChallengeItem[]>([]);
  const startedAtRef = useRef(0);
  const autoStartedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.current = [];
  }, []);

  const schedule = useCallback((callback: () => void, delayMs: number) => {
    const timeout = setTimeout(callback, delayMs);
    timeoutRefs.current.push(timeout);
  }, []);

  const refreshHighScore = useCallback(() => {
    setHighScore(readHighScore(mode, memoryN)?.score ?? 0);
  }, [memoryN, mode]);

  useLoad(refreshHighScore);
  useDidShow(refreshHighScore);

  useEffect(() => {
    refreshHighScore();
  }, [refreshHighScore]);

  useEffect(() => clearTimers, [clearTimers]);

  const createNextItem = useCallback((selectedMode: MemoryChallengeMode) => {
    if (selectedMode === "calculation") {
      return createCalculationItem();
    }
    return pickRandomItem(activePoolRef.current);
  }, []);

  const buildOptions = useCallback(
    (selectedMode: MemoryChallengeMode, target: MemoryChallengeItem) => {
      return selectedMode === "calculation"
        ? createNumericOptions(Number(target.answerId))
        : createVisualOptions(target, activePoolRef.current);
    },
    [],
  );

  const startPlaying = useCallback(
    (currentHistory: MemoryChallengeItem[]) => {
      const selectedMode = activeModeRef.current;
      const selectedN = activeNRef.current;
      const nextItem = createNextItem(selectedMode);
      const nextHistory = [...currentHistory, nextItem];
      const target = getNBackTarget(nextHistory, selectedN);
      if (!target) return;

      historyRef.current = nextHistory;
      setCurrentItem(nextItem);
      setTargetItem(target);
      setOptions(buildOptions(selectedMode, target));
      setGameState("playing");
      setFeedback("none");
      setSelectedId(null);
      setTimeLeft(ANSWER_TIME_SECONDS);
    },
    [buildOptions, createNextItem],
  );

  const beginSession = useCallback(
    (
      selectedMode: MemoryChallengeMode,
      selectedN: MemoryChallengeN,
      itemPool: MemoryChallengeItem[],
    ) => {
      clearTimers();
      activeModeRef.current = selectedMode;
      activeNRef.current = selectedN;
      const initialPool = selectedMode === "pet" ? getUnlockedPetItems(itemPool, 0) : itemPool;
      activePoolRef.current = initialPool;
      allPetItemsRef.current = selectedMode === "pet" ? itemPool : [];
      finishedRef.current = false;
      startedAtRef.current = Date.now();
      scoreRef.current = 0;
      correctCountRef.current = 0;

      const initialItems = Array.from({ length: selectedN }, () =>
        selectedMode === "calculation" ? createCalculationItem() : pickRandomItem(initialPool),
      );

      historyRef.current = initialItems;
      setScore(0);
      setRound(1);
      setCorrectCount(0);
      setAwardedPoints(0);
      setMemorizeIndex(0);
      setCurrentItem(initialItems[0]);
      setTargetItem(null);
      setOptions([]);
      setGameState("memorize");
      setFeedback("none");
      setSelectedId(null);

      let index = 0;
      const showNextItem = () => {
        index += 1;
        if (index < selectedN) {
          setMemorizeIndex(index);
          setCurrentItem(initialItems[index]);
          schedule(showNextItem, MEMORIZE_ITEM_MS);
          return;
        }
        schedule(() => startPlaying(initialItems), MEMORIZE_ITEM_MS);
      };

      schedule(showNextItem, MEMORIZE_ITEM_MS);
    },
    [clearTimers, schedule, startPlaying],
  );

  const startGame = useCallback(async () => {
    playTap();
    if (isLoadingPets) return;

    if (mode !== "pet") {
      beginSession(mode, memoryN, mode === "shape" ? SHAPE_ITEMS : []);
      return;
    }

    setIsLoadingPets(true);
    try {
      const resolvedItems = petItems.length > 0 ? petItems : await resolvePetItems();
      setPetItems(resolvedItems);
      beginSession(mode, memoryN, resolvedItems);
    } catch {
      Taro.showToast({
        title: "宠物图片加载失败，请重试",
        icon: "none",
      });
    } finally {
      setIsLoadingPets(false);
    }
  }, [beginSession, isLoadingPets, memoryN, mode, petItems]);

  useEffect(() => {
    if (!isGauntletPreset || autoStartedRef.current || gameState !== "start" || isLoadingPets)
      return;
    autoStartedRef.current = true;
    void startGame();
  }, [gameState, isGauntletPreset, isLoadingPets, startGame]);

  const updateHighScore = useCallback(
    (finalScore: number, selectedMode: MemoryChallengeMode, selectedN: MemoryChallengeN) => {
      const currentRecord = readHighScore(selectedMode, selectedN);
      if (!currentRecord || finalScore > currentRecord.score) {
        const nextRecord: HighScoreRecord = {
          score: finalScore,
          achievedAt: new Date().toISOString(),
        };
        Taro.setStorageSync(getHighScoreKey(selectedMode, selectedN), JSON.stringify(nextRecord));
        setHighScore(finalScore);
        setIsNewRecord(true);
        return;
      }
      setHighScore(currentRecord.score);
      setIsNewRecord(false);
    },
    [],
  );

  const handleGameOver = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();

    const selectedMode = activeModeRef.current;
    const selectedN = activeNRef.current;
    const finalScore = scoreRef.current;
    const rewardDifficulty = getRewardDifficulty(selectedN);
    const rewardPolicy = getRewardPolicy(selectedMode, selectedN);
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const settlement = settleGame({
      gameId: "memory-challenge",
      score: finalScore,
      mode: getMemoryChallengeModeRecord(selectedMode, selectedN),
      difficulty: rewardDifficulty,
      durationSeconds,
      rewardPolicy,
      outcome: "completed",
    });
    if (settlement.gauntletHandled) {
      return;
    }

    Taro.setStorageSync("memory_last_score", finalScore);

    setAwardedPoints(settlement.awardedPoints);
    updateHighScore(finalScore, selectedMode, selectedN);
    setGameState("gameover");
  }, [clearTimers, updateHighScore]);

  const nextRound = useCallback(() => {
    const selectedMode = activeModeRef.current;
    const selectedN = activeNRef.current;
    const nextItem = createNextItem(selectedMode);
    const nextHistory = [...historyRef.current, nextItem];
    const target = getNBackTarget(nextHistory, selectedN);
    if (!target) return;

    historyRef.current = nextHistory;
    setCurrentItem(nextItem);
    setTargetItem(target);
    setOptions(buildOptions(selectedMode, target));
    setRound((value) => value + 1);
    setFeedback("none");
    setSelectedId(null);
    setTimeLeft(ANSWER_TIME_SECONDS);
  }, [buildOptions, createNextItem]);

  useEffect(() => {
    if (gameState !== "playing" || feedback !== "none") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 0.1) {
          handleGameOver();
          return 0;
        }
        return current - 0.1;
      });
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [feedback, gameState, handleGameOver]);

  const handleSelect = useCallback(
    (id: string) => {
      if (gameState !== "playing" || feedback !== "none" || !targetItem) return;

      setSelectedId(id);
      if (id !== targetItem.answerId) {
        setFeedback("wrong");
        schedule(handleGameOver, FEEDBACK_MS);
        return;
      }

      const nextScore = addMemoryChallengeRoundScore(
        scoreRef.current,
        activeModeRef.current,
        activeNRef.current,
      );
      scoreRef.current = nextScore;
      setScore(nextScore);
      const nextCorrectCount = correctCountRef.current + 1;
      correctCountRef.current = nextCorrectCount;
      setCorrectCount(nextCorrectCount);
      if (activeModeRef.current === "pet") {
        activePoolRef.current = getUnlockedPetItems(allPetItemsRef.current, nextCorrectCount);
      }
      setFeedback("correct");
      schedule(nextRound, FEEDBACK_MS);
    },
    [feedback, gameState, handleGameOver, nextRound, schedule, targetItem],
  );

  const statusText =
    gameState === "memorize"
      ? `请记住第 ${memorizeIndex + 1}/${memoryN} 题`
      : mode === "calculation"
        ? `请选择前 ${memoryN} 题的答案`
        : `请选择前 ${memoryN} 题的内容`;

  return (
    <View className="game-container">
      {gameState === "start" && (
        <MemoryChallengeStartPanel
          memoryN={memoryN}
          mode={mode}
          highScore={highScore}
          isGauntletPreset={isGauntletPreset}
          isLoadingPets={isLoadingPets}
          answerTimeSeconds={ANSWER_TIME_SECONDS}
          modeConfig={MODE_CONFIG}
          memoryConfig={MEMORY_CONFIG}
          getRoundPoints={getMemoryChallengeRoundPoints}
          onModeChange={setMode}
          onMemoryNChange={setMemoryN}
          onStart={startGame}
        />
      )}

      {(gameState === "memorize" || gameState === "playing") && currentItem && (
        <MemoryChallengePlayPanel
          gameState={gameState}
          modeIcon={MODE_CONFIG[activeModeRef.current].icon}
          round={round}
          score={score}
          statusText={statusText}
          currentItem={currentItem}
          timeLeft={timeLeft}
          answerTimeSeconds={ANSWER_TIME_SECONDS}
          options={options}
          selectedId={selectedId}
          feedback={feedback}
          onSelect={handleSelect}
        />
      )}

      {gameState === "gameover" && (
        <MemoryChallengeResultPanel
          score={score}
          correctCount={correctCount}
          modeLabel={MODE_CONFIG[activeModeRef.current].label}
          memoryLabel={MEMORY_CONFIG[activeNRef.current].label}
          awardedPoints={awardedPoints}
          rewardCap={getMemoryChallengeRewardCap(activeModeRef.current, activeNRef.current)}
          highScore={highScore}
          isNewRecord={isNewRecord}
          isGauntlet={isGauntletPreset}
          onRestart={startGame}
          onBackToStart={() => setGameState("start")}
          onBackHome={() => Taro.reLaunch({ url: "/pages/index/index" })}
        />
      )}
    </View>
  );
}
