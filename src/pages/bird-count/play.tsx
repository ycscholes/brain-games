import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { getCurrentInstance, useDidShow, useUnload } from "@tarojs/taro";
import { shouldRedirectInvalidGameRun } from "../../utils/gameRoute";
import { resolvePetSpriteUrl } from "../../config/remoteAssets";
import { resolveCustomPetSpriteUrl } from "../../services/custom-pet/customPetService";
import { syncPetData } from "../../utils/petStorage";
import { type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import GameRouteBack from "../../components/game-route/GameRouteBack";
import { usePageShare } from "../../utils/share";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import type { PetSpriteMood } from "../../domain/pet/sprite";
import type { PetSkin } from "../../domain/pet/types";
import { getPetAssetKey } from "../../domain/pet/assets";
import {
  buildPetDisplayPool,
  getPetDisplayNameForSkin,
  getPetDisplayItemsForSkin,
  type PetDisplayItem,
} from "../pet/petDisplayPool";
import {
  BIRD_COUNT_TOTAL_QUESTIONS,
  createBirdCountSession,
  scoreBirdCountQuestion,
  type BirdCountQuestion,
  type BirdCountQuestionResult,
  type PetCountIdentity,
} from "./gameLogic";
import {
  createHeadCountSession,
  getHeadCountRewardDifficulty,
  HEAD_COUNT_TOTAL_QUESTIONS,
  scoreHeadCountQuestion,
  type HeadCountDifficulty,
  type HeadCountQuestion,
  type HeadCountQuestionResult,
  type HeadCountSpeedDifficulty,
} from "../head-count/gameLogic";
import { useTimerQueue } from "./useTimerQueue";
import {
  abandonBirdCountRun,
  readBirdCountRun,
  settleBirdCountCompletion,
  updateBirdCountRun,
  type BirdCountRunPhase,
} from "./run";
import FarmCountPlayArea from "./components/FarmCountPlayArea";
import "./index.scss";

type FarmCountMode = "speed" | "yard";
type Phase =
  | "loading"
  | "ready"
  | "watching"
  | "replay"
  | "playing-event"
  | "answering"
  | "feedback";

const SPEED_STORAGE_KEY_PREFIX = "bird_count_best";
const YARD_STORAGE_KEY_PREFIX = "head_count_best";
const READY_MS = 520;
const FEEDBACK_MS = 900;
const SPEED_LOADING_MIN_MS = 520;

function getSpeedBestScoreKey(difficulty: TrainingDifficulty) {
  return `${SPEED_STORAGE_KEY_PREFIX}_${difficulty}`;
}

function getYardBestScoreKey(
  difficulty: HeadCountDifficulty,
  speedDifficulty: HeadCountSpeedDifficulty,
) {
  return `${YARD_STORAGE_KEY_PREFIX}_${difficulty}_${speedDifficulty}`;
}

function readSpeedBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(getSpeedBestScoreKey(difficulty)) || 0);
  return Number.isFinite(value) ? value : 0;
}

function readYardBestScore(
  difficulty: HeadCountDifficulty,
  speedDifficulty: HeadCountSpeedDifficulty,
) {
  const value = Number(
    Taro.getStorageSync(getYardBestScoreKey(difficulty, speedDifficulty)) ||
      Taro.getStorageSync(`${YARD_STORAGE_KEY_PREFIX}_${difficulty}`) ||
      0,
  );
  return Number.isFinite(value) ? value : 0;
}

function getPrioritizedPetDisplayPool() {
  return buildPetDisplayPool(syncPetData({ markChanged: false }));
}

function getPetDisplayItemById(petDisplayPool: PetDisplayItem[], displayId: string) {
  return petDisplayPool.find((item) => item.displayId === displayId);
}

function getPetDisplayItemForQuestionPet(
  petDisplayPool: PetDisplayItem[],
  petKey: string,
  skin: PetSkin,
) {
  return (
    getPetDisplayItemById(petDisplayPool, petKey) ??
    getPetDisplayItemsForSkin(petDisplayPool, skin)[0]
  );
}

async function resolveDisplayPetSpriteUrl(item: PetDisplayItem, mood: PetSpriteMood) {
  return item.assetRef.kind === "custom"
    ? resolveCustomPetSpriteUrl(item.assetRef.customAssetId, mood)
    : resolvePetSpriteUrl(item.skin, mood);
}

function preloadImage(url: string) {
  if (!url) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    Taro.getImageInfo({
      src: url,
      success: () => resolve(),
      fail: () => resolve(),
    });
  });
}

function waitForMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function preloadSpeedQuestionImages(
  questions: BirdCountQuestion[],
  petDisplayPool: PetDisplayItem[],
  onProgress: (loaded: number, total: number) => void,
) {
  const imageKeys = new Map<string, { item: PetDisplayItem; mood: PetSpriteMood }>();

  questions.forEach((question) => {
    const targetItem = getPetDisplayItemForQuestionPet(
      petDisplayPool,
      question.targetPetKey,
      question.targetSkin,
    );
    if (targetItem) {
      imageKeys.set(`${getPetAssetKey(targetItem.assetRef)}:idle`, {
        item: targetItem,
        mood: "idle",
      });
    }
    question.pets.forEach((pet) => {
      const item = getPetDisplayItemForQuestionPet(petDisplayPool, pet.petKey, pet.skin);
      if (!item) {
        return;
      }
      imageKeys.set(`${getPetAssetKey(item.assetRef)}:${pet.mood}`, { item, mood: pet.mood });
    });
  });

  const images = [...imageKeys.values()];
  let loaded = 0;
  onProgress(loaded, images.length);

  await Promise.all(
    images.map(async ({ item, mood }) => {
      try {
        const url = await resolveDisplayPetSpriteUrl(item, mood);
        await preloadImage(url);
      } finally {
        loaded += 1;
        onProgress(loaded, images.length);
      }
    }),
  );
}

export default function FarmCount() {
  usePageShare("pages/bird-count/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;
  const presetMode = gauntletPreset?.farmMode ?? "speed";
  const presetDifficulty = gauntletPreset?.difficulty ?? "normal";
  const presetYardSpeed =
    gauntletPreset?.yardSpeed ?? (presetDifficulty === "hard" ? "standard" : "slow");
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = readBirdCountRun(runId);
  const allowSettledRef = useRef(false);

  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, routeRun?.status, allowSettledRef.current)) {
      void Taro.redirectTo({ url: "/pages/bird-count/index" });
    }
  }, [routeRun, runId]);

  const mode: FarmCountMode = routeRun?.payload.mode ?? presetMode;
  const difficulty: TrainingDifficulty = routeRun?.payload.difficulty ?? presetDifficulty;
  const yardDifficulty: HeadCountDifficulty = routeRun?.payload.difficulty ?? presetDifficulty;
  const speedDifficulty: HeadCountSpeedDifficulty = routeRun?.payload.yardSpeed ?? presetYardSpeed;
  const persistedState = routeRun?.payload.state;
  const [phase, setPhase] = useState<Phase>(persistedState?.phase ?? "loading");
  const [best, setBest] = useState(0);
  const [petDisplayPool, setPetDisplayPool] = useState<PetDisplayItem[]>(() =>
    buildPetDisplayPool({
      pets: [],
      activePetId: null,
      balance: 0,
      adoptedCount: 0,
      lastCheckTime: new Date().toISOString(),
    }),
  );
  const [speedQuestions, setSpeedQuestions] = useState<BirdCountQuestion[]>(
    () => persistedState?.speedQuestions ?? [],
  );
  const [yardQuestions, setYardQuestions] = useState<HeadCountQuestion[]>(
    () => persistedState?.yardQuestions ?? [],
  );
  const [currentIndex, setCurrentIndex] = useState(() => persistedState?.currentIndex ?? 0);
  const [eventIndex, setEventIndex] = useState(() => persistedState?.eventIndex ?? -1);
  const [displayCount, setDisplayCount] = useState(() => persistedState?.displayCount ?? 0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(
    () => persistedState?.selectedAnswer ?? null,
  );
  const [score, setScore] = useState(() => persistedState?.score ?? 0);
  const [combo, setCombo] = useState(() => persistedState?.combo ?? 0);
  const [bestCombo, setBestCombo] = useState(() => persistedState?.bestCombo ?? 0);
  const [correctQuestions, setCorrectQuestions] = useState(
    () => persistedState?.correctQuestions ?? 0,
  );
  const [lastSpeedResult, setLastSpeedResult] = useState<BirdCountQuestionResult | null>(
    () => persistedState?.lastSpeedResult ?? null,
  );
  const [lastYardResult, setLastYardResult] = useState<HeadCountQuestionResult | null>(
    () => persistedState?.lastYardResult ?? null,
  );
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });

  const { clear: clearTimers, schedule } = useTimerQueue();
  const startedAtRef = useRef(persistedState?.clockStartedAt ?? routeRun?.payload.startedAt ?? 0);
  const answerStartedAtRef = useRef(persistedState?.answerStartedAt ?? 0);
  const scoreRef = useRef(persistedState?.score ?? 0);
  const comboRef = useRef(persistedState?.combo ?? 0);
  const bestComboRef = useRef(persistedState?.bestCombo ?? 0);
  const correctQuestionsRef = useRef(persistedState?.correctQuestions ?? 0);
  const finishedRef = useRef(false);
  const preloadRunIdRef = useRef(0);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    scoreRef.current = score;
    comboRef.current = combo;
    bestComboRef.current = bestCombo;
    correctQuestionsRef.current = correctQuestions;
  }, [bestCombo, combo, correctQuestions, score]);

  const persistRunState = useCallback(
    (state: {
      speedQuestions: BirdCountQuestion[];
      yardQuestions: HeadCountQuestion[];
      currentIndex: number;
      eventIndex: number;
      displayCount: number;
      selectedAnswer: number | null;
      score: number;
      combo: number;
      bestCombo: number;
      correctQuestions: number;
      phase: BirdCountRunPhase;
      lastSpeedResult: BirdCountQuestionResult | null;
      lastYardResult: HeadCountQuestionResult | null;
    }) => {
      if (!runId) return;
      updateBirdCountRun(runId, {
        state: {
          ...state,
          clockStartedAt: startedAtRef.current,
          answerStartedAt: answerStartedAtRef.current,
        },
      });
    },
    [runId],
  );

  const speedQuestion = speedQuestions[currentIndex] ?? null;
  const yardQuestion = yardQuestions[currentIndex] ?? null;
  const yardEvent =
    yardQuestion && eventIndex >= 0 ? (yardQuestion.events[eventIndex] ?? null) : null;
  const totalQuestions = mode === "yard" ? HEAD_COUNT_TOTAL_QUESTIONS : BIRD_COUNT_TOTAL_QUESTIONS;
  const staticPetCount =
    yardQuestion && phase === "feedback"
      ? yardQuestion.answer
      : phase === "ready"
        ? displayCount
        : 0;
  const movingPets = Array.from({ length: yardEvent?.delta ?? 0 }, (_, index) => index);

  const refreshPetSkinPool = useCallback(() => {
    const next = getPrioritizedPetDisplayPool();
    setPetDisplayPool(next);
    return next;
  }, []);

  const refreshBest = useCallback(() => {
    const nextBest =
      mode === "yard"
        ? readYardBestScore(yardDifficulty, speedDifficulty)
        : readSpeedBestScore(difficulty);
    setBest(nextBest);
  }, [difficulty, mode, speedDifficulty, yardDifficulty]);

  useDidShow(() => {
    refreshPetSkinPool();
    refreshBest();
  });

  useEffect(() => {
    refreshBest();
  }, [refreshBest]);

  const resetRoundState = useCallback(() => {
    setCurrentIndex(0);
    setEventIndex(-1);
    setDisplayCount(0);
    setSelectedAnswer(null);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectQuestions(0);
    setLastSpeedResult(null);
    setLastYardResult(null);
    setLoadProgress({ loaded: 0, total: 0 });
    scoreRef.current = 0;
    comboRef.current = 0;
    bestComboRef.current = 0;
    correctQuestionsRef.current = 0;
    finishedRef.current = false;
  }, []);

  const finishSpeedGame = useCallback(
    (finalScore: number, finalCorrectQuestions: number) => {
      if (finishedRef.current) {
        return;
      }

      finishedRef.current = true;
      clearTimers();
      playComplete();

      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const settlementInput = {
        gameId: "bird-count",
        score: finalScore,
        durationSeconds,
        mode: "speed",
        difficulty,
        outcome: "completed",
      } as const;
      const isNewBest = finalScore > best;
      allowSettledRef.current = true;
      if (isNewBest) {
        Taro.setStorageSync(getSpeedBestScoreKey(difficulty), finalScore);
      }
      const routeSettlement = runId
        ? settleBirdCountCompletion(
            runId,
            {
              score: finalScore,
              awardedPoints: 0,
              durationSeconds,
              correctCount: finalCorrectQuestions,
              bestCombo: bestComboRef.current,
              isNewBest,
            },
            settlementInput,
          )
        : null;
      if (!routeSettlement) return;
      if (routeSettlement.settlement.gauntletHandled) return;
      void Taro.redirectTo({
        url: `/pages/bird-count/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [best, clearTimers, difficulty, runId],
  );

  const finishYardGame = useCallback(
    (finalScore: number, finalCorrectQuestions: number) => {
      if (finishedRef.current) {
        return;
      }

      finishedRef.current = true;
      clearTimers();
      playComplete();

      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const nextRewardDifficulty = getHeadCountRewardDifficulty(yardDifficulty, speedDifficulty);
      const settlementInput = {
        gameId: isGauntletPreset ? "bird-count" : "head-count",
        score: finalScore,
        durationSeconds,
        mode: `${yardDifficulty}:${speedDifficulty}`,
        difficulty: nextRewardDifficulty,
        outcome: "completed",
      } as const;
      const isNewBest = finalScore > best;
      allowSettledRef.current = true;
      if (isNewBest) {
        Taro.setStorageSync(getYardBestScoreKey(yardDifficulty, speedDifficulty), finalScore);
      }
      const routeSettlement = runId
        ? settleBirdCountCompletion(
            runId,
            {
              score: finalScore,
              awardedPoints: 0,
              durationSeconds,
              correctCount: finalCorrectQuestions,
              bestCombo: bestComboRef.current,
              isNewBest,
            },
            settlementInput,
          )
        : null;
      if (!routeSettlement) return;
      if (routeSettlement.settlement.gauntletHandled) return;
      void Taro.redirectTo({
        url: `/pages/bird-count/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [best, clearTimers, isGauntletPreset, runId, speedDifficulty, yardDifficulty],
  );

  const beginSpeedQuestion = useCallback(
    (questionIndex: number, nextQuestions = speedQuestions) => {
      clearTimers();
      const question = nextQuestions[questionIndex];
      setCurrentIndex(questionIndex);
      setSelectedAnswer(null);
      setLastSpeedResult(null);
      setLastYardResult(null);
      setPhase("ready");
      persistRunState({
        speedQuestions: nextQuestions,
        yardQuestions: [],
        currentIndex: questionIndex,
        eventIndex: -1,
        displayCount: 0,
        selectedAnswer: null,
        score: scoreRef.current,
        combo: comboRef.current,
        bestCombo: bestComboRef.current,
        correctQuestions: correctQuestionsRef.current,
        phase: "ready",
        lastSpeedResult: null,
        lastYardResult: null,
      });

      schedule(() => {
        setPhase("watching");
        persistRunState({
          speedQuestions: nextQuestions,
          yardQuestions: [],
          currentIndex: questionIndex,
          eventIndex: -1,
          displayCount: 0,
          selectedAnswer: null,
          score: scoreRef.current,
          combo: comboRef.current,
          bestCombo: bestComboRef.current,
          correctQuestions: correctQuestionsRef.current,
          phase: "watching",
          lastSpeedResult: null,
          lastYardResult: null,
        });
        schedule(() => {
          answerStartedAtRef.current = Date.now();
          setPhase("answering");
          persistRunState({
            speedQuestions: nextQuestions,
            yardQuestions: [],
            currentIndex: questionIndex,
            eventIndex: -1,
            displayCount: 0,
            selectedAnswer: null,
            score: scoreRef.current,
            combo: comboRef.current,
            bestCombo: bestComboRef.current,
            correctQuestions: correctQuestionsRef.current,
            phase: "answering",
            lastSpeedResult: null,
            lastYardResult: null,
          });
        }, question?.revealMs ?? 1000);
      }, READY_MS);
    },
    [clearTimers, persistRunState, schedule, speedQuestions],
  );

  const beginYardQuestion = useCallback(
    (questionIndex: number, nextQuestions = yardQuestions) => {
      clearTimers();
      const question = nextQuestions[questionIndex];
      setCurrentIndex(questionIndex);
      setSelectedAnswer(null);
      setLastSpeedResult(null);
      setLastYardResult(null);
      setEventIndex(-1);
      setDisplayCount(question?.initialCount ?? 0);
      setPhase("ready");
      persistRunState({
        speedQuestions: [],
        yardQuestions: nextQuestions,
        currentIndex: questionIndex,
        eventIndex: -1,
        displayCount: question?.initialCount ?? 0,
        selectedAnswer: null,
        score: scoreRef.current,
        combo: comboRef.current,
        bestCombo: bestComboRef.current,
        correctQuestions: correctQuestionsRef.current,
        phase: "ready",
        lastSpeedResult: null,
        lastYardResult: null,
      });

      schedule(() => {
        setPhase("playing-event");
        persistRunState({
          speedQuestions: [],
          yardQuestions: nextQuestions,
          currentIndex: questionIndex,
          eventIndex: -1,
          displayCount: question?.initialCount ?? 0,
          selectedAnswer: null,
          score: scoreRef.current,
          combo: comboRef.current,
          bestCombo: bestComboRef.current,
          correctQuestions: correctQuestionsRef.current,
          phase: "playing-event",
          lastSpeedResult: null,
          lastYardResult: null,
        });
        question?.events.forEach((event, index) => {
          schedule(() => {
            setEventIndex(index);
            setDisplayCount(event.afterCount);
            persistRunState({
              speedQuestions: [],
              yardQuestions: nextQuestions,
              currentIndex: questionIndex,
              eventIndex: index,
              displayCount: event.afterCount,
              selectedAnswer: null,
              score: scoreRef.current,
              combo: comboRef.current,
              bestCombo: bestComboRef.current,
              correctQuestions: correctQuestionsRef.current,
              phase: "playing-event",
              lastSpeedResult: null,
              lastYardResult: null,
            });
          }, index * question.eventMs);
        });

        schedule(
          () => {
            answerStartedAtRef.current = Date.now();
            setEventIndex(-1);
            setPhase("answering");
            persistRunState({
              speedQuestions: [],
              yardQuestions: nextQuestions,
              currentIndex: questionIndex,
              eventIndex: -1,
              displayCount: question?.answer ?? question?.initialCount ?? 0,
              selectedAnswer: null,
              score: scoreRef.current,
              combo: comboRef.current,
              bestCombo: bestComboRef.current,
              correctQuestions: correctQuestionsRef.current,
              phase: "answering",
              lastSpeedResult: null,
              lastYardResult: null,
            });
          },
          (question?.events.length ?? 0) * (question?.eventMs ?? 700) + 160,
        );
      }, READY_MS);
    },
    [clearTimers, persistRunState, schedule, yardQuestions],
  );

  const startSpeedGame = useCallback(
    async (currentPetDisplayPool = petDisplayPool) => {
      clearTimers();
      const preloadRunId = preloadRunIdRef.current + 1;
      preloadRunIdRef.current = preloadRunId;
      const currentPetPool: PetCountIdentity[] = currentPetDisplayPool.map((item) => ({
        id: item.displayId,
        skin: item.skin,
      }));
      const nextQuestions = createBirdCountSession(difficulty, currentPetPool);
      resetRoundState();
      finishedRef.current = false;
      setSpeedQuestions(nextQuestions);
      setYardQuestions([]);
      setPhase("loading");
      setCurrentIndex(0);
      persistRunState({
        speedQuestions: nextQuestions,
        yardQuestions: [],
        currentIndex: 0,
        eventIndex: -1,
        displayCount: 0,
        selectedAnswer: null,
        score: 0,
        combo: 0,
        bestCombo: 0,
        correctQuestions: 0,
        phase: "loading",
        lastSpeedResult: null,
        lastYardResult: null,
      });

      await Promise.all([
        preloadSpeedQuestionImages(nextQuestions, currentPetDisplayPool, (loaded, total) => {
          if (preloadRunIdRef.current === preloadRunId) {
            setLoadProgress({ loaded, total });
          }
        }),
        waitForMs(SPEED_LOADING_MIN_MS),
      ]);

      if (preloadRunIdRef.current !== preloadRunId) {
        return;
      }

      startedAtRef.current = Date.now();
      beginSpeedQuestion(0, nextQuestions);
    },
    [beginSpeedQuestion, clearTimers, difficulty, persistRunState, petDisplayPool, resetRoundState],
  );

  const startYardGame = useCallback(() => {
    clearTimers();
    preloadRunIdRef.current += 1;
    const nextQuestions = createHeadCountSession(yardDifficulty, speedDifficulty);
    resetRoundState();
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setYardQuestions(nextQuestions);
    setSpeedQuestions([]);
    beginYardQuestion(0, nextQuestions);
  }, [beginYardQuestion, clearTimers, resetRoundState, speedDifficulty, yardDifficulty]);

  const startGame = useCallback(() => {
    playTap();
    const currentPetDisplayPool = refreshPetSkinPool();
    if (mode === "yard") {
      startYardGame();
      return;
    }
    void startSpeedGame(currentPetDisplayPool);
  }, [mode, refreshPetSkinPool, startSpeedGame, startYardGame]);

  const restoreGame = useCallback(() => {
    if (!persistedState) {
      startGame();
      return;
    }

    clearTimers();
    const currentPetPool = refreshPetSkinPool();
    setSpeedQuestions(persistedState.speedQuestions);
    setYardQuestions(persistedState.yardQuestions);
    setCurrentIndex(persistedState.currentIndex);
    setEventIndex(persistedState.eventIndex);
    setDisplayCount(persistedState.displayCount);
    setSelectedAnswer(persistedState.selectedAnswer);
    setScore(persistedState.score);
    setCombo(persistedState.combo);
    setBestCombo(persistedState.bestCombo);
    setCorrectQuestions(persistedState.correctQuestions);
    setLastSpeedResult(persistedState.lastSpeedResult);
    setLastYardResult(persistedState.lastYardResult);
    scoreRef.current = persistedState.score;
    comboRef.current = persistedState.combo;
    bestComboRef.current = persistedState.bestCombo;
    correctQuestionsRef.current = persistedState.correctQuestions;
    startedAtRef.current = persistedState.clockStartedAt;
    answerStartedAtRef.current = persistedState.answerStartedAt;
    finishedRef.current = false;
    setPetDisplayPool(currentPetPool);

    if (
      persistedState.phase === "loading" ||
      persistedState.phase === "ready" ||
      persistedState.phase === "watching" ||
      persistedState.phase === "playing-event"
    ) {
      if (mode === "yard" && persistedState.yardQuestions.length > 0) {
        beginYardQuestion(persistedState.currentIndex, persistedState.yardQuestions);
      } else if (persistedState.speedQuestions.length > 0) {
        beginSpeedQuestion(persistedState.currentIndex, persistedState.speedQuestions);
      } else {
        startGame();
      }
      return;
    }

    if (persistedState.phase === "replay") {
      const question = persistedState.speedQuestions[persistedState.currentIndex];
      schedule(() => {
        if (persistedState.currentIndex >= BIRD_COUNT_TOTAL_QUESTIONS - 1) {
          finishSpeedGame(persistedState.score, persistedState.correctQuestions);
          return;
        }
        beginSpeedQuestion(persistedState.currentIndex + 1, persistedState.speedQuestions);
      }, question?.revealMs ?? 1000);
      return;
    }

    if (persistedState.phase === "feedback") {
      schedule(() => {
        if (persistedState.currentIndex >= HEAD_COUNT_TOTAL_QUESTIONS - 1) {
          finishYardGame(persistedState.score, persistedState.correctQuestions);
          return;
        }
        beginYardQuestion(persistedState.currentIndex + 1, persistedState.yardQuestions);
      }, FEEDBACK_MS);
    }
  }, [
    beginSpeedQuestion,
    beginYardQuestion,
    clearTimers,
    finishSpeedGame,
    finishYardGame,
    mode,
    persistedState,
    refreshPetSkinPool,
    schedule,
    startGame,
  ]);

  useEffect(() => {
    if (!routeRun || routeRun.status !== "active" || autoStartedRef.current) return;
    autoStartedRef.current = true;
    restoreGame();
  }, [phase, restoreGame, routeRun]);

  const handleRouteBack = useCallback(() => {
    if (!runId || !routeRun || routeRun.status !== "active") return;
    abandonBirdCountRun(runId, {
      gameId: "bird-count",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - routeRun.payload.startedAt) / 1_000)),
      mode: routeRun.payload.mode,
      difficulty: routeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [routeRun, runId]);
  useUnload(handleRouteBack);

  const advanceAfterSpeedQuestion = useCallback(
    (nextScore: number, nextCorrectQuestions: number) => {
      if (currentIndex >= BIRD_COUNT_TOTAL_QUESTIONS - 1) {
        finishSpeedGame(nextScore, nextCorrectQuestions);
        return;
      }

      beginSpeedQuestion(currentIndex + 1);
    },
    [beginSpeedQuestion, currentIndex, finishSpeedGame],
  );

  const handleSpeedAnswer = (answer: number) => {
    if (phase !== "answering" || !speedQuestion || selectedAnswer !== null) {
      return;
    }

    const result = scoreBirdCountQuestion({
      selectedAnswer: answer,
      correctAnswer: speedQuestion.answer,
      answerMs: Date.now() - answerStartedAtRef.current,
      currentCombo: combo,
    });
    playTap();
    result.correct ? playCorrect() : playWrong();
    const nextScore = score + result.score;
    const nextCombo = result.correct ? combo + 1 : 0;
    const nextCorrectQuestions = correctQuestions + (result.correct ? 1 : 0);
    const nextBestCombo = Math.max(bestCombo, nextCombo);

    setSelectedAnswer(answer);
    setLastSpeedResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(nextBestCombo);
    setCorrectQuestions(nextCorrectQuestions);
    scoreRef.current = nextScore;
    comboRef.current = nextCombo;
    bestComboRef.current = nextBestCombo;
    correctQuestionsRef.current = nextCorrectQuestions;
    persistRunState({
      speedQuestions,
      yardQuestions: [],
      currentIndex,
      eventIndex: -1,
      displayCount,
      selectedAnswer: answer,
      score: nextScore,
      combo: nextCombo,
      bestCombo: nextBestCombo,
      correctQuestions: nextCorrectQuestions,
      phase: result.correct ? "answering" : "replay",
      lastSpeedResult: result,
      lastYardResult: null,
    });

    if (result.correct) {
      advanceAfterSpeedQuestion(nextScore, nextCorrectQuestions);
      return;
    }

    setPhase("replay");
    schedule(() => {
      advanceAfterSpeedQuestion(nextScore, nextCorrectQuestions);
    }, speedQuestion.revealMs);
  };

  const handleYardAnswer = (answer: number) => {
    if (phase !== "answering" || !yardQuestion || selectedAnswer !== null) {
      return;
    }

    const result = scoreHeadCountQuestion({
      selectedAnswer: answer,
      correctAnswer: yardQuestion.answer,
      answerMs: Date.now() - answerStartedAtRef.current,
      currentCombo: combo,
    });
    playTap();
    result.correct ? playCorrect() : playWrong();
    const nextScore = score + result.score;
    const nextCombo = result.correct ? combo + 1 : 0;
    const nextCorrectQuestions = correctQuestions + (result.correct ? 1 : 0);
    const nextBestCombo = Math.max(bestCombo, nextCombo);

    setSelectedAnswer(answer);
    setLastYardResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(nextBestCombo);
    setCorrectQuestions(nextCorrectQuestions);
    setDisplayCount(yardQuestion.answer);
    setPhase("feedback");
    scoreRef.current = nextScore;
    comboRef.current = nextCombo;
    bestComboRef.current = nextBestCombo;
    correctQuestionsRef.current = nextCorrectQuestions;
    persistRunState({
      speedQuestions: [],
      yardQuestions,
      currentIndex,
      eventIndex: -1,
      displayCount: yardQuestion.answer,
      selectedAnswer: answer,
      score: nextScore,
      combo: nextCombo,
      bestCombo: nextBestCombo,
      correctQuestions: nextCorrectQuestions,
      phase: "feedback",
      lastSpeedResult: null,
      lastYardResult: result,
    });

    schedule(() => {
      if (currentIndex >= HEAD_COUNT_TOTAL_QUESTIONS - 1) {
        finishYardGame(nextScore, nextCorrectQuestions);
        return;
      }

      beginYardQuestion(currentIndex + 1);
    }, FEEDBACK_MS);
  };

  const handleAnswer = (answer: number) => {
    if (mode === "yard") {
      handleYardAnswer(answer);
      return;
    }
    handleSpeedAnswer(answer);
  };

  const currentOptions =
    mode === "yard" ? (yardQuestion?.options ?? []) : (speedQuestion?.options ?? []);
  const currentAnswer = mode === "yard" ? yardQuestion?.answer : speedQuestion?.answer;
  const speedTargetPetName = speedQuestion
    ? (getPetDisplayItemForQuestionPet(
        petDisplayPool,
        speedQuestion.targetPetKey,
        speedQuestion.targetSkin,
      )?.name ?? getPetDisplayNameForSkin(petDisplayPool, speedQuestion.targetSkin))
    : "宠物";

  return (
    <View className="farm-count-page">
      {runId ? (
        <GameRouteBack gameId="bird-count" runId={runId} onAbandon={handleRouteBack} />
      ) : null}
      <FarmCountPlayArea
        mode={mode}
        phase={phase}
        currentIndex={currentIndex}
        totalQuestions={totalQuestions}
        score={score}
        combo={combo}
        speedQuestion={speedQuestion}
        yardQuestion={yardQuestion}
        yardEvent={yardEvent}
        eventIndex={eventIndex}
        displayCount={displayCount}
        staticPetCount={staticPetCount}
        movingPets={movingPets}
        speedDifficulty={speedDifficulty}
        selectedAnswer={selectedAnswer}
        currentOptions={currentOptions}
        currentAnswer={currentAnswer}
        lastSpeedResult={lastSpeedResult}
        lastYardResult={lastYardResult}
        petDisplayPool={petDisplayPool}
        speedTargetPetName={speedTargetPetName}
        loadProgress={loadProgress}
        onAnswer={handleAnswer}
      />
    </View>
  );
}
