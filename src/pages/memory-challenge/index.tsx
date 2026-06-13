import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { resolvePetSpriteUrl } from "../../config/remoteAssets";
import { addPointsToPet, syncPetData } from "../../utils/petStorage";
import { resolveCustomPetSpriteUrl } from "../../services/custom-pet/customPetService";
import {
  getAwardedPoints,
  recordTrainingSession,
  type TrainingDifficulty,
  type TrainingRewardPolicy,
} from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import { PET_SKIN_NAME, type PetSkin } from "../pet/types";
import { createStandardPetAssetRef, getPetAssetRef } from "../pet/petAssets";
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
const PET_SKINS: PetSkin[] = ["cat", "dog", "rabbit", "bear", "panda", "gecko", "turtle"];

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

const MODE_CONFIG: Record<MemoryChallengeMode, {
  label: string;
  icon: string;
  description: string;
}> = {
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

const MEMORY_CONFIG: Record<MemoryChallengeN, {
  label: string;
  color: string;
  description: string;
}> = {
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
  const ownedPets = petData.pets
    .filter((pet) => pet.status !== "dead")
    .map((pet) => ({
      name: pet.name,
      skin: pet.skin,
      assetRef: getPetAssetRef(pet),
    }));
  const pets = ownedPets.length > 0
    ? ownedPets
    : PET_SKINS.map((skin) => ({
        name: PET_SKIN_NAME[skin],
        skin,
        assetRef: createStandardPetAssetRef(skin),
      }));
  return loadPetMemoryItemsFromAssets(
    pets,
    PET_MOOD_UNLOCK_ORDER,
    (assetRef, skin, mood) =>
      assetRef.kind === "custom"
        ? resolveCustomPetSpriteUrl(assetRef.customAssetId, mood)
        : resolvePetSpriteUrl(skin, mood),
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

  const [gameState, setGameState] = useState<GameState>("start");
  const [mode, setMode] = useState<MemoryChallengeMode>("shape");
  const [memoryN, setMemoryN] = useState<MemoryChallengeN>(1);
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

  const buildOptions = useCallback((
    selectedMode: MemoryChallengeMode,
    target: MemoryChallengeItem,
  ) => {
    return selectedMode === "calculation"
      ? createNumericOptions(Number(target.answerId))
      : createVisualOptions(target, activePoolRef.current);
  }, []);

  const startPlaying = useCallback((currentHistory: MemoryChallengeItem[]) => {
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
  }, [buildOptions, createNextItem]);

  const beginSession = useCallback((
    selectedMode: MemoryChallengeMode,
    selectedN: MemoryChallengeN,
    itemPool: MemoryChallengeItem[],
  ) => {
    clearTimers();
    activeModeRef.current = selectedMode;
    activeNRef.current = selectedN;
    const initialPool = selectedMode === "pet"
      ? getUnlockedPetItems(itemPool, 0)
      : itemPool;
    activePoolRef.current = initialPool;
    allPetItemsRef.current = selectedMode === "pet" ? itemPool : [];
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    scoreRef.current = 0;
    correctCountRef.current = 0;

    const initialItems = Array.from(
      { length: selectedN },
      () => selectedMode === "calculation" ? createCalculationItem() : pickRandomItem(initialPool),
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
  }, [clearTimers, schedule, startPlaying]);

  const startGame = useCallback(async () => {
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

  const updateHighScore = useCallback((
    finalScore: number,
    selectedMode: MemoryChallengeMode,
    selectedN: MemoryChallengeN,
  ) => {
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
  }, []);

  const handleGameOver = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();

    const selectedMode = activeModeRef.current;
    const selectedN = activeNRef.current;
    const finalScore = scoreRef.current;
    const rewardDifficulty = getRewardDifficulty(selectedN);
    const rewardPolicy = getRewardPolicy(selectedMode, selectedN);
    const finalAwardedPoints = getAwardedPoints(
      "memory-challenge",
      finalScore,
      rewardDifficulty,
      rewardPolicy,
    );

    Taro.setStorageSync("memory_last_score", finalScore);
    addPointsToPet("memory-challenge", finalScore, rewardDifficulty, rewardPolicy);
    recordTrainingSession({
      gameId: "memory-challenge",
      score: finalScore,
      awardedPoints: finalAwardedPoints,
      mode: getMemoryChallengeModeRecord(selectedMode, selectedN),
      difficulty: rewardDifficulty,
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
      outcome: "completed",
    });

    setAwardedPoints(finalAwardedPoints);
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

  const handleSelect = useCallback((id: string) => {
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
  }, [feedback, gameState, handleGameOver, nextRound, schedule, targetItem]);

  const statusText = gameState === "memorize"
    ? `请记住第 ${memorizeIndex + 1}/${memoryN} 题`
    : mode === "calculation"
      ? `请选择前 ${memoryN} 题的答案`
      : `请选择前 ${memoryN} 题的内容`;

  const renderItemContent = (item: MemoryChallengeItem, className: string) => {
    if (item.imageSrc) {
      return <Image src={item.imageSrc} className={className} mode="aspectFit" />;
    }
    return <Text className={`${className} calculation-text`}>{item.prompt}</Text>;
  };

  return (
    <View className="game-container">
      {gameState === "start" && (
        <View className="start-screen">
          <View className="header-section">
            <View className="logo-container">
              <View className="logo-icon">
                <Text className="logo-emoji">🎯</Text>
              </View>
            </View>
            <Text className="game-title">奇趣记忆</Text>
            <Text className="game-subtitle">6 秒判断，挑战持续更新记忆</Text>
            <View className="high-score-badge">
              <View className="high-score-icon">
                <Text className="high-score-icon-text">🏆</Text>
              </View>
              <View className="high-score-content">
                <Text className="high-score-label">当前模式最高分</Text>
                <Text className="high-score-value">{highScore}</Text>
              </View>
            </View>
          </View>

          <View className="rules-card">
            <View className="rules-header">
              <Text className="rules-icon-text">📋</Text>
              <Text className="rules-title">游戏规则</Text>
            </View>
            <View className="rules-list">
              <Text className="rule-text">1. 依次记住最开始的 {memoryN} 题</Text>
              <Text className="rule-text">2. 每轮选出前 {memoryN} 题的内容或答案</Text>
              <Text className="rule-text">3. 每题限时 {ANSWER_TIME_SECONDS} 秒，答错或超时结束</Text>
              <Text className="rule-text">4. 游戏分数无限累计，宠物积分按模式封顶</Text>
            </View>
          </View>

          <View className="difficulty-section">
            <View className="difficulty-header">
              <Text className="difficulty-icon-text">🎮</Text>
              <Text className="difficulty-title">游戏模式</Text>
            </View>
            <View className="mode-grid">
              {(Object.keys(MODE_CONFIG) as MemoryChallengeMode[]).map((itemMode) => {
                const config = MODE_CONFIG[itemMode];
                return (
                  <View
                    key={itemMode}
                    className={`mode-item ${mode === itemMode ? "mode-item-selected" : ""}`}
                    onClick={() => setMode(itemMode)}
                  >
                    <Text className="mode-icon">{config.icon}</Text>
                    <Text className="difficulty-label">{config.label}</Text>
                    <Text className="difficulty-desc">{config.description}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="difficulty-section">
            <View className="difficulty-header">
              <Text className="difficulty-icon-text">🧠</Text>
              <Text className="difficulty-title">记忆数量</Text>
            </View>
            <View className="difficulty-grid">
              {([1, 2, 3, 4] as MemoryChallengeN[]).map((n) => {
                const config = MEMORY_CONFIG[n];
                return (
                  <View
                    key={n}
                    className={`difficulty-item ${memoryN === n ? "difficulty-item-selected" : ""}`}
                    onClick={() => setMemoryN(n)}
                  >
                    <View className="difficulty-badge" style={{ backgroundColor: config.color }}>
                      <Text className="difficulty-badge-text">{n}</Text>
                    </View>
                    <Text className="difficulty-label">{config.label}</Text>
                    <Text className="difficulty-desc">
                      {mode === "calculation"
                        ? `计算 ${getMemoryChallengeRoundPoints(mode, n)} 分/题`
                        : config.description}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="start-button-container floating-start-action">
            <View
              className={`start-button ${isLoadingPets ? "start-button-disabled" : ""}`}
              onClick={startGame}
            >
              <Text className="start-button-text">
                {isLoadingPets ? "加载宠物图片..." : "开始游戏"}
              </Text>
            </View>
          </View>
          <View className="floating-start-spacer" />
        </View>
      )}

      {(gameState === "memorize" || gameState === "playing") && currentItem && (
        <View className="game-screen">
          <View className="top-bar">
            <View className="top-bar-item">
              <Text className="top-bar-icon-text">{MODE_CONFIG[activeModeRef.current].icon}</Text>
              <Text className="top-bar-text">题目 {round}</Text>
            </View>
            <View className="top-bar-item">
              <Text className="top-bar-icon-text">🏆</Text>
              <Text className="top-bar-text">{score} 分</Text>
            </View>
          </View>

          <View className="main-card">
            <View className={`status-badge ${gameState === "memorize" ? "status-badge-memorize" : "status-badge-play"}`}>
              <Text className="status-badge-text">{statusText}</Text>
            </View>
            <View className="shape-display">
              {renderItemContent(currentItem, "shape-image")}
            </View>

            {gameState === "playing" && (
              <>
                <View className="countdown">
                  <Text className={`countdown-text ${timeLeft < 3 ? "countdown-urgent" : ""}`}>
                    {timeLeft.toFixed(1)}
                  </Text>
                </View>
                <View className="progress-bar">
                  <View
                    className="progress-bar-fill"
                    style={{ width: `${(timeLeft / ANSWER_TIME_SECONDS) * 100}%` }}
                  />
                </View>
              </>
            )}
          </View>

          {gameState === "playing" ? (
            <View className="options-grid">
              {options.map((option) => {
                const isSelected = selectedId === option.id;
                const optionClass = isSelected
                  ? `option-item ${feedback === "correct" ? "option-item-correct" : "option-item-wrong"}`
                  : "option-item";
                return (
                  <View
                    key={option.id}
                    className={optionClass}
                    onClick={() => handleSelect(option.id)}
                  >
                    {option.imageSrc ? (
                      <Image src={option.imageSrc} className="option-image" mode="aspectFit" />
                    ) : (
                      <Text className="option-number">{option.label}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="loading-section">
              <View className="loading-dots">
                <View className="loading-dot" />
                <View className="loading-dot loading-dot-delay-1" />
                <View className="loading-dot loading-dot-delay-2" />
              </View>
            </View>
          )}
        </View>
      )}

      {gameState === "gameover" && (
        <View className="result-screen">
          <View className="result-card">
            <Text className="result-title">本局成绩</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-desc">答对 {correctCount} 题</Text>
            <Text className="result-desc">
              {MODE_CONFIG[activeModeRef.current].label} · {MEMORY_CONFIG[activeNRef.current].label}
            </Text>
            <Text className="result-desc">
              获得 {awardedPoints} 宠物积分，上限 {getMemoryChallengeRewardCap(activeModeRef.current, activeNRef.current)}
            </Text>
            <Text className="result-desc">
              历史最高 {highScore}
              {isNewRecord && score > 0 ? <Text className="result-highlight">刷新纪录</Text> : null}
            </Text>
          </View>

          <View className="result-actions">
            <View className="primary-button" onClick={startGame}>
              <Text className="button-text">再来一局</Text>
            </View>
            <View className="secondary-button" onClick={() => setGameState("start")}>
              <Text className="button-text">返回开始页</Text>
            </View>
            <View className="secondary-button" onClick={() => Taro.reLaunch({ url: "/pages/index/index" })}>
              <Text className="button-text">返回游戏主页</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
