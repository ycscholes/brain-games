import { type CSSProperties } from "react";
import { View, Text } from "@tarojs/components";
import PetSprite from "../../pet/components/PetSprite";
import type { PetSpriteMood, PetSpriteSize } from "../../../domain/pet/sprite";
import type { PetSkin } from "../../../domain/pet/types";
import type { PetAssetRef } from "../../../domain/pet/assets";
import { getPetDisplayItemsForSkin, type PetDisplayItem } from "../../pet/petDisplayPool";
import type { BirdCountQuestion, BirdCountQuestionResult } from "../gameLogic";
import type {
  HeadCountEvent,
  HeadCountQuestion,
  HeadCountQuestionResult,
  HeadCountSpeedDifficulty,
} from "../../head-count/gameLogic";
import type { FarmCountMode } from "./FarmCountStartPanel";

export type FarmCountPhase =
  | "loading"
  | "ready"
  | "watching"
  | "replay"
  | "playing-event"
  | "answering"
  | "feedback";

export interface FarmCountPlayAreaProps {
  mode: FarmCountMode;
  phase: FarmCountPhase;
  currentIndex: number;
  totalQuestions: number;
  score: number;
  combo: number;
  speedQuestion: BirdCountQuestion | null;
  yardQuestion: HeadCountQuestion | null;
  yardEvent: HeadCountEvent | null;
  eventIndex: number;
  displayCount: number;
  staticPetCount: number;
  movingPets: number[];
  speedDifficulty: HeadCountSpeedDifficulty;
  selectedAnswer: number | null;
  currentOptions: number[];
  currentAnswer?: number;
  lastSpeedResult: BirdCountQuestionResult | null;
  lastYardResult: HeadCountQuestionResult | null;
  petDisplayPool: PetDisplayItem[];
  speedTargetPetName: string;
  loadProgress: { loaded: number; total: number };
  onAnswer: (answer: number) => void;
}

function formatYardEvent(event: HeadCountEvent | null) {
  if (!event) return "观察围栏数量变化";
  return event.direction === "enter" ? `进入 ${event.delta} 只` : `离开 ${event.delta} 只`;
}

function getYardCountText(phase: FarmCountPhase, displayCount: number, answer: number) {
  if (phase === "ready") return `${displayCount}`;
  if (phase === "feedback") return `${answer}`;
  if (phase === "answering") return "?";
  return "清点中";
}

function getPetDisplayItemForIndex(petDisplayPool: PetDisplayItem[], index: number) {
  return petDisplayPool[index % petDisplayPool.length];
}

function getPetDisplayItemForQuestionPet(
  petDisplayPool: PetDisplayItem[],
  displayId: string,
  skin: PetSkin,
) {
  return (
    petDisplayPool.find((item) => item.displayId === displayId) ??
    getPetDisplayItemsForSkin(petDisplayPool, skin)[0]
  );
}

function CountPetSprite({
  skin,
  mood = "idle",
  size = "sm",
  className = "",
  assetRef,
}: {
  skin: PetSkin;
  assetRef?: PetAssetRef;
  mood?: PetSpriteMood;
  size?: PetSpriteSize;
  className?: string;
}) {
  return (
    <PetSprite
      skin={skin}
      assetRef={assetRef}
      mood={mood}
      size={size}
      className={`count-pet-sprite ${className}`}
    />
  );
}

export default function FarmCountPlayArea({
  mode,
  phase,
  currentIndex,
  totalQuestions,
  score,
  combo,
  speedQuestion,
  yardQuestion,
  yardEvent,
  eventIndex,
  displayCount,
  staticPetCount,
  movingPets,
  speedDifficulty,
  selectedAnswer,
  currentOptions,
  currentAnswer,
  lastSpeedResult,
  lastYardResult,
  petDisplayPool,
  speedTargetPetName,
  loadProgress,
  onAnswer,
}: FarmCountPlayAreaProps) {
  const lastResult = mode === "yard" ? lastYardResult : lastSpeedResult;
  const speedTargetPetItem = speedQuestion
    ? getPetDisplayItemForQuestionPet(
        petDisplayPool,
        speedQuestion.targetPetKey,
        speedQuestion.targetSkin,
      )
    : null;

  return (
    <View className="farm-play">
      <View className="status-row">
        <View className="status-card">
          <Text className="status-value">
            {currentIndex + 1}/{totalQuestions}
          </Text>
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
              <Text
                className={`yard-count ${phase === "playing-event" ? "yard-count-hidden" : ""}`}
              >
                {getYardCountText(phase, displayCount, yardQuestion.answer)}
              </Text>
              <View className="yard-pet-row">
                {Array.from({ length: Math.min(staticPetCount, 10) }, (_, index) => {
                  const petItem = getPetDisplayItemForIndex(petDisplayPool, index);
                  return (
                    <View key={`yard-pet-${index}`} className="yard-pet-token">
                      <CountPetSprite
                        skin={petItem.skin}
                        assetRef={petItem.assetRef}
                        size="xxs"
                        className="yard-pet-sprite"
                      />
                    </View>
                  );
                })}
              </View>
              {phase === "playing-event" && yardEvent ? (
                <View className={`moving-yard-layer moving-yard-layer-${yardEvent.direction}`}>
                  {movingPets.map((petIndex) => {
                    const petItem = getPetDisplayItemForIndex(
                      petDisplayPool,
                      eventIndex + petIndex,
                    );
                    return (
                      <View
                        key={`event-${eventIndex}-${petIndex}`}
                        className={`moving-yard-pet moving-yard-pet-${yardEvent.direction} moving-yard-pet-speed-${speedDifficulty}`}
                        style={{
                          top: `${30 + petIndex * 17}%`,
                          animationDelay: `${petIndex * 70}ms`,
                        }}
                      >
                        <CountPetSprite
                          skin={petItem.skin}
                          assetRef={petItem.assetRef}
                          size="xs"
                          className="moving-yard-pet-sprite"
                        />
                      </View>
                    );
                  })}
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
              <CountPetSprite
                skin={speedQuestion.targetSkin}
                assetRef={speedTargetPetItem?.assetRef}
                size="sm"
                className="target-pet-sprite"
              />
            </View>
            <View className="target-copy">
              <Text className="farm-prompt">
                {phase === "loading"
                  ? "准备中"
                  : phase === "ready"
                    ? "准备观察目标"
                    : phase === "watching"
                      ? `只数${speedTargetPetName}`
                      : phase === "replay"
                        ? "正确顺序"
                        : phase === "answering"
                          ? `${speedTargetPetName}有几只`
                          : lastSpeedResult?.correct
                            ? "回答正确"
                            : "正确数量"}
              </Text>
              <Text className="target-meta">
                {phase === "loading"
                  ? `资源检查 ${loadProgress.loaded}/${loadProgress.total || "..."}`
                  : `目标：${speedTargetPetName}`}
              </Text>
            </View>
          </View>
          {phase === "loading" ? (
            <View className="scroll-viewport scroll-viewport-loading">
              <View className="scroll-world scroll-world-paused" />
              <View className="speed-loading-inline">
                <View className="speed-loading-dot" />
                <Text className="speed-loading-inline-text">准备宠物图片</Text>
              </View>
            </View>
          ) : phase === "watching" || phase === "replay" ? (
            <View className="scroll-viewport">
              <View
                className="scroll-world"
                style={{ animationDuration: `${speedQuestion.scrollMs}ms` }}
              >
                <View className="scroll-pet-layer">
                  {speedQuestion.pets.map((pet) => {
                    const petItem = getPetDisplayItemForQuestionPet(
                      petDisplayPool,
                      pet.petKey,
                      pet.skin,
                    );
                    return (
                      <View
                        key={pet.id}
                        className={`pet-count-token pet-count-${pet.size} ${pet.mirror ? "pet-count-mirror" : ""} ${pet.petKey === speedQuestion.targetPetKey ? "pet-count-target" : ""}`}
                        style={
                          {
                            left: `${pet.x}%`,
                            top: `${pet.y}%`,
                            animationDelay: `${pet.delayMs}ms`,
                            "--pet-count-scale": pet.scale,
                          } as CSSProperties
                        }
                      >
                        <CountPetSprite
                          skin={pet.skin}
                          assetRef={petItem.assetRef}
                          mood={pet.mood}
                          size="xs"
                          className="pet-count-sprite"
                        />
                        {phase === "replay" && pet.targetOrder ? (
                          <Text className="pet-count-order">{pet.targetOrder}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : (
            <View className="scroll-viewport scroll-viewport-empty">
              {phase === "answering" ? (
                <Text className="hidden-count">?</Text>
              ) : (
                <CountPetSprite
                  skin={speedQuestion.targetSkin}
                  assetRef={speedTargetPetItem?.assetRef}
                  size="lg"
                  className="hidden-count-pet"
                />
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
                onClick={() => onAnswer(option)}
              >
                <Text className="option-text">{option}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {phase === "feedback" ? (
        <View
          className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}
        >
          <Text className="feedback-title">{lastResult?.correct ? "计数准确" : "正确答案"}</Text>
          <Text className="feedback-copy">
            {mode === "yard"
              ? `围栏里 ${yardQuestion?.answer ?? 0} 只 · 本题 +${lastYardResult?.score ?? 0}`
              : `${speedTargetPetName} ${speedQuestion?.answer ?? 0} 只 · 本题 +${lastSpeedResult?.score ?? 0}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
