const mockStorage = new Map<string, string>();

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getStorageSync: jest.fn((key: string) => mockStorage.get(key) ?? ""),
    setStorageSync: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
  },
}));

import {
  createMentalMathRun,
  readMentalMathRun,
  updateMentalMathRun,
} from "../../src/pages/mental-math/run";
import {
  createMemoryChallengeRun,
  readMemoryChallengeRun,
  updateMemoryChallengeRun,
} from "../../src/pages/memory-challenge/run";
import {
  createBirdCountRun,
  readBirdCountRun,
  updateBirdCountRun,
} from "../../src/pages/bird-count/run";
import {
  createTwentyFourRun,
  readTwentyFourRun,
  updateTwentyFourRun,
} from "../../src/pages/twenty-four/run";
import {
  createDigitSpanRun,
  readDigitSpanRun,
  updateDigitSpanRun,
} from "../../src/pages/digit-span/run";
import {
  createRockPaperScissorsRun,
  readRockPaperScissorsRun,
  updateRockPaperScissorsRun,
} from "../../src/pages/rock-paper-scissors/run";
import { createHidatoRun, readHidatoRun, updateHidatoRun } from "../../src/pages/hidato/run";
import {
  createTentsCampRun,
  readTentsCampRun,
  updateTentsCampRun,
} from "../../src/pages/tents-camp/run";
import {
  createLoopLineRun,
  readLoopLineRun,
  updateLoopLineRun,
} from "../../src/pages/loop-line/run";
import { createNetwalkRun, readNetwalkRun, updateNetwalkRun } from "../../src/pages/netwalk/run";

describe("migrated game live run persistence", () => {
  beforeEach(() => mockStorage.clear());

  test("persists a timed question and counters across mental math restoration", () => {
    const run = createMentalMathRun({
      difficulty: "normal",
      mode: "timed",
      stageId: "G1A",
    });
    const state = {
      currentProblem: { question: "3 + 4 = ?", answer: 7, operation: "add" as const },
      options: [7, 6, 8, 9],
      timeLeft: 24.3,
      score: 3,
      correctCount: 3,
      selectedAnswer: null,
      feedback: "none" as const,
      clockStartedAt: 100,
    };

    updateMentalMathRun(run.runId, { state });

    expect(readMentalMathRun(run.runId)?.payload.state).toEqual(state);
  });

  test("persists the active timed puzzle state for 24 points, digit span, and reverse rock-paper-scissors", () => {
    const twentyFour = createTwentyFourRun();
    const twentyFourState = {
      round: {
        cards: [1, 3, 4, 6].map((value) => ({ value, label: String(value) })),
        solution: "6÷(1-3÷4)",
      },
      tokens: [{ type: "number" as const, value: 1, cardIndex: 0, label: "1" }],
      score: 4,
      solvedCount: 2,
      timeLeft: 48,
      hintUsed: false,
      feedback: "继续凑出 24",
      clockStartedAt: 200,
    };
    updateTwentyFourRun(twentyFour.runId, { state: twentyFourState });

    const digitSpan = createDigitSpanRun();
    const digitSpanState = {
      phase: "input" as const,
      sequence: "3815",
      roundLength: 4,
      inputValue: "38",
      score: 3,
      currentDigit: "",
      displayStep: 0,
      clockStartedAt: 300,
      revealStartedAt: 0,
    };
    updateDigitSpanRun(digitSpan.runId, { state: digitSpanState });

    const rps = createRockPaperScissorsRun();
    const rpsState = {
      score: 6,
      streak: 3,
      bestStreak: 3,
      timeLeft: 2.4,
      currentHand: "paper" as const,
      targetOutcome: "win" as const,
      feedback: "none" as const,
      selectedHand: null,
      clockStartedAt: 400,
      questionStartedAt: 401,
    };
    updateRockPaperScissorsRun(rps.runId, { state: rpsState });

    expect(readTwentyFourRun(twentyFour.runId)?.payload.state).toEqual(twentyFourState);
    expect(readDigitSpanRun(digitSpan.runId)?.payload.state).toEqual(digitSpanState);
    expect(readRockPaperScissorsRun(rps.runId)?.payload.state).toEqual(rpsState);
  });

  test("persists generated boards and move counters without regenerating them", () => {
    const hidato = createHidatoRun();
    const hidatoState = {
      puzzle: {
        id: "hidato-test",
        difficulty: "normal" as const,
        rows: 1,
        cols: 2,
        total: 2,
        cells: [
          { id: "r0c0", row: 0, col: 0, value: 1, given: true },
          { id: "r0c1", row: 0, col: 1, value: 2, given: false },
        ],
        path: [
          { id: "r0c0", row: 0, col: 0, value: 1, given: true },
          { id: "r0c1", row: 0, col: 1, value: 2, given: false },
        ],
        givenValues: [1],
      },
      clickState: { nextValue: 2, clickedValues: [1], mistakeCount: 1, hintCount: 0 },
      clockStartedAt: 500,
    };
    updateHidatoRun(hidato.runId, { state: hidatoState });

    const tents = createTentsCampRun();
    const tentsState = {
      puzzles: [],
      currentIndex: 1,
      selectedTents: [{ row: 1, col: 2 }],
      score: 8,
      combo: 2,
      bestCombo: 3,
      correctPuzzles: 1,
      lastResult: null,
      phase: "playing" as const,
      clockStartedAt: 600,
      puzzleStartedAt: 601,
    };
    updateTentsCampRun(tents.runId, { state: tentsState });

    const loop = createLoopLineRun();
    const loopState = {
      puzzle: {
        id: "loop-test",
        difficulty: "normal" as const,
        size: 1,
        clues: [],
        solutionEdges: [],
      },
      boardState: { selectedEdges: ["horizontal:0:0"], blockedEdges: [] },
      hintCount: 1,
      elapsedSeconds: 9,
      feedback: "继续",
      clockStartedAt: 700,
    };
    updateLoopLineRun(loop.runId, { state: loopState });

    const netwalk = createNetwalkRun();
    const netwalkState = {
      puzzle: {
        id: "netwalk-test",
        difficulty: "normal" as const,
        size: 1,
        solutionTiles: [{ id: "0-0", row: 0, col: 0, isServer: true, connections: [] }],
        initialTiles: [{ id: "0-0", row: 0, col: 0, isServer: true, connections: [] }],
        minimumMoves: 0,
      },
      networkState: {
        tiles: [{ id: "0-0", row: 0, col: 0, isServer: true, connections: [] }],
        moveCount: 4,
      },
      hintCount: 1,
      elapsedSeconds: 11,
      feedback: "继续",
      clockStartedAt: 800,
    };
    updateNetwalkRun(netwalk.runId, { state: netwalkState });

    expect(readHidatoRun(hidato.runId)?.payload.state).toEqual(hidatoState);
    expect(readTentsCampRun(tents.runId)?.payload.state).toEqual(tentsState);
    expect(readLoopLineRun(loop.runId)?.payload.state).toEqual(loopState);
    expect(readNetwalkRun(netwalk.runId)?.payload.state).toEqual(netwalkState);
  });

  test("persists dynamic memory and counting sessions with stable item/question data", () => {
    const memory = createMemoryChallengeRun({ difficulty: "normal", mode: "shape", n: 1 });
    const memoryState = {
      history: [{ id: "shape_01", prompt: "shape_01", answerId: "shape_01", answerLabel: "图形1" }],
      currentItem: {
        id: "shape_01",
        prompt: "shape_01",
        answerId: "shape_01",
        answerLabel: "图形1",
      },
      targetItem: null,
      options: [],
      gameState: "memorize" as const,
      round: 1,
      memorizeIndex: 0,
      score: 0,
      correctCount: 0,
      timeLeft: 6,
      selectedId: null,
      feedback: "none" as const,
      clockStartedAt: 900,
      answerStartedAt: 0,
    };
    updateMemoryChallengeRun(memory.runId, { state: memoryState });

    const bird = createBirdCountRun({ difficulty: "normal", mode: "speed", yardSpeed: "slow" });
    const birdState = {
      speedQuestions: [],
      yardQuestions: [],
      currentIndex: 2,
      eventIndex: -1,
      displayCount: 0,
      selectedAnswer: 4,
      score: 7,
      combo: 2,
      bestCombo: 3,
      correctQuestions: 2,
      phase: "answering" as const,
      lastSpeedResult: null,
      lastYardResult: null,
      clockStartedAt: 1000,
      answerStartedAt: 1001,
    };
    updateBirdCountRun(bird.runId, { state: birdState });

    expect(readMemoryChallengeRun(memory.runId)?.payload.state).toEqual(memoryState);
    expect(readBirdCountRun(bird.runId)?.payload.state).toEqual(birdState);
  });
});
