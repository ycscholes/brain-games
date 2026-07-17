import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type CodeBreakerDifficulty = TrainingDifficulty;
export type CodeBreakerDigit = string;
export type CodeBreakerCode = CodeBreakerDigit[];

export interface CodeBreakerFeedback {
  exact: number;
  misplaced: number;
}

export interface CodeBreakerClue {
  id: string;
  guess: CodeBreakerCode;
  feedback: CodeBreakerFeedback;
}

export interface CodeBreakerOption {
  id: string;
  code: CodeBreakerCode;
}

export interface CodeBreakerPuzzle {
  id: string;
  answerCode: CodeBreakerCode;
  clues: CodeBreakerClue[];
  options: CodeBreakerOption[];
  answerOptionId: string;
  timeLimitMs: number;
}

export interface CodeBreakerResult {
  correct: boolean;
  speedBonus: number;
  comboBonus: number;
  score: number;
}

interface CodeBreakerPuzzleSeed {
  answerCode: CodeBreakerCode;
  clueGuesses: CodeBreakerCode[];
  decoys: CodeBreakerCode[];
}

export const CODE_BREAKER_TOTAL_PUZZLES = 8;

const TIME_LIMIT_MS: Record<CodeBreakerDifficulty, number[]> = {
  normal: [30000, 29000, 28000, 27000, 26000, 25000, 24000, 23000],
  hard: [38000, 37000, 36000, 35000, 34000, 33000, 32000, 31000],
};

const NORMAL_PUZZLES: CodeBreakerPuzzleSeed[] = [
  {
    answerCode: ["3", "1", "4"],
    clueGuesses: [["1", "2", "3"], ["3", "5", "6"], ["4", "1", "2"]],
    decoys: [["3", "4", "1"], ["1", "3", "4"], ["3", "1", "6"]],
  },
  {
    answerCode: ["2", "5", "6"],
    clueGuesses: [["2", "1", "5"], ["6", "5", "3"], ["4", "2", "6"]],
    decoys: [["2", "6", "5"], ["5", "2", "6"], ["2", "5", "4"]],
  },
  {
    answerCode: ["6", "2", "4"],
    clueGuesses: [["6", "1", "2"], ["4", "2", "5"], ["3", "6", "4"]],
    decoys: [["6", "4", "2"], ["2", "6", "4"], ["6", "2", "5"]],
  },
  {
    answerCode: ["1", "6", "3"],
    clueGuesses: [["1", "3", "5"], ["6", "2", "3"], ["4", "1", "6"]],
    decoys: [["1", "3", "6"], ["6", "1", "3"], ["1", "6", "5"]],
  },
  {
    answerCode: ["5", "3", "2"],
    clueGuesses: [["5", "1", "3"], ["2", "3", "4"], ["6", "5", "2"]],
    decoys: [["5", "2", "3"], ["3", "5", "2"], ["5", "3", "1"]],
  },
  {
    answerCode: ["4", "6", "1"],
    clueGuesses: [["4", "2", "6"], ["1", "6", "5"], ["3", "4", "1"]],
    decoys: [["4", "1", "6"], ["6", "4", "1"], ["4", "6", "2"]],
  },
  {
    answerCode: ["2", "4", "5"],
    clueGuesses: [["2", "5", "1"], ["4", "3", "5"], ["6", "2", "4"]],
    decoys: [["2", "5", "4"], ["4", "2", "5"], ["2", "4", "6"]],
  },
  {
    answerCode: ["6", "1", "5"],
    clueGuesses: [["6", "5", "2"], ["1", "3", "5"], ["4", "6", "1"]],
    decoys: [["6", "5", "1"], ["1", "6", "5"], ["6", "1", "4"]],
  },
];

const HARD_PUZZLES: CodeBreakerPuzzleSeed[] = [
  {
    answerCode: ["4", "1", "6", "2"],
    clueGuesses: [["4", "2", "1", "5"], ["6", "1", "3", "2"], ["2", "4", "6", "1"], ["4", "5", "6", "3"]],
    decoys: [["4", "6", "1", "2"], ["1", "4", "6", "2"], ["4", "1", "2", "6"]],
  },
  {
    answerCode: ["2", "6", "3", "5"],
    clueGuesses: [["2", "3", "6", "1"], ["5", "6", "4", "3"], ["1", "2", "3", "5"], ["2", "6", "5", "4"]],
    decoys: [["2", "3", "6", "5"], ["6", "2", "3", "5"], ["2", "6", "5", "3"]],
  },
  {
    answerCode: ["5", "2", "4", "1"],
    clueGuesses: [["5", "1", "2", "6"], ["4", "2", "3", "1"], ["6", "5", "4", "2"], ["5", "2", "1", "3"]],
    decoys: [["5", "4", "2", "1"], ["2", "5", "4", "1"], ["5", "2", "1", "4"]],
  },
  {
    answerCode: ["1", "5", "2", "6"],
    clueGuesses: [["1", "2", "5", "3"], ["6", "5", "4", "2"], ["3", "1", "2", "6"], ["1", "5", "6", "4"]],
    decoys: [["1", "2", "5", "6"], ["5", "1", "2", "6"], ["1", "5", "6", "2"]],
  },
  {
    answerCode: ["6", "3", "1", "4"],
    clueGuesses: [["6", "4", "3", "2"], ["1", "3", "5", "4"], ["2", "6", "1", "3"], ["6", "3", "4", "5"]],
    decoys: [["6", "1", "3", "4"], ["3", "6", "1", "4"], ["6", "3", "4", "1"]],
  },
  {
    answerCode: ["3", "6", "5", "1"],
    clueGuesses: [["3", "5", "6", "2"], ["1", "6", "4", "5"], ["2", "3", "5", "1"], ["3", "6", "1", "4"]],
    decoys: [["3", "5", "6", "1"], ["6", "3", "5", "1"], ["3", "6", "1", "5"]],
  },
  {
    answerCode: ["2", "4", "6", "3"],
    clueGuesses: [["2", "6", "4", "1"], ["3", "4", "5", "6"], ["1", "2", "6", "3"], ["2", "4", "3", "5"]],
    decoys: [["2", "6", "4", "3"], ["4", "2", "6", "3"], ["2", "4", "3", "6"]],
  },
  {
    answerCode: ["5", "1", "3", "6"],
    clueGuesses: [["5", "3", "1", "2"], ["6", "1", "4", "3"], ["2", "5", "3", "6"], ["5", "1", "6", "4"]],
    decoys: [["5", "3", "1", "6"], ["1", "5", "3", "6"], ["5", "1", "6", "3"]],
  },
];

function clampPuzzleIndex(puzzleIndex: number) {
  return Math.max(0, Math.min(CODE_BREAKER_TOTAL_PUZZLES - 1, puzzleIndex));
}

function codeKey(code: CodeBreakerCode) {
  return code.join("");
}

function feedbackEquals(left: CodeBreakerFeedback, right: CodeBreakerFeedback) {
  return left.exact === right.exact && left.misplaced === right.misplaced;
}

export function evaluateCodeGuess(answer: CodeBreakerCode, guess: CodeBreakerCode): CodeBreakerFeedback {
  const unmatchedAnswer: CodeBreakerDigit[] = [];
  const unmatchedGuess: CodeBreakerDigit[] = [];
  let exact = 0;

  answer.forEach((digit, index) => {
    if (digit === guess[index]) {
      exact += 1;
      return;
    }

    unmatchedAnswer.push(digit);
    unmatchedGuess.push(guess[index]);
  });

  let misplaced = 0;
  const remainingAnswer = [...unmatchedAnswer];
  unmatchedGuess.forEach((digit) => {
    const matchedIndex = remainingAnswer.indexOf(digit);
    if (matchedIndex >= 0) {
      misplaced += 1;
      remainingAnswer.splice(matchedIndex, 1);
    }
  });

  return { exact, misplaced };
}

export function isCodeConsistentWithClues(code: CodeBreakerCode, clues: CodeBreakerClue[]) {
  return clues.every((clue) => feedbackEquals(evaluateCodeGuess(code, clue.guess), clue.feedback));
}

export function findConsistentOptions(puzzle: CodeBreakerPuzzle) {
  return puzzle.options
    .filter((option) => isCodeConsistentWithClues(option.code, puzzle.clues))
    .map((option) => option.id);
}

export function getCodeBreakerTimeLimitMs(
  difficulty: CodeBreakerDifficulty,
  puzzleIndex: number,
) {
  return TIME_LIMIT_MS[difficulty][clampPuzzleIndex(puzzleIndex)];
}

function getPuzzleSeed(difficulty: CodeBreakerDifficulty, puzzleIndex: number) {
  const bank = difficulty === "hard" ? HARD_PUZZLES : NORMAL_PUZZLES;
  return bank[clampPuzzleIndex(puzzleIndex)];
}

export function createCodeBreakerPuzzle(
  difficulty: CodeBreakerDifficulty,
  puzzleIndex: number,
): CodeBreakerPuzzle {
  const safePuzzleIndex = clampPuzzleIndex(puzzleIndex);
  const seed = getPuzzleSeed(difficulty, safePuzzleIndex);
  const answerOption = { id: "answer", code: seed.answerCode };
  const decoyOptions = seed.decoys.map((code, index) => ({
    id: `decoy-${index + 1}`,
    code,
  }));
  const options = [answerOption, ...decoyOptions];
  const rotation = (safePuzzleIndex + (difficulty === "hard" ? 2 : 1)) % options.length;

  return {
    id: `code-breaker-${difficulty}-${safePuzzleIndex + 1}`,
    answerCode: seed.answerCode,
    clues: seed.clueGuesses.map((guess, index) => ({
      id: `clue-${index + 1}`,
      guess,
      feedback: evaluateCodeGuess(seed.answerCode, guess),
    })),
    options: [...options.slice(rotation), ...options.slice(0, rotation)],
    answerOptionId: answerOption.id,
    timeLimitMs: getCodeBreakerTimeLimitMs(difficulty, safePuzzleIndex),
  };
}

export function createCodeBreakerSession(difficulty: CodeBreakerDifficulty) {
  return Array.from({ length: CODE_BREAKER_TOTAL_PUZZLES }, (_, index) =>
    createCodeBreakerPuzzle(difficulty, index),
  );
}

export function scoreCodeBreakerPuzzle(params: {
  selectedOptionId: string;
  answerOptionId: string;
  answerMs: number;
  currentCombo: number;
}): CodeBreakerResult {
  const correct = params.selectedOptionId === params.answerOptionId;
  if (!correct) {
    return {
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    };
  }

  const speedBonus = params.answerMs <= 9000 ? 1 : 0;
  const comboBonus = params.currentCombo >= 2 ? 1 : 0;

  return {
    correct: true,
    speedBonus,
    comboBonus,
    score: 4 + speedBonus + comboBonus,
  };
}

export function formatCode(code: CodeBreakerCode) {
  return codeKey(code);
}
