import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type WordScrambleDifficulty = TrainingDifficulty;

export interface WordScrambleEntry {
  word: string;
  hint: string;
  category: string;
}

export interface WordScrambleCharChoice {
  id: string;
  char: string;
  isTarget: boolean;
}

export interface WordScrambleQuestion {
  id: string;
  target: WordScrambleEntry;
  scrambledChars: string[];
  charChoices: WordScrambleCharChoice[];
  options: string[];
  revealMs: number;
  hintDelayMs: number;
  timeLimitMs: number;
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
    { word: "露营", hint: "在户外搭帐篷过夜", category: "活动" },
    { word: "齿轮", hint: "机器里咬合转动的圆形零件", category: "物品" },
    { word: "航线", hint: "飞机或船只预定经过的路线", category: "交通" },
    { word: "岩浆", hint: "火山里炽热流动的物质", category: "自然" },
    { word: "陶瓷", hint: "由泥土烧制成的器物材料", category: "材料" },
    { word: "磁铁", hint: "能吸住铁质物品", category: "物品" },
    { word: "暗号", hint: "约定后才懂的秘密信号", category: "沟通" },
    { word: "峡谷", hint: "两侧陡峭的狭长山谷", category: "地理" },
    { word: "沙漏", hint: "用细沙流动计时的工具", category: "物品" },
    { word: "轮廓", hint: "物体外缘形成的形状", category: "视觉" },
  ],
  hard: [
    { word: "观察力", hint: "快速发现细节和差异的能力", category: "能力" },
    { word: "博物馆", hint: "收藏、陈列和研究展品的场所", category: "地点" },
    { word: "方向盘", hint: "驾驶时控制车辆转向的部件", category: "物品" },
    { word: "降落伞", hint: "帮助人在空中减速下降", category: "物品" },
    { word: "记忆宫殿", hint: "把内容放进想象空间来记忆", category: "能力" },
    { word: "天气预报", hint: "提前说明晴雨冷暖变化", category: "生活" },
    { word: "图书管理员", hint: "负责借阅、归类和维护书架", category: "职业" },
    { word: "时间管理", hint: "安排任务先后、节奏和优先级", category: "能力" },
    { word: "注意力", hint: "持续把心理资源放在目标上", category: "能力" },
    { word: "路线规划", hint: "出发前设计经过地点和顺序", category: "生活" },
  ],
};

const DISTRACTOR_CHARS = "月亮铅笔火车苹果雨伞海浪书包花园篮球灯塔森林星球云朵河流城堡钟表地图";

const REVEAL_MS: Record<WordScrambleDifficulty, number[]> = {
  normal: [5200, 5000, 4800, 4600, 4400, 4200, 4000, 3800],
  hard: [4400, 4200, 4000, 3800, 3600, 3400, 3200, 3000],
};

const HINT_DELAY_MS: Record<WordScrambleDifficulty, number[]> = {
  normal: [0, 0, 350, 450, 550, 650, 750, 850],
  hard: [650, 800, 950, 1100, 1250, 1400, 1550, 1700],
};

const TIME_LIMIT_MS: Record<WordScrambleDifficulty, number[]> = {
  normal: [7600, 7300, 7000, 6700, 6400, 6100, 5800, 5500],
  hard: [6400, 6100, 5800, 5500, 5200, 4900, 4600, 4300],
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

function createDistractorChars(word: string, difficulty: WordScrambleDifficulty, questionIndex: number) {
  const targetChars = new Set(Array.from(word));
  const distractorCount = difficulty === "hard" ? 4 + Math.floor(questionIndex / 3) : 2 + Math.floor(questionIndex / 4);
  const source = shuffle(Array.from(DISTRACTOR_CHARS).filter((char) => !targetChars.has(char)));
  return source.slice(0, distractorCount);
}

function createCharChoices(
  word: string,
  difficulty: WordScrambleDifficulty,
  questionIndex: number,
): WordScrambleCharChoice[] {
  const targetChoices = createScrambledChars(word).map((char, index) => ({
    id: `target-${index + 1}-${char}`,
    char,
    isTarget: true,
  }));
  const distractorChoices = createDistractorChars(word, difficulty, questionIndex).map((char, index) => ({
    id: `decoy-${index + 1}-${char}`,
    char,
    isTarget: false,
  }));

  return shuffle([...targetChoices, ...distractorChoices]);
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

export function getWordScrambleHintDelayMs(difficulty: WordScrambleDifficulty, questionIndex: number) {
  return HINT_DELAY_MS[difficulty][clampQuestionIndex(questionIndex)];
}

export function getWordScrambleTimeLimitMs(difficulty: WordScrambleDifficulty, questionIndex: number) {
  return TIME_LIMIT_MS[difficulty][clampQuestionIndex(questionIndex)];
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
    charChoices: createCharChoices(target.word, difficulty, safeQuestionIndex),
    options: createOptions(target, bank),
    revealMs: getWordScrambleRevealMs(difficulty, safeQuestionIndex),
    hintDelayMs: getWordScrambleHintDelayMs(difficulty, safeQuestionIndex),
    timeLimitMs: getWordScrambleTimeLimitMs(difficulty, safeQuestionIndex),
  };
}

export function createWordScrambleSession(difficulty: WordScrambleDifficulty) {
  const bank = shuffle(WORD_BANK[difficulty]).slice(0, WORD_SCRAMBLE_TOTAL_QUESTIONS);
  return bank.map((target, index) => ({
    id: `word-scramble-${difficulty}-${index + 1}`,
    target,
    scrambledChars: createScrambledChars(target.word),
    charChoices: createCharChoices(target.word, difficulty, index),
    options: createOptions(target, WORD_BANK[difficulty]),
    revealMs: getWordScrambleRevealMs(difficulty, index),
    hintDelayMs: getWordScrambleHintDelayMs(difficulty, index),
    timeLimitMs: getWordScrambleTimeLimitMs(difficulty, index),
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

  const speedBonus = params.answerMs <= 2200 ? 1 : 0;
  const comboBonus = params.currentCombo >= 2 ? 1 : 0;

  return {
    correct: true,
    speedBonus,
    comboBonus,
    score: 4 + speedBonus + comboBonus,
  };
}
