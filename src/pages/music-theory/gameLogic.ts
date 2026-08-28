import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type MusicTheoryTopic = "rhythm" | "note" | "scale" | "staff";
export type MusicTheoryPhase = "quiz" | "staff-placement";
export type StaffSlotKind = "ledger-line" | "line" | "space" | "above-space";
export interface MusicTheoryQuestion { id: string; topic: MusicTheoryTopic; prompt: string; options: string[]; correctOptionIndex: number; explanation: string; difficulty: TrainingDifficulty; }
export interface StaffPlacementLevel { id: string; chapterId: "music-island-a"; clef: "treble"; targetNote: string; targetSlotId: string; prompt: string; explanation: string; candidateNotes: string[]; }
export interface StaffSlot { id: string; note: string; kind: StaffSlotKind; x: number; y: number; width: number; height: number; }
export type StaffDropSlot = StaffSlot;
export interface StaffPoint { x: number; y: number; }
export interface StaffBounds { left: number; top: number; }
export interface StaffTouchEvent { detail?: { x?: number; y?: number }; touches?: Array<{ clientX?: number; clientY?: number; pageX?: number; pageY?: number; x?: number; y?: number }>; changedTouches?: Array<{ clientX?: number; clientY?: number; pageX?: number; pageY?: number; x?: number; y?: number }>; }
export interface MusicTheoryScoreInput { difficulty: TrainingDifficulty; quizCorrectCount: number; placementCorrectCount: number; hintCount: number; elapsedSeconds: number; completed: boolean; }

const QUESTIONS: Array<Omit<MusicTheoryQuestion, "difficulty">> = [
  { id: "rhythm-quarter", topic: "rhythm", prompt: "在 4/4 拍中，四分音符通常数几拍？", options: ["1 拍", "2 拍", "4 拍", "半拍"], correctOptionIndex: 0, explanation: "四分音符通常占一拍。" },
  { id: "rhythm-bar", topic: "rhythm", prompt: "4/4 拍的一小节一共有几拍？", options: ["2 拍", "3 拍", "4 拍", "8 拍"], correctOptionIndex: 2, explanation: "4/4 拍表示每小节有四拍。" },
  { id: "note-names", topic: "note", prompt: "音乐里的基本音名有哪七个字母？", options: ["A 到 G", "A 到 H", "C 到 I", "D 到 J"], correctOptionIndex: 0, explanation: "基本音名按 A、B、C、D、E、F、G 循环。" },
  { id: "note-c-scale", topic: "note", prompt: "C 大调向上走的第一个音序列是？", options: ["C-D-E-F-G", "C-E-G-B-D", "G-F-E-D-C", "C-D-F-A-C"], correctOptionIndex: 0, explanation: "C 大调上行从 C 依次经过 D、E、F、G。" },
  { id: "scale-seven", topic: "scale", prompt: "C 到下一个 C 的大调音阶有几个不同音名？", options: ["5 个", "6 个", "7 个", "8 个"], correctOptionIndex: 2, explanation: "C 大调包含 C、D、E、F、G、A、B 七个不同音名。" },
  { id: "scale-down", topic: "scale", prompt: "音阶从高音走向低音，叫做什么？", options: ["上行", "下行", "跳拍", "延长"], correctOptionIndex: 1, explanation: "从高到低是下行，从低到高是上行。" },
  { id: "staff-clef", topic: "staff", prompt: "高音谱号主要帮助我们读哪一组较高的音？", options: ["较高音区", "只有鼓声", "只有休止符", "歌词"], correctOptionIndex: 0, explanation: "高音谱号帮助我们定位较高音区的音符。" },
  { id: "staff-lines", topic: "staff", prompt: "五线谱由什么组成？", options: ["五条线和四个间", "四条线和五个间", "七条线", "一条线"], correctOptionIndex: 0, explanation: "五线谱有五条线，线与线之间形成四个间。" },
];

const NOTE_NAMES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5"];
const kindForIndex = (index: number): StaffSlotKind => index === 0 ? "ledger-line" : index === 11 ? "above-space" : index % 2 === 0 ? "line" : "space";

export function getStaffSlotForNote(note: string): StaffSlot {
  const index = NOTE_NAMES.indexOf(note);
  if (index < 0) throw new Error(`Unsupported treble note: ${note}`);
  return { id: `staff-${note.toLowerCase()}`, note, kind: kindForIndex(index), x: 24, y: 80 + index * 8, width: 192, height: 16 };
}

export function getAllStaffSlots(): StaffSlot[] {
  return NOTE_NAMES.map(getStaffSlotForNote);
}

export function evaluateStaffPlacement(chosenNote: string, slotId: string, targetNote: string, targetSlotId: string): { correct: boolean; reason?: "wrong-note" | "wrong-slot" } {
  if (slotId !== targetSlotId) return { correct: false, reason: "wrong-slot" };
  if (chosenNote !== targetNote) return { correct: false, reason: "wrong-note" };
  return { correct: true };
}

export function getStaffPointFromTouchEvent(event: StaffTouchEvent): StaffPoint | null {
  const touch = event.touches?.[0] ?? event.changedTouches?.[0];
  if (touch) {
    const x = touch.clientX ?? touch.pageX ?? touch.x;
    const y = touch.clientY ?? touch.pageY ?? touch.y;
    if (typeof x === "number" && typeof y === "number") return { x, y };
  }
  const x = event.detail?.x;
  const y = event.detail?.y;
  return typeof x === "number" && typeof y === "number" ? { x, y } : null;
}

export function toStaffLocalPoint(point: StaffPoint, bounds: StaffBounds): StaffPoint {
  return { x: point.x - bounds.left, y: point.y - bounds.top };
}

export function selectMusicTheoryQuestions(difficulty: TrainingDifficulty, seed = "") {
  const offset = seed.length % QUESTIONS.length;
  const prepared = QUESTIONS.map((question, index) => ({ ...question, difficulty, options: difficulty === "hard" && index % 2 === 0 ? [...question.options].reverse() : question.options, correctOptionIndex: difficulty === "hard" && index % 2 === 0 ? question.options.length - 1 - question.correctOptionIndex : question.correctOptionIndex }));
  return prepared.slice(offset).concat(prepared.slice(0, offset));
}

export function createStaffPlacementLevels(_difficulty: TrainingDifficulty, seed = "") {
  const start = seed.length % 8;
  return [0, 2, 4, 6].map((step, index) => {
    const note = NOTE_NAMES[(start + step) % NOTE_NAMES.length];
    const slot = getStaffSlotForNote(note);
    return { id: `music-placement-${index + 1}`, chapterId: "music-island-a" as const, clef: "treble" as const, targetNote: note, targetSlotId: slot.id, prompt: `把 ${note} 放到高音谱号的正确位置`, explanation: `${note} 在${slot.kind === "line" ? "线上" : "间上"}。`, candidateNotes: [note, NOTE_NAMES[(NOTE_NAMES.indexOf(note) + 1) % NOTE_NAMES.length], NOTE_NAMES[(NOTE_NAMES.indexOf(note) + 3) % NOTE_NAMES.length]] };
  });
}

export function resolveStaffDrop(slots: StaffDropSlot[], point: StaffPoint): string | null {
  return slots.find((slot) => point.x >= slot.x && point.x <= slot.x + slot.width && point.y >= slot.y - slot.height / 2 && point.y <= slot.y + slot.height / 2)?.id ?? null;
}

export type StaffDropState = { kind: "slot"; slotId: string } | { kind: "outside" };

export function getStaffDropState(slots: StaffDropSlot[], point: StaffPoint): StaffDropState {
  const slotId = resolveStaffDrop(slots, point);
  return slotId ? { kind: "slot", slotId } : { kind: "outside" };
}

export function evaluateMusicTheoryScore(input: MusicTheoryScoreInput) {
  if (!input.completed) return 0;
  const quiz = Math.min(8, Math.max(0, input.quizCorrectCount)) * 3;
  const placement = Math.min(4, Math.max(0, input.placementCorrectCount)) * 3;
  const bonus = Math.min(4, Math.max(0, 12 - Math.floor(Math.max(0, input.elapsedSeconds) / 30)));
  return Math.max(0, Math.min(input.difficulty === "hard" ? 50 : 40, quiz + placement + bonus - Math.max(0, input.hintCount) * 2));
}
