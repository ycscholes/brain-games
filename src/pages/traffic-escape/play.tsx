import { useCallback, useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import { resolveTrafficVehicleAtlasUrl } from "../../config/remoteAssets";
import {
  abandonTrafficEscapeRun,
  readTrafficEscapeRun,
  settleTrafficEscapeCompletion,
  updateTrafficEscapeRun,
  type TrafficEscapeRun,
} from "./run";
import { usePageShare } from "../../utils/share";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import {
  applyTrafficEscapeMove,
  getTrafficEscapeHint,
  isTrafficEscapeSolved,
  scoreTrafficEscapeGame,
  type TrafficEscapeMove,
  type TrafficVehicle,
} from "./gameLogic";
import {
  getTrafficVehicleAtlasClassName,
  getTrafficVehicleAtlasCropStyle,
  getTrafficVehicleAtlasMaskStyle,
} from "./vehicleAtlas";
import "./index.scss";

const STORAGE_KEY_PREFIX = "traffic_escape_best";

export default function TrafficEscapePlay() {
  usePageShare("pages/traffic-escape/index");
  const params = getCurrentInstance().router?.params ?? {};
  const runId = typeof params.runId === "string" ? params.runId : "";
  const [run, setRun] = useState<TrafficEscapeRun | null>(() => readTrafficEscapeRun(runId));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [feedback, setFeedback] = useState("红车驶向右侧出口。先腾出它前方的车道。");
  const [vehicleAtlasUrl, setVehicleAtlasUrl] = useState("");

  useEffect(() => {
    if (!run || run.status !== "active")
      void Taro.redirectTo({ url: "/pages/traffic-escape/index" });
  }, [run]);
  useEffect(() => {
    let active = true;
    void resolveTrafficVehicleAtlasUrl()
      .then((url) => {
        if (active) setVehicleAtlasUrl(url);
      })
      .catch(() => {
        if (active) setVehicleAtlasUrl("");
      });
    return () => {
      active = false;
    };
  }, []);
  const runStartedAt = run?.payload.startedAt;
  const runStatus = run?.status;

  useEffect(() => {
    if (!runStartedAt || runStatus !== "active") return undefined;
    const timer = setInterval(
      () => setElapsedSeconds(Math.max(1, Math.floor((Date.now() - runStartedAt) / 1000))),
      1_000,
    );
    return () => clearInterval(timer);
  }, [runStartedAt, runStatus]);

  const finishGame = useCallback(
    (nextRun: TrafficEscapeRun, nextHints: number) => {
      const { payload } = nextRun;
      const durationSeconds = Math.max(1, Math.round((Date.now() - payload.startedAt) / 1_000));
      const score = scoreTrafficEscapeGame({
        difficulty: payload.difficulty,
        elapsedSeconds: durationSeconds,
        moveCount: payload.trafficState.moveCount,
        hintCount: nextHints,
        completed: true,
      });
      const best =
        Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${payload.difficulty}`) || 0) || 0;
      const settled = settleTrafficEscapeCompletion(
        runId,
        {
          score,
          awardedPoints: 0,
          durationSeconds,
          moveCount: payload.trafficState.moveCount,
          hintCount: nextHints,
          isNewBest: score > best,
        },
        {
          gameId: "traffic-escape",
          score,
          durationSeconds,
          difficulty: payload.difficulty,
          outcome: "completed",
        },
      );
      if (!settled) return;
      playComplete();
      if (settled.settlement.gauntletHandled) return;
      if (score > best) Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${payload.difficulty}`, score);
      void Taro.redirectTo({
        url: `/pages/traffic-escape/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [runId],
  );

  const applyMove = useCallback(
    (move: TrafficEscapeMove, usedHint = false) => {
      if (!run || run.status !== "active") return;
      const result = applyTrafficEscapeMove(run.payload.puzzle, run.payload.trafficState, move);
      playTap();
      if (!result.moved) {
        playWrong();
        setFeedback("这边被其他车辆堵住了，换个方向试试。");
        return;
      }
      const hintCount = run.payload.hintCount + (usedHint ? 1 : 0);
      const updated = updateTrafficEscapeRun(runId, {
        trafficState: result.state,
        hintMove: null,
        hintCount,
      });
      if (!updated) return;
      playCorrect();
      setRun(updated);
      setFeedback(
        usedHint ? "提示已完成一步调度。继续为红车让路。" : "调度成功，继续观察出口通道。",
      );
      if (isTrafficEscapeSolved(updated.payload.puzzle, result.state))
        finishGame(updated, hintCount);
    },
    [finishGame, run, runId],
  );

  const backToStart = useCallback(() => {
    if (!run || run.status !== "active") return;
    const durationSeconds = Math.max(1, Math.round((Date.now() - run.payload.startedAt) / 1_000));
    const settlement = abandonTrafficEscapeRun(runId, {
      gameId: "traffic-escape",
      score: 0,
      durationSeconds,
      difficulty: run.payload.difficulty,
      outcome: "interrupted",
    });
    if (!settlement || settlement.gauntletHandled) return;
    void Taro.navigateBack();
  }, [run, runId]);

  if (!run || run.status !== "active") return null;
  const { payload } = run;
  const selectedVehicle =
    payload.trafficState.vehicles.find((vehicle) => vehicle.id === payload.selectedVehicleId) ??
    null;
  const moveButton = (delta: number, label: string) => (
    <View
      className="traffic-move-button"
      onClick={() => {
        if (!selectedVehicle) {
          setFeedback("先选中一辆车。");
          return;
        }
        applyMove({ vehicleId: selectedVehicle.id, delta });
      }}
    >
      <Text className="traffic-move-button-text">{label}</Text>
    </View>
  );
  const renderVehicle = (vehicle: TrafficVehicle) => {
    const selected = vehicle.id === payload.selectedVehicleId;
    const appearance = vehicle.appearance ?? "sport";
    const className = getTrafficVehicleAtlasClassName(
      appearance,
      vehicle.length,
      vehicle.orientation,
      selected,
    );
    return (
      <View
        key={vehicle.id}
        className={`traffic-vehicle ${vehicleAtlasUrl ? "traffic-vehicle-has-atlas" : ""} ${selected ? "traffic-vehicle-selected" : ""}`}
        style={{
          gridColumn: `${vehicle.col + 1} / span ${vehicle.orientation === "horizontal" ? vehicle.length : 1}`,
          gridRow: `${vehicle.row + 1} / span ${vehicle.orientation === "horizontal" ? 1 : vehicle.length}`,
        }}
        onClick={() => {
          const updated = updateTrafficEscapeRun(runId, {
            selectedVehicleId: vehicle.id,
            hintMove: null,
          });
          if (updated) setRun(updated);
        }}
      >
        {vehicleAtlasUrl ? (
          <View
            className={`traffic-vehicle-atlas-mask ${className}`}
            style={getTrafficVehicleAtlasMaskStyle(appearance, vehicle.length, vehicleAtlasUrl)}
          />
        ) : null}
        {vehicleAtlasUrl ? (
          <View
            className={`traffic-vehicle-atlas-viewport ${className}`}
            style={getTrafficVehicleAtlasCropStyle(appearance, vehicle.length, vehicleAtlasUrl)}
          />
        ) : null}
        {vehicle.isTarget ? <Text className="traffic-vehicle-mark">出</Text> : null}
      </View>
    );
  };
  return (
    <View className="traffic-escape-page">
      <View className="traffic-play">
        <View className="traffic-hud">
          <View>
            <Text className="traffic-hud-label">出口倒计时</Text>
            <Text className="traffic-hud-value">{elapsedSeconds}s</Text>
          </View>
          <View className="traffic-hud-divider" />
          <View>
            <Text className="traffic-hud-label">调度</Text>
            <Text className="traffic-hud-value">{payload.trafficState.moveCount} 次</Text>
          </View>
          <View className="traffic-hud-divider" />
          <View>
            <Text className="traffic-hud-label">提示</Text>
            <Text className="traffic-hud-value">{payload.hintCount}</Text>
          </View>
          <View className="traffic-hud-divider" />
          <View onClick={backToStart}>
            <Text className="traffic-hud-label">返回</Text>
            <Text className="traffic-hud-value">‹</Text>
          </View>
        </View>
        <View className="traffic-feedback-card">
          <Text className="traffic-feedback-title">
            {selectedVehicle
              ? `${selectedVehicle.isTarget ? "红车" : "已选车辆"} · 可向${selectedVehicle.orientation === "vertical" ? "上 / 下" : "左 / 右"}调度`
              : "选择一辆车开始"}
          </Text>
          <Text className="traffic-feedback-copy">{feedback}</Text>
        </View>
        <View className="traffic-board-shell">
          <View className="traffic-exit-sign">
            <Text className="traffic-exit-sign-text">EXIT →</Text>
          </View>
          <View
            className="traffic-board"
            style={{
              gridTemplateColumns: `repeat(${payload.puzzle.size}, 1fr)`,
              gridTemplateRows: `repeat(${payload.puzzle.size}, 1fr)`,
            }}
          >
            {Array.from({ length: payload.puzzle.size * payload.puzzle.size }, (_, index) => (
              <View className="traffic-cell" key={index} />
            ))}
            {payload.trafficState.vehicles.map(renderVehicle)}
          </View>
        </View>
        <View className="traffic-controls-card">
          <Text className="traffic-controls-label">移动已选车辆</Text>
          <View className="traffic-controls-row">
            {moveButton(-1, selectedVehicle?.orientation === "vertical" ? "↑ 上移" : "← 左移")}
            {moveButton(1, selectedVehicle?.orientation === "vertical" ? "↓ 下移" : "右移 →")}
          </View>
          <View
            className="traffic-secondary-button"
            onClick={() => {
              const hint = getTrafficEscapeHint(payload.puzzle, payload.trafficState);
              if (hint) applyMove(hint, true);
              else setFeedback("出口已经打开，试着把红车驶向右侧。");
            }}
          >
            <Text className="traffic-secondary-button-text">给我一步提示（−4 分）</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
