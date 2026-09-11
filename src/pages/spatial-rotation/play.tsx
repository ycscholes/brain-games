import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { shouldRedirectInvalidGameRun } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import {
  SPATIAL_ROTATION_GRID_SIZE,
  SPATIAL_ROTATION_TOTAL_PUZZLES,
  scoreSpatialRotationPuzzle,
  type SpatialRotationCell,
  type SpatialRotationOption,
  type SpatialRotationPuzzle,
} from "./gameLogic";
import {
  abandonSpatialRotationRun,
  readSpatialRotationRun,
  settleSpatialRotationCompletion,
  updateSpatialRotationRun,
  type SpatialRotationRun,
  type SpatialRotationRunState,
} from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "spatial_rotation_best";
const FEEDBACK_MS = 760;

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function renderShape(cells: SpatialRotationCell[]) {
  const activeCells = new Set(cells.map(([row, col]) => cellKey(row, col)));
  return (
    <View className="shape-grid">
      {Array.from(
        { length: SPATIAL_ROTATION_GRID_SIZE * SPATIAL_ROTATION_GRID_SIZE },
        (_, index) => {
          const row = Math.floor(index / SPATIAL_ROTATION_GRID_SIZE);
          const col = index % SPATIAL_ROTATION_GRID_SIZE;
          return (
            <View
              key={cellKey(row, col)}
              className={`shape-cell ${activeCells.has(cellKey(row, col)) ? "shape-cell-active" : ""}`}
            />
          );
        },
      )}
    </View>
  );
}

export default function SpatialRotationPlay() {
  usePageShare("pages/spatial-rotation/index");
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const [run, setRun] = useState<SpatialRotationRun | null>(() => readSpatialRotationRun(runId));
  const runRef = useRef(run);
  const stateRef = useRef(run?.payload.state ?? null);
  const finishedRef = useRef(false);
  const initializedRef = useRef(false);
  const answeredRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const submitAnswerRef = useRef<
    (
      option: SpatialRotationOption | null,
      puzzle?: SpatialRotationPuzzle,
      timedOut?: boolean,
    ) => void
  >(() => undefined);
  const beginPuzzleRef = useRef<(puzzleIndex: number) => void>(() => undefined);

  useEffect(() => {
    runRef.current = run;
    stateRef.current = run?.payload.state ?? null;
  }, [run]);
  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, run?.status))
      void Taro.redirectTo({ url: "/pages/spatial-rotation/index" });
  }, [run, runId]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);
  const schedule = useCallback((callback: () => void, delay: number) => {
    timersRef.current.push(setTimeout(callback, delay));
  }, []);
  const persist = useCallback(
    (nextState: SpatialRotationRunState) => {
      if (!runRef.current) return null;
      const updated = updateSpatialRotationRun(runId, { state: nextState });
      if (updated) {
        runRef.current = updated;
        stateRef.current = nextState;
        setRun(updated);
      }
      return updated;
    },
    [runId],
  );

  const finishGame = useCallback(
    (finalState: SpatialRotationRunState) => {
      if (finishedRef.current || !runRef.current) return;
      finishedRef.current = true;
      clearTimers();
      const activeRun = runRef.current;
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - activeRun.payload.startedAt) / 1000),
      );
      const best =
        Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${activeRun.payload.difficulty}`) || 0) ||
        0;
      const result = {
        score: finalState.score,
        awardedPoints: 0,
        durationSeconds,
        correctQuestions: finalState.correctPuzzles,
        totalQuestions: SPATIAL_ROTATION_TOTAL_PUZZLES,
        bestCombo: finalState.bestCombo,
        isNewBest: finalState.score > best,
      };
      const settled = settleSpatialRotationCompletion(runId, result, {
        gameId: "spatial-rotation",
        score: result.score,
        durationSeconds,
        difficulty: activeRun.payload.difficulty,
        outcome: "completed",
      });
      if (!settled) return;
      playComplete();
      if (settled.settlement.gauntletHandled) return;
      if (result.isNewBest)
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${activeRun.payload.difficulty}`, result.score);
      void Taro.redirectTo({
        url: `/pages/spatial-rotation/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [clearTimers, runId],
  );

  const submitAnswer = useCallback(
    (option: SpatialRotationOption | null, puzzle?: SpatialRotationPuzzle, timedOut = false) => {
      const currentRun = runRef.current;
      const currentState = stateRef.current;
      const currentPuzzle = puzzle ?? currentState?.puzzles[currentState.currentIndex];
      if (
        !currentRun ||
        currentRun.status !== "active" ||
        !currentState ||
        currentState.phase !== "playing" ||
        !currentPuzzle ||
        answeredRef.current
      )
        return;
      answeredRef.current = true;
      clearTimers();
      const result = scoreSpatialRotationPuzzle({
        selectedOptionId: timedOut ? "" : (option?.id ?? ""),
        answerOptionId: currentPuzzle.answerOptionId,
        answerMs: Date.now() - currentState.puzzleStartedAt,
        currentCombo: currentState.combo,
      });
      if (!timedOut) {
        playTap();
        result.correct ? playCorrect() : playWrong();
      }
      const nextCombo = result.correct ? currentState.combo + 1 : 0;
      const nextState: SpatialRotationRunState = {
        ...currentState,
        phase: "feedback",
        selectedOptionId: timedOut ? "" : (option?.id ?? ""),
        lastResult: result,
        score: currentState.score + result.score,
        combo: nextCombo,
        bestCombo: Math.max(currentState.bestCombo, nextCombo),
        correctPuzzles: currentState.correctPuzzles + (result.correct ? 1 : 0),
      };
      persist(nextState);
      schedule(
        () =>
          nextState.currentIndex >= SPATIAL_ROTATION_TOTAL_PUZZLES - 1
            ? finishGame(nextState)
            : beginPuzzleRef.current(nextState.currentIndex + 1),
        FEEDBACK_MS,
      );
    },
    [clearTimers, finishGame, persist, schedule],
  );
  submitAnswerRef.current = submitAnswer;

  const beginPuzzle = useCallback(
    (puzzleIndex: number) => {
      const currentRun = runRef.current;
      const currentState = stateRef.current;
      if (!currentRun || currentRun.status !== "active" || !currentState) return;
      clearTimers();
      const puzzle = currentState.puzzles[puzzleIndex];
      if (!puzzle) return;
      answeredRef.current = false;
      const nextState: SpatialRotationRunState = {
        ...currentState,
        phase: "playing",
        currentIndex: puzzleIndex,
        selectedOptionId: "",
        lastResult: null,
        puzzleStartedAt: Date.now(),
      };
      persist(nextState);
      schedule(() => submitAnswerRef.current(null, puzzle, true), puzzle.timeLimitMs);
    },
    [clearTimers, persist, schedule],
  );
  beginPuzzleRef.current = beginPuzzle;
  useEffect(() => {
    if (!initializedRef.current && run?.status === "active") {
      initializedRef.current = true;
      beginPuzzleRef.current(run.payload.state.currentIndex);
    }
  }, [run]);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const handleUnload = useCallback(() => {
    const activeRun = runRef.current;
    if (!activeRun || activeRun.status !== "active" || finishedRef.current) return;
    clearTimers();
    abandonSpatialRotationRun(runId, {
      gameId: "spatial-rotation",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - activeRun.payload.startedAt) / 1000)),
      difficulty: activeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [clearTimers, runId]);
  useUnload(handleUnload);

  if (!run || run.status !== "active") return null;
  const state = run.payload.state;
  const currentPuzzle = state.puzzles[state.currentIndex];
  if (!currentPuzzle) return null;
  return (
    <View className="spatial-rotation-page">
      <View className="rotation-play">
        <View className="status-row">
          <View className="status-card">
            <Text className="status-value">
              {state.currentIndex + 1}/{SPATIAL_ROTATION_TOTAL_PUZZLES}
            </Text>
            <Text className="status-label">题目</Text>
          </View>
          <View className="status-card">
            <Text className="status-value">{state.score}</Text>
            <Text className="status-label">得分</Text>
          </View>
          <View className="status-card">
            <Text className="status-value">{state.combo}</Text>
            <Text className="status-label">连击</Text>
          </View>
        </View>
        <View className="target-card">
          <Text className="question-kicker">目标图形</Text>
          {renderShape(currentPuzzle.targetCells)}
          <Text className="target-copy">可以旋转，不可以翻面镜像</Text>
        </View>
        <View className="rotation-option-grid">
          {currentPuzzle.options.map((option, index) => {
            const isSelected = state.selectedOptionId === option.id;
            const isAnswer =
              state.phase === "feedback" && option.id === currentPuzzle.answerOptionId;
            return (
              <View
                key={option.id}
                className={`rotation-option option-tone-${index + 1} ${isSelected ? "rotation-option-selected" : ""} ${isAnswer ? "rotation-option-answer" : ""}`}
                onClick={() => submitAnswer(option)}
              >
                {renderShape(option.cells)}
                <Text className="option-label">{String.fromCharCode(65 + index)}</Text>
              </View>
            );
          })}
        </View>
        {state.phase === "feedback" ? (
          <View
            className={`feedback-card ${state.lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}
          >
            <Text className="feedback-title">
              {state.lastResult?.correct ? "辨认正确" : "正确答案已标出"}
            </Text>
            <Text className="feedback-copy">本题 +{state.lastResult?.score ?? 0}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
