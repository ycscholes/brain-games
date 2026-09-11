import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { shouldRedirectInvalidGameRun } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import { PATTERN_HINTS_PER_SESSION, scorePatternQuestion, type PatternOption } from "./patterns";
import PatternPlayPanel from "./components/PatternPlayPanel";
import {
  abandonPatternCompletionRun,
  readPatternCompletionRun,
  settlePatternCompletionCompletion,
  updatePatternCompletionRun,
  type PatternCompletionRunState,
} from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "pattern_completion_best";
const SPEED_TARGET_MS = { normal: 12000, hard: 9000 } as const;
const DIFFICULTY_LABEL: Record<number, string> = {
  1: "入门",
  2: "入门",
  3: "入门",
  4: "进阶",
  5: "进阶",
  6: "进阶",
  7: "挑战",
  8: "挑战",
  9: "挑战",
  10: "大师",
};

const formatElapsed = (elapsedMs: number) => {
  const seconds = Math.floor(elapsedMs / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
};

export default function PatternCompletionPlay() {
  usePageShare("pages/pattern-completion/index");
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = useRef(readPatternCompletionRun(runId)).current;
  const allowSettledRef = useRef(false);
  const [state, setState] = useState<PatternCompletionRunState | null>(
    routeRun?.payload.state ?? null,
  );
  const stateRef = useRef(state);
  const [elapsedMs, setElapsedMs] = useState(routeRun?.payload.state.elapsedMs ?? 0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, routeRun?.status, allowSettledRef.current))
      void Taro.redirectTo({ url: "/pages/pattern-completion/index" });
  }, [routeRun, runId]);

  const persist = useCallback(
    (next: PatternCompletionRunState) => {
      stateRef.current = next;
      setState(next);
      updatePatternCompletionRun(runId, { state: next });
    },
    [runId],
  );

  const clearTicker = useCallback(() => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
  }, []);

  useEffect(() => {
    if (!routeRun || routeRun.status !== "active" || !state) return undefined;
    tickerRef.current = setInterval(
      () => setElapsedMs(Date.now() - routeRun.payload.startedAt),
      250,
    );
    return clearTicker;
  }, [clearTicker, routeRun, state]);
  useEffect(() => clearTicker, [clearTicker]);

  const finishGame = useCallback(
    (finalState: PatternCompletionRunState) => {
      if (finishedRef.current || !routeRun) return;
      finishedRef.current = true;
      clearTicker();
      const settledElapsedMs = Math.max(0, Date.now() - routeRun.payload.startedAt);
      const rawBest =
        Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${routeRun.payload.difficulty}`) ||
        (routeRun.payload.difficulty === "normal" ? Taro.getStorageSync(STORAGE_KEY_PREFIX) : 0);
      const best = Number.isFinite(Number(rawBest)) ? Number(rawBest) : 0;
      const isNewBest = finalState.finalScore > best;
      const result = {
        score: finalState.finalScore,
        awardedPoints: 0,
        correctCount: finalState.correctCount,
        totalQuestions: finalState.session.length,
        longestCombo: finalState.longestCombo,
        hintsUsed: PATTERN_HINTS_PER_SESSION - finalState.remainingHints,
        multiruleCases: finalState.session.filter((question) => question.ruleCount >= 2).length,
        elapsedMs: settledElapsedMs,
        best: isNewBest ? finalState.finalScore : best,
        isNewBest,
      };
      persist({ ...finalState, elapsedMs: settledElapsedMs });
      allowSettledRef.current = true;
      const settled = settlePatternCompletionCompletion(runId, result, {
        gameId: "pattern-completion",
        score: result.score,
        durationSeconds: Math.round(settledElapsedMs / 1000),
        difficulty: routeRun.payload.difficulty,
        outcome: "completed",
      });
      if (!settled) return;
      playComplete();
      if (settled.settlement.gauntletHandled) return;
      if (isNewBest)
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${routeRun.payload.difficulty}`, result.best);
      void Taro.redirectTo({
        url: `/pages/pattern-completion/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [clearTicker, persist, routeRun, runId],
  );

  const resetRound = useCallback(
    (current: PatternCompletionRunState, currentIndex: number) => ({
      ...current,
      phase: "playing" as const,
      currentIndex,
      selectedOptionId: "",
      hintVisible: false,
      hintUsedForCurrent: false,
      currentScoreResult: null,
      lastAnswerCorrect: false,
      questionStartedAt: Date.now(),
    }),
    [],
  );

  const handleHint = useCallback(() => {
    const current = stateRef.current;
    if (
      !current ||
      current.phase !== "playing" ||
      current.selectedOptionId ||
      current.remainingHints <= 0 ||
      current.hintUsedForCurrent
    )
      return;
    persist({
      ...current,
      remainingHints: current.remainingHints - 1,
      hintUsedForCurrent: true,
      hintVisible: true,
    });
  }, [persist]);

  const handleOptionSelect = useCallback(
    (option: PatternOption) => {
      const current = stateRef.current;
      if (!current || current.phase !== "playing" || current.selectedOptionId || !routeRun) return;
      const question = current.session[current.currentIndex];
      if (!question) return;
      const correct = option.id === question.answer.id;
      playTap();
      if (correct) playCorrect();
      else playWrong();
      const scoreResult = scorePatternQuestion({
        isCorrect: correct,
        currentCombo: current.currentCombo,
        elapsedMs: Date.now() - current.questionStartedAt,
        targetMs: SPEED_TARGET_MS[routeRun.payload.difficulty],
        hintUsed: current.hintUsedForCurrent,
      });
      const nextCombo = correct ? current.currentCombo + 1 : 0;
      const next = {
        ...current,
        selectedOptionId: option.id,
        lastAnswerCorrect: correct,
        currentScoreResult: scoreResult,
        finalScore: current.finalScore + scoreResult.score,
        correctCount: current.correctCount + (correct ? 1 : 0),
        currentCombo: nextCombo,
        longestCombo: Math.max(current.longestCombo, nextCombo),
      };
      if (correct && current.currentIndex >= current.session.length - 1) {
        finishGame(next);
        return;
      }
      if (correct) {
        persist(resetRound(next, current.currentIndex + 1));
        return;
      }
      persist({ ...next, phase: "reveal" });
    },
    [finishGame, persist, resetRound, routeRun],
  );

  const handleNextCase = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.phase !== "reveal") return;
    if (current.currentIndex >= current.session.length - 1) {
      finishGame(current);
      return;
    }
    persist(resetRound(current, current.currentIndex + 1));
  }, [finishGame, persist, resetRound]);

  const handleUnload = useCallback(() => {
    if (!stateRef.current || !routeRun || routeRun.status !== "active" || finishedRef.current)
      return;
    clearTicker();
    abandonPatternCompletionRun(runId, {
      gameId: "pattern-completion",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - routeRun.payload.startedAt) / 1000)),
      difficulty: routeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [clearTicker, routeRun, runId]);
  useUnload(handleUnload);

  if (!state || !routeRun || routeRun.status !== "active") return null;
  const question = state.session[state.currentIndex];
  if (!question) return null;
  const selectedDistractorExplanation = state.selectedOptionId
    ? (question.distractorExplanations?.[state.selectedOptionId] ?? "")
    : "";
  return (
    <View className="pattern-page">
      <PatternPlayPanel
        currentIndex={state.currentIndex}
        totalQuestions={state.session.length}
        finalScore={state.finalScore}
        elapsedText={formatElapsed(elapsedMs)}
        difficultyLabel={DIFFICULTY_LABEL[question.difficulty]}
        currentCombo={state.currentCombo}
        remainingHints={state.remainingHints}
        currentQuestion={question}
        phase={state.phase}
        hintVisible={state.hintVisible}
        hintUsedForCurrent={state.hintUsedForCurrent}
        selectedOptionId={state.selectedOptionId}
        lastAnswerCorrect={state.lastAnswerCorrect}
        currentScoreResult={state.currentScoreResult}
        selectedDistractorExplanation={selectedDistractorExplanation}
        onOptionSelect={handleOptionSelect}
        onHint={handleHint}
        onNextCase={handleNextCase}
      />
    </View>
  );
}
