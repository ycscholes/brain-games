import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance, useDidShow, useLoad, useUnload } from "@tarojs/taro";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { settleGame } from "../../services/gameSettlementService";
import GameRouteBack from "../../components/game-route/GameRouteBack";
import { usePageShare } from "../../utils/share";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
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
import { abandonLoopLineRun, readLoopLineRun, settleLoopLineCompletion } from "./run";
import "./index.scss";

type Phase = "start" | "playing" | "finished";

const STORAGE_KEY_PREFIX = "loop_line_best";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getDifficultyCopy(difficulty: TrainingDifficulty) {
  return difficulty === "hard" ? "6 × 6 · 更多转折与隐藏线索" : "5 × 5 · 适合熟悉单环规则";
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
  const isGauntletPreset = gauntletPreset !== null;
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = readLoopLineRun(runId);

  useEffect(() => {
    if (!runId || !routeRun || routeRun.status !== "active") {
      void Taro.redirectTo({ url: "/pages/loop-line/index" });
    }
  }, [routeRun, runId]);
  const [phase, setPhase] = useState<Phase>("start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(
    gauntletPreset?.difficulty ?? "normal",
  );
  const [best, setBest] = useState(0);
  const [puzzle, setPuzzle] = useState<LoopLinePuzzle | null>(null);
  const [boardState, setBoardState] = useState<LoopLineState>(() => createLoopLineState());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [hintKey, setHintKey] = useState("");
  const [feedback, setFeedback] = useState(
    "先从 0 与 3 附近开始，让每个数字刚好被对应数量的线段围住。",
  );
  const [finalScore, setFinalScore] = useState(0);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const startedAtRef = useRef(0);
  const completedRef = useRef(false);
  const autoStartedRef = useRef(false);
  useAmbientMusic(phase === "start");

  const refreshBest = useCallback(() => {
    setBest(readBestScore(difficulty));
  }, [difficulty]);

  useLoad(() => {
    refreshBest();
  });

  useDidShow(() => {
    refreshBest();
  });

  useEffect(() => {
    refreshBest();
  }, [refreshBest]);

  useEffect(() => {
    if (phase !== "playing") return undefined;
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const finishGame = useCallback(
    (nextHintCount: number) => {
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
      const routeSettlement = runId
        ? settleLoopLineCompletion(
            runId,
            {
              score: nextScore,
              awardedPoints: 0,
              durationSeconds,
              moveCount: boardState.selectedEdges.length,
              isNewBest: nextScore > best,
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
      const nextBest = Math.max(best, nextScore);
      if (nextScore > best) {
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`, nextScore);
        setBest(nextBest);
      }
      setIsNewBest(nextScore > best);
      setFinalScore(nextScore);
      setAwardedPoints(nextAwardedPoints);
      setElapsedSeconds(durationSeconds);
      if (runId) {
        void Taro.redirectTo({ url: `/pages/loop-line/result?runId=${encodeURIComponent(runId)}` });
        return;
      }
      setPhase("finished");
    },
    [best, boardState.selectedEdges.length, difficulty, puzzle, runId],
  );

  const startGame = useCallback(() => {
    playTap();
    completedRef.current = false;
    startedAtRef.current = Date.now();
    setPuzzle(createLoopLinePuzzle(difficulty));
    setBoardState(createLoopLineState());
    setElapsedSeconds(0);
    setHintCount(0);
    setHintKey("");
    setFeedback("每个数字表示它四周需要经过的线段数；所有线最后必须只组成一个闭环。");
    setFinalScore(0);
    setAwardedPoints(0);
    setIsNewBest(false);
    setPhase("playing");
  }, [difficulty]);

  useEffect(() => {
    if (!routeRun || routeRun.status !== "active" || autoStartedRef.current || phase !== "start")
      return;
    autoStartedRef.current = true;
    startGame();
  }, [phase, routeRun, startGame]);

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
    if (nextStatus.solved) {
      finishGame(hintCount);
      return;
    }
    if (nextStatus.overfilledClueKeys.length > 0) {
      playWrong();
      setFeedback("有数字被多余线段包围了，先撤掉附近的一段线。 ");
      return;
    }
    if (nextStatus.branchNodeKeys.length > 0) {
      playWrong();
      setFeedback("回路不能分叉：每个亮点最多连接两段线。 ");
      return;
    }
    setFeedback(
      `还有 ${nextStatus.unsatisfiedClueKeys.length} 个数字待满足，当前有 ${nextStatus.openNodeKeys.length} 个回路端点。`,
    );
  };

  const useHint = () => {
    if (!puzzle || phase !== "playing" || completedRef.current) return;
    const hint = getLoopLineHint(puzzle, boardState);
    if (!hint) {
      setFeedback("正确的路线已经画出，检查它是否闭合成一个单环。 ");
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
    setFeedback("已点亮一段正确路线，本局结算会扣减 4 分。 ");
    if (nextStatus.solved) finishGame(nextHintCount);
  };

  const restart = () => {
    if (phase === "finished") {
      setPhase("start");
      return;
    }
    startGame();
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
      {phase === "start" ? (
        <View className="loop-line-start start-screen">
          <View className="header-section">
            <View className="loop-line-logo-icon">
              <Text className="loop-line-logo-emoji">○</Text>
            </View>
            <Text className="loop-line-title">环线谜踪</Text>
            <Text className="loop-line-subtitle">读懂数字，画出唯一不断开的闭环</Text>
            <View className="loop-line-best-pill">
              <Text className="loop-line-best-label">当前难度最高</Text>
              <Text className="loop-line-best-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="loop-line-section-title">游戏规则</Text>
            <Text className="loop-line-rule-item">1. 数字表示它四边经过的线段数量。</Text>
            <Text className="loop-line-rule-item">2. 每个交点只能经过 0 或 2 段线。</Text>
            <Text className="loop-line-rule-item">3. 所有线段最后必须组成唯一闭环。</Text>
          </View>

          {!isGauntletPreset ? (
            <View className="summary-card">
              <Text className="loop-line-section-title">选择难度</Text>
              <View className="loop-line-difficulty-row">
                {(["normal", "hard"] as TrainingDifficulty[]).map((value) => (
                  <View
                    key={value}
                    className={`loop-line-difficulty-card ${difficulty === value ? "loop-line-difficulty-card-active" : ""}`}
                    onClick={() => setDifficulty(value)}
                  >
                    <Text className="loop-line-difficulty-name">
                      {getTrainingDifficultyLabel(value)}
                    </Text>
                    <Text className="loop-line-difficulty-copy">{getDifficultyCopy(value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View className="floating-start-action">
            <View className="loop-line-start-button audio-pressable" onClick={startGame}>
              <Text className="loop-line-start-button-text">开始挑战</Text>
            </View>
          </View>
          <View className="floating-start-spacer" />
        </View>
      ) : null}

      {phase === "playing" && puzzle && status ? (
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
            <View className="loop-line-action loop-line-action-secondary" onClick={restart}>
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

      {phase === "finished" ? (
        <View className="loop-line-finished summary-card">
          <Text className="loop-line-finished-kicker">CIRCUIT CLOSED</Text>
          <Text className="loop-line-finished-title">路线闭合成功</Text>
          <Text className="loop-line-finished-copy">
            用时 {elapsedSeconds} 秒 · 使用 {hintCount} 次提示
          </Text>
          <View className="loop-line-result-grid">
            <View>
              <Text className="loop-line-result-value">{finalScore}</Text>
              <Text className="loop-line-result-label">游戏得分</Text>
            </View>
            <View>
              <Text className="loop-line-result-value">+{awardedPoints}</Text>
              <Text className="loop-line-result-label">宠物积分</Text>
            </View>
          </View>
          {isNewBest ? <Text className="loop-line-new-best">新的最高分</Text> : null}
          <StickerShareButton
            gameTitle="环线谜踪"
            score={finalScore}
            pagePath="pages/loop-line/index"
            isGauntlet={isGauntletPreset}
          />
          <View
            className="loop-line-start-button floating-start-action audio-pressable"
            onClick={restart}
          >
            <Text className="loop-line-start-button-text">再来一局</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
