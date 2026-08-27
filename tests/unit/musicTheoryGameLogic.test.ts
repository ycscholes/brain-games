import {
  createStaffPlacementLevels,
  getStaffSlotForNote,
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
    const slots = [getStaffSlotForNote("E4"), getStaffSlotForNote("F4")];
    expect(resolveStaffDrop(slots, { x: 120, y: 96 })).toBe("staff-e4");
    expect(resolveStaffDrop(slots, { x: -1, y: -1 })).toBeNull();
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
