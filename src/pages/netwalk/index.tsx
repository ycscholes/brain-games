import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  recordTrainingSession,
  type TrainingDifficulty,
} from "../../utils/trainingStorage";
import { completeGauntletLegIfNeeded, readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
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
import "./index.scss";

type Phase = "start" | "playing" | "finished";

const STORAGE_KEY_PREFIX = "netwalk_best";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getDifficultyCopy(difficulty: TrainingDifficulty) {
  return difficulty === "hard" ? "5×5 · 更深的分支网络" : "4×4 · 快速接通全网";
}

export default function Netwalk() {
  usePageShare("pages/netwalk/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;
  const [phase, setPhase] = useState<Phase>("start");
  useAmbientMusic(phase === "start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(gauntletPreset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);
  const [puzzle, setPuzzle] = useState<NetwalkPuzzle | null>(null);
  const [networkState, setNetworkState] = useState<NetwalkState | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [feedback, setFeedback] = useState("旋转线路，让每个终端接回琥珀服务器。");
  const [finalScore, setFinalScore] = useState(0);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const startedAtRef = useRef(0);
  const completedRef = useRef(false);
  const autoStartedRef = useRef(false);

  const refreshBest = useCallback(() => {
    setBest(readBestScore(difficulty));
  }, [difficulty]);

  useLoad(refreshBest);
  useDidShow(refreshBest);

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

  const finishGame = useCallback((nextState: NetwalkState, nextHintCount: number) => {
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
    const nextAwardedPoints = getAwardedPoints("netwalk", nextScore, difficulty);

    if (completeGauntletLegIfNeeded({
      gameId: "netwalk",
      score: nextScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    })) {
      return;
    }

    addPointsToPet("netwalk", nextScore, difficulty);
    recordTrainingSession({
      gameId: "netwalk",
      score: nextScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    });
    const nextBest = Math.max(best, nextScore);
    if (nextScore > best) {
      Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`, nextScore);
      setBest(nextBest);
    }
    setIsNewBest(nextScore > best);
    setFinalScore(nextScore);
    setAwardedPoints(nextAwardedPoints);
    setElapsedSeconds(durationSeconds);
    setPhase("finished");
  }, [best, difficulty, puzzle]);

  const startGame = useCallback(() => {
    playTap();
    const nextPuzzle = createNetwalkPuzzle(difficulty);
    completedRef.current = false;
    startedAtRef.current = Date.now();
    setPuzzle(nextPuzzle);
    setNetworkState(createNetwalkState(nextPuzzle));
    setHintCount(0);
    setElapsedSeconds(0);
    setFeedback("点击任意蓝色节点顺时针旋转，接口需要两边同时对齐。");
    setFinalScore(0);
    setAwardedPoints(0);
    setIsNewBest(false);
    setPhase("playing");
  }, [difficulty]);

  useEffect(() => {
    if (!isGauntletPreset || autoStartedRef.current || phase !== "start") return;
    autoStartedRef.current = true;
    startGame();
  }, [isGauntletPreset, phase, startGame]);

  const rotateTile = useCallback((tile: NetwalkTile, fromHint = false) => {
    if (!puzzle || !networkState || phase !== "playing") return;
    if (tile.isServer) {
      setFeedback("琥珀服务器是固定核心，旋转周围的线路节点。 ");
      return;
    }
    const nextState = rotateNetwalkTile(networkState, tile.id);
    playTap();
    setNetworkState(nextState);
    if (isNetwalkSolved(puzzle, nextState)) {
      finishGame(nextState, hintCount + (fromHint ? 1 : 0));
      return;
    }
    if (fromHint) {
      setFeedback("提示已旋转一个错误节点。顺着亮起的线路继续延展。 ");
      return;
    }
    const connectedCount = getConnectedNetwalkTileIds(puzzle, nextState).length;
    if (connectedCount > 1) playCorrect();
    setFeedback(`已有 ${connectedCount}/${puzzle.size * puzzle.size} 个节点接回服务器。`);
  }, [finishGame, hintCount, networkState, phase, puzzle]);

  const useHint = () => {
    if (!puzzle || !networkState || phase !== "playing") return;
    const hint = getNetwalkHint(puzzle, networkState);
    if (!hint) {
      setFeedback("全网已对齐，检查是否还有断开的支路。 ");
      return;
    }
    const tile = networkState.tiles.find((item) => item.id === hint.tileId);
    if (tile) rotateTile(tile, true);
    setHintCount((count) => count + 1);
  };

  const connectedTileIds = useMemo(() => (
    puzzle && networkState ? new Set(getConnectedNetwalkTileIds(puzzle, networkState)) : new Set<string>()
  ), [networkState, puzzle]);

  const boardStyle = puzzle ? {
    gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${puzzle.size}, minmax(0, 1fr))`,
  } : undefined;

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

  const difficultyCard = (value: TrainingDifficulty) => (
    <View
      className={`summary-item netwalk-difficulty-card ${difficulty === value ? "summary-item-active netwalk-difficulty-card-active" : ""}`}
      onClick={() => setDifficulty(value)}
    >
      <Text className="summary-value netwalk-difficulty-name">{getTrainingDifficultyLabel(value)}</Text>
      <Text className="summary-label netwalk-difficulty-copy">{getDifficultyCopy(value)}</Text>
    </View>
  );

  return (
    <View className="netwalk-page">
      {phase === "start" ? (
        <View className="netwalk-start start-screen">
          <View className="header-section netwalk-hero">
            <View className="netwalk-orbit netwalk-orbit-one" />
            <View className="netwalk-orbit netwalk-orbit-two" />
            <View className="netwalk-hero-server"><Text>●</Text></View>
            <View className="logo-icon netwalk-kicker"><Text className="logo-emoji">⌘</Text></View>
            <Text className="game-title netwalk-title">网络回路</Text>
            <Text className="game-subtitle netwalk-subtitle">旋转线路，让每个终端接回核心</Text>
            <View className="high-score-badge netwalk-best-pill">
              <Text className="high-score-label netwalk-best-label">当前难度最高</Text>
              <Text className="high-score-value netwalk-best-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card netwalk-panel netwalk-rule-panel">
            <Text className="section-title netwalk-section-title">游戏规则</Text>
            <Text className="rule-item netwalk-rule">1. 点击蓝色线路节点，每次顺时针旋转 90°。</Text>
            <Text className="rule-item netwalk-rule">2. 接口必须两边同时对齐，才能点亮一条线路。</Text>
            <Text className="rule-item netwalk-rule">3. 全部节点接回琥珀服务器即通关；少旋转、少提示得分更高。</Text>
          </View>

          {!isGauntletPreset ? (
            <View className="summary-card netwalk-panel">
              <Text className="section-title netwalk-section-title">选择网络规模</Text>
              <View className="summary-grid netwalk-difficulty-grid">
                {difficultyCard("normal")}
                {difficultyCard("hard")}
              </View>
            </View>
          ) : null}

          <View className="floating-start-action netwalk-floating-start">
            <View className="primary-button netwalk-primary-button" onClick={startGame}>
              <Text className="primary-button-text netwalk-primary-button-text">接通网络</Text>
            </View>
          </View>
          <View className="floating-start-spacer netwalk-floating-spacer" />
        </View>
      ) : null}

      {phase === "playing" && puzzle && networkState ? (
        <View className="netwalk-play">
          <View className="netwalk-hud">
            <View><Text className="netwalk-hud-label">耗时</Text><Text className="netwalk-hud-value">{elapsedSeconds}s</Text></View>
            <View className="netwalk-hud-divider" />
            <View><Text className="netwalk-hud-label">旋转</Text><Text className="netwalk-hud-value">{networkState.moveCount} 次</Text></View>
            <View className="netwalk-hud-divider" />
            <View><Text className="netwalk-hud-label">提示</Text><Text className="netwalk-hud-value">{hintCount}</Text></View>
          </View>

          <View className="netwalk-feedback-card">
            <Text className="netwalk-feedback-title">已接通 {connectedTileIds.size}/{puzzle.size * puzzle.size} 个节点</Text>
            <Text className="netwalk-feedback-copy">{feedback}</Text>
          </View>

          <View className="netwalk-board-shell">
            <View className="netwalk-board" style={boardStyle}>{networkState.tiles.map(renderTile)}</View>
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

      {phase === "finished" ? (
        <View className="netwalk-finish finish-screen">
          <View className="netwalk-finish-panel">
            <Text className="netwalk-kicker">NETWORK ONLINE · {getTrainingDifficultyLabel(difficulty)}</Text>
            <Text className="netwalk-finish-title">{isNewBest ? "连通纪录刷新" : "全网已接通"}</Text>
            <Text className="netwalk-finish-score">{finalScore}</Text>
            <Text className="netwalk-finish-copy">获得 {awardedPoints} 宠物积分 · 旋转 {networkState?.moveCount ?? 0} 次 · 提示 {hintCount} 次</Text>
            <View className="netwalk-finish-actions">
              <StickerShareButton gameTitle="网络回路" score={finalScore} pagePath="pages/netwalk/index" isGauntlet={isGauntletPreset} />
              <View className="netwalk-primary-button" onClick={startGame}><Text className="netwalk-primary-button-text">再接一张网络</Text></View>
              <View className="netwalk-secondary-button" onClick={() => setPhase("start")}><Text className="netwalk-secondary-button-text">返回难度选择</Text></View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
