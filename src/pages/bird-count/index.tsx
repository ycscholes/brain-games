import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet, syncPetData } from "../../utils/petStorage";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  recordTrainingSession,
  type TrainingDifficulty,
} from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import PetSprite from "../pet/components/PetSprite";
import type { PetSpriteMood, PetSpriteSize } from "../pet/components/PetSprite/types";
import { PET_SKIN_NAME, type PetSkin } from "../pet/types";
import {
  BIRD_COUNT_TOTAL_QUESTIONS,
  createBirdCountSession,
  PET_COUNT_SKINS,
  scoreBirdCountQuestion,
  type BirdCountQuestion,
  type BirdCountQuestionResult,
} from "./gameLogic";
import {
  createHeadCountSession,
  getHeadCountRewardDifficulty,
  HEAD_COUNT_SPEED_LABELS,
  HEAD_COUNT_TOTAL_QUESTIONS,
  scoreHeadCountQuestion,
  type HeadCountDifficulty,
  type HeadCountEvent,
  type HeadCountQuestion,
  type HeadCountQuestionResult,
  type HeadCountSpeedDifficulty,
} from "../head-count/gameLogic";
import "./index.scss";

type FarmCountMode = "speed" | "yard";
type Phase = "start" | "ready" | "watching" | "playing-event" | "answering" | "feedback" | "finished";

const SPEED_STORAGE_KEY_PREFIX = "bird_count_best";
const YARD_STORAGE_KEY_PREFIX = "head_count_best";
const READY_MS = 520;
const FEEDBACK_MS = 900;

function normalizeMode(value?: string): FarmCountMode {
  return value === "yard" ? "yard" : "speed";
}

function getSpeedBestScoreKey(difficulty: TrainingDifficulty) {
  return `${SPEED_STORAGE_KEY_PREFIX}_${difficulty}`;
}

function getYardBestScoreKey(difficulty: HeadCountDifficulty, speedDifficulty: HeadCountSpeedDifficulty) {
  return `${YARD_STORAGE_KEY_PREFIX}_${difficulty}_${speedDifficulty}`;
}

function readSpeedBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(getSpeedBestScoreKey(difficulty)) || 0);
  return Number.isFinite(value) ? value : 0;
}

function readYardBestScore(difficulty: HeadCountDifficulty, speedDifficulty: HeadCountSpeedDifficulty) {
  const value = Number(
    Taro.getStorageSync(getYardBestScoreKey(difficulty, speedDifficulty)) ||
      Taro.getStorageSync(`${YARD_STORAGE_KEY_PREFIX}_${difficulty}`) ||
      0,
  );
  return Number.isFinite(value) ? value : 0;
}

function getPrioritizedPetSkins() {
  const petData = syncPetData({ markChanged: false });
  const alivePets = petData.pets.filter((pet) => pet.status !== "dead");
  const activePet = alivePets.find((pet) => pet.id === petData.activePetId) ?? null;
  const orderedPets = [
    ...(activePet ? [activePet] : []),
    ...alivePets.filter((pet) => pet.id !== activePet?.id),
  ];
  const skins = Array.from(new Set(orderedPets.map((pet) => pet.skin)));

  return skins.length > 0 ? skins : PET_COUNT_SKINS;
}

function getPetSkinForIndex(petSkinPool: PetSkin[], index: number) {
  return petSkinPool[index % petSkinPool.length] ?? PET_COUNT_SKINS[index % PET_COUNT_SKINS.length];
}

function formatYardEvent(event: HeadCountEvent | null) {
  if (!event) return "观察围栏数量变化";
  return event.direction === "enter" ? `进入 ${event.delta} 只` : `离开 ${event.delta} 只`;
}

function getYardCountText(phase: Phase, displayCount: number, answer: number) {
  if (phase === "ready") return `${displayCount}`;
  if (phase === "feedback") return `${answer}`;
  if (phase === "answering") return "?";
  return "清点中";
}

function CountPetSprite({
  skin,
  mood = "idle",
  size = "sm",
  className = "",
}: {
  skin: PetSkin;
  mood?: PetSpriteMood;
  size?: PetSpriteSize;
  className?: string;
}) {
  return <PetSprite skin={skin} mood={mood} size={size} className={`count-pet-sprite ${className}`} />;
}

export default function FarmCount() {
  usePageShare("pages/bird-count/index");

  const [mode, setMode] = useState<FarmCountMode>("speed");
  const [phase, setPhase] = useState<Phase>("start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>("normal");
  const [yardDifficulty, setYardDifficulty] = useState<HeadCountDifficulty>("normal");
  const [speedDifficulty, setSpeedDifficulty] = useState<HeadCountSpeedDifficulty>("slow");
  const [best, setBest] = useState(0);
  const [petSkinPool, setPetSkinPool] = useState<PetSkin[]>(PET_COUNT_SKINS);
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

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const answerStartedAtRef = useRef(0);
  const finishedRef = useRef(false);

  const speedQuestion = speedQuestions[currentIndex] ?? null;
  const yardQuestion = yardQuestions[currentIndex] ?? null;
  const yardEvent = yardQuestion && eventIndex >= 0 ? yardQuestion.events[eventIndex] ?? null : null;
  const totalQuestions = mode === "yard" ? HEAD_COUNT_TOTAL_QUESTIONS : BIRD_COUNT_TOTAL_QUESTIONS;
  const rewardDifficulty = getHeadCountRewardDifficulty(yardDifficulty, speedDifficulty);
  const staticPetCount = yardQuestion && phase === "feedback"
    ? yardQuestion.answer
    : phase === "ready"
      ? displayCount
      : 0;
  const movingPets = Array.from({ length: yardEvent?.delta ?? 0 }, (_, index) => index);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timersRef.current.push(timer);
  }, []);

  const refreshPetSkinPool = useCallback(() => {
    setPetSkinPool(getPrioritizedPetSkins());
  }, []);

  const refreshBest = useCallback(() => {
    const nextBest = mode === "yard"
      ? readYardBestScore(yardDifficulty, speedDifficulty)
      : readSpeedBestScore(difficulty);
    setBest(nextBest);
  }, [difficulty, mode, speedDifficulty, yardDifficulty]);

  useLoad((query) => {
    const nextMode = normalizeMode(String(query.mode ?? ""));
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

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

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
    finishedRef.current = false;
  }, []);

  const backToStart = useCallback(() => {
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

  const finishSpeedGame = useCallback((finalScore: number, finalCorrectQuestions: number) => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    clearTimers();

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const nextAwardedPoints = getAwardedPoints("bird-count", finalScore, difficulty);
    addPointsToPet("bird-count", finalScore, difficulty);
    recordTrainingSession({
      gameId: "bird-count",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    });

    setAwardedPoints(nextAwardedPoints);
    setCorrectQuestions(finalCorrectQuestions);
    setPhase("finished");

    if (finalScore > best) {
      Taro.setStorageSync(getSpeedBestScoreKey(difficulty), finalScore);
      setBest(finalScore);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }
  }, [best, clearTimers, difficulty]);

  const finishYardGame = useCallback((finalScore: number, finalCorrectQuestions: number) => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    clearTimers();

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const nextRewardDifficulty = getHeadCountRewardDifficulty(yardDifficulty, speedDifficulty);
    const nextAwardedPoints = getAwardedPoints("head-count", finalScore, nextRewardDifficulty);
    addPointsToPet("head-count", finalScore, nextRewardDifficulty);
    recordTrainingSession({
      gameId: "head-count",
      score: finalScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      mode: `${yardDifficulty}:${speedDifficulty}`,
      difficulty: nextRewardDifficulty,
      outcome: "completed",
    });

    setAwardedPoints(nextAwardedPoints);
    setCorrectQuestions(finalCorrectQuestions);
    setPhase("finished");

    if (finalScore > best) {
      Taro.setStorageSync(getYardBestScoreKey(yardDifficulty, speedDifficulty), finalScore);
      setBest(finalScore);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }
  }, [best, clearTimers, speedDifficulty, yardDifficulty]);

  const beginSpeedQuestion = useCallback((questionIndex: number, nextQuestions = speedQuestions) => {
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
  }, [clearTimers, schedule, speedQuestions]);

  const beginYardQuestion = useCallback((questionIndex: number, nextQuestions = yardQuestions) => {
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

      schedule(() => {
        answerStartedAtRef.current = Date.now();
        setEventIndex(-1);
        setPhase("answering");
      }, (question?.events.length ?? 0) * (question?.eventMs ?? 700) + 160);
    }, READY_MS);
  }, [clearTimers, schedule, yardQuestions]);

  const startSpeedGame = () => {
    clearTimers();
    const nextQuestions = createBirdCountSession(difficulty, petSkinPool);
    resetRoundState();
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setSpeedQuestions(nextQuestions);
    setYardQuestions([]);
    beginSpeedQuestion(0, nextQuestions);
  };

  const startYardGame = () => {
    clearTimers();
    const nextQuestions = createHeadCountSession(yardDifficulty, speedDifficulty);
    resetRoundState();
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setYardQuestions(nextQuestions);
    setSpeedQuestions([]);
    beginYardQuestion(0, nextQuestions);
  };

  const startGame = () => {
    refreshPetSkinPool();
    if (mode === "yard") {
      startYardGame();
      return;
    }
    startSpeedGame();
  };

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
    const nextScore = score + result.score;
    const nextCombo = result.correct ? combo + 1 : 0;
    const nextCorrectQuestions = correctQuestions + (result.correct ? 1 : 0);

    setSelectedAnswer(answer);
    setLastSpeedResult(result);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(Math.max(bestCombo, nextCombo));
    setCorrectQuestions(nextCorrectQuestions);
    setPhase("feedback");

    schedule(() => {
      if (currentIndex >= BIRD_COUNT_TOTAL_QUESTIONS - 1) {
        finishSpeedGame(nextScore, nextCorrectQuestions);
        return;
      }

      beginSpeedQuestion(currentIndex + 1);
    }, FEEDBACK_MS);
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

  const renderSpeedDifficultyCard = (nextDifficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`difficulty-card ${difficulty === nextDifficulty ? "difficulty-card-active" : ""}`}
      onClick={() => setDifficulty(nextDifficulty)}
    >
      <Text className="difficulty-name">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="difficulty-copy">{copy}</Text>
    </View>
  );

  const renderYardDifficultyCard = (nextDifficulty: HeadCountDifficulty, copy: string) => (
    <View
      className={`difficulty-card ${yardDifficulty === nextDifficulty ? "difficulty-card-active" : ""}`}
      onClick={() => setYardDifficulty(nextDifficulty)}
    >
      <Text className="difficulty-name">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="difficulty-copy">{copy}</Text>
    </View>
  );

  const renderSpeedCard = (nextSpeedDifficulty: HeadCountSpeedDifficulty, copy: string) => (
    <View
      className={`difficulty-card ${speedDifficulty === nextSpeedDifficulty ? "difficulty-card-active" : ""}`}
      onClick={() => setSpeedDifficulty(nextSpeedDifficulty)}
    >
      <Text className="difficulty-name">{HEAD_COUNT_SPEED_LABELS[nextSpeedDifficulty]}</Text>
      <Text className="difficulty-copy">{copy}</Text>
    </View>
  );

  const modeTitle = mode === "yard" ? "农场进出" : "宠物速数";
  const currentOptions = mode === "yard" ? yardQuestion?.options ?? [] : speedQuestion?.options ?? [];
  const currentAnswer = mode === "yard" ? yardQuestion?.answer : speedQuestion?.answer;
  const lastResult = mode === "yard" ? lastYardResult : lastSpeedResult;

  return (
    <View className="farm-count-page">
      {phase === "start" ? (
        <View className="farm-start">
          <View className="farm-hero">
            <Text className="hero-kicker">农场观察训练</Text>
            <Text className="hero-title">农场清点</Text>
            <Text className="hero-copy">在农场里观察宠物，选择速数或进出清点模式。</Text>
            <View className="best-pill">
              <Text className="best-label">当前设置最高</Text>
              <Text className="best-value">{best}</Text>
            </View>
          </View>

          <View className="info-panel">
            <Text className="section-title">游戏模式</Text>
            <View className="mode-grid">
              <View
                className={`mode-card ${mode === "speed" ? "mode-card-active" : ""}`}
                onClick={() => switchMode("speed")}
              >
                <Text className="mode-name">宠物速数</Text>
                <Text className="mode-copy">快速滚过一群宠物，只数指定宠物。</Text>
              </View>
              <View
                className={`mode-card ${mode === "yard" ? "mode-card-active" : ""}`}
                onClick={() => switchMode("yard")}
              >
                <Text className="mode-name">农场进出</Text>
                <Text className="mode-copy">观察宠物进出围栏，清点最后数量。</Text>
              </View>
            </View>
          </View>

          <View className="info-panel">
            <Text className="section-title">训练规则</Text>
            {mode === "yard" ? (
              <>
                <Text className="rule-line">1. 每局 8 题，先记住围栏里的初始宠物数。</Text>
                <Text className="rule-line">2. 宠物进出时不再显示总数，需要在心里清点。</Text>
                <Text className="rule-line">3. 事件结束后从 4 个选项中选择剩余数量。</Text>
              </>
            ) : (
              <>
                <Text className="rule-line">1. 每局 8 题，先看本题要数哪种宠物。</Text>
                <Text className="rule-line">2. 宠物穿过农场小路时，只统计目标宠物。</Text>
                <Text className="rule-line">3. 速度会逐题提升，快速正确和连击有额外分。</Text>
              </>
            )}
          </View>

          <View className="info-panel">
            <Text className="section-title">{mode === "yard" ? "事件难度" : "难度"}</Text>
            <View className="difficulty-grid">
              {mode === "yard" ? (
                <>
                  {renderYardDifficultyCard("normal", "3-4 段事件 · 节奏清晰")}
                  {renderYardDifficultyCard("hard", "4-6 段事件 · 数量变化更大")}
                </>
              ) : (
                <>
                  {renderSpeedDifficultyCard("normal", "8-15 只宠物 · 4 条小路")}
                  {renderSpeedDifficultyCard("hard", "14-21 只宠物 · 5 条小路")}
                </>
              )}
            </View>
          </View>

          {mode === "yard" ? (
            <View className="info-panel">
              <Text className="section-title">出入速度</Text>
              <View className="difficulty-grid speed-grid">
                {renderSpeedCard("slow", "舒缓进出")}
                {renderSpeedCard("standard", "标准节奏")}
                {renderSpeedCard("fast", "快速切换")}
              </View>
            </View>
          ) : null}

          <View className="primary-button" onClick={startGame}>
            <Text className="primary-button-text">开始训练</Text>
          </View>
        </View>
      ) : null}

      {phase !== "start" && phase !== "finished" ? (
        <View className="farm-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{currentIndex + 1}/{totalQuestions}</Text>
              <Text className="status-label">题目</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{score}</Text>
              <Text className="status-label">得分</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{combo}</Text>
              <Text className="status-label">连击</Text>
            </View>
          </View>

          {mode === "yard" && yardQuestion ? (
            <>
              <View className="prompt-card">
                <Text className="prompt-title">
                  {phase === "ready"
                    ? "记住初始数量"
                    : phase === "playing-event"
                      ? formatYardEvent(yardEvent)
                      : phase === "answering"
                        ? "现在还剩几只"
                        : lastYardResult?.correct
                          ? "回答正确"
                          : "正确数量"}
                </Text>
                <Text className="prompt-copy">
                  {phase === "feedback"
                    ? `正确答案 ${yardQuestion.answer} · 本题 +${lastYardResult?.score ?? 0}`
                    : "在心里更新数量，不需要点击"}
                </Text>
              </View>

              <View className={`farm-pen farm-pen-${phase}`}>
                <View className="farm-gate farm-gate-left">
                  <Text className="farm-gate-label">入口</Text>
                </View>
                <View className="farm-yard">
                  <Text className="yard-title">
                    {phase === "ready" ? "初始数量" : phase === "feedback" ? "正确数量" : "围栏数量"}
                  </Text>
                  <Text className={`yard-count ${phase === "playing-event" ? "yard-count-hidden" : ""}`}>
                    {getYardCountText(phase, displayCount, yardQuestion.answer)}
                  </Text>
                  <View className="yard-pet-row">
                    {Array.from({ length: Math.min(staticPetCount, 10) }, (_, index) => (
                      <View key={`yard-pet-${index}`} className="yard-pet-token">
                        <CountPetSprite
                          skin={getPetSkinForIndex(petSkinPool, index)}
                          size="xxs"
                          className="yard-pet-sprite"
                        />
                      </View>
                    ))}
                  </View>
                  {phase === "playing-event" && yardEvent ? (
                    <View className={`moving-yard-layer moving-yard-layer-${yardEvent.direction}`}>
                      {movingPets.map((petIndex) => (
                        <View
                          key={`event-${eventIndex}-${petIndex}`}
                          className={`moving-yard-pet moving-yard-pet-${yardEvent.direction} moving-yard-pet-speed-${speedDifficulty}`}
                          style={{
                            top: `${30 + petIndex * 17}%`,
                            animationDelay: `${petIndex * 70}ms`,
                          }}
                        >
                          <CountPetSprite
                            skin={getPetSkinForIndex(petSkinPool, eventIndex + petIndex)}
                            size="xs"
                            className="moving-yard-pet-sprite"
                          />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View className="farm-gate farm-gate-right">
                  <Text className="farm-gate-label">出口</Text>
                </View>
              </View>
            </>
          ) : null}

          {mode === "speed" && speedQuestion ? (
            <View className={`farm-scene farm-scene-${phase}`}>
              <View className="target-banner">
                <View className="target-pet">
                  <CountPetSprite skin={speedQuestion.targetSkin} size="sm" className="target-pet-sprite" />
                </View>
                <View className="target-copy">
                  <Text className="farm-prompt">
                    {phase === "ready"
                      ? "准备观察目标"
                      : phase === "watching"
                        ? `只数${PET_SKIN_NAME[speedQuestion.targetSkin]}`
                        : phase === "answering"
                          ? `${PET_SKIN_NAME[speedQuestion.targetSkin]}有几只`
                          : lastSpeedResult?.correct
                            ? "回答正确"
                            : "正确数量"}
                  </Text>
                  <Text className="target-meta">
                    {phase === "watching"
                      ? `${speedQuestion.totalPets} 只混排 · ${speedQuestion.laneCount} 条小路`
                      : `目标：${PET_SKIN_NAME[speedQuestion.targetSkin]}`}
                  </Text>
                </View>
              </View>
              {phase === "watching" || phase === "feedback" ? (
                <View className="scroll-viewport">
                  <View
                    className="scroll-world"
                    style={{ animationDuration: `${speedQuestion.scrollMs}ms` }}
                  >
                    <View className="scroll-pet-layer">
                      {speedQuestion.pets.map((pet) => (
                        <View
                          key={pet.id}
                          className={`pet-count-token pet-count-${pet.size} ${pet.mirror ? "pet-count-mirror" : ""} ${pet.skin === speedQuestion.targetSkin ? "pet-count-target" : ""}`}
                          style={{ left: `${pet.x}%`, top: `${pet.y}%`, animationDelay: `${pet.delayMs}ms` }}
                        >
                          <CountPetSprite
                            skin={pet.skin}
                            mood={pet.mood}
                            size="xs"
                            className="pet-count-sprite"
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ) : (
                <View className="scroll-viewport scroll-viewport-empty">
                  {phase === "answering" ? (
                    <Text className="hidden-count">?</Text>
                  ) : (
                    <CountPetSprite skin={speedQuestion.targetSkin} size="lg" className="hidden-count-pet" />
                  )}
                </View>
              )}
            </View>
          ) : null}

          {phase === "answering" || phase === "feedback" ? (
            <View className="option-grid">
              {currentOptions.map((option) => {
                const isSelected = selectedAnswer === option;
                const isAnswer = phase === "feedback" && option === currentAnswer;
                const isWrong = phase === "feedback" && isSelected && option !== currentAnswer;
                return (
                  <View
                    key={option}
                    className={`option-card ${isAnswer ? "option-card-correct" : ""} ${isWrong ? "option-card-wrong" : ""}`}
                    onClick={() => handleAnswer(option)}
                  >
                    <Text className="option-text">{option}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {phase === "feedback" ? (
            <View className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}>
              <Text className="feedback-title">{lastResult?.correct ? "计数准确" : "正确答案"}</Text>
              <Text className="feedback-copy">
                {mode === "yard"
                  ? `围栏里 ${yardQuestion?.answer ?? 0} 只 · 本题 +${lastYardResult?.score ?? 0}`
                  : `${speedQuestion ? PET_SKIN_NAME[speedQuestion.targetSkin] : "宠物"} ${speedQuestion?.answer ?? 0} 只 · 本题 +${lastSpeedResult?.score ?? 0}`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="farm-result">
          <View className="result-card">
            <Text className="result-kicker">{isNewBest ? "刷新最高分" : "训练完成"}</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-copy">
              {modeTitle} · {mode === "yard"
                ? `${getTrainingDifficultyLabel(yardDifficulty)} · ${HEAD_COUNT_SPEED_LABELS[speedDifficulty]} · 积分${getTrainingDifficultyLabel(rewardDifficulty)}`
                : getTrainingDifficultyLabel(difficulty)}
            </Text>
            <View className="result-grid">
              <View className="result-item">
                <Text className="result-item-value">{accuracyText}</Text>
                <Text className="result-item-label">正确率</Text>
              </View>
              <View className="result-item">
                <Text className="result-item-value">{bestCombo}</Text>
                <Text className="result-item-label">最佳连击</Text>
              </View>
              <View className="result-item">
                <Text className="result-item-value">+{awardedPoints}</Text>
                <Text className="result-item-label">宠物积分</Text>
              </View>
            </View>
            <View className="result-actions">
              <View className="secondary-button" onClick={backToStart}>
                <Text className="secondary-button-text">返回设置</Text>
              </View>
              <View className="primary-button" onClick={startGame}>
                <Text className="primary-button-text">再练一局</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
