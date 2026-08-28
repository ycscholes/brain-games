import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import { getAwardedPoints, recordTrainingSession, type TrainingDifficulty } from "../../utils/trainingStorage";
import { completeGauntletLegIfNeeded, readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { playComplete, playCorrect, playTap, playWrong } from "../../services/audio/audioFeedbackService";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { usePageShare } from "../../utils/share";
import StickerShareButton from "../../components/stickers/StickerShareButton";
import { createStaffPlacementLevels, createVisibleStaffSlots, evaluateMusicTheoryScore, evaluateStaffPlacement, getStaffDropState, getStaffPointFromTouchEvent, selectMusicTheoryQuestions, toStaffLocalPoint, type MusicTheoryPhase, type StaffBounds, type StaffPoint, type StaffSlot, type StaffTouchEvent } from "./gameLogic";
import "./index.scss";

type PagePhase = "start" | "playing" | "finished";
const BEST_PREFIX = "music_theory_best";

export default function MusicTheory() {
  usePageShare("pages/music-theory/index");
  const preset = readGameGauntletModePreset();
  const isGauntlet = preset !== null;
  const [pagePhase, setPagePhase] = useState<PagePhase>("start");
  const [phase, setPhase] = useState<MusicTheoryPhase>("quiz");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(preset?.difficulty ?? "normal");
  const [questions, setQuestions] = useState(selectMusicTheoryQuestions("normal"));
  const [levels, setLevels] = useState(createStaffPlacementLevels("normal"));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [placementCorrect, setPlacementCorrect] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [chosenNote, setChosenNote] = useState<string | null>(null);
  const [dragPoint, setDragPoint] = useState<StaffPoint | null>(null);
  const [staffBounds, setStaffBounds] = useState<StaffBounds | null>(null);
  const [feedback, setFeedback] = useState("准备好就出发吧！");
  const [score, setScore] = useState(0);
  const [awarded, setAwarded] = useState(0);
  const [placementReaction, setPlacementReaction] = useState<"success" | "error" | null>(null);
  const startedAt = useRef(0);
  const finished = useRef(false);
  useAmbientMusic(pagePhase === "start");

  const startGame = useCallback(() => {
    playTap();
    setQuestions(selectMusicTheoryQuestions(difficulty, `${Date.now()}`));
    setLevels(createStaffPlacementLevels(difficulty, `${Date.now()}`));
    setIndex(0); setSelected(null); setQuizCorrect(0); setPlacementCorrect(0); setHintCount(0); setChosenNote(null); setDragPoint(null); setScore(0); setAwarded(0); setPhase("quiz"); setPagePhase("playing"); setFeedback("先认识音乐小知识！"); startedAt.current = Date.now(); finished.current = false;
  }, [difficulty]);

  const finishGame = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const finalScore = evaluateMusicTheoryScore({ difficulty, quizCorrectCount: quizCorrect, placementCorrectCount: placementCorrect, hintCount, elapsedSeconds: durationSeconds, completed: true });
    const points = getAwardedPoints("music-theory", finalScore, difficulty);
    playComplete();
    if (completeGauntletLegIfNeeded({ gameId: "music-theory", score: finalScore, awardedPoints: points, durationSeconds, difficulty, mode: "music-island-a", outcome: "completed" })) return;
    addPointsToPet("music-theory", finalScore, difficulty);
    recordTrainingSession({ gameId: "music-theory", score: finalScore, awardedPoints: points, durationSeconds, difficulty, mode: "music-island-a", outcome: "completed" });
    const key = `${BEST_PREFIX}_${difficulty}`; const best = Number(Taro.getStorageSync(key) || 0); if (finalScore > best) Taro.setStorageSync(key, finalScore);
    setScore(finalScore); setAwarded(points); setPagePhase("finished");
  }, [difficulty, hintCount, placementCorrect, quizCorrect]);

  useEffect(() => { if (isGauntlet && pagePhase === "start") startGame(); }, [isGauntlet, pagePhase, startGame]);

  useEffect(() => {
    if (pagePhase !== "playing" || phase !== "staff-placement") {
      setStaffBounds(null);
      return undefined;
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
          setStaffBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
        })
        .exec();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [index, pagePhase, phase]);

  const answerQuiz = (option: number) => { if (selected !== null) return; const question = questions[index]; const correct = option === question.correctOptionIndex; setSelected(option); setFeedback(correct ? "对了 ✨" : "再试"); if (correct) { playCorrect(); setQuizCorrect((value) => value + 1); } else playWrong(); };
  const nextQuiz = () => { playTap(); if (index === questions.length - 1) { setPhase("staff-placement"); setIndex(0); setSelected(null); setFeedback("选音符"); } else { setIndex((value) => value + 1); setSelected(null); setFeedback("下一张"); } };
  const place = (slotId: string) => { const level = levels[index]; if (!chosenNote) { setFeedback("选音符"); return; } const result = evaluateStaffPlacement(chosenNote, slotId, level.targetNote, level.targetSlotId); if (result.correct) { playCorrect(); setPlacementReaction("success"); setPlacementCorrect((value) => value + 1); setFeedback("对了 ✨"); setChosenNote(null); if (index === levels.length - 1) finishGame(); else { setTimeout(() => { setIndex((value) => value + 1); setPlacementReaction(null); setFeedback("选音符"); }, 520); } } else { playWrong(); setPlacementReaction("error"); setFeedback(result.reason === "wrong-note" ? "换一个" : "再试"); setTimeout(() => setPlacementReaction(null), 420); } };
  const getStaffLocalPoint = (event: StaffTouchEvent) => {
    const point = getStaffPointFromTouchEvent(event);
    if (!point) return null;
    if (!staffBounds) {
      setFeedback("五线谱正在准备中，请稍后再试。🌟");
      return null;
    }
    return toStaffLocalPoint(point, staffBounds);
  };
  const handleDrop = (point: StaffPoint) => { const slots = staffBounds?.width && staffBounds.height ? createVisibleStaffSlots({ width: staffBounds.width, height: staffBounds.height }) : []; const state = getStaffDropState(slots, point); if (state.kind === "outside") { setPlacementReaction("error"); setFeedback("放谱上"); setTimeout(() => setPlacementReaction(null), 420); return; } place(state.slotId); };
  const handleStaffClick = (event: StaffTouchEvent) => { const point = getStaffLocalPoint(event); if (point) handleDrop(point); };
  const handleNoteTouchStart = (note: string, event: StaffTouchEvent) => { setChosenNote(note); setDragPoint(getStaffLocalPoint(event)); };
  const handleNoteTouchMove = (event: StaffTouchEvent) => { const point = getStaffLocalPoint(event); if (point) setDragPoint(point); };
  const handleNoteTouchEnd = (event: StaffTouchEvent) => { const point = getStaffLocalPoint(event) ?? dragPoint; if (point) handleDrop(point); setDragPoint(null); };
  const currentLevel = levels[index];
  const staffSlots: StaffSlot[] = currentLevel && staffBounds?.width && staffBounds.height ? createVisibleStaffSlots({ width: staffBounds.width, height: staffBounds.height }) : [];

  return <View className="music-theory-page" onTouchMove={(event) => { if (chosenNote) handleNoteTouchMove(event); }} onTouchEnd={(event) => { if (chosenNote && dragPoint) handleNoteTouchEnd(event); }}>
    {pagePhase === "start" && <View className="music-start"><Text className="music-kicker">🎵 音乐岛</Text><Text className="music-title">音符探险</Text><Text className="music-subtitle">选一选 · 放一放</Text><View className="music-card"><Text>8 张卡 · 4 次放</Text><Text>C4 – G5</Text></View><View className="music-difficulty"><View className={difficulty === "normal" ? "active" : ""} onClick={() => setDifficulty("normal")}><Text>普通</Text></View><View className={difficulty === "hard" ? "active" : ""} onClick={() => setDifficulty("hard")}><Text>困难</Text></View></View><View className="music-button" onClick={startGame}><Text>出发 ✨</Text></View></View>}
    {pagePhase === "playing" && <View className="music-play"><View className="music-top"><Text>{phase === "quiz" ? "🎵 选一选" : "🎼 放一放"}</Text><Text>{index + 1} / {phase === "quiz" ? 8 : 4}</Text></View>{phase === "quiz" && questions[index] && <View className="music-card question-card"><Text className="topic">{questions[index].topic === "rhythm" ? "🥁" : questions[index].topic === "note" ? "🎵" : questions[index].topic === "scale" ? "🌈" : "🎼"}</Text><Text className="question">{questions[index].prompt}</Text>{questions[index].options.map((option, optionIndex) => <View key={option} className={`option ${selected === optionIndex ? (optionIndex === questions[index].correctOptionIndex ? "correct" : "wrong") : ""}`} onClick={() => answerQuiz(optionIndex)}><Text>{option}</Text></View>)}<Text className="feedback">{feedback}</Text>{selected !== null && <View className="music-button" onClick={nextQuiz}><Text>{index === 7 ? "去放音符" : "下一张"}</Text></View>}</View>}{phase === "staff-placement" && currentLevel && <View className={`music-card staff-card ${placementReaction ?? ""}`}><Text className="question">放 {currentLevel.targetNote}</Text><View className="staff" onClick={handleStaffClick} onTouchEnd={handleStaffClick}><Text className="clef">𝄞</Text>{[0,1,2,3,4].map((line) => <View key={line} className="staff-line" style={{ top: `${40 + line * 16}px` }} />)}{staffSlots.map((slot) => <View key={slot.id} className={`staff-target ${chosenNote && slot.id === currentLevel.targetSlotId ? "highlight" : ""}`} style={{ top: `${slot.y - 80}px` }} />)}{dragPoint && chosenNote && <Text className="drag-ghost" style={{ left: `${dragPoint.x - 18}px`, top: `${dragPoint.y - 22}px` }}>♪</Text>}{placementReaction === "success" && <Text className="success-stars">✦ ✧ ✦</Text>}</View><View className="note-cards">{currentLevel.candidateNotes.map((note) => <View key={note} className={`note-card ${chosenNote === note ? "selected" : ""}`} onClick={() => { playTap(); setChosenNote(note); setFeedback("放这里"); }} onTouchStart={(event) => handleNoteTouchStart(note, event)} onTouchMove={handleNoteTouchMove} onTouchEnd={handleNoteTouchEnd}><Text>♪ {note}</Text></View>)}</View><Text className="feedback">{feedback}</Text><View className="hint" onClick={() => { setHintCount((value) => value + 1); setFeedback("看亮点"); }}><Text>提示 💡</Text></View></View>}</View>}
    {pagePhase === "finished" && <View className="music-finish"><Text className="music-kicker">🌈 完成</Text><Text className="music-title">太棒啦！</Text><Text className="final-score">{score} 分</Text><Text>+{awarded} 积分</Text><StickerShareButton gameTitle="音符小探险" score={score} pagePath="pages/music-theory/index" isGauntlet={isGauntlet} /><View className="music-button" onClick={startGame}><Text>再来一次</Text></View></View>}
  </View>;
}
