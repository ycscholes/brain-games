import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { shouldRedirectInvalidGameRun } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import { isGameGauntletRun } from "../../utils/gameGauntlet";
import {
  CIRCLE_RADIUS,
  CIRCLE_SIZE,
  buildCircles,
  MAX_TARGET_COUNT,
  PREVIEW_DURATION,
  SPEED_STEP,
  STORAGE_KEY_PREFIX,
  stepCircles,
  TRACKING_DURATION,
  type MovingCircle,
} from "./gameLogic";
import {
  abandonMultipleObjectTrackingRun,
  readMultipleObjectTrackingRun,
  settleMultipleObjectTrackingCompletion,
  updateMultipleObjectTrackingRun,
  type MultipleObjectTrackingRun,
  type MultipleObjectTrackingRunPayload,
} from "./run";
import "./index.scss";

const requestFrame = (callback: (time: number) => void): number => {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  return setTimeout(() => callback(Date.now()), 16) as unknown as number;
};

const cancelFrame = (frameId: number) => {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
  else clearTimeout(frameId as unknown as ReturnType<typeof setTimeout>);
};

export default function MultipleObjectTrackingPlay() {
  usePageShare("pages/multiple-object-tracking/index");
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const [run, setRun] = useState<MultipleObjectTrackingRun | null>(() =>
    readMultipleObjectTrackingRun(runId),
  );
  const routeRun = run;
  const runRef = useRef(run);
  const circlesRef = useRef<MovingCircle[]>(run?.payload.circles ?? []);
  const phaseRef = useRef(run?.payload.phase ?? "preview");
  const frameRef = useRef<number | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFrameTimeRef = useRef(0);
  const trackingStartedAtRef = useRef(0);
  const initializedRef = useRef(false);
  const finishedRef = useRef(false);
  const allowSettledRef = useRef(false);
  const [circles, setCircles] = useState<MovingCircle[]>(run?.payload.circles ?? []);

  useEffect(() => {
    runRef.current = run;
    if (run) {
      phaseRef.current = run.payload.phase;
      circlesRef.current = run.payload.circles;
    }
  }, [run]);

  useEffect(() => {
    if (
      shouldRedirectInvalidGameRun(runId, routeRun?.status, allowSettledRef.current) ||
      (routeRun && routeRun.status !== "active" && !allowSettledRef.current)
    ) {
      void Taro.redirectTo({ url: "/pages/multiple-object-tracking/index" });
    }
  }, [routeRun, runId]);

  const clearRoundRuntime = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (frameRef.current !== null) {
      cancelFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const persist = useCallback(
    (patch: Partial<MultipleObjectTrackingRunPayload>) => {
      if (!runRef.current) return null;
      const updated = updateMultipleObjectTrackingRun(runId, patch);
      if (!updated) return null;
      runRef.current = updated;
      phaseRef.current = updated.payload.phase;
      circlesRef.current = updated.payload.circles;
      setRun(updated);
      setCircles(updated.payload.circles);
      return updated;
    },
    [runId],
  );

  const stopTracking = useCallback(
    (nextCircles: MovingCircle[]) => {
      if (frameRef.current !== null) {
        cancelFrame(frameRef.current);
        frameRef.current = null;
      }
      lastFrameTimeRef.current = 0;
      trackingStartedAtRef.current = 0;
      const current = runRef.current;
      if (!current || current.status !== "active") return;
      persist({
        phase: "selecting",
        phaseStartedAt: Date.now(),
        circles: nextCircles,
        selectedIds: [],
        roundMessage: `请选择 ${current.payload.targetCount} 个你一直在追踪的目标圆圈`,
      });
    },
    [persist],
  );

  const startTracking = useCallback(
    (resume = false) => {
      const current = runRef.current;
      if (!current || current.status !== "active") return;
      if (!resume) {
        persist({
          phase: "tracking",
          phaseStartedAt: Date.now(),
          roundMessage: "所有圆圈将持续移动 5 秒，请保持专注",
        });
      }
      phaseRef.current = "tracking";
      lastFrameTimeRef.current = 0;
      trackingStartedAtRef.current = resume ? current.payload.phaseStartedAt : Date.now();

      const animate = (timestamp: number) => {
        if (phaseRef.current !== "tracking") return;
        if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp;
        const dt = Math.min((timestamp - lastFrameTimeRef.current) / 16.67, 1.8);
        lastFrameTimeRef.current = timestamp;
        const nextCircles = stepCircles(
          circlesRef.current,
          dt,
          runRef.current?.payload.boardSize ?? { width: 300, height: 222 },
        );
        circlesRef.current = nextCircles;
        setCircles(nextCircles);
        const elapsed = Date.now() - trackingStartedAtRef.current;
        const difficulty = runRef.current?.payload.difficulty ?? "normal";
        if (elapsed >= TRACKING_DURATION[difficulty]) {
          stopTracking(nextCircles);
          return;
        }
        frameRef.current = requestFrame(animate);
      };

      frameRef.current = requestFrame(animate);
    },
    [persist, stopTracking],
  );

  const schedulePreview = useCallback(
    (delay: number) => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(
        () => {
          previewTimerRef.current = null;
          startTracking();
        },
        Math.max(0, delay),
      );
    },
    [startTracking],
  );

  const startRound = useCallback(
    (nextTargetCount: number, nextSpeed: number, nextScore: number) => {
      clearRoundRuntime();
      const current = runRef.current;
      if (!current || current.status !== "active") return;
      const nextCircles = buildCircles(nextTargetCount, nextSpeed, current.payload.boardSize);
      persist({
        targetCount: nextTargetCount,
        speed: nextSpeed,
        score: nextScore,
        selectedIds: [],
        circles: nextCircles,
        phase: "preview",
        phaseStartedAt: Date.now(),
        roundMessage: "记住高亮的目标圆圈",
      });
      schedulePreview(PREVIEW_DURATION[current.payload.difficulty]);
    },
    [clearRoundRuntime, persist, schedulePreview],
  );

  useEffect(() => {
    if (initializedRef.current || !run || run.status !== "active") return;
    initializedRef.current = true;
    if (run.payload.phase === "preview") {
      const elapsed = Date.now() - run.payload.phaseStartedAt;
      schedulePreview(PREVIEW_DURATION[run.payload.difficulty] - elapsed);
    } else if (run.payload.phase === "tracking") {
      startTracking(true);
    }
  }, [run, schedulePreview, startTracking]);

  useEffect(() => () => clearRoundRuntime(), [clearRoundRuntime]);

  const toggleSelect = useCallback(
    (circleId: number) => {
      const current = runRef.current;
      if (!current || current.status !== "active" || current.payload.phase !== "selecting") return;
      const selectedIds = current.payload.selectedIds.includes(circleId)
        ? current.payload.selectedIds.filter((id) => id !== circleId)
        : current.payload.selectedIds.length >= current.payload.targetCount
          ? current.payload.selectedIds
          : [...current.payload.selectedIds, circleId];
      playTap();
      persist({ selectedIds });
    },
    [persist],
  );

  const finishGame = useCallback(
    (message: string) => {
      if (finishedRef.current) return;
      const current = runRef.current;
      if (!current || current.status !== "active") return;
      finishedRef.current = true;
      clearRoundRuntime();
      const prepared = persist({
        phase: "finished",
        phaseStartedAt: Date.now(),
        roundMessage: message,
      });
      if (!prepared) return;
      const result = {
        score: prepared.payload.score,
        awardedPoints: 0,
        durationSeconds: Math.max(1, Math.round((Date.now() - prepared.payload.startedAt) / 1000)),
        isNewBest: prepared.payload.isNewBest,
      };
      allowSettledRef.current = true;
      const settled = settleMultipleObjectTrackingCompletion(runId, result, {
        gameId: "multiple-object-tracking",
        score: result.score,
        durationSeconds: result.durationSeconds,
        difficulty: prepared.payload.difficulty,
        outcome: "completed",
      });
      if (!settled) return;
      playComplete();
      if (settled.settlement.gauntletHandled) return;
      if (result.isNewBest) {
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${prepared.payload.difficulty}`, result.score);
      }
      void Taro.redirectTo({
        url: `/pages/multiple-object-tracking/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [clearRoundRuntime, persist, runId],
  );

  const submitSelection = useCallback(() => {
    const current = runRef.current;
    if (!current || current.status !== "active" || current.payload.phase !== "selecting") return;
    if (current.payload.selectedIds.length !== current.payload.targetCount) return;
    const targetIds = circlesRef.current
      .filter((circle) => circle.isTarget)
      .map((circle) => circle.id);
    const targetSet = new Set(targetIds);
    const hitCount = current.payload.selectedIds.filter((id) => targetSet.has(id)).length;
    const allCorrect = hitCount === current.payload.targetCount;
    playTap();
    if (allCorrect) {
      playCorrect();
      const nextScore = current.payload.score + 1;
      const nextTargetCount = Math.min(MAX_TARGET_COUNT, current.payload.targetCount + 1);
      const nextSpeed = Number((current.payload.speed + SPEED_STEP).toFixed(2));
      const storedBest =
        Number(
          Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${current.payload.difficulty}`) ||
            (current.payload.difficulty === "normal" ? Taro.getStorageSync(STORAGE_KEY_PREFIX) : 0),
        ) || 0;
      const isNewBest = !isGameGauntletRun() && nextScore > storedBest;
      if (isNewBest) {
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${current.payload.difficulty}`, nextScore);
      }
      persist({ isNewBest: current.payload.isNewBest || isNewBest });
      startRound(nextTargetCount, nextSpeed, nextScore);
      return;
    }
    playWrong();
    finishGame("本轮未能完整锁定全部目标");
  }, [finishGame, persist, startRound]);

  const handleUnload = useCallback(() => {
    const current = runRef.current;
    if (!current || current.status !== "active" || finishedRef.current) return;
    clearRoundRuntime();
    abandonMultipleObjectTrackingRun(runId, {
      gameId: "multiple-object-tracking",
      score: current.payload.score,
      durationSeconds: Math.max(1, Math.round((Date.now() - current.payload.startedAt) / 1000)),
      difficulty: current.payload.difficulty,
      outcome: "interrupted",
    });
  }, [clearRoundRuntime, runId]);
  useUnload(handleUnload);

  if (!run || run.status !== "active") return null;
  const { payload } = run;
  const revealTargets = payload.phase === "preview" || payload.phase === "finished";

  return (
    <View className="mot-page">
      <View className="game-screen">
        <View className="status-row">
          <View className="status-card">
            <Text className="status-value">{payload.targetCount}</Text>
            <Text className="status-label">目标数量</Text>
          </View>
          <View className="status-card">
            <Text className="status-value">{payload.score}</Text>
            <Text className="status-label">连续得分</Text>
          </View>
          <View className="status-card">
            <Text className="status-value">
              {Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${payload.difficulty}`) || 0) || 0}
            </Text>
            <Text className="status-label">最佳分数</Text>
          </View>
        </View>

        <View className="phase-card">
          <Text className="phase-title">
            {payload.phase === "preview"
              ? "准备记忆"
              : payload.phase === "tracking"
                ? "追踪中"
                : "作答阶段"}
          </Text>
          <Text className="phase-desc">{payload.roundMessage}</Text>
          {payload.phase === "selecting" ? (
            <Text className="selection-tip">
              已选择 {payload.selectedIds.length} / {payload.targetCount}
            </Text>
          ) : null}
        </View>

        <View className="arena-card">
          <View
            className="arena"
            style={{
              width: `${payload.boardSize.width}px`,
              height: `${payload.boardSize.height}px`,
            }}
          >
            {circles.map((circle) => {
              const isSelected = payload.selectedIds.includes(circle.id);
              const isWrongPick = revealTargets && isSelected && !circle.isTarget;
              const classNames = [
                "circle",
                circle.isTarget && revealTargets ? "circle-target" : "",
                isSelected ? "circle-selected" : "",
                isWrongPick ? "circle-wrong" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <View
                  key={circle.id}
                  className={classNames}
                  style={{
                    width: `${CIRCLE_SIZE}px`,
                    height: `${CIRCLE_SIZE}px`,
                    transform: `translate3d(${circle.x - CIRCLE_RADIUS}px, ${circle.y - CIRCLE_RADIUS}px, 0)`,
                  }}
                  onClick={() => toggleSelect(circle.id)}
                >
                  <Text className="circle-text">
                    {payload.phase === "preview" && circle.isTarget ? "目" : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {payload.phase === "selecting" ? (
          <View className="action-row">
            <View
              className={`primary-button ${payload.selectedIds.length === payload.targetCount ? "" : "button-disabled"}`}
              onClick={submitSelection}
            >
              <Text className="button-text">提交选择</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
