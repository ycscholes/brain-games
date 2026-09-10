import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { shouldRedirectInvalidGameRun } from "../../utils/gameRoute";
import { type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import {
  applyHidatoCellClick,
  applyHidatoHint,
  createHidatoLineSegments,
  createHidatoPuzzle,
  createInitialClickState,
  scoreHidatoGame,
  type HidatoCell,
  type HidatoBoardBounds,
  type HidatoClickState,
  type HidatoPuzzle,
} from "./gameLogic";
import { abandonHidatoRun, readHidatoRun, settleHidatoCompletion, updateHidatoRun } from "./run";
import "./index.scss";

type Phase = "playing";

const STORAGE_KEY_PREFIX = "hidato_best";
const HINT_FLASH_MS = 900;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function HidatoPage() {
  usePageShare("pages/hidato/index");
  const gauntletPreset = readGameGauntletModePreset();
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = readHidatoRun(runId);
  const allowSettledRef = useRef(false);

  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, routeRun?.status, allowSettledRef.current)) {
      void Taro.redirectTo({ url: "/pages/hidato/index" });
    }
  }, [routeRun, runId]);

  const phase: Phase = "playing";
  const difficulty: TrainingDifficulty =
    routeRun?.payload.difficulty ?? gauntletPreset?.difficulty ?? "normal";
  const persistedState = routeRun?.payload.state;
  const [puzzle, setPuzzle] = useState<HidatoPuzzle | null>(() => persistedState?.puzzle ?? null);
  const [clickState, setClickState] = useState<HidatoClickState>(
    () => persistedState?.clickState ?? createInitialClickState(),
  );
  const [feedback, setFeedback] = useState("从 1 开始，沿相邻格连接到终点。");
  const [hintValue, setHintValue] = useState<number | null>(null);
  const [lastWrongCellId, setLastWrongCellId] = useState<string | null>(null);
  const [boardBounds, setBoardBounds] = useState<HidatoBoardBounds | null>(null);

  const startedAtRef = useRef(persistedState?.clockStartedAt ?? routeRun?.payload.startedAt ?? 0);
  const finishedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clickedValueSet = useMemo(
    () => new Set(clickState.clickedValues),
    [clickState.clickedValues],
  );
  const lineSegments = useMemo(
    () =>
      puzzle
        ? createHidatoLineSegments(puzzle, clickState.clickedValues, boardBounds ?? undefined)
        : [],
    [boardBounds, clickState.clickedValues, puzzle],
  );
  const progressPercent = puzzle
    ? Math.round((clickState.clickedValues.length / puzzle.total) * 100)
    : 0;

  const clearTransientTimers = useCallback(() => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    if (wrongTimerRef.current) {
      clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = null;
    }
  }, []);

  const persistRunState = useCallback(
    (nextPuzzle: HidatoPuzzle, nextClickState: HidatoClickState) => {
      if (!runId) return;
      updateHidatoRun(runId, {
        state: {
          puzzle: nextPuzzle,
          clickState: nextClickState,
          clockStartedAt: startedAtRef.current,
        },
      });
    },
    [runId],
  );

  useEffect(() => {
    return () => {
      clearTransientTimers();
    };
  }, [clearTransientTimers]);

  useEffect(() => {
    if (phase !== "playing" || clickState.nextValue <= 1) return;

    void Taro.pageScrollTo({
      selector: `.hidato-cell-value-${clickState.nextValue}`,
      duration: 220,
    }).catch(() => undefined);
  }, [clickState.nextValue, phase]);

  useEffect(() => {
    if (phase !== "playing" || !puzzle) return undefined;

    const timer = setTimeout(() => {
      Taro.createSelectorQuery()
        .select(".hidato-board")
        .boundingClientRect((rect) => {
          if (!rect || Array.isArray(rect) || rect.width <= 0 || rect.height <= 0) return;
          setBoardBounds({ width: rect.width, height: rect.height });
        })
        .exec();
    }, 0);

    return () => clearTimeout(timer);
  }, [difficulty, phase, puzzle]);

  const finishGame = useCallback(
    (nextState: HidatoClickState) => {
      if (!puzzle || finishedRef.current) return;

      finishedRef.current = true;
      clearTransientTimers();
      playComplete();

      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const nextScore = scoreHidatoGame({
        difficulty,
        completed: true,
        elapsedSeconds: durationSeconds,
        mistakeCount: nextState.mistakeCount,
        hintCount: nextState.hintCount,
      });
      const settlementInput = {
        gameId: "hidato",
        score: nextScore,
        durationSeconds,
        difficulty,
        outcome: "completed",
      } as const;
      const isNewBest = nextScore > readBestScore(difficulty);
      allowSettledRef.current = true;
      if (isNewBest) {
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`, nextScore);
      }
      const routeSettlement = runId
        ? settleHidatoCompletion(
            runId,
            {
              score: nextScore,
              awardedPoints: 0,
              durationSeconds,
              moveCount: nextState.clickedValues.length,
              mistakeCount: nextState.mistakeCount,
              hintCount: nextState.hintCount,
              isNewBest,
            },
            settlementInput,
          )
        : null;
      if (!routeSettlement) return;
      if (routeSettlement.settlement.gauntletHandled) return;
      void Taro.redirectTo({ url: `/pages/hidato/result?runId=${encodeURIComponent(runId)}` });
    },
    [clearTransientTimers, difficulty, puzzle, runId],
  );

  const startGame = useCallback(() => {
    playTap();
    clearTransientTimers();
    const nextPuzzle = createHidatoPuzzle(difficulty);
    const nextState = createInitialClickState();

    startedAtRef.current = Date.now();
    finishedRef.current = false;
    setPuzzle(nextPuzzle);
    setClickState(nextState);
    setHintValue(null);
    setLastWrongCellId(null);
    setFeedback("先点击 1，再沿相邻格寻找下一个数字。");
    persistRunState(nextPuzzle, nextState);
  }, [clearTransientTimers, difficulty, persistRunState]);

  const restoreGame = useCallback(() => {
    if (!persistedState) {
      startGame();
      return;
    }
    clearTransientTimers();
    startedAtRef.current = persistedState.clockStartedAt;
    finishedRef.current = false;
    setPuzzle(persistedState.puzzle);
    setClickState(persistedState.clickState);
    setHintValue(null);
    setLastWrongCellId(null);
    setFeedback("已恢复本局，请继续寻找下一个数字。");
  }, [clearTransientTimers, persistedState, startGame]);

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
    abandonHidatoRun(runId, {
      gameId: "hidato",
      score: 0,
      durationSeconds,
      difficulty: routeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [routeRun, runId]);
  useUnload(handleRouteBack);

  const leaveGame = () => {
    handleRouteBack();
    void Taro.navigateBack().catch(() => Taro.redirectTo({ url: "/pages/hidato/index" }));
  };

  const flashWrongCell = (cellId: string) => {
    if (wrongTimerRef.current) {
      clearTimeout(wrongTimerRef.current);
    }
    setLastWrongCellId(cellId);
    wrongTimerRef.current = setTimeout(() => {
      setLastWrongCellId(null);
    }, 420);
  };

  const handleCellTap = (cell: HidatoCell) => {
    if (!puzzle || phase !== "playing" || finishedRef.current) return;

    const result = applyHidatoCellClick(clickState, cell, puzzle.total);
    playTap();
    result.correct ? playCorrect() : playWrong();
    setClickState(result.state);
    persistRunState(puzzle, result.state);

    if (!result.correct) {
      flashWrongCell(cell.id);
      setFeedback(`当前要找 ${clickState.nextValue}，这格不是下一步。`);
      return;
    }

    setHintValue(null);
    setLastWrongCellId(null);
    setFeedback(result.completed ? "最后一步已连接。" : `继续寻找 ${result.state.nextValue}。`);

    if (result.completed) {
      finishGame(result.state);
    }
  };

  const useHint = () => {
    if (!puzzle || phase !== "playing" || finishedRef.current) return;

    const targetValue = clickState.nextValue;
    const nextState = applyHidatoHint(clickState);
    setClickState(nextState);
    persistRunState(puzzle, nextState);
    setHintValue(targetValue);
    setFeedback(`提示已高亮 ${targetValue}，本局分数会降低。`);

    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }
    hintTimerRef.current = setTimeout(() => {
      setHintValue(null);
    }, HINT_FLASH_MS);
  };

  const renderCell = (cell: HidatoCell) => {
    const clicked = clickedValueSet.has(cell.value);
    const visible = cell.given || clicked;
    const isTarget = phase === "playing" && cell.value === clickState.nextValue;
    const isHint = hintValue === cell.value;
    const isWrong = lastWrongCellId === cell.id;
    const isStart = cell.value === 1;
    const isEnd = puzzle ? cell.value === puzzle.total : false;

    return (
      <View
        key={cell.id}
        className={`hidato-cell hidato-cell-value-${cell.value} ${cell.given ? "hidato-cell-given" : ""} ${clicked ? "hidato-cell-clicked" : ""} ${isTarget ? "hidato-cell-target" : ""} ${isHint ? "hidato-cell-hint" : ""} ${isWrong ? "hidato-cell-wrong" : ""}`}
        onClick={() => handleCellTap(cell)}
      >
        <Text className="hidato-cell-text">{visible ? cell.value : ""}</Text>
        {isStart || isEnd ? (
          <Text className="hidato-cell-mark">{isStart ? "起" : "终"}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View className="hidato-page">
      {puzzle ? (
        <View className="hidato-play">
          <View className="play-hud">
            <View className="play-hud-main">
              <View className="target-pill">
                <Text className="target-label">寻找</Text>
                <Text className="target-value">
                  {clickState.nextValue > puzzle.total ? puzzle.total : clickState.nextValue}
                </Text>
              </View>
              <View className="progress-block">
                <Text className="progress-label">进度 {progressPercent}%</Text>
                <View className="progress-track">
                  <View className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </View>
              </View>
            </View>
            <View className="hud-meta-row">
              <Text className="hud-feedback">{feedback}</Text>
              <View className="hud-counters">
                <Text className="hud-counter">错 {clickState.mistakeCount}</Text>
                <Text className="hud-counter">提示 {clickState.hintCount}</Text>
              </View>
            </View>
          </View>

          <View className="board-shell">
            <View
              className={`hidato-board hidato-board-${difficulty}`}
              style={{
                gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)`,
                gridTemplateRows: `repeat(${puzzle.rows}, ${difficulty === "hard" ? 88 : 92}rpx)`,
              }}
            >
              <View className="hidato-line-layer">
                {lineSegments.map((segment) => (
                  <View
                    key={`${segment.fromValue}-${segment.toValue}`}
                    className="hidato-line-segment"
                    style={{
                      left: `${segment.left}px`,
                      top: `${segment.top}px`,
                      width: `${segment.width}px`,
                      transform: `translateY(-50%) rotate(${segment.angle}deg)`,
                    }}
                  />
                ))}
              </View>
              {puzzle.cells.map(renderCell)}
            </View>
          </View>

          <View className="action-row">
            <View className="secondary-button" onClick={useHint}>
              <Text className="secondary-button-text">提示下一步</Text>
            </View>
            <View className="secondary-button secondary-button-quiet" onClick={leaveGame}>
              <Text className="secondary-button-text">重新选择</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
