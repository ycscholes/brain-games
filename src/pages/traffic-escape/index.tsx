import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import {
  resolveTrafficVehicleUrl,
} from "../../config/remoteAssets";
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
import { playComplete, playCorrect, playTap, playWrong } from "../../services/audio/audioFeedbackService";
import {
  applyTrafficEscapeMove,
  createTrafficEscapePuzzle,
  createTrafficEscapeState,
  getTrafficEscapeHint,
  isTrafficEscapeSolved,
  scoreTrafficEscapeGame,
  type TrafficEscapeMove,
  type TrafficEscapePuzzle,
  type TrafficEscapeState,
  type TrafficVehicle,
  TRAFFIC_VEHICLE_APPEARANCE_LIST,
  type TrafficVehicleAppearance,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "finished";

const STORAGE_KEY_PREFIX = "traffic_escape_best";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getDifficultyCopy(difficulty: TrainingDifficulty) {
  return difficulty === "hard" ? "6×6 · 八车密集车阵" : "6×6 · 六种车型破局";
}

export default function TrafficEscape() {
  usePageShare("pages/traffic-escape/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;
  const [phase, setPhase] = useState<Phase>("start");
  useAmbientMusic(phase === "start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(gauntletPreset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);
  const [puzzle, setPuzzle] = useState<TrafficEscapePuzzle | null>(null);
  const [trafficState, setTrafficState] = useState<TrafficEscapeState | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [hintMove, setHintMove] = useState<TrafficEscapeMove | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [feedback, setFeedback] = useState("先点一辆车，再选择移动方向。");
  const [finalScore, setFinalScore] = useState(0);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [vehicleImageUrls, setVehicleImageUrls] = useState<Partial<Record<TrafficVehicleAppearance, string>>>({});
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
    let active = true;
    void Promise.all(
      TRAFFIC_VEHICLE_APPEARANCE_LIST.map((appearance) => resolveTrafficVehicleUrl(appearance).then((url) => [appearance, url] as const)),
    ).then((entries) => {
      if (!active) return;
      setVehicleImageUrls(Object.fromEntries(entries.filter(([, url]) => Boolean(url))));
    }).catch(() => {
      if (active) setVehicleImageUrls({});
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing") return undefined;
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const finishGame = useCallback((nextState: TrafficEscapeState, nextHints: number) => {
    if (!puzzle || completedRef.current) return;
    completedRef.current = true;
    playComplete();
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const nextScore = scoreTrafficEscapeGame({
      difficulty,
      elapsedSeconds: durationSeconds,
      moveCount: nextState.moveCount,
      hintCount: nextHints,
      completed: true,
    });
    const nextAwardedPoints = getAwardedPoints("traffic-escape", nextScore, difficulty);

    if (completeGauntletLegIfNeeded({
      gameId: "traffic-escape",
      score: nextScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    })) {
      return;
    }

    addPointsToPet("traffic-escape", nextScore, difficulty);
    recordTrainingSession({
      gameId: "traffic-escape",
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
    const nextPuzzle = createTrafficEscapePuzzle(difficulty);
    const nextState = createTrafficEscapeState(nextPuzzle);
    completedRef.current = false;
    startedAtRef.current = Date.now();
    setPuzzle(nextPuzzle);
    setTrafficState(nextState);
    setSelectedVehicleId("target");
    setHintMove(null);
    setHintCount(0);
    setElapsedSeconds(0);
    setFeedback("红车驶向右侧出口。先腾出它前方的车道。 ");
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

  const applyMove = useCallback((move: TrafficEscapeMove, usedHint = false) => {
    if (!puzzle || !trafficState || phase !== "playing") return;
    const result = applyTrafficEscapeMove(puzzle, trafficState, move);
    playTap();
    if (!result.moved) {
      playWrong();
      setFeedback("这边被其他车辆堵住了，换个方向试试。 ");
      return;
    }

    const nextHints = hintCount + (usedHint ? 1 : 0);
    playCorrect();
    setTrafficState(result.state);
    setHintMove(null);
    setHintCount(nextHints);
    setFeedback(usedHint ? "提示已完成一步调度。继续为红车让路。" : "调度成功，继续观察出口通道。 ");
    if (isTrafficEscapeSolved(puzzle, result.state)) {
      finishGame(result.state, nextHints);
    }
  }, [finishGame, hintCount, phase, puzzle, trafficState]);

  const useHint = () => {
    if (!puzzle || !trafficState || phase !== "playing") return;
    const nextHint = getTrafficEscapeHint(puzzle, trafficState);
    if (!nextHint) {
      setFeedback("出口已经打开，试着把红车驶向右侧。 ");
      return;
    }
    setHintMove(nextHint);
    setSelectedVehicleId(nextHint.vehicleId);
    applyMove(nextHint, true);
  };

  const selectedVehicle = trafficState?.vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const visibleVehicles = trafficState?.vehicles ?? [];
  const selectedDirectionCopy = selectedVehicle?.orientation === "vertical" ? "上 / 下" : "左 / 右";
  const boardStyle = puzzle ? {
    gridTemplateColumns: `repeat(${puzzle.size}, 1fr)`,
    gridTemplateRows: `repeat(${puzzle.size}, 1fr)`,
  } : undefined;

  const renderVehicle = (vehicle: TrafficVehicle) => {
    const isSelected = vehicle.id === selectedVehicleId;
    const isHinted = hintMove?.vehicleId === vehicle.id;
    const isHorizontal = vehicle.orientation === "horizontal";
    const vehicleAppearance = vehicle.appearance ?? "sport";
    const vehicleImageUrl = vehicleImageUrls[vehicleAppearance];
    return (
      <View
        key={vehicle.id}
        className={`traffic-vehicle traffic-vehicle-${vehicle.color} ${isHorizontal ? "traffic-vehicle-horizontal" : "traffic-vehicle-vertical"} ${vehicleImageUrl ? "traffic-vehicle-has-image" : ""} ${isSelected ? "traffic-vehicle-selected" : ""} ${isHinted ? "traffic-vehicle-hinted" : ""}`}
        style={{
          gridColumn: `${vehicle.col + 1} / span ${isHorizontal ? vehicle.length : 1}`,
          gridRow: `${vehicle.row + 1} / span ${isHorizontal ? 1 : vehicle.length}`,
        }}
        onClick={() => {
          playTap();
          setSelectedVehicleId(vehicle.id);
          setHintMove(null);
          setFeedback(`${vehicle.isTarget ? "红车" : "已选车辆"}可向${vehicle.orientation === "horizontal" ? "左或右" : "上或下"}移动。`);
        }}
      >
        {vehicleImageUrl ? (
          <Image
            className={`traffic-vehicle-image ${isHorizontal ? "traffic-vehicle-image-horizontal" : "traffic-vehicle-image-vertical"}`}
            src={vehicleImageUrl}
            mode="aspectFit"
            onError={() => setVehicleImageUrls((current) => ({ ...current, [vehicleAppearance]: "" }))}
          />
        ) : null}
        <View className="traffic-vehicle-window" />
        <View className="traffic-vehicle-window" />
        {vehicle.isTarget ? <Text className="traffic-vehicle-mark">出</Text> : null}
      </View>
    );
  };

  const difficultyCard = (value: TrainingDifficulty) => (
    <View
      className={`summary-item traffic-difficulty-card ${difficulty === value ? "summary-item-active traffic-difficulty-card-active" : ""}`}
      onClick={() => setDifficulty(value)}
    >
      <Text className="summary-value traffic-difficulty-name">{getTrainingDifficultyLabel(value)}</Text>
      <Text className="summary-label traffic-difficulty-copy">{getDifficultyCopy(value)}</Text>
    </View>
  );

  const moveButton = (delta: number, label: string) => (
    <View
      className="traffic-move-button"
      onClick={() => {
        if (!selectedVehicle) {
          setFeedback("先选中一辆车。 ");
          return;
        }
        applyMove({ vehicleId: selectedVehicle.id, delta });
      }}
    >
      <Text className="traffic-move-button-text">{label}</Text>
    </View>
  );

  return (
    <View className="traffic-escape-page">
      {phase === "start" ? (
        <View className="traffic-start start-screen">
          <View className="header-section traffic-hero">
            <View className="traffic-hero-road traffic-hero-road-a" />
            <View className="traffic-hero-road traffic-hero-road-b" />
            <View className="logo-icon traffic-kicker"><Text className="logo-emoji">🚗</Text></View>
            <Text className="game-title traffic-title">车阵突围</Text>
            <Text className="game-subtitle traffic-subtitle">调度车流，为红车打开出口</Text>
            <View className="high-score-badge traffic-best-pill">
              <Text className="high-score-label traffic-best-label">当前难度最高</Text>
              <Text className="high-score-value traffic-best-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card traffic-panel traffic-rule-panel">
            <Text className="section-title traffic-section-title">游戏规则</Text>
            <Text className="rule-item traffic-rule">1. 车辆只能沿朝向直线移动，不能转弯。</Text>
            <Text className="rule-item traffic-rule">2. 点选车辆后，用方向键腾出红车前方道路。</Text>
            <Text className="rule-item traffic-rule">3. 红车抵达右侧出口即通关；少移动、少提示得分更高。</Text>
          </View>

          {!isGauntletPreset ? (
            <View className="summary-card traffic-panel">
              <Text className="section-title traffic-section-title">选择路线难度</Text>
              <View className="summary-grid traffic-difficulty-grid">
                {difficultyCard("normal")}
                {difficultyCard("hard")}
              </View>
            </View>
          ) : null}

          <View className="floating-start-action traffic-floating-start">
            <View className="primary-button traffic-primary-button" onClick={startGame}>
              <Text className="primary-button-text traffic-primary-button-text">开始调度</Text>
            </View>
          </View>
          <View className="floating-start-spacer traffic-floating-spacer" />
        </View>
      ) : null}

      {phase === "playing" && puzzle && trafficState ? (
        <View className="traffic-play">
          <View className="traffic-hud">
            <View>
              <Text className="traffic-hud-label">出口倒计时</Text>
              <Text className="traffic-hud-value">{elapsedSeconds}s</Text>
            </View>
            <View className="traffic-hud-divider" />
            <View>
              <Text className="traffic-hud-label">调度</Text>
              <Text className="traffic-hud-value">{trafficState.moveCount} 次</Text>
            </View>
            <View className="traffic-hud-divider" />
            <View>
              <Text className="traffic-hud-label">提示</Text>
              <Text className="traffic-hud-value">{hintCount}</Text>
            </View>
          </View>

          <View className="traffic-feedback-card">
            <Text className="traffic-feedback-title">{selectedVehicle ? `${selectedVehicle.isTarget ? "红车" : "已选车辆"} · 可向${selectedDirectionCopy}调度` : "选择一辆车开始"}</Text>
            <Text className="traffic-feedback-copy">{feedback}</Text>
          </View>

          <View className="traffic-board-shell">
            <View className="traffic-exit-sign"><Text className="traffic-exit-sign-text">EXIT →</Text></View>
            <View className="traffic-board" style={boardStyle}>
              {Array.from({ length: puzzle.size * puzzle.size }, (_, index) => (
                <View className="traffic-cell" key={index} />
              ))}
              {visibleVehicles.map(renderVehicle)}
            </View>
          </View>

          <View className="traffic-controls-card">
            <Text className="traffic-controls-label">移动已选车辆</Text>
            <View className="traffic-controls-row">
              {moveButton(-1, selectedVehicle?.orientation === "vertical" ? "↑ 上移" : "← 左移")}
              {moveButton(1, selectedVehicle?.orientation === "vertical" ? "↓ 下移" : "右移 →")}
            </View>
            <View className="traffic-secondary-button" onClick={useHint}>
              <Text className="traffic-secondary-button-text">给我一步提示（−4 分）</Text>
            </View>
          </View>
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="traffic-finish">
          <View className="traffic-finish-panel">
            <Text className="traffic-kicker">TRAFFIC CLEARED · {getTrainingDifficultyLabel(difficulty)}</Text>
            <Text className="traffic-finish-title">{isNewBest ? "路线纪录刷新" : "红车已驶离"}</Text>
            <Text className="traffic-finish-score">{finalScore}</Text>
            <Text className="traffic-finish-copy">获得 {awardedPoints} 宠物积分 · 调度 {trafficState?.moveCount ?? 0} 次 · 提示 {hintCount} 次</Text>
            <View className="traffic-finish-actions">
              <StickerShareButton gameTitle="车阵突围" score={finalScore} pagePath="pages/traffic-escape/index" isGauntlet={isGauntletPreset} />
              <View className="traffic-primary-button" onClick={startGame}>
                <Text className="traffic-primary-button-text">再闯一条路线</Text>
              </View>
              <View className="traffic-secondary-button" onClick={() => setPhase("start")}>
                <Text className="traffic-secondary-button-text">返回难度选择</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
