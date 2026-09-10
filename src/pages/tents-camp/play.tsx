import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { shouldRedirectInvalidGameRun } from "../../utils/gameRoute";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import GameRouteBack from "../../components/game-route/GameRouteBack";
import { type TrainingDifficulty } from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import {
  TENTS_CAMP_TOTAL_PUZZLES,
  coordKey,
  countSelectedByAxis,
  createTentsCampSession,
  isTentSolutionCell,
  isTreeCell,
  scoreTentsCampPuzzle,
  type TentsCampCoord,
  type TentsCampPuzzle,
  type TentsCampResult,
} from "./gameLogic";
import {
  abandonTentsCampRun,
  readTentsCampRun,
  settleTentsCampCompletion,
  updateTentsCampRun,
} from "./run";
import "./index.scss";

type Phase = "playing" | "feedback";

const STORAGE_KEY_PREFIX = "tents_camp_best";
const FEEDBACK_MS = 820;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function toCoord(index: number, size: number): TentsCampCoord {
  return {
    row: Math.floor(index / size),
    col: index % size,
  };
}

export default function TentsCamp() {
  usePageShare("pages/tents-camp/index");
  const gauntletPreset = readGameGauntletModePreset();
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = readTentsCampRun(runId);
  const allowSettledRef = useRef(false);

  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, routeRun?.status, allowSettledRef.current)) {
      void Taro.redirectTo({ url: "/pages/tents-camp/index" });
    }
  }, [routeRun, runId]);

  const difficulty: TrainingDifficulty =
    routeRun?.payload.difficulty ?? gauntletPreset?.difficulty ?? "normal";
  const persistedState = routeRun?.payload.state;
  const [phase, setPhase] = useState<Phase>(persistedState?.phase ?? "playing");
  const [puzzles, setPuzzles] = useState<TentsCampPuzzle[]>(persistedState?.puzzles ?? []);
  const [currentIndex, setCurrentIndex] = useState(persistedState?.currentIndex ?? 0);
  const [selectedTents, setSelectedTents] = useState<TentsCampCoord[]>(
    persistedState?.selectedTents ?? [],
  );
  const [score, setScore] = useState(persistedState?.score ?? 0);
  const [combo, setCombo] = useState(persistedState?.combo ?? 0);
  const [bestCombo, setBestCombo] = useState(persistedState?.bestCombo ?? 0);
  const [correctPuzzles, setCorrectPuzzles] = useState(persistedState?.correctPuzzles ?? 0);
  const [lastResult, setLastResult] = useState<TentsCampResult | null>(
    persistedState?.lastResult ?? null,
  );

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(persistedState?.clockStartedAt ?? routeRun?.payload.startedAt ?? 0);
  const puzzleStartedAtRef = useRef(persistedState?.puzzleStartedAt ?? 0);
  const finishedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const phaseRef = useRef<Phase>("playing");
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const correctPuzzlesRef = useRef(0);
  const currentIndexRef = useRef(0);
  const selectedTentsRef = useRef<TentsCampCoord[]>([]);
  const currentPuzzle = puzzles[currentIndex] ?? null;

  const selectedKeys = useMemo(() => new Set(selectedTents.map(coordKey)), [selectedTents]);
  const rowSelectedCounts = useMemo(
    () => (currentPuzzle ? countSelectedByAxis(selectedTents, currentPuzzle.size, "row") : []),
    [currentPuzzle, selectedTents],
  );
  const colSelectedCounts = useMemo(
    () => (currentPuzzle ? countSelectedByAxis(selectedTents, currentPuzzle.size, "col") : []),
    [currentPuzzle, selectedTents],
  );

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const persistRunState = useCallback(
    (
      nextPuzzles: TentsCampPuzzle[],
      nextIndex: number,
      nextSelectedTents: TentsCampCoord[],
      nextScore: number,
      nextCombo: number,
      nextBestCombo: number,
      nextCorrectPuzzles: number,
      nextLastResult: TentsCampResult | null,
      nextPhase: Phase,
    ) => {
      if (!runId) return;
      updateTentsCampRun(runId, {
        state: {
          puzzles: nextPuzzles,
          currentIndex: nextIndex,
          selectedTents: nextSelectedTents,
          score: nextScore,
          combo: nextCombo,
          bestCombo: nextBestCombo,
          correctPuzzles: nextCorrectPuzzles,
          lastResult: nextLastResult,
          phase: nextPhase,
          clockStartedAt: startedAtRef.current,
          puzzleStartedAt: puzzleStartedAtRef.current,
        },
      });
    },
    [runId],
  );

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timersRef.current.push(timer);
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    bestComboRef.current = bestCombo;
  }, [bestCombo]);

  useEffect(() => {
    correctPuzzlesRef.current = correctPuzzles;
  }, [correctPuzzles]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    selectedTentsRef.current = selectedTents;
  }, [selectedTents]);

  const finishGame = useCallback(
    (finalScore: number, finalCorrectPuzzles: number) => {
      if (finishedRef.current) return;

      finishedRef.current = true;
      clearTimers();
      playComplete();

      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const settlementInput = {
        gameId: "tents-camp",
        score: finalScore,
        durationSeconds,
        difficulty,
        outcome: "completed",
      } as const;
      const isNewBest = finalScore > readBestScore(difficulty);
      allowSettledRef.current = true;
      if (isNewBest) {
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`, finalScore);
      }
      const routeSettlement = runId
        ? settleTentsCampCompletion(
            runId,
            {
              score: finalScore,
              awardedPoints: 0,
              durationSeconds,
              placedCount: finalCorrectPuzzles,
              correctPuzzles: finalCorrectPuzzles,
              bestCombo: bestComboRef.current,
              isNewBest,
            },
            settlementInput,
          )
        : null;
      if (!routeSettlement) return;
      if (routeSettlement.settlement.gauntletHandled) return;
      void Taro.redirectTo({
        url: `/pages/tents-camp/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [clearTimers, difficulty, runId],
  );

  const beginPuzzle = useCallback(
    (puzzleIndex: number) => {
      clearTimers();
      setCurrentIndex(puzzleIndex);
      currentIndexRef.current = puzzleIndex;
      setSelectedTents([]);
      selectedTentsRef.current = [];
      setLastResult(null);
      puzzleStartedAtRef.current = Date.now();
      setPhase("playing");
      phaseRef.current = "playing";
      persistRunState(
        puzzles,
        puzzleIndex,
        [],
        scoreRef.current,
        comboRef.current,
        bestComboRef.current,
        correctPuzzlesRef.current,
        null,
        "playing",
      );
    },
    [clearTimers, persistRunState, puzzles],
  );

  const startGame = useCallback(() => {
    playTap();
    clearTimers();
    const nextPuzzles = createTentsCampSession(difficulty);
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setPuzzles(nextPuzzles);
    setCurrentIndex(0);
    setSelectedTents([]);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectPuzzles(0);
    setLastResult(null);
    scoreRef.current = 0;
    comboRef.current = 0;
    bestComboRef.current = 0;
    correctPuzzlesRef.current = 0;
    currentIndexRef.current = 0;
    selectedTentsRef.current = [];
    phaseRef.current = "playing";
    puzzleStartedAtRef.current = startedAtRef.current;
    persistRunState(nextPuzzles, 0, [], 0, 0, 0, 0, null, "playing");
  }, [clearTimers, difficulty, persistRunState]);

  const restoreGame = useCallback(() => {
    if (!persistedState) {
      startGame();
      return;
    }
    clearTimers();
    startedAtRef.current = persistedState.clockStartedAt;
    puzzleStartedAtRef.current = persistedState.puzzleStartedAt;
    finishedRef.current = false;
    setPuzzles(persistedState.puzzles);
    setCurrentIndex(persistedState.currentIndex);
    setSelectedTents(persistedState.selectedTents);
    setScore(persistedState.score);
    setCombo(persistedState.combo);
    setBestCombo(persistedState.bestCombo);
    setCorrectPuzzles(persistedState.correctPuzzles);
    setLastResult(persistedState.lastResult);
    setPhase(persistedState.phase);
    scoreRef.current = persistedState.score;
    comboRef.current = persistedState.combo;
    bestComboRef.current = persistedState.bestCombo;
    correctPuzzlesRef.current = persistedState.correctPuzzles;
    currentIndexRef.current = persistedState.currentIndex;
    selectedTentsRef.current = persistedState.selectedTents;
    phaseRef.current = persistedState.phase;
    if (persistedState.phase === "feedback") {
      schedule(() => {
        if (persistedState.currentIndex >= TENTS_CAMP_TOTAL_PUZZLES - 1) {
          finishGame(persistedState.score, persistedState.correctPuzzles);
          return;
        }
        beginPuzzle(persistedState.currentIndex + 1);
      }, FEEDBACK_MS);
    }
  }, [beginPuzzle, clearTimers, finishGame, persistedState, schedule, startGame]);

  useEffect(() => {
    if (!routeRun || routeRun.status !== "active" || autoStartedRef.current) return;
    autoStartedRef.current = true;
    restoreGame();
  }, [phase, restoreGame, routeRun]);

  const handleRouteBack = useCallback(() => {
    if (!runId || !routeRun || routeRun.status !== "active") return;
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - routeRun.payload.startedAt) / 1_000),
    );
    abandonTentsCampRun(runId, {
      gameId: "tents-camp",
      score: 0,
      durationSeconds,
      difficulty: routeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [routeRun, runId]);
  useUnload(handleRouteBack);

  const toggleTent = (coord: TentsCampCoord) => {
    if (phaseRef.current !== "playing" || !currentPuzzle || isTreeCell(currentPuzzle, coord))
      return;

    playTap();
    const key = coordKey(coord);
    setSelectedTents((items) => {
      let nextItems: TentsCampCoord[];
      if (items.some((item) => coordKey(item) === key)) {
        nextItems = items.filter((item) => coordKey(item) !== key);
      } else if (items.length >= currentPuzzle.tents.length) {
        nextItems = items;
      } else {
        nextItems = [...items, coord];
      }
      selectedTentsRef.current = nextItems;
      persistRunState(
        puzzles,
        currentIndex,
        nextItems,
        scoreRef.current,
        comboRef.current,
        bestComboRef.current,
        correctPuzzlesRef.current,
        lastResult,
        "playing",
      );
      return nextItems;
    });
  };

  const submitPuzzle = () => {
    if (phaseRef.current !== "playing" || !currentPuzzle) return;

    clearTimers();
    const result = scoreTentsCampPuzzle({
      puzzle: currentPuzzle,
      selectedTents: selectedTentsRef.current,
      answerMs: Date.now() - puzzleStartedAtRef.current,
      currentCombo: comboRef.current,
    });
    result.correct ? playCorrect() : playWrong();

    const nextScore = scoreRef.current + result.score;
    const nextCombo = result.correct ? comboRef.current + 1 : 0;
    const nextBestCombo = Math.max(bestComboRef.current, nextCombo);
    const nextCorrectPuzzles = correctPuzzlesRef.current + (result.correct ? 1 : 0);

    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(nextBestCombo);
    setCorrectPuzzles(nextCorrectPuzzles);
    setLastResult(result);
    setPhase("feedback");
    scoreRef.current = nextScore;
    comboRef.current = nextCombo;
    bestComboRef.current = nextBestCombo;
    correctPuzzlesRef.current = nextCorrectPuzzles;
    phaseRef.current = "feedback";
    persistRunState(
      puzzles,
      currentIndexRef.current,
      selectedTentsRef.current,
      nextScore,
      nextCombo,
      nextBestCombo,
      nextCorrectPuzzles,
      result,
      "feedback",
    );

    schedule(() => {
      if (currentIndexRef.current >= TENTS_CAMP_TOTAL_PUZZLES - 1) {
        finishGame(nextScore, nextCorrectPuzzles);
        return;
      }
      beginPuzzle(currentIndexRef.current + 1);
    }, FEEDBACK_MS);
  };

  return (
    <View className="tents-camp-page">
      {runId ? (
        <GameRouteBack gameId="tents-camp" runId={runId} onAbandon={handleRouteBack} />
      ) : null}
      {currentPuzzle ? (
        <View className="tents-play">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">
                {currentIndex + 1}/{TENTS_CAMP_TOTAL_PUZZLES}
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

          <View className="board-panel">
            <View className="corner-count" />
            <View
              className="column-counts"
              style={{ gridTemplateColumns: `repeat(${currentPuzzle.size}, 1fr)` }}
            >
              {currentPuzzle.colCounts.map((count, index) => (
                <Text
                  key={`col-${index}`}
                  className={`count-label ${colSelectedCounts[index] === count ? "count-label-ok" : ""}`}
                >
                  {count}
                </Text>
              ))}
            </View>
            <View
              className="row-counts"
              style={{ gridTemplateRows: `repeat(${currentPuzzle.size}, 1fr)` }}
            >
              {currentPuzzle.rowCounts.map((count, index) => (
                <Text
                  key={`row-${index}`}
                  className={`count-label ${rowSelectedCounts[index] === count ? "count-label-ok" : ""}`}
                >
                  {count}
                </Text>
              ))}
            </View>
            <View
              className="tents-board"
              style={{ gridTemplateColumns: `repeat(${currentPuzzle.size}, 1fr)` }}
            >
              {Array.from({ length: currentPuzzle.size * currentPuzzle.size }, (_, index) => {
                const coord = toCoord(index, currentPuzzle.size);
                const key = coordKey(coord);
                const isTree = isTreeCell(currentPuzzle, coord);
                const isSelected = selectedKeys.has(key);
                const isSolution = phase === "feedback" && isTentSolutionCell(currentPuzzle, coord);
                return (
                  <View
                    key={key}
                    className={`tent-cell ${isTree ? "tent-cell-tree" : ""} ${isSelected ? "tent-cell-selected" : ""} ${isSolution ? "tent-cell-solution" : ""}`}
                    onClick={() => toggleTent(coord)}
                  >
                    <Text className="tent-cell-text">
                      {isTree ? "树" : isSelected || isSolution ? "帐" : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="tents-actions">
            <Text className="tents-progress">
              已放置 {selectedTents.length}/{currentPuzzle.tents.length}
            </Text>
            <View className="primary-button compact-button" onClick={submitPuzzle}>
              <Text className="primary-button-text">提交营地</Text>
            </View>
          </View>

          {phase === "feedback" ? (
            <View
              className={`feedback-card ${lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}
            >
              <Text className="feedback-title">
                {lastResult?.correct ? "营地成立" : "营地还不稳"}
              </Text>
              <Text className="feedback-copy">
                匹配帐篷 {lastResult?.matchedTents ?? 0}/{currentPuzzle.tents.length} · 本题 +
                {lastResult?.score ?? 0}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
