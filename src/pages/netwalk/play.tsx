import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { shouldRedirectInvalidGameRun } from "../../utils/gameRoute";
import { type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { playComplete, playCorrect, playTap } from "../../services/audio/audioFeedbackService";
import {
  createNetwalkPuzzle,
  createNetwalkState,
  getConnectedNetwalkTileIds,
  getNetwalkHint,
  isNetwalkSolved,
  rotateNetwalkTile,
  scoreNetwalkGame,
  type NetwalkPuzzle,
  type NetwalkState,
  type NetwalkTile,
} from "./gameLogic";
import {
  abandonNetwalkRun,
  readNetwalkRun,
  settleNetwalkCompletion,
  updateNetwalkRun,
} from "./run";
import "./index.scss";

type Phase = "playing";

const STORAGE_KEY_PREFIX = "netwalk_best";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function Netwalk() {
  usePageShare("pages/netwalk/index");
  const gauntletPreset = readGameGauntletModePreset();
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = readNetwalkRun(runId);
  const allowSettledRef = useRef(false);

  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, routeRun?.status, allowSettledRef.current)) {
      void Taro.redirectTo({ url: "/pages/netwalk/index" });
    }
  }, [routeRun, runId]);
  const phase: Phase = "playing";
  const difficulty: TrainingDifficulty =
    routeRun?.payload.difficulty ?? gauntletPreset?.difficulty ?? "normal";
  const persistedState = routeRun?.payload.state;
  const [puzzle, setPuzzle] = useState<NetwalkPuzzle | null>(() => persistedState?.puzzle ?? null);
  const [networkState, setNetworkState] = useState<NetwalkState | null>(
    () => persistedState?.networkState ?? null,
  );
  const [hintCount, setHintCount] = useState(persistedState?.hintCount ?? 0);
  const [elapsedSeconds, setElapsedSeconds] = useState(persistedState?.elapsedSeconds ?? 0);
  const [feedback, setFeedback] = useState(
    persistedState?.feedback ?? "旋转线路，让每个终端接回琥珀服务器。",
  );
  const startedAtRef = useRef(persistedState?.clockStartedAt ?? routeRun?.payload.startedAt ?? 0);
  const completedRef = useRef(false);
  const autoStartedRef = useRef(false);

  const persistRunState = useCallback(
    (
      nextPuzzle: NetwalkPuzzle,
      nextNetworkState: NetwalkState,
      nextHintCount: number,
      nextElapsedSeconds: number,
      nextFeedback: string,
    ) => {
      if (!runId) return;
      updateNetwalkRun(runId, {
        state: {
          puzzle: nextPuzzle,
          networkState: nextNetworkState,
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
      setElapsedSeconds(Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const finishGame = useCallback(
    (nextState: NetwalkState, nextHintCount: number) => {
      if (!puzzle || completedRef.current) return;
      completedRef.current = true;
      playComplete();
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const nextScore = scoreNetwalkGame({
        difficulty,
        elapsedSeconds: durationSeconds,
        moveCount: nextState.moveCount,
        minimumMoves: puzzle.minimumMoves,
        hintCount: nextHintCount,
        completed: true,
      });
      const settlementInput = {
        gameId: "netwalk",
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
        ? settleNetwalkCompletion(
            runId,
            {
              score: nextScore,
              awardedPoints: 0,
              durationSeconds,
              moveCount: nextState.moveCount,
              hintCount: nextHintCount,
              isNewBest,
            },
            settlementInput,
          )
        : null;
      if (!routeSettlement) return;
      if (routeSettlement.settlement.gauntletHandled) return;
      setElapsedSeconds(durationSeconds);
      void Taro.redirectTo({ url: `/pages/netwalk/result?runId=${encodeURIComponent(runId)}` });
    },
    [difficulty, puzzle, runId],
  );

  const startGame = useCallback(() => {
    playTap();
    const nextPuzzle = createNetwalkPuzzle(difficulty);
    const nextNetworkState = createNetwalkState(nextPuzzle);
    completedRef.current = false;
    startedAtRef.current = Date.now();
    setPuzzle(nextPuzzle);
    setNetworkState(nextNetworkState);
    setHintCount(0);
    setElapsedSeconds(0);
    setFeedback("点击任意蓝色节点顺时针旋转，接口需要两边同时对齐。");
    persistRunState(
      nextPuzzle,
      nextNetworkState,
      0,
      0,
      "点击任意蓝色节点顺时针旋转，接口需要两边同时对齐。",
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
    setNetworkState(persistedState.networkState);
    setHintCount(persistedState.hintCount);
    setElapsedSeconds(
      Math.max(
        persistedState.elapsedSeconds,
        Math.floor((Date.now() - persistedState.clockStartedAt) / 1000),
      ),
    );
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
    abandonNetwalkRun(runId, {
      gameId: "netwalk",
      score: 0,
      durationSeconds,
      difficulty: routeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [routeRun, runId]);
  useUnload(handleRouteBack);

  const rotateTile = useCallback(
    (tile: NetwalkTile, fromHint = false) => {
      if (!puzzle || !networkState || phase !== "playing") return;
      if (tile.isServer) {
        setFeedback("琥珀服务器是固定核心，旋转周围的线路节点。 ");
        return;
      }
      const nextState = rotateNetwalkTile(networkState, tile.id);
      playTap();
      setNetworkState(nextState);
      const nextHintCount = hintCount + (fromHint ? 1 : 0);
      const nextElapsedSeconds = Math.max(
        1,
        Math.floor((Date.now() - startedAtRef.current) / 1000),
      );
      if (isNetwalkSolved(puzzle, nextState)) {
        persistRunState(
          puzzle,
          nextState,
          nextHintCount,
          nextElapsedSeconds,
          "全网已接通，正在结算。 ",
        );
        finishGame(nextState, nextHintCount);
        return;
      }
      if (fromHint) {
        const nextFeedback = "提示已旋转一个错误节点。顺着亮起的线路继续延展。 ";
        setFeedback(nextFeedback);
        persistRunState(puzzle, nextState, nextHintCount, nextElapsedSeconds, nextFeedback);
        return;
      }
      const connectedCount = getConnectedNetwalkTileIds(puzzle, nextState).length;
      if (connectedCount > 1) playCorrect();
      const nextFeedback = `已有 ${connectedCount}/${puzzle.size * puzzle.size} 个节点接回服务器。`;
      setFeedback(nextFeedback);
      persistRunState(puzzle, nextState, hintCount, nextElapsedSeconds, nextFeedback);
    },
    [finishGame, hintCount, networkState, persistRunState, phase, puzzle],
  );

  const useHint = () => {
    if (!puzzle || !networkState || phase !== "playing") return;
    const hint = getNetwalkHint(puzzle, networkState);
    if (!hint) {
      const nextFeedback = "全网已对齐，检查是否还有断开的支路。 ";
      setFeedback(nextFeedback);
      persistRunState(puzzle, networkState, hintCount, elapsedSeconds, nextFeedback);
      return;
    }
    const tile = networkState.tiles.find((item) => item.id === hint.tileId);
    if (tile) rotateTile(tile, true);
    setHintCount((count) => count + 1);
  };

  const connectedTileIds = useMemo(
    () =>
      puzzle && networkState
        ? new Set(getConnectedNetwalkTileIds(puzzle, networkState))
        : new Set<string>(),
    [networkState, puzzle],
  );

  const boardStyle = puzzle
    ? {
        gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${puzzle.size}, minmax(0, 1fr))`,
      }
    : undefined;

  const renderTile = (tile: NetwalkTile) => {
    const isConnected = connectedTileIds.has(tile.id);
    return (
      <View
        key={tile.id}
        className={`netwalk-tile ${tile.isServer ? "netwalk-tile-server" : ""} ${isConnected ? "netwalk-tile-powered" : ""}`}
        style={{ gridColumn: `${tile.col + 1}`, gridRow: `${tile.row + 1}` }}
        onClick={() => rotateTile(tile)}
      >
        {tile.connections.map((direction) => (
          <View className={`netwalk-arm netwalk-arm-${direction}`} key={direction} />
        ))}
        <View className="netwalk-node-core">
          <Text className="netwalk-node-mark">{tile.isServer ? "S" : "·"}</Text>
        </View>
      </View>
    );
  };

  return (
    <View className="netwalk-page">
      {puzzle && networkState ? (
        <View className="netwalk-play">
          <View className="netwalk-hud">
            <View>
              <Text className="netwalk-hud-label">耗时</Text>
              <Text className="netwalk-hud-value">{elapsedSeconds}s</Text>
            </View>
            <View className="netwalk-hud-divider" />
            <View>
              <Text className="netwalk-hud-label">旋转</Text>
              <Text className="netwalk-hud-value">{networkState.moveCount} 次</Text>
            </View>
            <View className="netwalk-hud-divider" />
            <View>
              <Text className="netwalk-hud-label">提示</Text>
              <Text className="netwalk-hud-value">{hintCount}</Text>
            </View>
          </View>

          <View className="netwalk-feedback-card">
            <Text className="netwalk-feedback-title">
              已接通 {connectedTileIds.size}/{puzzle.size * puzzle.size} 个节点
            </Text>
            <Text className="netwalk-feedback-copy">{feedback}</Text>
          </View>

          <View className="netwalk-board-shell">
            <View className="netwalk-board" style={boardStyle}>
              {networkState.tiles.map(renderTile)}
            </View>
            <Text className="netwalk-board-caption">AMBER CORE · ALL NODES REQUIRED</Text>
          </View>

          <View className="netwalk-controls-card">
            <Text className="netwalk-controls-title">卡住时可先点提示</Text>
            <Text className="netwalk-controls-copy">提示会替你旋转一步，并扣除 5 游戏分。</Text>
            <View className="netwalk-secondary-button" onClick={useHint}>
              <Text className="netwalk-secondary-button-text">给我一步提示（−5 分）</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
