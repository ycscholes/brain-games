import {
  SIGNAL_SPRINT_TOTAL_TRIALS,
  createSignalSprintSession,
  getSignalSprintResponseWindowMs,
  scoreSignalSprintTrial,
} from "../../src/pages/signal-sprint/gameLogic";

describe("signal-sprint game logic", () => {
  test("creates normal and hard sessions with a playable go-first sequence", () => {
    const normal = createSignalSprintSession("normal");
    const hard = createSignalSprintSession("hard");

    expect(normal).toHaveLength(SIGNAL_SPRINT_TOTAL_TRIALS.normal);
    expect(hard).toHaveLength(SIGNAL_SPRINT_TOTAL_TRIALS.hard);
    expect(normal[0].signal).toBe("go");
    expect(hard[0].signal).toBe("go");
  });

  test("balances frequent go signals with rarer stop signals", () => {
    const normal = createSignalSprintSession("normal");
    const hard = createSignalSprintSession("hard");
    const normalStopCount = normal.filter((trial) => trial.signal === "stop").length;
    const hardStopCount = hard.filter((trial) => trial.signal === "stop").length;

    expect(normalStopCount).toBe(6);
    expect(hardStopCount).toBe(8);
    expect(normal.length - normalStopCount).toBeGreaterThan(normalStopCount);
    expect(hard.length - hardStopCount).toBeGreaterThan(hardStopCount);
  });

  test("hard mode uses shorter response windows", () => {
    expect(getSignalSprintResponseWindowMs("normal", 0)).toBe(1350);
    expect(getSignalSprintResponseWindowMs("normal", 99)).toBe(1100);
    expect(getSignalSprintResponseWindowMs("hard", 0)).toBe(1100);
    expect(getSignalSprintResponseWindowMs("hard", 99)).toBe(900);
  });

  test("scores go taps with speed and combo bonuses", () => {
    expect(scoreSignalSprintTrial({
      signal: "go",
      action: "tap",
      reactionMs: 410,
      currentCombo: 3,
    })).toEqual({
      correct: true,
      speedBonus: 1,
      comboBonus: 1,
      scoreDelta: 4,
    });
  });

  test("scores stop holds and penalizes stop taps", () => {
    expect(scoreSignalSprintTrial({
      signal: "stop",
      action: "hold",
      reactionMs: 1200,
      currentCombo: 4,
    })).toEqual({
      correct: true,
      speedBonus: 0,
      comboBonus: 1,
      scoreDelta: 3,
    });

    expect(scoreSignalSprintTrial({
      signal: "stop",
      action: "tap",
      reactionMs: 360,
      currentCombo: 5,
    })).toEqual({
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      scoreDelta: -2,
    });
  });
});
