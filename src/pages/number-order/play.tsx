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
  getRouteValues,
  isCorrectPathPrefix,
  NUMBER_ORDER_TOTAL_QUESTIONS,
  scoreNumberOrderQuestion,
  type NumberOrderQuestion,
} from "./gameLogic";
import {
  abandonNumberOrderRun,
  readNumberOrderRun,
  settleNumberOrderCompletion,
  updateNumberOrderRun,
  type NumberOrderRun,
  type NumberOrderRunPayload,
} from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "number_order_best";
const READY_MS = 520;
const FEEDBACK_MS = 1500;
const PLAYBACK_END_PAUSE_MS = 260;

export default function NumberOrderPlay() {
  usePageShare("pages/number-order/index");
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const [run, setRun] = useState<NumberOrderRun | null>(() => readNumberOrderRun(runId));
  const runRef = useRef(run);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const initializedRef = useRef(false);
  const finishedRef = useRef(false);
  const allowSettledRef = useRef(false);

  useEffect(() => {
    runRef.current = run;
  }, [run]);
  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, run?.status, allowSettledRef.current))
      void Taro.redirectTo({ url: "/pages/number-order/index" });
  }, [run, runId]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);
  const schedule = useCallback((callback: () => void, delay: number) => {
    timersRef.current.push(setTimeout(callback, delay));
  }, []);
  const persist = useCallback(
    (patch: Partial<NumberOrderRunPayload>) => {
      const current = runRef.current;
      if (!current) return null;
      const updated = updateNumberOrderRun(runId, patch);
      if (updated) {
        runRef.current = updated;
        setRun(updated);
      }
      return updated;
    },
    [runId],
  );

  const scheduleEchoPlayback = useCallback(
    (question: NumberOrderQuestion) => {
      question.answerIds.forEach((_, index) => {
        schedule(() => {
          const current = runRef.current;
          if (!current || current.status !== "active") return;
          persist({ phase: "revealing", activeEchoIndex: index });
        }, question.playbackIntervalMs * index);
      });
      schedule(() => {
        const current = runRef.current;
        if (!current || current.status !== "active") return;
        persist({ phase: "answering", activeEchoIndex: -1 });
      }, question.revealMs + PLAYBACK_END_PAUSE_MS);
    },
    [persist, schedule],
  );

  const beginQuestionRef = useRef<(questionIndex: number) => void>(() => undefined);
  const finishGame = useCallback(
    (finalState: NumberOrderRunPayload) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearTimers();
      const best =
        Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${finalState.difficulty}`) || 0) || 0;
      const durationSeconds = Math.max(1, Math.round((Date.now() - finalState.startedAt) / 1000));
      const result = {
        score: finalState.score,
        awardedPoints: 0,
        durationSeconds,
        correctQuestions: finalState.correctQuestions,
        bestCombo: finalState.bestCombo,
        isNewBest: finalState.score > best,
      };
      allowSettledRef.current = true;
      const settled = settleNumberOrderCompletion(runId, result, {
        gameId: "number-order",
        score: result.score,
        durationSeconds,
        difficulty: finalState.difficulty,
        outcome: "completed",
      });
      if (!settled) return;
      playComplete();
      if (settled.settlement.gauntletHandled) return;
      if (result.isNewBest)
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${finalState.difficulty}`, result.score);
      void Taro.redirectTo({
        url: `/pages/number-order/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [clearTimers, runId],
  );

  const settleQuestionRef = useRef<(nextTappedIds: string[]) => void>(() => undefined);
  const beginQuestion = useCallback(
    (questionIndex: number) => {
      const current = runRef.current;
      if (!current || current.status !== "active") return;
      const question = current.payload.questions[questionIndex];
      if (!question) return;
      clearTimers();
      persist({
        currentIndex: questionIndex,
        tappedIds: [],
        lastResult: null,
        activeEchoIndex: -1,
        phase: "ready",
      });
      schedule(() => {
        const latest = runRef.current;
        if (!latest || latest.status !== "active") return;
        persist({ phase: "revealing", activeEchoIndex: -1 });
        scheduleEchoPlayback(question);
      }, READY_MS);
    },
    [clearTimers, persist, schedule, scheduleEchoPlayback],
  );
  beginQuestionRef.current = beginQuestion;

  const settleQuestion = useCallback(
    (nextTappedIds: string[]) => {
      const current = runRef.current;
      if (!current || current.status !== "active" || current.payload.phase !== "answering") return;
      const question = current.payload.questions[current.payload.currentIndex];
      if (!question) return;
      const result = scoreNumberOrderQuestion({
        question,
        tappedIds: nextTappedIds,
        currentCombo: current.payload.combo,
      });
      result.allCorrect ? playCorrect() : playWrong();
      const nextState: NumberOrderRunPayload = {
        ...current.payload,
        tappedIds: nextTappedIds,
        lastResult: result,
        score: current.payload.score + result.score,
        combo: result.allCorrect ? current.payload.combo + 1 : 0,
        bestCombo: Math.max(
          current.payload.bestCombo,
          result.allCorrect ? current.payload.combo + 1 : 0,
        ),
        correctQuestions: current.payload.correctQuestions + (result.allCorrect ? 1 : 0),
        activeEchoIndex: -1,
        phase: "feedback",
      };
      const updated = persist(nextState);
      if (!updated) return;
      clearTimers();
      schedule(() => {
        const latest = runRef.current;
        if (!latest || latest.status !== "active") return;
        if (latest.payload.currentIndex >= NUMBER_ORDER_TOTAL_QUESTIONS - 1)
          finishGame(latest.payload);
        else beginQuestionRef.current(latest.payload.currentIndex + 1);
      }, FEEDBACK_MS);
    },
    [clearTimers, finishGame, persist, schedule],
  );
  settleQuestionRef.current = settleQuestion;

  useEffect(() => {
    if (!initializedRef.current && run?.status === "active") {
      initializedRef.current = true;
      beginQuestionRef.current(run.payload.currentIndex);
    }
  }, [run]);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const handlePointTap = useCallback(
    (pointId: string) => {
      const current = runRef.current;
      if (!current || current.status !== "active" || current.payload.phase !== "answering") return;
      const question = current.payload.questions[current.payload.currentIndex];
      if (!question || current.payload.tappedIds.includes(pointId)) return;
      playTap();
      const nextTappedIds = [...current.payload.tappedIds, pointId];
      persist({ tappedIds: nextTappedIds });
      if (
        !isCorrectPathPrefix(question, nextTappedIds) ||
        nextTappedIds.length === question.answerIds.length
      )
        settleQuestionRef.current(nextTappedIds);
    },
    [persist],
  );

  const backToStart = useCallback(() => {
    const current = runRef.current;
    if (!current || current.status !== "active") return;
    clearTimers();
    const settlement = abandonNumberOrderRun(runId, {
      gameId: "number-order",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - current.payload.startedAt) / 1000)),
      difficulty: current.payload.difficulty,
      outcome: "interrupted",
    });
    if (!settlement) return;
    void Taro.navigateBack().catch(() => Taro.redirectTo({ url: "/pages/number-order/index" }));
  }, [clearTimers, runId]);
  useUnload(backToStart);

  const renderRouteSegment = (
    fromPoint: NumberOrderQuestion["points"][number] | undefined,
    toPoint: NumberOrderQuestion["points"][number] | undefined,
    className: string,
    key: string,
  ) => {
    if (!fromPoint || !toPoint) return null;
    const deltaX = toPoint.x - fromPoint.x;
    const deltaY = toPoint.y - fromPoint.y;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
    return (
      <View
        key={key}
        className={className}
        style={{
          left: `${fromPoint.x}%`,
          top: `${fromPoint.y}%`,
          width: `${length}%`,
          transform: `rotate(${angle}deg)`,
        }}
      />
    );
  };

  if (!run || run.status !== "active") return null;
  const { payload } = run;
  const currentQuestion = payload.questions[payload.currentIndex];
  if (!currentQuestion) return null;
  const answerProgress = `${Math.min(payload.tappedIds.length + 1, currentQuestion.answerIds.length)}/${currentQuestion.answerIds.length}`;
  const routeValues = getRouteValues(currentQuestion);
  const routeValueText = routeValues.join(" -> ");
  return (
    <View className="number-order-page">
      <View className="play-screen">
        <View className="status-row">
          <View className="status-card">
            <Text className="status-value">
              {payload.currentIndex + 1}/{NUMBER_ORDER_TOTAL_QUESTIONS}
            </Text>
            <Text className="status-label">题目</Text>
          </View>
          <View className="status-card">
            <Text className="status-value">{payload.score}</Text>
            <Text className="status-label">得分</Text>
          </View>
          <View className="status-card">
            <Text className="status-value">{payload.combo}</Text>
            <Text className="status-label">连击</Text>
          </View>
        </View>
        <View className="prompt-card">
          <Text className="prompt-title">
            {payload.phase === "ready"
              ? "准备聆听回响"
              : payload.phase === "revealing"
                ? `记住第 ${Math.max(payload.activeEchoIndex + 1, 1)}/${currentQuestion.answerIds.length} 颗星`
                : payload.phase === "answering"
                  ? `点亮第 ${answerProgress} 颗星`
                  : payload.lastResult?.allCorrect
                    ? "星链复现完成"
                    : "星链回放"}
          </Text>
          <Text className="prompt-copy">
            {payload.phase === "answering"
              ? "沿着刚才的闪现顺序连回星链"
              : payload.phase === "feedback"
                ? `${currentQuestion.replayText} · 本题 +${payload.lastResult?.score ?? 0}`
                : "保持专注，星点会依次发光"}
          </Text>
        </View>
        <View className={`star-board star-board-${payload.phase}`}>
          {payload.phase === "revealing" && payload.activeEchoIndex > 0
            ? currentQuestion.answerIds
                .slice(1, payload.activeEchoIndex + 1)
                .map((pointId, index) =>
                  renderRouteSegment(
                    currentQuestion.points.find(
                      (point) => point.id === currentQuestion.answerIds[index],
                    ),
                    currentQuestion.points.find((point) => point.id === pointId),
                    "route-segment route-segment-echo",
                    `echo-${currentQuestion.answerIds[index]}-${pointId}`,
                  ),
                )
            : null}
          {payload.tappedIds.slice(1).map((pointId, index) =>
            renderRouteSegment(
              currentQuestion.points.find((point) => point.id === payload.tappedIds[index]),
              currentQuestion.points.find((point) => point.id === pointId),
              "route-segment route-segment-player",
              `${payload.tappedIds[index]}-${pointId}`,
            ),
          )}
          {payload.phase === "feedback"
            ? currentQuestion.answerIds.slice(1).map((pointId, index) =>
                renderRouteSegment(
                  currentQuestion.points.find(
                    (point) => point.id === currentQuestion.answerIds[index],
                  ),
                  currentQuestion.points.find((point) => point.id === pointId),
                  "route-segment route-segment-answer",
                  `answer-${currentQuestion.answerIds[index]}-${pointId}`,
                ),
              )
            : null}
          {currentQuestion.points.map((point) => {
            const tapped = payload.tappedIds.includes(point.id);
            const expectedPrefix = currentQuestion.answerIds.slice(0, payload.tappedIds.length);
            const wrongTap =
              payload.phase === "feedback" && tapped && !expectedPrefix.includes(point.id);
            const activeEchoId =
              payload.activeEchoIndex >= 0
                ? currentQuestion.answerIds[payload.activeEchoIndex]
                : "";
            const activeEcho = payload.phase === "revealing" && activeEchoId === point.id;
            const answerRank = currentQuestion.answerIds.indexOf(point.id);
            const shouldShowValue = payload.phase === "feedback";
            return (
              <View
                key={point.id}
                className={`star-node star-node-${point.colorGroup} star-node-${point.brightness} ${tapped ? "star-node-tapped" : ""} ${wrongTap ? "star-node-wrong" : ""} ${activeEcho ? "star-node-echo-active" : ""}`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                onClick={() => handlePointTap(point.id)}
              >
                <Text className="star-node-text">
                  {shouldShowValue && answerRank >= 0
                    ? answerRank + 1
                    : tapped
                      ? "✓"
                      : activeEcho
                        ? "•"
                        : ""}
                </Text>
              </View>
            );
          })}
          <View className="star-board-grid" />
        </View>
        {payload.phase === "feedback" ? (
          <View className="route-replay-card">
            <Text className="route-replay-label">正确星路</Text>
            <Text className="route-replay-values">{routeValueText}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
