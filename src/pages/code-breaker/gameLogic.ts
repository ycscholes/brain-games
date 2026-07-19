import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type CodeBreakerDifficulty = TrainingDifficulty;
export type CodeBreakerSymbol = "amber" | "jade" | "cyan" | "rose" | "violet" | "slate";

export interface CodeBreakerConfig {
  codeLength: number;
  symbolCount: number;
  maxGuesses: number;
  allowDuplicates: boolean;
}

export interface CodeBreakerGuessResult {
  exact: number;
  present: number;
  solved: boolean;
}

export interface CodeBreakerFinalScoreInput {
  solved: boolean;
  attemptsUsed: number;
  maxGuesses: number;
  elapsedSeconds: number;
  bestExact: number;
  bestPresent: number;
}

export const CODE_BREAKER_SYMBOLS: CodeBreakerSymbol[] = [
  "amber",
  "jade",
  "cyan",
  "rose",
  "violet",
  "slate",
];

export const CODE_BREAKER_CONFIG: Record<CodeBreakerDifficulty, CodeBreakerConfig> = {
  normal: {
    codeLength: 4,
    symbolCount: 6,
    maxGuesses: 8,
    allowDuplicates: false,
  },
  hard: {
    codeLength: 4,
    symbolCount: 6,
    maxGuesses: 7,
    allowDuplicates: true,
  },
};

function pickIndex(length: number, random: () => number) {
  return Math.max(0, Math.min(length - 1, Math.floor(random() * length)));
}

export function getCodeBreakerConfig(difficulty: CodeBreakerDifficulty) {
  return CODE_BREAKER_CONFIG[difficulty];
}

export function getCodeBreakerSymbols(difficulty: CodeBreakerDifficulty) {
  const config = getCodeBreakerConfig(difficulty);
  return CODE_BREAKER_SYMBOLS.slice(0, config.symbolCount);
}

export function createSecretCode(
  difficulty: CodeBreakerDifficulty,
  random: () => number = Math.random,
): CodeBreakerSymbol[] {
  const config = getCodeBreakerConfig(difficulty);
  const symbols = getCodeBreakerSymbols(difficulty);

  if (config.allowDuplicates) {
    return Array.from({ length: config.codeLength }, () => symbols[pickIndex(symbols.length, random)]);
  }

  const pool = [...symbols];
  return Array.from({ length: config.codeLength }, () => {
    const index = pickIndex(pool.length, random);
    const [symbol] = pool.splice(index, 1);
    return symbol;
  });
}

export function scoreCodeBreakerGuess(
  solution: CodeBreakerSymbol[],
  guess: CodeBreakerSymbol[],
): CodeBreakerGuessResult {
  const unmatchedSolution: CodeBreakerSymbol[] = [];
  const unmatchedGuess: CodeBreakerSymbol[] = [];
  let exact = 0;

  solution.forEach((symbol, index) => {
    if (guess[index] === symbol) {
      exact += 1;
      return;
    }

    unmatchedSolution.push(symbol);
    if (guess[index]) {
      unmatchedGuess.push(guess[index]);
    }
  });

  const counts = new Map<CodeBreakerSymbol, number>();
  unmatchedSolution.forEach((symbol) => {
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  });

  let present = 0;
  unmatchedGuess.forEach((symbol) => {
    const count = counts.get(symbol) ?? 0;
    if (count <= 0) return;
    present += 1;
    counts.set(symbol, count - 1);
  });

  return {
    exact,
    present,
    solved: exact === solution.length,
  };
}

export function calculateCodeBreakerFinalScore(input: CodeBreakerFinalScoreInput) {
  if (!input.solved) {
    return Math.min(14, input.bestExact * 4 + input.bestPresent * 2);
  }

  const remainingGuessBonus = Math.max(0, input.maxGuesses - input.attemptsUsed) * 3;
  const speedBonus = input.elapsedSeconds <= 50 ? 4 : input.elapsedSeconds <= 80 ? 2 : 0;
  return 18 + remainingGuessBonus + speedBonus;
}
