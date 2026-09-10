import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { getCurrentInstance, useDidShow, useLoad, useUnload } from "@tarojs/taro";
import { resolvePetSpriteUrl } from "../../config/remoteAssets";
import { resolveCustomPetSpriteUrl } from "../../services/custom-pet/customPetService";
import { syncPetData } from "../../utils/petStorage";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { settleGame } from "../../services/gameSettlementService";
import GameRouteBack from "../../components/game-route/GameRouteBack";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
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
  HEAD_COUNT_SPEED_LABELS,
  HEAD_COUNT_TOTAL_QUESTIONS,
  scoreHeadCountQuestion,
  type HeadCountDifficulty,
  type HeadCountQuestion,
  type HeadCountQuestionResult,
  type HeadCountSpeedDifficulty,
} from "../head-count/gameLogic";
import { useTimerQueue } from "./useTimerQueue";
import { abandonBirdCountRun, readBirdCountRun, settleBirdCountCompletion } from "./run";
import FarmCountStartPanel from "./components/FarmCountStartPanel";
import FarmCountPlayArea from "./components/FarmCountPlayArea";
import FarmCountResult from "./components/FarmCountResult";
import "./index.scss";

type FarmCountMode = "speed" | "yard";
type Phase =
  | "start"
  | "loading"
  | "ready"
  | "watching"
  | "replay"
  | "playing-event"
  | "answering"
  | "feedback"
  | "finished";

const SPEED_STORAGE_KEY_PREFIX = "bird_count_best";
const YARD_STORAGE_KEY_PREFIX = "head_count_best";
const READY_MS = 520;
const FEEDBACK_MS = 900;
const SPEED_LOADING_MIN_MS = 520;

function normalizeMode(value?: string): FarmCountMode {
  return value === "yard" ? "yard" : "speed";
}

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

  useEffect(() => {
    if (!runId || !routeRun || routeRun.status !== "active") {
      void Taro.redirectTo({ url: "/pages/bird-count/index" });
    }
  }, [routeRun, runId]);

  const [mode, setMode] = useState<FarmCountMode>(presetMode);
  const [phase, setPhase] = useState<Phase>("start");
  useAmbientMusic(phase === "start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(presetDifficulty);
  const [yardDifficulty, setYardDifficulty] = useState<HeadCountDifficulty>(presetDifficulty);
  const [speedDifficulty, setSpeedDifficulty] = useState<HeadCountSpeedDifficulty>(presetYardSpeed);
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
  const [speedQuestions, setSpeedQuestions] = useState<BirdCountQuestion[]>([]);
  const [yardQuestions, setYardQuestions] = useState<HeadCountQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [eventIndex, setEventIndex] = useState(-1);
  const [displayCount, setDisplayCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctQuestions, setCorrectQuestions] = useState(0);
  const [lastSpeedResult, setLastSpeedResult] = useState<BirdCountQuestionResult | null>(null);
  const [lastYardResult, setLastYardResult] = useState<HeadCountQuestionResult | null>(null);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });

  const { clear: clearTimers, schedule } = useTimerQueue();
  const startedAtRef = useRef(0);
  const answerStartedAtRef = useRef(0);
  const finishedRef = useRef(false);
  const preloadRunIdRef = useRef(0);
  const autoStartedRef = useRef(false);

  const speedQuestion = speedQuestions[currentIndex] ?? null;
  const yardQuestion = yardQuestions[currentIndex] ?? null;
  const yardEvent =
    yardQuestion && eventIndex >= 0 ? (yardQuestion.events[eventIndex] ?? null) : null;
  const totalQuestions = mode === "yard" ? HEAD_COUNT_TOTAL_QUESTIONS : BIRD_COUNT_TOTAL_QUESTIONS;
  const rewardDifficulty = getHeadCountRewardDifficulty(yardDifficulty, speedDifficulty);
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

  useLoad((query) => {
    const nextMode = isGauntletPreset ? presetMode : normalizeMode(String(query.mode ?? ""));
    setMode(nextMode);
    refreshPetSkinPool();
  });

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
    setAwardedPoints(0);
    setIsNewBest(false);
    setLoadProgress({ loaded: 0, total: 0 });
    finishedRef.current = false;
  }, []);

  const backToStart = useCallback(() => {
    preloadRunIdRef.current += 1;
    clearTimers();
    setPhase("start");
    setSpeedQuestions([]);
    setYardQuestions([]);
    resetRoundState();
    refreshPetSkinPool();
    refreshBest();
  }, [clearTimers, refreshBest, refreshPetSkinPool, resetRoundState]);

  const switchMode = (nextMode: FarmCountMode) => {
    if (phase !== "start") {
      return;
    }
    clearTimers();
    setMode(nextMode);
    resetRoundState();
  };

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
      const routeSettlement = runId
        ? settleBirdCountCompletion(
            runId,
            {
              score: finalScore,
              awardedPoints: 0,
              durationSeconds,
              correctCount: finalCorrectQuestions,
              isNewBest: finalScore > best,
            },
            settlementInput,
          )
        : null;
      const settlement =
        routeSettlement?.settlement ?? (runId ? null : settleGame(settlementInput));
      if (!settlement) return;
      if (settlement.gauntletHandled) {
        return;
      }
      const nextAwardedPoints = settlement.awardedPoints;

      setAwardedPoints(nextAwardedPoints);
      setCorrectQuestions(finalCorrectQuestions);
      if (runId) {
        void Taro.redirectTo({
          url: `/pages/bird-count/result?runId=${encodeURIComponent(runId)}`,
        });
        return;
      }
      setPhase("finished");

      if (finalScore > best) {
        Taro.setStorageSync(getSpeedBestScoreKey(difficulty), finalScore);
        setBest(finalScore);
        setIsNewBest(true);
      } else {
        setIsNewBest(false);
      }
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
      const routeSettlement = runId
        ? settleBirdCountCompletion(
            runId,
            {
              score: finalScore,
              awardedPoints: 0,
              durationSeconds,
              correctCount: finalCorrectQuestions,
              isNewBest: finalScore > best,
            },
            settlementInput,
          )
        : null;
      const settlement =
        routeSettlement?.settlement ?? (runId ? null : settleGame(settlementInput));
      if (!settlement) return;
      if (settlement.gauntletHandled) {
        return;
      }
      const nextAwardedPoints = settlement.awardedPoints;

      setAwardedPoints(nextAwardedPoints);
      setCorrectQuestions(finalCorrectQuestions);
      if (runId) {
        void Taro.redirectTo({
          url: `/pages/bird-count/result?runId=${encodeURIComponent(runId)}`,
        });
        return;
      }
      setPhase("finished");

      if (finalScore > best) {
        Taro.setStorageSync(getYardBestScoreKey(yardDifficulty, speedDifficulty), finalScore);
        setBest(finalScore);
        setIsNewBest(true);
      } else {
        setIsNewBest(false);
      }
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

      schedule(() => {
        setPhase("watching");
        schedule(() => {
          answerStartedAtRef.current = Date.now();
          setPhase("answering");
        }, question?.revealMs ?? 1000);
      }, READY_MS);
    },
    [clearTimers, schedule, speedQuestions],
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

      schedule(() => {
        setPhase("playing-event");
        question?.events.forEach((event, index) => {
          schedule(() => {
            setEventIndex(index);
            setDisplayCount(event.afterCount);
          }, index * question.eventMs);
        });

        schedule(
          () => {
            answerStartedAtRef.current = Date.now();
            setEventIndex(-1);
            setPhase("answering");
          },
          (question?.events.length ?? 0) * (question?.eventMs ?? 700) + 160,
        );
      }, READY_MS);
    },
    [clearTimers, schedule, yardQuestions],
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
    [beginSpeedQuestion, clearTimers, difficulty, petDisplayPool, resetRoundState],
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

  useEffect(() => {
    if (!routeRun || routeRun.status !== "active" || autoStartedRef.current || phase !== "start")
      return;
    autoStartedRef.current = true;
    startGame();
  }, [phase, routeRun, startGame]);

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

    setSelectedAnswer(answer);
    setLastSpeedResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestCombo, nextCombo));
    setCorrectQuestions(nextCorrectQuestions);

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

    setSelectedAnswer(answer);
    setLastYardResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestCombo, nextCombo));
    setCorrectQuestions(nextCorrectQuestions);
    setDisplayCount(yardQuestion.answer);
    setPhase("feedback");

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

  const accuracyText = useMemo(() => {
    return `${Math.round((correctQuestions / totalQuestions) * 100)}%`;
  }, [correctQuestions, totalQuestions]);

  const modeTitle = mode === "yard" ? "农场进出" : "宠物速数";
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
      {phase === "start" ? (
        <FarmCountStartPanel
          mode={mode}
          difficulty={difficulty}
          yardDifficulty={yardDifficulty}
          speedDifficulty={speedDifficulty}
          best={best}
          isGauntletPreset={isGauntletPreset}
          onModeChange={switchMode}
          onDifficultyChange={setDifficulty}
          onYardDifficultyChange={setYardDifficulty}
          onSpeedDifficultyChange={setSpeedDifficulty}
          onStart={startGame}
        />
      ) : null}

      {phase !== "start" && phase !== "finished" ? (
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
      ) : null}

      {phase === "finished" ? (
        <FarmCountResult
          score={score}
          modeTitle={modeTitle}
          difficultyLabel={
            mode === "yard"
              ? `${getTrainingDifficultyLabel(yardDifficulty)} · ${HEAD_COUNT_SPEED_LABELS[speedDifficulty]} · 积分${getTrainingDifficultyLabel(rewardDifficulty)}`
              : getTrainingDifficultyLabel(difficulty)
          }
          accuracyText={accuracyText}
          bestCombo={bestCombo}
          awardedPoints={awardedPoints}
          isNewBest={isNewBest}
          isGauntlet={isGauntletPreset}
          onBack={backToStart}
          onRestart={startGame}
        />
      ) : null}
    </View>
  );
}
