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
import {
  createVisibleStaffSlots,
  evaluateMusicTheoryScore,
  evaluateStaffPlacement,
  getStaffDropState,
  getStaffPointFromTouchEvent,
  toStaffLocalPoint,
  type StaffBounds,
  type StaffPoint,
  type StaffSlot,
  type StaffTouchEvent,
} from "./gameLogic";
import MusicTheoryPlayPanel from "./components/MusicTheoryPlayPanel";
import {
  abandonMusicTheoryRun,
  readMusicTheoryRun,
  settleMusicTheoryCompletion,
  updateMusicTheoryRun,
  type MusicTheoryRunState,
} from "./run";
import "./index.scss";

const BEST_PREFIX = "music_theory_best";

export default function MusicTheoryPlay() {
  usePageShare("pages/music-theory/index");
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = useRef(readMusicTheoryRun(runId)).current;
  const allowSettledRef = useRef(false);
  const [state, setState] = useState<MusicTheoryRunState | null>(routeRun?.payload.state ?? null);
  const stateRef = useRef(state);
  const [feedback, setFeedback] = useState("准备好就出发吧！");
  const [chosenNote, setChosenNote] = useState<string | null>(
    routeRun?.payload.state.chosenNote ?? null,
  );
  const [dragPoint, setDragPoint] = useState<StaffPoint | null>(null);
  const [staffBounds, setStaffBounds] = useState<StaffBounds | null>(null);
  const [placementReaction, setPlacementReaction] = useState<"success" | "error" | null>(null);
  const finishedRef = useRef(false);
  const startedAtRef = useRef(routeRun?.payload.startedAt ?? 0);

  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, routeRun?.status, allowSettledRef.current))
      void Taro.redirectTo({ url: "/pages/music-theory/index" });
  }, [routeRun, runId]);

  const persist = useCallback(
    (next: MusicTheoryRunState) => {
      stateRef.current = next;
      setState(next);
      setChosenNote(next.chosenNote);
      updateMusicTheoryRun(runId, { state: next });
    },
    [runId],
  );

  const finishGame = useCallback(
    (finalState: MusicTheoryRunState) => {
      if (finishedRef.current || !routeRun) return;
      finishedRef.current = true;
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const finalScore = evaluateMusicTheoryScore({
        difficulty: routeRun.payload.difficulty,
        quizCorrectCount: finalState.quizCorrect,
        placementCorrectCount: finalState.placementCorrect,
        hintCount: finalState.hintCount,
        elapsedSeconds: durationSeconds,
        completed: true,
      });
      const key = `${BEST_PREFIX}_${routeRun.payload.difficulty}`;
      const best = Number(Taro.getStorageSync(key) || 0);
      const isNewBest = finalScore > best;
      persist(finalState);
      allowSettledRef.current = true;
      const settled = settleMusicTheoryCompletion(
        runId,
        {
          score: finalScore,
          awardedPoints: 0,
          durationSeconds,
          quizCorrectCount: finalState.quizCorrect,
          placementCorrectCount: finalState.placementCorrect,
          hintCount: finalState.hintCount,
          isNewBest,
        },
        {
          gameId: "music-theory",
          score: finalScore,
          durationSeconds,
          difficulty: routeRun.payload.difficulty,
          mode: "music-island-a",
          outcome: "completed",
        },
      );
      if (!settled) return;
      playComplete();
      if (settled.settlement.gauntletHandled) return;
      if (isNewBest) Taro.setStorageSync(key, finalScore);
      void Taro.redirectTo({
        url: `/pages/music-theory/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [persist, routeRun, runId],
  );

  useEffect(() => {
    if (!state || !routeRun || routeRun.status !== "active") return;
    if (state.phase !== "staff-placement") {
      setStaffBounds(null);
      return;
    }
    setStaffBounds(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      Taro.createSelectorQuery()
        .select(".staff")
        .boundingClientRect((rect) => {
          if (cancelled) return;
          if (!rect || Array.isArray(rect) || rect.width <= 0 || rect.height <= 0) {
            setStaffBounds(null);
            setFeedback("五线谱正在准备中，请稍后再试。🌟");
            return;
          }
          setStaffBounds({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          });
        })
        .exec();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [routeRun, state]);

  const answerQuiz = useCallback(
    (option: number) => {
      const current = stateRef.current;
      if (!current || current.phase !== "quiz" || current.selected !== null || !routeRun) return;
      const question = routeRun.payload.questions[current.index];
      if (!question) return;
      const correct = option === question.correctOptionIndex;
      setFeedback(correct ? "对了 ✨" : "再试");
      if (correct) {
        playCorrect();
      } else playWrong();
      persist({
        ...current,
        selected: option,
        quizCorrect: current.quizCorrect + (correct ? 1 : 0),
      });
    },
    [persist, routeRun],
  );

  const nextQuiz = useCallback(() => {
    const current = stateRef.current;
    if (!current || !routeRun) return;
    playTap();
    if (current.index === routeRun.payload.questions.length - 1) {
      persist({ ...current, phase: "staff-placement", index: 0, selected: null, chosenNote: null });
      setFeedback("选音符");
    } else {
      persist({ ...current, index: current.index + 1, selected: null });
      setFeedback("下一张");
    }
  }, [persist, routeRun]);

  const place = useCallback(
    (slotId: string) => {
      const current = stateRef.current;
      if (!current || !routeRun || current.phase !== "staff-placement") return;
      const level = routeRun.payload.levels[current.index];
      if (!level) return;
      if (!current.chosenNote) {
        setFeedback("选音符");
        return;
      }
      const result = evaluateStaffPlacement(
        current.chosenNote,
        slotId,
        level.targetNote,
        level.targetSlotId,
      );
      if (result.correct) {
        playCorrect();
        setPlacementReaction("success");
        const next = {
          ...current,
          placementCorrect: current.placementCorrect + 1,
          chosenNote: null,
        };
        setFeedback("对了 ✨");
        if (current.index === routeRun.payload.levels.length - 1) {
          finishGame(next);
          return;
        }
        persist(next);
        setTimeout(() => {
          setPlacementReaction(null);
          const latest = stateRef.current;
          if (latest) {
            persist({ ...latest, index: latest.index + 1 });
            setFeedback("选音符");
          }
        }, 520);
      } else {
        playWrong();
        setPlacementReaction("error");
        setFeedback(result.reason === "wrong-note" ? "换一个" : "再试");
        setTimeout(() => setPlacementReaction(null), 420);
      }
    },
    [finishGame, persist, routeRun],
  );

  const getStaffLocalPoint = useCallback(
    (event: StaffTouchEvent) => {
      const point = getStaffPointFromTouchEvent(event);
      if (!point) return null;
      if (!staffBounds) {
        setFeedback("五线谱正在准备中，请稍后再试。🌟");
        return null;
      }
      return toStaffLocalPoint(point, staffBounds);
    },
    [staffBounds],
  );
  const handleDrop = useCallback(
    (point: StaffPoint) => {
      const slots =
        staffBounds?.width && staffBounds.height
          ? createVisibleStaffSlots({ width: staffBounds.width, height: staffBounds.height })
          : [];
      const drop = getStaffDropState(slots, point);
      if (drop.kind === "outside") {
        setPlacementReaction("error");
        setFeedback("放谱上");
        setTimeout(() => setPlacementReaction(null), 420);
        return;
      }
      place(drop.slotId);
    },
    [place, staffBounds],
  );
  const handleStaffClick = useCallback(
    (event: StaffTouchEvent) => {
      const point = getStaffLocalPoint(event);
      if (point) handleDrop(point);
    },
    [getStaffLocalPoint, handleDrop],
  );
  const handleNoteTouchStart = useCallback(
    (note: string, event: StaffTouchEvent) => {
      setChosenNote(note);
      setDragPoint(getStaffLocalPoint(event));
      const current = stateRef.current;
      if (current) persist({ ...current, chosenNote: note });
    },
    [getStaffLocalPoint, persist],
  );
  const handleNoteTouchMove = useCallback(
    (event: StaffTouchEvent) => {
      const point = getStaffLocalPoint(event);
      if (point) setDragPoint(point);
    },
    [getStaffLocalPoint],
  );
  const handleNoteTouchEnd = useCallback(
    (event: StaffTouchEvent) => {
      const point = getStaffLocalPoint(event) ?? dragPoint;
      if (point) handleDrop(point);
      setDragPoint(null);
    },
    [dragPoint, getStaffLocalPoint, handleDrop],
  );
  const handleUnload = useCallback(() => {
    if (!stateRef.current || !routeRun || routeRun.status !== "active" || finishedRef.current)
      return;
    abandonMusicTheoryRun(runId, {
      gameId: "music-theory",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
      difficulty: routeRun.payload.difficulty,
      mode: "music-island-a",
      outcome: "interrupted",
    });
  }, [routeRun, runId]);
  useUnload(handleUnload);

  if (!state || !routeRun || routeRun.status !== "active") return null;
  const currentLevel = routeRun.payload.levels[state.index];
  const staffSlots: StaffSlot[] =
    currentLevel && staffBounds?.width && staffBounds.height
      ? createVisibleStaffSlots({ width: staffBounds.width, height: staffBounds.height })
      : [];
  return (
    <View
      className="music-theory-page"
      onTouchMove={(event) => {
        if (chosenNote) handleNoteTouchMove(event);
      }}
      onTouchEnd={(event) => {
        if (chosenNote && dragPoint) handleNoteTouchEnd(event);
      }}
    >
      <MusicTheoryPlayPanel
        phase={state.phase}
        index={state.index}
        questions={routeRun.payload.questions}
        selected={state.selected}
        feedback={feedback}
        currentLevel={currentLevel}
        staffSlots={staffSlots}
        chosenNote={chosenNote}
        dragPoint={dragPoint}
        placementReaction={placementReaction}
        onAnswer={answerQuiz}
        onNextQuiz={nextQuiz}
        onStaffClick={handleStaffClick}
        onNoteClick={(note) => {
          playTap();
          setChosenNote(note);
          const current = stateRef.current;
          if (current) persist({ ...current, chosenNote: note });
          setFeedback("放这里");
        }}
        onNoteTouchStart={handleNoteTouchStart}
        onNoteTouchMove={handleNoteTouchMove}
        onNoteTouchEnd={handleNoteTouchEnd}
        onHint={() => {
          const current = stateRef.current;
          if (current) persist({ ...current, hintCount: current.hintCount + 1 });
          setFeedback("看亮点");
        }}
      />
    </View>
  );
}
