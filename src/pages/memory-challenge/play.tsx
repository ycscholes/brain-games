import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { resolvePetSpriteUrl } from "../../config/remoteAssets";
import { syncPetData } from "../../utils/petStorage";
import { resolveCustomPetSpriteUrl } from "../../services/custom-pet/customPetService";
import { type TrainingDifficulty, type TrainingRewardPolicy } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import GameRouteBack from "../../components/game-route/GameRouteBack";
import { usePageShare } from "../../utils/share";
import { playTap } from "../../services/audio/audioFeedbackService";
import { buildPetDisplayPool } from "../pet/petDisplayPool";
import MemoryChallengePlayPanel from "./components/MemoryChallengePlayPanel";
import {
  addMemoryChallengeRoundScore,
  createCalculationItem,
  createNumericOptions,
  createVisualOptions,
  getMemoryChallengeModeRecord,
  getMemoryChallengeRewardCap,
  getNBackTarget,
  getUnlockedPetItems,
  loadPetMemoryItemsFromAssets,
  PET_MOOD_UNLOCK_ORDER,
  type MemoryChallengeItem,
  type MemoryChallengeMode,
  type MemoryChallengeN,
  type MemoryChallengeOption,
} from "./gameLogic";
import {
  abandonMemoryChallengeRun,
  readMemoryChallengeRun,
  settleMemoryChallengeCompletion,
  updateMemoryChallengeRun,
  type MemoryChallengeItemSnapshot,
  type MemoryChallengeOptionSnapshot,
} from "./run";
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

type GameState = "memorize" | "playing";

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

function snapshotItem(item: MemoryChallengeItem): MemoryChallengeItemSnapshot {
  return {
    id: item.id,
    prompt: item.prompt,
    answerId: item.answerId,
    answerLabel: item.answerLabel,
    petMood: item.petMood,
  };
}

function restoreItem(
  snapshot: MemoryChallengeItemSnapshot | null,
  itemPool: MemoryChallengeItem[],
): MemoryChallengeItem | null {
  if (!snapshot) return null;
  return (
    itemPool.find((item) => item.id === snapshot.id || item.answerId === snapshot.answerId) ?? {
      ...snapshot,
      petMood: snapshot.petMood as MemoryChallengeItem["petMood"],
    }
  );
}

function restoreOption(
  snapshot: MemoryChallengeOptionSnapshot,
  itemPool: MemoryChallengeItem[],
): MemoryChallengeOption {
  const item = itemPool.find(
    (candidate) => candidate.answerId === snapshot.id || candidate.id === snapshot.id,
  );
  return {
    ...snapshot,
    imageSrc: item?.imageSrc,
  };
}

export default function MemoryChallenge() {
  usePageShare("pages/memory-challenge/index");
  const gauntletPreset = readGameGauntletModePreset();
  const presetMode = gauntletPreset?.memoryMode ?? "shape";
  const presetN: MemoryChallengeN = gauntletPreset?.memoryN === "3" ? 3 : 1;
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = readMemoryChallengeRun(runId);

  useEffect(() => {
    if (!runId || !routeRun || routeRun.status !== "active") {
      void Taro.redirectTo({ url: "/pages/memory-challenge/index" });
    }
  }, [routeRun, runId]);

  const mode: MemoryChallengeMode = routeRun?.payload.mode ?? presetMode;
  const memoryN: MemoryChallengeN = routeRun?.payload.n ?? presetN;
  const persistedState = routeRun?.payload.state;
  const initialStaticPool = mode === "shape" ? SHAPE_ITEMS : [];
  const [gameState, setGameState] = useState<GameState>(persistedState?.gameState ?? "memorize");
  const [score, setScore] = useState(() => persistedState?.score ?? 0);
  const [round, setRound] = useState(() => persistedState?.round ?? 1);
  const [timeLeft, setTimeLeft] = useState(() => persistedState?.timeLeft ?? ANSWER_TIME_SECONDS);
  const [currentItem, setCurrentItem] = useState<MemoryChallengeItem | null>(() =>
    restoreItem(persistedState?.currentItem ?? null, initialStaticPool),
  );
  const [targetItem, setTargetItem] = useState<MemoryChallengeItem | null>(() =>
    restoreItem(persistedState?.targetItem ?? null, initialStaticPool),
  );
  const [memorizeIndex, setMemorizeIndex] = useState(() => persistedState?.memorizeIndex ?? 0);
  const [options, setOptions] = useState<MemoryChallengeOption[]>(() =>
    (persistedState?.options ?? []).map((option) => restoreOption(option, initialStaticPool)),
  );
  const [feedback, setFeedback] = useState<"none" | "correct" | "wrong">(
    () => persistedState?.feedback ?? "none",
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => persistedState?.selectedId ?? null,
  );
  const [isLoadingPets, setIsLoadingPets] = useState(false);
  const [petItems, setPetItems] = useState<MemoryChallengeItem[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const historyRef = useRef<MemoryChallengeItem[]>(
    (persistedState?.history ?? [])
      .map((item) => restoreItem(item, initialStaticPool))
      .filter((item): item is MemoryChallengeItem => Boolean(item)),
  );
  const scoreRef = useRef(persistedState?.score ?? 0);
  const correctCountRef = useRef(persistedState?.correctCount ?? 0);
  const finishedRef = useRef(false);
  const activeModeRef = useRef<MemoryChallengeMode>(mode);
  const activeNRef = useRef<MemoryChallengeN>(memoryN);
  const activePoolRef = useRef<MemoryChallengeItem[]>(initialStaticPool);
  const allPetItemsRef = useRef<MemoryChallengeItem[]>([]);
  const startedAtRef = useRef(persistedState?.clockStartedAt ?? routeRun?.payload.startedAt ?? 0);
  const answerStartedAtRef = useRef(persistedState?.answerStartedAt ?? 0);
  const autoStartedRef = useRef(false);
  const restoredTransientRef = useRef(false);

  const persistRunState = useCallback(
    (state: {
      history: MemoryChallengeItem[];
      currentItem: MemoryChallengeItem | null;
      targetItem: MemoryChallengeItem | null;
      options: MemoryChallengeOption[];
      gameState: GameState;
      round: number;
      memorizeIndex: number;
      score: number;
      correctCount: number;
      timeLeft: number;
      selectedId: string | null;
      feedback: "none" | "correct" | "wrong";
    }) => {
      if (!runId) return;
      updateMemoryChallengeRun(runId, {
        state: {
          history: state.history.map(snapshotItem),
          currentItem: state.currentItem ? snapshotItem(state.currentItem) : null,
          targetItem: state.targetItem ? snapshotItem(state.targetItem) : null,
          options: state.options.map((option) => ({
            id: option.id,
            label: option.label,
          })),
          gameState: state.gameState,
          round: state.round,
          memorizeIndex: state.memorizeIndex,
          score: state.score,
          correctCount: state.correctCount,
          timeLeft: state.timeLeft,
          selectedId: state.selectedId,
          feedback: state.feedback,
          clockStartedAt: startedAtRef.current,
          answerStartedAt: answerStartedAtRef.current,
        },
      });
    },
    [runId],
  );

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
      answerStartedAtRef.current = Date.now();
      const nextOptions = buildOptions(selectedMode, target);
      setCurrentItem(nextItem);
      setTargetItem(target);
      setOptions(nextOptions);
      setGameState("playing");
      setFeedback("none");
      setSelectedId(null);
      setTimeLeft(ANSWER_TIME_SECONDS);
      persistRunState({
        history: nextHistory,
        currentItem: nextItem,
        targetItem: target,
        options: nextOptions,
        gameState: "playing",
        round,
        memorizeIndex: selectedN - 1,
        score: scoreRef.current,
        correctCount: correctCountRef.current,
        timeLeft: ANSWER_TIME_SECONDS,
        selectedId: null,
        feedback: "none",
      });
    },
    [buildOptions, createNextItem, persistRunState, round],
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
      answerStartedAtRef.current = 0;
      scoreRef.current = 0;
      correctCountRef.current = 0;

      const initialItems = Array.from({ length: selectedN }, () =>
        selectedMode === "calculation" ? createCalculationItem() : pickRandomItem(initialPool),
      );

      historyRef.current = initialItems;
      setScore(0);
      setRound(1);
      setMemorizeIndex(0);
      setCurrentItem(initialItems[0]);
      setTargetItem(null);
      setOptions([]);
      setGameState("memorize");
      setFeedback("none");
      setSelectedId(null);
      persistRunState({
        history: initialItems,
        currentItem: initialItems[0],
        targetItem: null,
        options: [],
        gameState: "memorize",
        round: 1,
        memorizeIndex: 0,
        score: 0,
        correctCount: 0,
        timeLeft: ANSWER_TIME_SECONDS,
        selectedId: null,
        feedback: "none",
      });

      let index = 0;
      const showNextItem = () => {
        index += 1;
        if (index < selectedN) {
          setMemorizeIndex(index);
          setCurrentItem(initialItems[index]);
          persistRunState({
            history: initialItems,
            currentItem: initialItems[index],
            targetItem: null,
            options: [],
            gameState: "memorize",
            round: 1,
            memorizeIndex: index,
            score: scoreRef.current,
            correctCount: correctCountRef.current,
            timeLeft: ANSWER_TIME_SECONDS,
            selectedId: null,
            feedback: "none",
          });
          schedule(showNextItem, MEMORIZE_ITEM_MS);
          return;
        }
        schedule(() => startPlaying(initialItems), MEMORIZE_ITEM_MS);
      };

      schedule(showNextItem, MEMORIZE_ITEM_MS);
    },
    [clearTimers, persistRunState, schedule, startPlaying],
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

  const restoreGame = useCallback(async () => {
    if (!persistedState) {
      await startGame();
      return;
    }

    clearTimers();
    setIsLoadingPets(mode === "pet");
    try {
      const resolvedItems =
        mode === "pet" ? (petItems.length > 0 ? petItems : await resolvePetItems()) : [];
      if (mode === "pet") setPetItems(resolvedItems);
      const pool = mode === "shape" ? SHAPE_ITEMS : mode === "pet" ? resolvedItems : [];
      const restoredHistory = persistedState.history
        .map((item) => restoreItem(item, pool))
        .filter((item): item is MemoryChallengeItem => Boolean(item));
      if (restoredHistory.length === 0) {
        await startGame();
        return;
      }

      activeModeRef.current = mode;
      activeNRef.current = memoryN;
      activePoolRef.current =
        mode === "pet" ? getUnlockedPetItems(pool, persistedState.correctCount) : pool;
      allPetItemsRef.current = mode === "pet" ? pool : [];
      historyRef.current = restoredHistory;
      scoreRef.current = persistedState.score;
      correctCountRef.current = persistedState.correctCount;
      startedAtRef.current = persistedState.clockStartedAt;
      answerStartedAtRef.current = persistedState.answerStartedAt;
      finishedRef.current = false;

      const restoredCurrentItem = restoreItem(persistedState.currentItem, pool);
      const restoredTargetItem = restoreItem(persistedState.targetItem, pool);
      const restoredOptions = persistedState.options.map((option) => restoreOption(option, pool));
      const restoredTimeLeft =
        persistedState.gameState === "playing" && persistedState.answerStartedAt > 0
          ? Math.max(
              0,
              Math.min(
                persistedState.timeLeft,
                ANSWER_TIME_SECONDS - (Date.now() - persistedState.answerStartedAt) / 1000,
              ),
            )
          : persistedState.timeLeft;

      setScore(persistedState.score);
      setRound(persistedState.round);
      setMemorizeIndex(persistedState.memorizeIndex);
      setCurrentItem(restoredCurrentItem);
      setTargetItem(restoredTargetItem);
      setOptions(restoredOptions);
      setGameState(persistedState.gameState);
      setFeedback(persistedState.feedback);
      setSelectedId(persistedState.selectedId);
      setTimeLeft(restoredTimeLeft);
      restoredTransientRef.current =
        persistedState.gameState === "playing" && persistedState.feedback !== "none";

      if (persistedState.gameState === "memorize") {
        let index = persistedState.memorizeIndex;
        const showNextItem = () => {
          index += 1;
          if (index < memoryN) {
            setMemorizeIndex(index);
            setCurrentItem(restoredHistory[index]);
            persistRunState({
              history: restoredHistory,
              currentItem: restoredHistory[index],
              targetItem: null,
              options: [],
              gameState: "memorize",
              round: persistedState.round,
              memorizeIndex: index,
              score: scoreRef.current,
              correctCount: correctCountRef.current,
              timeLeft: ANSWER_TIME_SECONDS,
              selectedId: null,
              feedback: "none",
            });
            schedule(showNextItem, MEMORIZE_ITEM_MS);
            return;
          }
          startPlaying(restoredHistory);
        };
        schedule(showNextItem, MEMORIZE_ITEM_MS);
      }
    } catch {
      Taro.showToast({
        title: "宠物图片加载失败，请重试",
        icon: "none",
      });
    } finally {
      setIsLoadingPets(false);
    }
  }, [
    clearTimers,
    memoryN,
    mode,
    persistedState,
    petItems,
    persistRunState,
    schedule,
    startGame,
    startPlaying,
  ]);

  useEffect(() => {
    if (!routeRun || routeRun.status !== "active" || autoStartedRef.current || isLoadingPets)
      return;
    autoStartedRef.current = true;
    void restoreGame();
  }, [gameState, isLoadingPets, restoreGame, routeRun]);

  const updateHighScore = useCallback(
    (finalScore: number, selectedMode: MemoryChallengeMode, selectedN: MemoryChallengeN) => {
      const currentRecord = readHighScore(selectedMode, selectedN);
      if (!currentRecord || finalScore > currentRecord.score) {
        const nextRecord: HighScoreRecord = {
          score: finalScore,
          achievedAt: new Date().toISOString(),
        };
        Taro.setStorageSync(getHighScoreKey(selectedMode, selectedN), JSON.stringify(nextRecord));
        return true;
      }
      return false;
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
    const settlementInput = {
      gameId: "memory-challenge",
      score: finalScore,
      mode: getMemoryChallengeModeRecord(selectedMode, selectedN),
      difficulty: rewardDifficulty,
      durationSeconds,
      rewardPolicy,
      outcome: "completed",
    } as const;
    const isNewBest = updateHighScore(finalScore, selectedMode, selectedN);
    const routeSettlement = runId
      ? settleMemoryChallengeCompletion(
          runId,
          {
            score: finalScore,
            awardedPoints: 0,
            durationSeconds,
            correctCount: correctCountRef.current,
            level: round,
            isNewBest,
          },
          settlementInput,
        )
      : null;
    if (!routeSettlement) return;
    if (routeSettlement.settlement.gauntletHandled) return;
    void Taro.redirectTo({
      url: `/pages/memory-challenge/result?runId=${encodeURIComponent(runId)}`,
    });
  }, [clearTimers, round, runId, updateHighScore]);

  const handleRouteBack = useCallback(() => {
    if (!runId || !routeRun || routeRun.status !== "active") return;
    abandonMemoryChallengeRun(runId, {
      gameId: "memory-challenge",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - routeRun.payload.startedAt) / 1_000)),
      mode: `${routeRun.payload.mode}-${routeRun.payload.n}back`,
      difficulty: routeRun.payload.difficulty,
      outcome: "interrupted",
      rewardPolicy: getRewardPolicy(routeRun.payload.mode, routeRun.payload.n),
    });
  }, [routeRun, runId]);
  useUnload(handleRouteBack);

  const nextRound = useCallback(() => {
    const selectedMode = activeModeRef.current;
    const selectedN = activeNRef.current;
    const nextItem = createNextItem(selectedMode);
    const nextHistory = [...historyRef.current, nextItem];
    const target = getNBackTarget(nextHistory, selectedN);
    if (!target) return;

    historyRef.current = nextHistory;
    answerStartedAtRef.current = Date.now();
    const nextOptions = buildOptions(selectedMode, target);
    const nextRoundNumber = round + 1;
    setCurrentItem(nextItem);
    setTargetItem(target);
    setOptions(nextOptions);
    setRound(nextRoundNumber);
    setFeedback("none");
    setSelectedId(null);
    setTimeLeft(ANSWER_TIME_SECONDS);
    persistRunState({
      history: nextHistory,
      currentItem: nextItem,
      targetItem: target,
      options: nextOptions,
      gameState: "playing",
      round: nextRoundNumber,
      memorizeIndex: activeNRef.current - 1,
      score: scoreRef.current,
      correctCount: correctCountRef.current,
      timeLeft: ANSWER_TIME_SECONDS,
      selectedId: null,
      feedback: "none",
    });
  }, [buildOptions, createNextItem, persistRunState, round]);

  useEffect(() => {
    if (!restoredTransientRef.current || gameState !== "playing" || feedback === "none") {
      return undefined;
    }
    restoredTransientRef.current = false;
    const timeout = setTimeout(() => {
      if (feedback === "wrong") {
        handleGameOver();
      } else {
        nextRound();
      }
    }, FEEDBACK_MS);
    return () => clearTimeout(timeout);
  }, [feedback, gameState, handleGameOver, nextRound]);

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
        persistRunState({
          history: historyRef.current,
          currentItem,
          targetItem,
          options,
          gameState,
          round,
          memorizeIndex,
          score: scoreRef.current,
          correctCount: correctCountRef.current,
          timeLeft,
          selectedId: id,
          feedback: "wrong",
        });
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
      if (activeModeRef.current === "pet") {
        activePoolRef.current = getUnlockedPetItems(allPetItemsRef.current, nextCorrectCount);
      }
      setFeedback("correct");
      persistRunState({
        history: historyRef.current,
        currentItem,
        targetItem,
        options,
        gameState,
        round,
        memorizeIndex,
        score: nextScore,
        correctCount: nextCorrectCount,
        timeLeft,
        selectedId: id,
        feedback: "correct",
      });
      schedule(nextRound, FEEDBACK_MS);
    },
    [
      currentItem,
      feedback,
      gameState,
      handleGameOver,
      memorizeIndex,
      nextRound,
      options,
      persistRunState,
      round,
      schedule,
      targetItem,
      timeLeft,
    ],
  );

  const statusText =
    gameState === "memorize"
      ? `请记住第 ${memorizeIndex + 1}/${memoryN} 题`
      : mode === "calculation"
        ? `请选择前 ${memoryN} 题的答案`
        : `请选择前 ${memoryN} 题的内容`;

  return (
    <View className="game-container">
      {runId ? (
        <GameRouteBack gameId="memory-challenge" runId={runId} onAbandon={handleRouteBack} />
      ) : null}
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
    </View>
  );
}
