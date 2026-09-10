import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { shouldRedirectInvalidGameRun } from "../../utils/gameRoute";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import GameRouteBack from "../../components/game-route/GameRouteBack";
import { usePageShare } from "../../utils/share";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import {
  createLoopLinePuzzle,
  createLoopLineState,
  cycleLoopLineEdge,
  getLoopLineBoardStatus,
  getLoopLineHint,
  loopLineEdgeKey,
  scoreLoopLineGame,
  type LoopLineEdge,
  type LoopLinePuzzle,
  type LoopLineState,
} from "./gameLogic";
import {
  abandonLoopLineRun,
  readLoopLineRun,
  settleLoopLineCompletion,
  updateLoopLineRun,
} from "./run";
import "./index.scss";

type Phase = "playing";

const STORAGE_KEY_PREFIX = "loop_line_best";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function buildBoardEdges(size: number) {
  const edges: LoopLineEdge[] = [];
  for (let row = 0; row <= size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      edges.push({ direction: "horizontal", row, col });
    }
  }
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col <= size; col += 1) {
      edges.push({ direction: "vertical", row, col });
    }
  }
  return edges;
}

export default function LoopLinePage() {
  usePageShare("pages/loop-line/index");
  const gauntletPreset = readGameGauntletModePreset();
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = readLoopLineRun(runId);
  const allowSettledRef = useRef(false);

  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, routeRun?.status, allowSettledRef.current)) {
      void Taro.redirectTo({ url: "/pages/loop-line/index" });
    }
  }, [routeRun, runId]);
  const phase: Phase = "playing";
  const difficulty: TrainingDifficulty =
    routeRun?.payload.difficulty ?? gauntletPreset?.difficulty ?? "normal";
  const persistedState = routeRun?.payload.state;
  const [puzzle, setPuzzle] = useState<LoopLinePuzzle | null>(() => persistedState?.puzzle ?? null);
  const [boardState, setBoardState] = useState<LoopLineState>(
    () => persistedState?.boardState ?? createLoopLineState(),
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(persistedState?.elapsedSeconds ?? 0);
  const [hintCount, setHintCount] = useState(persistedState?.hintCount ?? 0);
  const [hintKey, setHintKey] = useState("");
  const [feedback, setFeedback] = useState(
    "先从 0 与 3 附近开始，让每个数字刚好被对应数量的线段围住。",
  );
  const startedAtRef = useRef(persistedState?.clockStartedAt ?? routeRun?.payload.startedAt ?? 0);
  const completedRef = useRef(false);
  const autoStartedRef = useRef(false);

  const persistRunState = useCallback(
    (
      nextPuzzle: LoopLinePuzzle,
      nextBoardState: LoopLineState,
      nextHintCount: number,
      nextElapsedSeconds: number,
      nextFeedback: string,
    ) => {
      if (!runId) return;
      updateLoopLineRun(runId, {
        state: {
          puzzle: nextPuzzle,
          boardState: nextBoardState,
          hintCount: nextHintCount,
          elapsedSeconds: nextElapsedSeconds,
          feedback: nextFeedback,
          clockStartedAt: startedAtRef.current,
        },
      });
    },
    [runId],
  );
  useEffect(() => {
    if (phase !== "playing") return undefined;
    const timer = setInterval(() => {
      const nextElapsedSeconds = Math.max(
        1,
        Math.floor((Date.now() - startedAtRef.current) / 1000),
      );
      setElapsedSeconds(nextElapsedSeconds);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const finishGame = useCallback(
    (nextHintCount: number, nextBoardState = boardState) => {
      if (!puzzle || completedRef.current) return;
      completedRef.current = true;
      playComplete();
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const nextScore = scoreLoopLineGame({
        difficulty,
        elapsedSeconds: durationSeconds,
        hintCount: nextHintCount,
        completed: true,
      });
      const settlementInput = {
        gameId: "loop-line",
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
        ? settleLoopLineCompletion(
            runId,
            {
              score: nextScore,
              awardedPoints: 0,
              durationSeconds,
              moveCount: nextBoardState.selectedEdges.length,
              hintCount: nextHintCount,
              isNewBest,
            },
            settlementInput,
          )
        : null;
      if (!routeSettlement) return;
      if (routeSettlement.settlement.gauntletHandled) return;
      setElapsedSeconds(durationSeconds);
      void Taro.redirectTo({ url: `/pages/loop-line/result?runId=${encodeURIComponent(runId)}` });
    },
    [boardState, difficulty, puzzle, runId],
  );

  const startGame = useCallback(() => {
    playTap();
    completedRef.current = false;
    startedAtRef.current = Date.now();
    const nextPuzzle = createLoopLinePuzzle(difficulty);
    const nextBoardState = createLoopLineState();
    setPuzzle(nextPuzzle);
    setBoardState(nextBoardState);
    setElapsedSeconds(0);
    setHintCount(0);
    setHintKey("");
    setFeedback("每个数字表示它四周需要经过的线段数；所有线最后必须只组成一个闭环。");
    persistRunState(
      nextPuzzle,
      nextBoardState,
      0,
      0,
      "每个数字表示它四周需要经过的线段数；所有线最后必须只组成一个闭环。",
    );
  }, [difficulty, persistRunState]);

  const restoreGame = useCallback(() => {
    if (!persistedState) {
      startGame();
      return;
    }
    startedAtRef.current = persistedState.clockStartedAt;
    completedRef.current = false;
    setPuzzle(persistedState.puzzle);
    setBoardState(persistedState.boardState);
    setHintCount(persistedState.hintCount);
    setElapsedSeconds(
      Math.max(
        persistedState.elapsedSeconds,
        Math.floor((Date.now() - persistedState.clockStartedAt) / 1000),
      ),
    );
    setHintKey("");
    setFeedback(persistedState.feedback);
  }, [persistedState, startGame]);

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
    abandonLoopLineRun(runId, {
      gameId: "loop-line",
      score: 0,
      durationSeconds,
      difficulty: routeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [routeRun, runId]);
  useUnload(handleRouteBack);

  const status = useMemo(
    () => (puzzle ? getLoopLineBoardStatus(puzzle, boardState) : null),
    [boardState, puzzle],
  );
  const edges = useMemo(() => (puzzle ? buildBoardEdges(puzzle.size) : []), [puzzle]);
  const handleEdgeTap = (edge: LoopLineEdge) => {
    if (!puzzle || phase !== "playing" || completedRef.current) return;
    playTap();
    const nextState = cycleLoopLineEdge(boardState, edge);
    const nextStatus = getLoopLineBoardStatus(puzzle, nextState);
    setBoardState(nextState);
    setHintKey("");
    const nextElapsedSeconds = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
    if (nextStatus.solved) {
      persistRunState(puzzle, nextState, hintCount, nextElapsedSeconds, "路线已闭合，正在结算。 ");
      finishGame(hintCount, nextState);
      return;
    }
    if (nextStatus.overfilledClueKeys.length > 0) {
      playWrong();
      const nextFeedback = "有数字被多余线段包围了，先撤掉附近的一段线。 ";
      setFeedback(nextFeedback);
      persistRunState(puzzle, nextState, hintCount, nextElapsedSeconds, nextFeedback);
      return;
    }
    if (nextStatus.branchNodeKeys.length > 0) {
      playWrong();
      const nextFeedback = "回路不能分叉：每个亮点最多连接两段线。 ";
      setFeedback(nextFeedback);
      persistRunState(puzzle, nextState, hintCount, nextElapsedSeconds, nextFeedback);
      return;
    }
    const nextFeedback = `还有 ${nextStatus.unsatisfiedClueKeys.length} 个数字待满足，当前有 ${nextStatus.openNodeKeys.length} 个回路端点。`;
    setFeedback(nextFeedback);
    persistRunState(puzzle, nextState, hintCount, nextElapsedSeconds, nextFeedback);
  };

  const useHint = () => {
    if (!puzzle || phase !== "playing" || completedRef.current) return;
    const hint = getLoopLineHint(puzzle, boardState);
    if (!hint) {
      const nextFeedback = "正确的路线已经画出，检查它是否闭合成一个单环。 ";
      setFeedback(nextFeedback);
      persistRunState(puzzle, boardState, hintCount, elapsedSeconds, nextFeedback);
      return;
    }
    const key = loopLineEdgeKey(hint);
    const nextHintCount = hintCount + 1;
    const nextState = {
      selectedEdges: boardState.selectedEdges.includes(key)
        ? boardState.selectedEdges
        : [...boardState.selectedEdges, key],
      blockedEdges: boardState.blockedEdges.filter((item) => item !== key),
    };
    const nextStatus = getLoopLineBoardStatus(puzzle, nextState);
    playCorrect();
    setBoardState(nextState);
    setHintCount(nextHintCount);
    setHintKey(key);
    const nextFeedback = "已点亮一段正确路线，本局结算会扣减 4 分。 ";
    setFeedback(nextFeedback);
    persistRunState(puzzle, nextState, nextHintCount, elapsedSeconds, nextFeedback);
    if (nextStatus.solved) finishGame(nextHintCount, nextState);
  };

  const leaveGame = () => {
    handleRouteBack();
    void Taro.navigateBack().catch(() => Taro.redirectTo({ url: "/pages/loop-line/index" }));
  };

  const boardDimension = puzzle ? puzzle.size * 2 + 1 : 0;
  const boardStyle = puzzle
    ? {
        gridTemplateColumns: `repeat(${boardDimension}, 1fr)`,
        gridTemplateRows: `repeat(${boardDimension}, 1fr)`,
      }
    : undefined;

  return (
    <View className="loop-line-page">
      {runId ? (
        <GameRouteBack gameId="loop-line" runId={runId} onAbandon={handleRouteBack} />
      ) : null}
      {puzzle && status ? (
        <View className="loop-line-play">
          <View className="loop-line-play-header">
            <View>
              <Text className="loop-line-play-title">环线谜踪</Text>
              <Text className="loop-line-play-subtitle">
                {getTrainingDifficultyLabel(difficulty)} · {elapsedSeconds} 秒
              </Text>
            </View>
            <View className="loop-line-progress-pill">
              <Text className="loop-line-progress-value">{status.selectedEdgeCount}</Text>
              <Text className="loop-line-progress-label">已绘</Text>
            </View>
          </View>

          <View className="loop-line-stats-row">
            <View className="loop-line-stat">
              <Text className="loop-line-stat-value">{status.unsatisfiedClueKeys.length}</Text>
              <Text className="loop-line-stat-label">待满足</Text>
            </View>
            <View className="loop-line-stat">
              <Text className="loop-line-stat-value">{status.openNodeKeys.length}</Text>
              <Text className="loop-line-stat-label">端点</Text>
            </View>
            <View className="loop-line-stat">
              <Text className="loop-line-stat-value">{hintCount}</Text>
              <Text className="loop-line-stat-label">提示</Text>
            </View>
          </View>

          <View className={`loop-line-board loop-line-board-${puzzle.size}`} style={boardStyle}>
            {Array.from({ length: puzzle.size + 1 }, (_, row) =>
              Array.from({ length: puzzle.size + 1 }, (_dotIndex, col) => (
                <View
                  key={`dot-${row}-${col}`}
                  className="loop-line-dot"
                  style={{ gridRowStart: row * 2 + 1, gridColumnStart: col * 2 + 1 }}
                />
              )),
            )}
            {puzzle.clues.map((clue) => {
              const key = `${clue.row}:${clue.col}`;
              const overfilled = status.overfilledClueKeys.includes(key);
              const unsatisfied = status.unsatisfiedClueKeys.includes(key);
              return (
                <View
                  key={`clue-${key}`}
                  className={`loop-line-clue ${overfilled ? "loop-line-clue-overfilled" : ""} ${unsatisfied ? "loop-line-clue-pending" : ""}`}
                  style={{ gridRowStart: clue.row * 2 + 2, gridColumnStart: clue.col * 2 + 2 }}
                >
                  <Text>{clue.value}</Text>
                </View>
              );
            })}
            {edges.map((edge) => {
              const key = loopLineEdgeKey(edge);
              const selected = boardState.selectedEdges.includes(key);
              const blocked = boardState.blockedEdges.includes(key);
              const isHint = hintKey === key;
              const row = edge.direction === "horizontal" ? edge.row * 2 + 1 : edge.row * 2 + 2;
              const col = edge.direction === "horizontal" ? edge.col * 2 + 2 : edge.col * 2 + 1;
              return (
                <View
                  key={key}
                  className={`loop-line-edge loop-line-edge-${edge.direction} ${selected ? "loop-line-edge-selected" : ""} ${blocked ? "loop-line-edge-blocked" : ""} ${isHint ? "loop-line-edge-hint" : ""}`}
                  style={{ gridRowStart: row, gridColumnStart: col }}
                  onClick={() => handleEdgeTap(edge)}
                >
                  {blocked ? <Text className="loop-line-edge-block-mark">×</Text> : null}
                </View>
              );
            })}
          </View>

          <Text className="loop-line-feedback">{feedback}</Text>
          <View className="loop-line-actions">
            <View className="loop-line-action loop-line-action-secondary" onClick={leaveGame}>
              <Text className="loop-line-action-text">重开</Text>
            </View>
            <View
              className="loop-line-action loop-line-action-primary audio-pressable"
              onClick={useHint}
            >
              <Text className="loop-line-action-text">提示 -4</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
