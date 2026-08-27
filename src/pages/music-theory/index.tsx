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
import { createStaffPlacementLevels, evaluateMusicTheoryScore, getStaffSlotForNote, resolveStaffDrop, selectMusicTheoryQuestions, type MusicTheoryPhase, type StaffPoint, type StaffSlot } from "./gameLogic";
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
  const [feedback, setFeedback] = useState("准备好就出发吧！");
  const [score, setScore] = useState(0);
  const [awarded, setAwarded] = useState(0);
  const startedAt = useRef(0);
  const finished = useRef(false);
  useAmbientMusic(pagePhase === "start");

  const startGame = useCallback(() => {
    playTap();
    setQuestions(selectMusicTheoryQuestions(difficulty, `${Date.now()}`));
    setLevels(createStaffPlacementLevels(difficulty, `${Date.now()}`));
    setIndex(0); setSelected(null); setQuizCorrect(0); setPlacementCorrect(0); setHintCount(0); setChosenNote(null); setScore(0); setAwarded(0); setPhase("quiz"); setPagePhase("playing"); setFeedback("先认识音乐小知识！"); startedAt.current = Date.now(); finished.current = false;
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

  const answerQuiz = (option: number) => { if (selected !== null) return; const question = questions[index]; const correct = option === question.correctOptionIndex; setSelected(option); setFeedback(question.explanation); if (correct) { playCorrect(); setQuizCorrect((value) => value + 1); } else playWrong(); };
  const nextQuiz = () => { playTap(); if (index === questions.length - 1) { setPhase("staff-placement"); setIndex(0); setSelected(null); setFeedback("把音符送到五线谱上吧！"); } else { setIndex((value) => value + 1); setSelected(null); setFeedback("继续探索下一个知识点！"); } };
  const place = (slotId: string) => { const level = levels[index]; if (!chosenNote) { setFeedback("先点选一张音符卡，再点五线谱位置。"); return; } if (slotId === level.targetSlotId) { playCorrect(); setPlacementCorrect((value) => value + 1); setFeedback(`${level.targetNote} 正确！${level.explanation}`); setChosenNote(null); if (index === levels.length - 1) finishGame(); else { setIndex((value) => value + 1); setFeedback(`${level.targetNote} 正确！继续下一颗星星。`); } } else { playWrong(); setFeedback(`还差一点：${level.targetNote} 要放在正确的线或间。`); } };
  const handleDrop = (point: StaffPoint) => { const slots = levels.map((level) => getStaffSlotForNote(level.targetNote)); const slot = resolveStaffDrop(slots, point); if (slot) place(slot); };
  const handleStaffClick = (event: { detail?: { x?: number; y?: number } }) => handleDrop({ x: event.detail?.x ?? 120, y: event.detail?.y ?? 96 });
  const currentLevel = levels[index];
  const staffSlots: StaffSlot[] = currentLevel ? [getStaffSlotForNote(currentLevel.targetNote)] : [];

  return <View className="music-theory-page">
    {pagePhase === "start" && <View className="music-start"><Text className="music-kicker">🎵 星空音乐岛</Text><Text className="music-title">音符小探险</Text><Text className="music-subtitle">跟着小星星认识节拍、音阶和五线谱</Text><View className="music-card"><Text>先完成 8 道知识卡，再挑战 4 道高音谱号识谱题</Text><Text>范围：C4 – G5 · 进阶模式</Text></View><View className="music-difficulty"><View className={difficulty === "normal" ? "active" : ""} onClick={() => setDifficulty("normal")}><Text>普通</Text></View><View className={difficulty === "hard" ? "active" : ""} onClick={() => setDifficulty("hard")}><Text>困难</Text></View></View><View className="music-button" onClick={startGame}><Text>开始探险 ✨</Text></View></View>}
    {pagePhase === "playing" && <View className="music-play"><View className="music-top"><Text>🎶 {phase === "quiz" ? "音乐岛知识卡" : "星光五线谱"}</Text><Text>{index + 1} / {phase === "quiz" ? 8 : 4}</Text></View>{phase === "quiz" && questions[index] && <View className="music-card question-card"><Text className="topic">{questions[index].topic}</Text><Text className="question">{questions[index].prompt}</Text>{questions[index].options.map((option, optionIndex) => <View key={option} className={`option ${selected === optionIndex ? (optionIndex === questions[index].correctOptionIndex ? "correct" : "wrong") : ""}`} onClick={() => answerQuiz(optionIndex)}><Text>{option}</Text></View>)}<Text className="feedback">{feedback}</Text>{selected !== null && <View className="music-button" onClick={nextQuiz}><Text>{index === 7 ? "进入五线谱挑战" : "下一题"}</Text></View>}</View>}{phase === "staff-placement" && currentLevel && <View className="music-card staff-card"><Text className="question">把 {currentLevel.targetNote} 放到正确位置</Text><View className="staff" onClick={handleStaffClick} onTouchEnd={handleStaffClick}><Text className="clef">𝄞</Text>{[0,1,2,3,4].map((line) => <View key={line} className="staff-line" style={{ top: `${40 + line * 16}px` }} />)}{staffSlots.map((slot) => <View key={slot.id} className={`staff-target ${chosenNote ? "highlight" : ""}`} style={{ top: `${slot.y - 80}px` }} onClick={() => place(slot.id)}><Text>{slot.kind === "line" ? "线" : "间"}</Text></View>)}</View><View className="note-cards">{currentLevel.candidateNotes.map((note) => <View key={note} className={`note-card ${chosenNote === note ? "selected" : ""}`} onClick={() => { playTap(); setChosenNote(note); setFeedback(`已选 ${note}，拖到五线谱上或点目标位置。`); }} onTouchStart={() => { setChosenNote(note); }}><Text>♪ {note}</Text></View>)}</View><Text className="feedback">{feedback}</Text><View className="hint" onClick={() => { setHintCount((value) => value + 1); setFeedback(`提示：${currentLevel.targetNote} 的目标位置已发光。`); }}><Text>需要提示？</Text></View></View>}</View>}
    {pagePhase === "finished" && <View className="music-finish"><Text className="music-kicker">🌈 探险完成</Text><Text className="music-title">太棒啦！</Text><Text className="final-score">{score} 分</Text><Text>获得 {awarded} 宠物积分</Text><StickerShareButton gameTitle="音符小探险" score={score} pagePath="pages/music-theory/index" isGauntlet={isGauntlet} /><View className="music-button" onClick={startGame}><Text>再玩一次</Text></View></View>}
  </View>;
}
