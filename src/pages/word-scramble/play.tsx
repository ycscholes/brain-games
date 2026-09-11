import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  scoreWordScrambleQuestion,
  WORD_SCRAMBLE_TOTAL_QUESTIONS,
  type WordScrambleQuestion,
} from "./gameLogic";
import {
  abandonWordScrambleRun,
  readWordScrambleRun,
  settleWordScrambleCompletion,
  updateWordScrambleRun,
  type WordScrambleRun,
  type WordScrambleRunState,
} from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "word_scramble_best";
const FEEDBACK_MS = 850;

export default function WordScramblePlay() {
  usePageShare("pages/word-scramble/index");
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const [run, setRun] = useState<WordScrambleRun | null>(() => readWordScrambleRun(runId));
  const runRef = useRef(run);
  const stateRef = useRef(run?.payload.state ?? null);
  const finishedRef = useRef(false);
  const initializedRef = useRef(false);
  const answeredRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const submitAnswerRef = useRef<
    (word: string, question?: WordScrambleQuestion, timedOut?: boolean) => void
  >(() => undefined);
  const beginQuestionRef = useRef<(questionIndex: number) => void>(() => undefined);
  useEffect(() => {
    runRef.current = run;
    stateRef.current = run?.payload.state ?? null;
  }, [run]);
  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, run?.status))
      void Taro.redirectTo({ url: "/pages/word-scramble/index" });
  }, [run, runId]);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);
  const schedule = useCallback((callback: () => void, delay: number) => {
    timersRef.current.push(setTimeout(callback, delay));
  }, []);
  const persist = useCallback(
    (nextState: WordScrambleRunState) => {
      if (!runRef.current) return null;
      const updated = updateWordScrambleRun(runId, { state: nextState });
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
    (finalState: WordScrambleRunState) => {
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
        totalQuestions: WORD_SCRAMBLE_TOTAL_QUESTIONS,
        bestCombo: finalState.bestCombo,
        isNewBest: finalState.score > best,
      };
      const settled = settleWordScrambleCompletion(runId, result, {
        gameId: "word-scramble",
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
      void Taro.redirectTo({
        url: `/pages/word-scramble/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [clearTimers, runId],
  );
  const submitAnswer = useCallback(
    (word: string, question?: WordScrambleQuestion, timedOut = false) => {
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
      const result = scoreWordScrambleQuestion({
        selectedWord: timedOut ? "" : word,
        correctWord: currentQuestion.target.word,
        answerMs: Date.now() - currentState.questionStartedAt,
        currentCombo: currentState.combo,
      });
      if (!timedOut) {
        playTap();
        result.correct ? playCorrect() : playWrong();
      }
      const nextCombo = result.correct ? currentState.combo + 1 : 0;
      const nextState: WordScrambleRunState = {
        ...currentState,
        phase: "feedback",
        selectedWord: timedOut ? "超时" : word,
        lastResult: result,
        score: currentState.score + result.score,
        combo: nextCombo,
        bestCombo: Math.max(currentState.bestCombo, nextCombo),
        correctQuestions: currentState.correctQuestions + (result.correct ? 1 : 0),
      };
      persist(nextState);
      schedule(
        () =>
          nextState.currentIndex >= WORD_SCRAMBLE_TOTAL_QUESTIONS - 1
            ? finishGame(nextState)
            : beginQuestionRef.current(nextState.currentIndex + 1),
        FEEDBACK_MS,
      );
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
      const nextState: WordScrambleRunState = {
        ...currentState,
        phase: "playing",
        currentIndex: questionIndex,
        selectedWord: "",
        selectedCharIds: [],
        isHintVisible: false,
        lastResult: null,
        questionStartedAt: Date.now(),
      };
      persist(nextState);
      schedule(() => {
        const latest = stateRef.current;
        if (latest?.phase === "playing") persist({ ...latest, isHintVisible: true });
      }, question.hintDelayMs);
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
  const handleCharTap = useCallback(
    (choiceId: string) => {
      const currentRun = runRef.current;
      const currentState = stateRef.current;
      const question = currentState?.questions[currentState.currentIndex];
      if (
        !currentRun ||
        !currentState ||
        currentState.phase !== "playing" ||
        !question ||
        currentState.selectedWord ||
        currentState.selectedCharIds.includes(choiceId) ||
        currentState.selectedCharIds.length >= question.target.word.length
      )
        return;
      const nextSelectedCharIds = [...currentState.selectedCharIds, choiceId];
      const nextWord = nextSelectedCharIds
        .map((id) => question.charChoices.find((choice) => choice.id === id)?.char || "")
        .join("");
      const nextState = { ...currentState, selectedCharIds: nextSelectedCharIds };
      persist(nextState);
      if (nextWord.length >= question.target.word.length)
        schedule(() => submitAnswerRef.current(nextWord, question), 120);
    },
    [persist, schedule],
  );
  const undoChar = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.phase !== "playing" || current.selectedWord) return;
    persist({ ...current, selectedCharIds: current.selectedCharIds.slice(0, -1) });
  }, [persist]);
  const clearSelection = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.phase !== "playing" || current.selectedWord) return;
    persist({ ...current, selectedCharIds: [] });
  }, [persist]);
  const handleUnload = useCallback(() => {
    const activeRun = runRef.current;
    if (!activeRun || activeRun.status !== "active" || finishedRef.current) return;
    clearTimers();
    abandonWordScrambleRun(runId, {
      gameId: "word-scramble",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - activeRun.payload.startedAt) / 1000)),
      difficulty: activeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [clearTimers, runId]);
  useUnload(handleUnload);
  const state = run?.payload.state ?? null;
  const currentQuestion = state?.questions[state.currentIndex] ?? null;
  const selectedChars = useMemo(
    () =>
      state && currentQuestion
        ? state.selectedCharIds
            .map((id) => currentQuestion.charChoices.find((choice) => choice.id === id)?.char || "")
            .filter(Boolean)
        : [],
    [currentQuestion, state],
  );
  if (!run || run.status !== "active" || !state || !currentQuestion) return null;
  return (
    <View className="word-scramble-page">
      <View className="word-play">
        <View className="status-row">
          <View className="status-card">
            <Text className="status-value">
              {state.currentIndex + 1}/{WORD_SCRAMBLE_TOTAL_QUESTIONS}
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
        <View className="scramble-card">
          <Text className="question-kicker">{currentQuestion.target.category}</Text>
          <View className="answer-rack">
            {Array.from(currentQuestion.target.word).map((_, index) => (
              <View
                key={`slot-${index}`}
                className={`answer-slot ${selectedChars[index] ? "answer-slot-filled" : ""}`}
              >
                <Text className="answer-slot-text">{selectedChars[index] || ""}</Text>
              </View>
            ))}
          </View>
          <Text className="hint-text">
            {state.isHintVisible ? currentQuestion.target.hint : "提示蓄力中，先靠字形和类别判断"}
          </Text>
          <View className="tool-row">
            <View className="tool-button" onClick={undoChar}>
              <Text className="tool-button-text">撤销</Text>
            </View>
            <View className="tool-button" onClick={clearSelection}>
              <Text className="tool-button-text">清空</Text>
            </View>
          </View>
        </View>
        <View className="char-bank">
          {currentQuestion.charChoices.map((choice) => (
            <View
              key={choice.id}
              className={`char-tile ${state.selectedCharIds.includes(choice.id) ? "char-tile-used" : ""} ${state.phase === "feedback" && choice.isTarget ? "char-tile-answer" : ""}`}
              onClick={() => handleCharTap(choice.id)}
            >
              <Text className="char-text">{choice.char}</Text>
            </View>
          ))}
        </View>
        {state.phase === "feedback" ? (
          <View
            className={`feedback-card ${state.lastResult?.correct ? "feedback-correct" : "feedback-wrong"}`}
          >
            <Text className="feedback-title">
              {state.lastResult?.correct ? "拼盘完成" : "正确词语"}
            </Text>
            <Text className="feedback-copy">
              {currentQuestion.target.word} · 本题 +{state.lastResult?.score ?? 0}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
