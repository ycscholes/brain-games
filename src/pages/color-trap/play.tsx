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
  COLOR_TRAP_TOTAL_QUESTIONS,
  scoreColorTrapQuestion,
  type ColorTrapColorId,
  type ColorTrapQuestion,
} from "./gameLogic";
import {
  abandonColorTrapRun,
  readColorTrapRun,
  settleColorTrapCompletion,
  updateColorTrapRun,
  type ColorTrapRun,
  type ColorTrapRunState,
} from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "color_trap_best";
const FEEDBACK_MS = 760;

export default function ColorTrapPlay() {
  usePageShare("pages/color-trap/index");
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const [run, setRun] = useState<ColorTrapRun | null>(() => readColorTrapRun(runId));
  const runRef = useRef(run);
  const stateRef = useRef(run?.payload.state ?? null);
  const finishedRef = useRef(false);
  const initializedRef = useRef(false);
  const answeredRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const submitAnswerRef = useRef<
    (colorId: ColorTrapColorId | "", question?: ColorTrapQuestion, timedOut?: boolean) => void
  >(() => undefined);
  const beginQuestionRef = useRef<(questionIndex: number) => void>(() => undefined);

  useEffect(() => {
    runRef.current = run;
    stateRef.current = run?.payload.state ?? null;
  }, [run]);

  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, run?.status))
      void Taro.redirectTo({ url: "/pages/color-trap/index" });
  }, [run, runId]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    timersRef.current.push(setTimeout(callback, delay));
  }, []);

  const persist = useCallback(
    (nextState: ColorTrapRunState) => {
      if (!runRef.current) return null;
      const updated = updateColorTrapRun(runId, { state: nextState });
      if (updated) {
        runRef.current = updated;
        stateRef.current = nextState;
        setRun(updated);
      }
      return updated;
    },
    [runId],
  );

  const finishGame = useCallback(
    (finalState: ColorTrapRunState) => {
      if (finishedRef.current || !runRef.current) return;
      finishedRef.current = true;
      clearTimers();
      const activeRun = runRef.current;
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - activeRun.payload.startedAt) / 1000),
      );
      const best =
        Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${activeRun.payload.difficulty}`) || 0) ||
        0;
      const result = {
        score: finalState.score,
        awardedPoints: 0,
        durationSeconds,
        correctQuestions: finalState.correctQuestions,
        totalQuestions: COLOR_TRAP_TOTAL_QUESTIONS,
        bestCombo: finalState.bestCombo,
        isNewBest: finalState.score > best,
      };
      const settled = settleColorTrapCompletion(runId, result, {
        gameId: "color-trap",
        score: result.score,
        durationSeconds,
        difficulty: activeRun.payload.difficulty,
        outcome: "completed",
      });
      if (!settled) return;
      playComplete();
      if (settled.settlement.gauntletHandled) return;
      if (result.isNewBest)
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${activeRun.payload.difficulty}`, result.score);
      void Taro.redirectTo({ url: `/pages/color-trap/result?runId=${encodeURIComponent(runId)}` });
    },
    [clearTimers, runId],
  );

  const submitAnswer = useCallback(
    (colorId: ColorTrapColorId | "", question?: ColorTrapQuestion, timedOut = false) => {
      const currentRun = runRef.current;
      const currentState = stateRef.current;
      const currentQuestion = question ?? currentState?.questions[currentState.currentIndex];
      if (
        !currentRun ||
        currentRun.status !== "active" ||
        !currentState ||
        currentState.phase !== "playing" ||
        !currentQuestion ||
        answeredRef.current
      )
        return;
      answeredRef.current = true;
      clearTimers();
      const result = scoreColorTrapQuestion({
        selectedColorId: timedOut ? "" : colorId,
        correctColorId: currentQuestion.answer,
        answerMs: Date.now() - currentState.questionStartedAt,
        currentCombo: currentState.combo,
      });
      if (!timedOut) {
        playTap();
        result.correct ? playCorrect() : playWrong();
      }
      const nextState: ColorTrapRunState = {
        ...currentState,
        phase: "feedback",
        selectedColorId: timedOut ? "" : colorId,
        lastResult: result,
        score: currentState.score + result.score,
        combo: result.correct ? currentState.combo + 1 : 0,
        bestCombo: Math.max(currentState.bestCombo, result.correct ? currentState.combo + 1 : 0),
        correctQuestions: currentState.correctQuestions + (result.correct ? 1 : 0),
      };
      persist(nextState);
      schedule(() => {
        if (nextState.currentIndex >= COLOR_TRAP_TOTAL_QUESTIONS - 1) {
          finishGame(nextState);
        } else {
          beginQuestionRef.current(nextState.currentIndex + 1);
        }
      }, FEEDBACK_MS);
    },
    [clearTimers, finishGame, persist, schedule],
  );
  submitAnswerRef.current = submitAnswer;

  const beginQuestion = useCallback(
    (questionIndex: number) => {
      const currentRun = runRef.current;
      const currentState = stateRef.current;
      if (!currentRun || currentRun.status !== "active" || !currentState) return;
      clearTimers();
      const question = currentState.questions[questionIndex];
      if (!question) return;
      answeredRef.current = false;
      const nextState: ColorTrapRunState = {
        ...currentState,
        phase: "playing",
        currentIndex: questionIndex,
        selectedColorId: "",
        lastResult: null,
        questionStartedAt: Date.now(),
      };
      persist(nextState);
      schedule(() => submitAnswerRef.current("", question, true), question.timeLimitMs);
    },
    [clearTimers, persist, schedule],
  );
  beginQuestionRef.current = beginQuestion;

  useEffect(() => {
    if (!initializedRef.current && run?.status === "active") {
      initializedRef.current = true;
      beginQuestionRef.current(run.payload.state.currentIndex);
    }
  }, [run]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const handleUnload = useCallback(() => {
    const activeRun = runRef.current;
    if (!activeRun || activeRun.status !== "active" || finishedRef.current) return;
    clearTimers();
    abandonColorTrapRun(runId, {
      gameId: "color-trap",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - activeRun.payload.startedAt) / 1000)),
      difficulty: activeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [clearTimers, runId]);
  useUnload(handleUnload);

  if (!run || run.status !== "active") return null;
  const state = run.payload.state;
  const currentQuestion = state.questions[state.currentIndex];
  if (!currentQuestion) return null;
  return (
    <View className="color-trap-page">
      <View className="trap-play">
        <View className="status-row">
          <View className="status-card">
            <Text className="status-value">
              {state.currentIndex + 1}/{COLOR_TRAP_TOTAL_QUESTIONS}
            </Text>
            <Text className="status-label">题目</Text>
          </View>
          <View className="status-card">
            <Text className="status-value">{state.score}</Text>
            <Text className="status-label">得分</Text>
          </View>
          <View className="status-card">
            <Text className="status-value">{state.combo}</Text>
            <Text className="status-label">连击</Text>
          </View>
        </View>
        <View className="stimulus-card">
          <Text className="question-kicker">
            {currentQuestion.rule === "ink" ? "选择字体颜色" : "选择文字含义"}
          </Text>
          <Text className="color-word" style={{ color: currentQuestion.inkColor.hex }}>
            {currentQuestion.wordColor.label}
          </Text>
          <Text className="stimulus-copy">
            {currentQuestion.rule === "ink"
              ? "忽略字的意思，只看它显示成什么颜色"
              : "忽略显示颜色，只看这个字写的是什么"}
          </Text>
        </View>
        <View className="option-grid">
          {currentQuestion.options.map((option) => {
            const isSelected = state.selectedColorId === option.id;
            const isAnswer = state.phase === "feedback" && option.id === currentQuestion.answer;
            return (
              <View
                key={option.id}
                className={`option-card ${isSelected ? "option-selected" : ""} ${isAnswer ? "option-answer" : ""}`}
                onClick={() => submitAnswer(option.id)}
              >
                <View className="option-swatch" style={{ backgroundColor: option.hex }} />
                <Text className="option-text">{option.label}</Text>
              </View>
            );
          })}
        </View>
        {state.phase === "feedback" ? (
          <View
            className={`feedback-card ${state.lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}
          >
            <Text className="feedback-title">
              {state.lastResult?.correct ? "判断正确" : "正确答案"}
            </Text>
            <Text className="feedback-copy">
              {
                currentQuestion.options.find((option) => option.id === currentQuestion.answer)
                  ?.label
              }
              色 · 本题 +{state.lastResult?.score ?? 0}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
