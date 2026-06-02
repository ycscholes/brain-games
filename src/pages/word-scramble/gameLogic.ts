import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type WordScrambleDifficulty = TrainingDifficulty;

export interface WordScrambleEntry {
  word: string;
  hint: string;
  category: string;
}

export interface WordScrambleQuestion {
  id: string;
  target: WordScrambleEntry;
  scrambledChars: string[];
  options: string[];
  revealMs: number;
}

export interface WordScrambleQuestionResult {
  correct: boolean;
  speedBonus: number;
  comboBonus: number;
  score: number;
}

export const WORD_SCRAMBLE_TOTAL_QUESTIONS = 8;

const WORD_BANK: Record<WordScrambleDifficulty, WordScrambleEntry[]> = {
  normal: [
    { word: "月亮", hint: "夜晚常见的天体", category: "自然" },
    { word: "铅笔", hint: "写字和画草稿的工具", category: "物品" },
    { word: "火车", hint: "沿轨道行驶的交通工具", category: "交通" },
    { word: "苹果", hint: "常见的红色或绿色水果", category: "食物" },
    { word: "雨伞", hint: "下雨时撑开的用品", category: "物品" },
    { word: "海浪", hint: "海面起伏拍岸的水", category: "自然" },
    { word: "书包", hint: "上学常背的包", category: "物品" },
    { word: "花园", hint: "种着花草的地方", category: "地点" },
    { word: "篮球", hint: "用手投篮的运动", category: "运动" },
    { word: "灯塔", hint: "给船只指引方向", category: "地点" },
  ],
  hard: [
    { word: "观察力", hint: "发现细节的能力", category: "能力" },
    { word: "博物馆", hint: "收藏展品的场所", category: "地点" },
    { word: "方向盘", hint: "驾驶时用来转向", category: "物品" },
    { word: "降落伞", hint: "从空中安全下降", category: "物品" },
    { word: "记忆宫殿", hint: "用空间联想记内容", category: "能力" },
    { word: "天气预报", hint: "提前说明晴雨冷暖", category: "生活" },
    { word: "图书管理员", hint: "管理借阅和书架的人", category: "职业" },
    { word: "时间管理", hint: "安排任务先后和节奏", category: "能力" },
    { word: "注意力", hint: "保持专注的能力", category: "能力" },
    { word: "路线规划", hint: "出发前安排经过地点", category: "生活" },
  ],
};

const REVEAL_MS: Record<WordScrambleDifficulty, number[]> = {
  normal: [6200, 6000, 5800, 5600, 5400, 5200, 5000, 4800],
  hard: [5200, 5000, 4800, 4600, 4400, 4200, 4000, 3800],
};

function clampQuestionIndex(questionIndex: number) {
  return Math.max(0, Math.min(WORD_SCRAMBLE_TOTAL_QUESTIONS - 1, questionIndex));
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function createScrambledChars(word: string) {
  const chars = Array.from(word);
  let scrambled = shuffle(chars);
  if (scrambled.join("") === word && scrambled.length > 1) {
    scrambled = [scrambled[1], scrambled[0], ...scrambled.slice(2)];
  }
  return scrambled;
}

function createOptions(target: WordScrambleEntry, bank: WordScrambleEntry[]) {
  const options = new Set<string>([target.word]);
  shuffle(bank)
    .filter((entry) => entry.word !== target.word)
    .forEach((entry) => {
      if (options.size < 4) {
        options.add(entry.word);
      }
    });
  return shuffle([...options]);
}

export function getWordScrambleRevealMs(difficulty: WordScrambleDifficulty, questionIndex: number) {
  return REVEAL_MS[difficulty][clampQuestionIndex(questionIndex)];
}

export function createWordScrambleQuestion(
  difficulty: WordScrambleDifficulty,
  questionIndex: number,
): WordScrambleQuestion {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  const bank = WORD_BANK[difficulty];
  const target = bank[safeQuestionIndex % bank.length];

  return {
    id: `word-scramble-${difficulty}-${safeQuestionIndex + 1}`,
    target,
    scrambledChars: createScrambledChars(target.word),
    options: createOptions(target, bank),
    revealMs: getWordScrambleRevealMs(difficulty, safeQuestionIndex),
  };
}

export function createWordScrambleSession(difficulty: WordScrambleDifficulty) {
  const bank = shuffle(WORD_BANK[difficulty]).slice(0, WORD_SCRAMBLE_TOTAL_QUESTIONS);
  return bank.map((target, index) => ({
    id: `word-scramble-${difficulty}-${index + 1}`,
    target,
    scrambledChars: createScrambledChars(target.word),
    options: createOptions(target, WORD_BANK[difficulty]),
    revealMs: getWordScrambleRevealMs(difficulty, index),
  }));
}

export function scoreWordScrambleQuestion(params: {
  selectedWord: string;
  correctWord: string;
  answerMs: number;
  currentCombo: number;
}): WordScrambleQuestionResult {
  const correct = params.selectedWord === params.correctWord;
  if (!correct) {
    return {
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    };
  }

  const speedBonus = params.answerMs <= 2600 ? 1 : 0;
  const comboBonus = params.currentCombo >= 2 ? 1 : 0;

  return {
    correct: true,
    speedBonus,
    comboBonus,
    score: 4 + speedBonus + comboBonus,
  };
}

