import {
  createStaffPlacementLevels,
  evaluateStaffPlacement,
  getAllStaffSlots,
  getStaffSlotForNote,
  getStaffPointFromTouchEvent,
  resolveStaffDrop,
  selectMusicTheoryQuestions,
  evaluateMusicTheoryScore,
} from "../../src/pages/music-theory/gameLogic";

describe("music theory game logic", () => {
  it("selects eight unique questions across four topics", () => {
    const questions = selectMusicTheoryQuestions("normal", "seed-a");
    expect(questions).toHaveLength(8);
    expect(new Set(questions.map((question) => question.id)).size).toBe(8);
    expect(new Set(questions.map((question) => question.topic))).toEqual(new Set(["rhythm", "note", "scale", "staff"]));
  });

  it("maps treble staff notes from C4 to G5", () => {
    expect(getStaffSlotForNote("C4")).toMatchObject({ kind: "ledger-line" });
    expect(getStaffSlotForNote("E4")).toMatchObject({ id: "staff-e4", kind: "line" });
    expect(getStaffSlotForNote("G5")).toMatchObject({ kind: "above-space" });
  });

  it("resolves a drop by rectangle and rejects the staff exterior", () => {
    const slots = getAllStaffSlots();
    expect(resolveStaffDrop(slots, { x: 120, y: 100 })).toBe("staff-e4");
    expect(resolveStaffDrop(slots, { x: -1, y: -1 })).toBeNull();
  });

  it("returns a non-target slot so the page can report an incorrect placement", () => {
    const result = evaluateStaffPlacement("E4", "staff-f4", "E4", "staff-e4");
    expect(result).toEqual({ correct: false, reason: "wrong-slot" });
  });

  it("rejects an incorrect note even when it lands on the target slot", () => {
    const result = evaluateStaffPlacement("F4", "staff-e4", "E4", "staff-e4");
    expect(result).toEqual({ correct: false, reason: "wrong-note" });
  });

  it("supports every C4-G5 staff slot while rejecting the exterior", () => {
    for (const slot of getAllStaffSlots()) {
      expect(resolveStaffDrop([slot], { x: slot.x + 1, y: slot.y })).toBe(slot.id);
    }
    expect(resolveStaffDrop(getAllStaffSlots(), { x: 400, y: 400 })).toBeNull();
  });

  it("reads the latest touch coordinate from touches or changedTouches", () => {
    expect(getStaffPointFromTouchEvent({ touches: [{ clientX: 11, clientY: 22 }] })).toEqual({ x: 11, y: 22 });
    expect(getStaffPointFromTouchEvent({ touches: [], changedTouches: [{ clientX: 33, clientY: 44 }] })).toEqual({ x: 33, y: 44 });
    expect(getStaffPointFromTouchEvent({ detail: { x: 55, y: 66 } })).toEqual({ x: 55, y: 66 });
    expect(getStaffPointFromTouchEvent({})).toBeNull();
  });

  it("creates four unique placement levels and scores completed play", () => {
    const levels = createStaffPlacementLevels("normal", "seed-a");
    expect(levels).toHaveLength(4);
    expect(new Set(levels.map((level) => level.targetSlotId)).size).toBe(4);
    expect(evaluateMusicTheoryScore({ difficulty: "normal", quizCorrectCount: 8, placementCorrectCount: 4, hintCount: 0, elapsedSeconds: 30, completed: true })).toBeLessThanOrEqual(40);
    expect(evaluateMusicTheoryScore({ difficulty: "hard", quizCorrectCount: 8, placementCorrectCount: 4, hintCount: 0, elapsedSeconds: 30, completed: true })).toBeLessThanOrEqual(50);
    expect(evaluateMusicTheoryScore({ difficulty: "normal", quizCorrectCount: 8, placementCorrectCount: 4, hintCount: 0, elapsedSeconds: 30, completed: false })).toBe(0);
  });
});
