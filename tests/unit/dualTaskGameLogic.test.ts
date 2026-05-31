import {
  applyDualTaskEvent,
  createInitialDualTaskStats,
  createInsertTask,
  DUAL_TASK_SESSION_MS,
  getDualTaskDifficultyConfig,
  getDualTaskPhase,
  getMainTrackFrame,
  isInsertTaskAnswerCorrect,
  judgeMainTrackTap,
  shouldEnterRecovery,
} from "../../src/pages/dual-task/gameLogic";

describe("dual-task command center logic", () => {
  test("maps elapsed time to command-center phases", () => {
    expect(getDualTaskPhase(0)).toBe("warmup");
    expect(getDualTaskPhase(14999)).toBe("warmup");
    expect(getDualTaskPhase(15000)).toBe("interference");
    expect(getDualTaskPhase(44999)).toBe("interference");
    expect(getDualTaskPhase(45000)).toBe("sprint");
    expect(getDualTaskPhase(DUAL_TASK_SESSION_MS)).toBe("sprint");
  });

  test("normal and hard difficulty expose bounded timing parameters", () => {
    const normal = getDualTaskDifficultyConfig("normal");
    const hard = getDualTaskDifficultyConfig("hard");

    expect(normal.rewardDifficulty).toBe("normal");
    expect(hard.rewardDifficulty).toBe("hard");
    expect(normal.insertIntervalMs.warmup.min).toBeGreaterThan(hard.insertIntervalMs.warmup.min);
    expect(normal.insertDurationMs.sprint).toBeGreaterThan(hard.insertDurationMs.sprint);
    expect(normal.targetWidth).toBeGreaterThan(hard.targetWidth);
  });

  test("computes cursor and centered target bounds for the main track", () => {
    const frame = getMainTrackFrame({
      difficulty: "normal",
      elapsedMs: 650,
      targetCenter: 0.5,
    });

    expect(frame.phase).toBe("warmup");
    expect(frame.cursorPosition).toBeGreaterThanOrEqual(0);
    expect(frame.cursorPosition).toBeLessThanOrEqual(1);
    expect(frame.targetStart).toBeCloseTo(0.39);
    expect(frame.targetEnd).toBeCloseTo(0.61);
  });

  test("judges main track taps around the target window", () => {
    expect(judgeMainTrackTap({ cursorPosition: 0.5, targetStart: 0.4, targetEnd: 0.6 })).toBe("hit");
    expect(judgeMainTrackTap({ cursorPosition: 0.3, targetStart: 0.4, targetEnd: 0.6 })).toBe("early");
    expect(judgeMainTrackTap({ cursorPosition: 0.7, targetStart: 0.4, targetEnd: 0.6 })).toBe("late");
  });

  test("creates answerable insert tasks for each task type", () => {
    const taskTypes = ["odd-even", "greater-than", "color", "direction", "stroop"] as const;

    taskTypes.forEach((taskType, index) => {
      const task = createInsertTask({
        type: taskType,
        seed: index + 1,
        durationMs: 2000,
        startedAtMs: 10_000,
      });

      expect(task.type).toBe(taskType);
      expect(task.prompt).toBeTruthy();
      expect(task.options.length).toBeGreaterThanOrEqual(2);
      expect(task.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(task.correctOptionIndex).toBeLessThan(task.options.length);
      expect(isInsertTaskAnswerCorrect(task, task.correctOptionIndex)).toBe(true);
    });
  });

  test("stroop task declares whether player should answer word or ink", () => {
    const task = createInsertTask({
      type: "stroop",
      seed: 7,
      durationMs: 1600,
      startedAtMs: 45_000,
    });

    expect(task.goal === "word" || task.goal === "ink").toBe(true);
    expect(task.inkColor).toMatch(/^#[0-9A-F]{6}$/);
  });

  test("scores main hits, insert hits, sync bonus and streak bonus", () => {
    let stats = createInitialDualTaskStats();

    stats = applyDualTaskEvent(stats, { type: "main-hit", insertWindowId: "a" });
    expect(stats.score).toBe(1);
    expect(stats.streak).toBe(1);

    stats = applyDualTaskEvent(stats, { type: "insert-hit", insertWindowId: "a" });
    expect(stats.score).toBe(4);
    expect(stats.syncCount).toBe(1);
    expect(stats.streak).toBe(2);

    stats = applyDualTaskEvent(stats, { type: "main-hit", insertWindowId: "b" });
    stats = applyDualTaskEvent(stats, { type: "main-hit", insertWindowId: "c" });
    stats = applyDualTaskEvent(stats, { type: "main-hit", insertWindowId: "d" });
    expect(stats.score).toBe(8);
    expect(stats.bestStreak).toBe(5);
  });

  test("misses reset streak and three consecutive misses enter recovery", () => {
    let stats = createInitialDualTaskStats();
    stats = applyDualTaskEvent(stats, { type: "miss" });
    stats = applyDualTaskEvent(stats, { type: "miss" });
    expect(shouldEnterRecovery(stats)).toBe(false);
    stats = applyDualTaskEvent(stats, { type: "miss" });
    expect(stats.streak).toBe(0);
    expect(shouldEnterRecovery(stats)).toBe(true);
  });

  test("typical strong play lands inside target score bands", () => {
    let normal = createInitialDualTaskStats();
    for (let i = 0; i < 8; i += 1) {
      normal = applyDualTaskEvent(normal, { type: "main-hit", insertWindowId: `n${i}` });
      normal = applyDualTaskEvent(normal, { type: "insert-hit", insertWindowId: `n${i}` });
    }

    let hard = createInitialDualTaskStats();
    for (let i = 0; i < 10; i += 1) {
      hard = applyDualTaskEvent(hard, { type: "main-hit", insertWindowId: `h${i}` });
      hard = applyDualTaskEvent(hard, { type: "insert-hit", insertWindowId: `h${i}` });
    }

    expect(normal.score).toBeGreaterThanOrEqual(20);
    expect(normal.score).toBeLessThanOrEqual(40);
    expect(hard.score).toBeGreaterThanOrEqual(30);
    expect(hard.score).toBeLessThanOrEqual(45);
  });
});
