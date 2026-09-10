import { Text, View } from "@tarojs/components";
import type {
  MusicTheoryPhase,
  MusicTheoryQuestion,
  StaffPlacementLevel,
  StaffPoint,
  StaffSlot,
  StaffTouchEvent,
} from "../gameLogic";

export interface MusicTheoryPlayPanelProps {
  phase: MusicTheoryPhase;
  index: number;
  questions: MusicTheoryQuestion[];
  selected: number | null;
  feedback: string;
  currentLevel?: StaffPlacementLevel;
  staffSlots: StaffSlot[];
  chosenNote: string | null;
  dragPoint: StaffPoint | null;
  placementReaction: "success" | "error" | null;
  onAnswer: (optionIndex: number) => void;
  onNextQuiz: () => void;
  onStaffClick: (event: StaffTouchEvent) => void;
  onNoteClick: (note: string) => void;
  onNoteTouchStart: (note: string, event: StaffTouchEvent) => void;
  onNoteTouchMove: (event: StaffTouchEvent) => void;
  onNoteTouchEnd: (event: StaffTouchEvent) => void;
  onHint: () => void;
}

export default function MusicTheoryPlayPanel({
  phase,
  index,
  questions,
  selected,
  feedback,
  currentLevel,
  staffSlots,
  chosenNote,
  dragPoint,
  placementReaction,
  onAnswer,
  onNextQuiz,
  onStaffClick,
  onNoteClick,
  onNoteTouchStart,
  onNoteTouchMove,
  onNoteTouchEnd,
  onHint,
}: MusicTheoryPlayPanelProps) {
  const question = questions[index];
  return (
    <View className="music-play">
      <View className="music-top">
        <Text>{phase === "quiz" ? "🎵 选一选" : "🎼 放一放"}</Text>
        <Text>
          {index + 1} / {phase === "quiz" ? 8 : 4}
        </Text>
      </View>
      {phase === "quiz" && question ? (
        <View className="music-card question-card">
          <Text className="topic">
            {question.topic === "rhythm"
              ? "🥁"
              : question.topic === "note"
                ? "🎵"
                : question.topic === "scale"
                  ? "🌈"
                  : "🎼"}
          </Text>
          <Text className="question">{question.prompt}</Text>
          {question.options.map((option, optionIndex) => (
            <View
              key={option}
              className={`option ${selected === optionIndex ? (optionIndex === question.correctOptionIndex ? "correct" : "wrong") : ""}`}
              onClick={() => onAnswer(optionIndex)}
            >
              <Text>{option}</Text>
            </View>
          ))}
          <Text className="feedback">{feedback}</Text>
          {selected !== null ? (
            <View className="music-button" onClick={onNextQuiz}>
              <Text>{index === 7 ? "去放音符" : "下一张"}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {phase === "staff-placement" && currentLevel ? (
        <View className={`music-card staff-card ${placementReaction ?? ""}`}>
          <Text className="question">放 {currentLevel.targetNote}</Text>
          <View className="staff" onClick={onStaffClick} onTouchEnd={onStaffClick}>
            <Text className="clef">𝄞</Text>
            {[0, 1, 2, 3, 4].map((line) => (
              <View key={line} className="staff-line" style={{ top: `${40 + line * 16}px` }} />
            ))}
            {staffSlots.map((slot) => (
              <View
                key={slot.id}
                className={`staff-target ${chosenNote && slot.id === currentLevel.targetSlotId ? "highlight" : ""}`}
                style={{ top: `${slot.y - 80}px` }}
              />
            ))}
            {dragPoint && chosenNote ? (
              <Text
                className="drag-ghost"
                style={{ left: `${dragPoint.x - 18}px`, top: `${dragPoint.y - 22}px` }}
              >
                ♪
              </Text>
            ) : null}
            {placementReaction === "success" ? <Text className="success-stars">✦ ✧ ✦</Text> : null}
          </View>
          <View className="note-cards">
            {currentLevel.candidateNotes.map((note) => (
              <View
                key={note}
                className={`note-card ${chosenNote === note ? "selected" : ""}`}
                onClick={() => onNoteClick(note)}
                onTouchStart={(event) => onNoteTouchStart(note, event)}
                onTouchMove={onNoteTouchMove}
                onTouchEnd={onNoteTouchEnd}
              >
                <Text>♪ {note}</Text>
              </View>
            ))}
          </View>
          <Text className="feedback">{feedback}</Text>
          <View className="hint" onClick={onHint}>
            <Text>提示 💡</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
