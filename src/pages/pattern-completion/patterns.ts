import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type PatternShape = "circle" | "square" | "triangle";
export type PatternColorName = "coral" | "amber" | "emerald" | "sky" | "violet";
export type PatternSize = "small" | "medium" | "large";
export type PatternQuestionKind = "visual" | "numeric";
export type PatternRuleFamily =
  | "color-cycle"
  | "shape-cycle"
  | "dual-sync"
  | "odd-even"
  | "size-count"
  | "missing-position"
  | "numeric-sequence";

export interface VisualPatternOption {
  type: "visual";
  id: string;
  shape: PatternShape;
  colorName: PatternColorName;
  colorHex: string;
  label: string;
  size: PatternSize;
  count: number;
}

export interface NumericPatternOption {
  type: "number";
  id: string;
  value: number;
  label: string;
}

export type PatternOption = VisualPatternOption | NumericPatternOption;
export type PatternCell = PatternOption | null;

export interface PatternQuestion {
  id: string;
  kind: PatternQuestionKind;
  family: PatternRuleFamily;
  difficulty: number;
  title: string;
  prompt: string;
  sequence: PatternCell[];
  missingIndex: number;
  answer: PatternOption;
  options: PatternOption[];
  hint: string;
  explanationTitle: string;
  explanation: string;
}

export interface PatternScoreParams {
  isCorrect: boolean;
  currentCombo: number;
  elapsedMs: number;
  targetMs: number;
  hintUsed: boolean;
}

export interface PatternScoreResult {
  baseScore: number;
  comboBonus: number;
  speedBonus: number;
  hintPenalty: number;
  score: number;
}

export const PATTERN_SESSION_LENGTH = 8;
export const PATTERN_HINTS_PER_SESSION = 2;

const COLOR_HEX_MAP: Record<PatternColorName, string> = {
  coral: "#ef4444",
  amber: "#f59e0b",
  emerald: "#10b981",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
};

const SHAPE_LABEL_MAP: Record<PatternShape, string> = {
  circle: "圆形",
  square: "方形",
  triangle: "三角形",
};

const COLOR_LABEL_MAP: Record<PatternColorName, string> = {
  coral: "红色",
  amber: "橙色",
  emerald: "绿色",
  sky: "蓝色",
  violet: "紫色",
};

const SIZE_LABEL_MAP: Record<PatternSize, string> = {
  small: "小",
  medium: "中",
  large: "大",
};

const SHAPES: PatternShape[] = ["circle", "square", "triangle"];
const COLORS: PatternColorName[] = ["coral", "amber", "emerald", "sky", "violet"];
const SIZES: PatternSize[] = ["small", "medium", "large"];

const createVisualOption = (
  shape: PatternShape,
  colorName: PatternColorName,
  size: PatternSize = "medium",
  count = 1,
): VisualPatternOption => {
  const sizeLabel = size === "medium" ? "" : SIZE_LABEL_MAP[size];
  const countLabel = count > 1 ? `${count}个` : "";

  return {
    type: "visual",
    id: `visual-${shape}-${colorName}-${size}-${count}`,
    shape,
    colorName,
    colorHex: COLOR_HEX_MAP[colorName],
    label: `${countLabel}${sizeLabel}${COLOR_LABEL_MAP[colorName]}${SHAPE_LABEL_MAP[shape]}`,
    size,
    count,
  };
};

const createNumericOption = (value: number): NumericPatternOption => ({
  type: "number",
  id: `number-${value}`,
  value,
  label: `${value}`,
});

const positiveModulo = (value: number, length: number) => ((value % length) + length) % length;

const pickByIndex = <T>(items: T[], index: number) => items[positiveModulo(index, items.length)];

const rotate = <T>(items: T[], offset: number) => {
  return items.map((_, index) => pickByIndex(items, index + offset));
};

const uniqueOptions = (options: PatternOption[]) => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
};

const buildOptions = (answer: PatternOption, distractors: PatternOption[]) => {
  const options = uniqueOptions([answer, ...distractors]);
  const fallbackVisuals = SHAPES.flatMap((shape) => COLORS.map((color) => createVisualOption(shape, color)));
  const fallbackNumbers = [answer.label, 1, 2, 3, 5, 8, 13, 21]
    .map(Number)
    .filter((value) => Number.isFinite(value))
    .map(createNumericOption);
  const fallback = answer.type === "visual" ? fallbackVisuals : fallbackNumbers;

  fallback.forEach((option) => {
    if (options.length < 4 && !options.some((item) => item.id === option.id)) {
      options.push(option);
    }
  });

  return options.slice(0, 4);
};

const withMissing = (items: PatternOption[], missingIndex: number): PatternCell[] => {
  return items.map((item, index) => (index === missingIndex ? null : item));
};

const createQuestion = (params: {
  id: string;
  kind: PatternQuestionKind;
  family: PatternRuleFamily;
  difficulty: number;
  title: string;
  prompt: string;
  fullSequence: PatternOption[];
  missingIndex: number;
  answer: PatternOption;
  distractors: PatternOption[];
  hint: string;
  explanationTitle: string;
  explanation: string;
}): PatternQuestion => {
  return {
    id: params.id,
    kind: params.kind,
    family: params.family,
    difficulty: params.difficulty,
    title: params.title,
    prompt: params.prompt,
    sequence: withMissing(params.fullSequence, params.missingIndex),
    missingIndex: params.missingIndex,
    answer: params.answer,
    options: buildOptions(params.answer, params.distractors),
    hint: params.hint,
    explanationTitle: params.explanationTitle,
    explanation: params.explanation,
  };
};

export function scorePatternQuestion(params: PatternScoreParams): PatternScoreResult {
  if (!params.isCorrect) {
    return {
      baseScore: 0,
      comboBonus: 0,
      speedBonus: 0,
      hintPenalty: 0,
      score: 0,
    };
  }

  const baseScore = 3;
  const comboBonus = Math.min(2, Math.max(0, params.currentCombo));
  const speedBonus = params.elapsedMs <= params.targetMs ? 1 : 0;
  const hintPenalty = params.hintUsed ? 1 : 0;
  const score = Math.max(1, baseScore + comboBonus + speedBonus - hintPenalty);

  return {
    baseScore,
    comboBonus,
    speedBonus,
    hintPenalty,
    score,
  };
}

export function createColorCycleQuestion(index: number, difficulty: TrainingDifficulty): PatternQuestion {
  const colors = rotate(COLORS.slice(0, difficulty === "hard" ? 4 : 3), index);
  const shape = pickByIndex(SHAPES, index);
  const fullSequence = [0, 1, 2, 3, 4].map((step) => createVisualOption(shape, pickByIndex(colors, step)));
  const missingIndex = difficulty === "hard" && index % 2 === 1 ? 3 : 4;
  const answer = fullSequence[missingIndex];

  return createQuestion({
    id: `color-cycle-${difficulty}-${index}`,
    kind: "visual",
    family: "color-cycle",
    difficulty: difficulty === "hard" ? 4 : 1,
    title: "找出颜色循环",
    prompt: "观察颜色顺序，补上缺口。",
    fullSequence,
    missingIndex,
    answer,
    distractors: [
      createVisualOption(shape, pickByIndex(colors, missingIndex + 1)),
      createVisualOption(pickByIndex(SHAPES, index + 1), answer.colorName),
      createVisualOption(shape, pickByIndex(colors, missingIndex + 2)),
    ],
    hint: "先看颜色顺序，形状暂时不用变。",
    explanationTitle: "颜色循环",
    explanation: `颜色按${colors.map((color) => COLOR_LABEL_MAP[color]).join("、")}重复，形状保持${SHAPE_LABEL_MAP[shape]}。`,
  });
}

export function createShapeCycleQuestion(index: number, difficulty: TrainingDifficulty): PatternQuestion {
  const shapes = rotate(SHAPES, index);
  const color = pickByIndex(COLORS, index + 1);
  const fullSequence = [0, 1, 2, 3, 4].map((step) => createVisualOption(pickByIndex(shapes, step), color));
  const missingIndex = difficulty === "hard" && index % 2 === 0 ? 2 : 4;
  const answer = fullSequence[missingIndex];

  return createQuestion({
    id: `shape-cycle-${difficulty}-${index}`,
    kind: "visual",
    family: "shape-cycle",
    difficulty: difficulty === "hard" ? 4 : 1,
    title: "找出形状循环",
    prompt: "观察形状顺序，补上缺口。",
    fullSequence,
    missingIndex,
    answer,
    distractors: [
      createVisualOption(pickByIndex(shapes, missingIndex + 1), color),
      createVisualOption(answer.shape, pickByIndex(COLORS, index + 2)),
      createVisualOption(pickByIndex(shapes, missingIndex + 2), color),
    ],
    hint: "先看圆形、方形、三角形的顺序。",
    explanationTitle: "形状循环",
    explanation: `形状按${shapes.map((shape) => SHAPE_LABEL_MAP[shape]).join("、")}重复，颜色保持${COLOR_LABEL_MAP[color]}。`,
  });
}

export function createDualSyncQuestion(index: number, difficulty: TrainingDifficulty): PatternQuestion {
  const colors = rotate(COLORS.slice(0, 4), index);
  const shapes = rotate(SHAPES, index + 1);
  const fullSequence = [0, 1, 2, 3, 4].map((step) =>
    createVisualOption(pickByIndex(shapes, step), pickByIndex(colors, step)),
  );
  const missingIndex = difficulty === "hard" && index % 2 === 0 ? 3 : 4;
  const answer = fullSequence[missingIndex];

  return createQuestion({
    id: `dual-sync-${difficulty}-${index}`,
    kind: "visual",
    family: "dual-sync",
    difficulty: difficulty === "hard" ? 6 : 4,
    title: "同步追踪两条线索",
    prompt: "颜色和形状都在变化，找出缺口。",
    fullSequence,
    missingIndex,
    answer,
    distractors: [
      createVisualOption(answer.shape, pickByIndex(colors, missingIndex + 1)),
      createVisualOption(pickByIndex(shapes, missingIndex + 1), answer.colorName),
      createVisualOption(pickByIndex(shapes, missingIndex + 1), pickByIndex(colors, missingIndex + 1)),
    ],
    hint: "颜色和形状要分开看，再合在一起。",
    explanationTitle: "颜色循环 · 形状循环",
    explanation: "颜色和形状各自向前推进，缺口需要同时满足两条顺序。",
  });
}

export function createOddEvenQuestion(index: number, difficulty: TrainingDifficulty): PatternQuestion {
  const oddColor = pickByIndex(COLORS, index);
  const evenColor = pickByIndex(COLORS, index + 2);
  const oddShapes = rotate(SHAPES, index);
  const evenShapes = rotate(SHAPES, index + 1);
  const fullSequence = [0, 1, 2, 3, 4].map((step) => {
    const trackIndex = Math.floor(step / 2);
    return step % 2 === 0
      ? createVisualOption(pickByIndex(oddShapes, trackIndex), oddColor)
      : createVisualOption(pickByIndex(evenShapes, trackIndex), evenColor);
  });
  const missingIndex = difficulty === "hard" ? 3 : 4;
  const answer = fullSequence[missingIndex];

  return createQuestion({
    id: `odd-even-${difficulty}-${index}`,
    kind: "visual",
    family: "odd-even",
    difficulty: difficulty === "hard" ? 7 : 6,
    title: "分开观察奇偶位",
    prompt: "奇数位和偶数位各自有规律。",
    fullSequence,
    missingIndex,
    answer,
    distractors: [
      fullSequence[missingIndex === 4 ? 3 : 4],
      createVisualOption(answer.shape, missingIndex % 2 === 0 ? evenColor : oddColor),
      createVisualOption(pickByIndex(SHAPES, index + 2), answer.colorName),
    ],
    hint: "把第 1、3、5 位和第 2、4 位分开看。",
    explanationTitle: "奇偶双轨",
    explanation: "奇数位是一条形状递进线，偶数位是另一条递进线，不能混在一起判断。",
  });
}

export function createSizeCountQuestion(index: number, difficulty: TrainingDifficulty): PatternQuestion {
  const color = pickByIndex(COLORS, index + 3);
  const shape = pickByIndex(SHAPES, index + 2);
  const counts = difficulty === "hard" ? [1, 2, 3, 1, 2] : [1, 2, 3, 1, 2];
  const sizes = rotate(SIZES, index);
  const fullSequence = [0, 1, 2, 3, 4].map((step) =>
    createVisualOption(shape, color, pickByIndex(sizes, step), counts[step]),
  );
  const missingIndex = difficulty === "hard" ? 2 : 4;
  const answer = fullSequence[missingIndex];

  return createQuestion({
    id: `size-count-${difficulty}-${index}`,
    kind: "visual",
    family: "size-count",
    difficulty: difficulty === "hard" ? 8 : 7,
    title: "观察大小与数量",
    prompt: "每格的大小或数量正在变化。",
    fullSequence,
    missingIndex,
    answer,
    distractors: [
      createVisualOption(shape, color, answer.size, answer.count === 3 ? 1 : answer.count + 1),
      createVisualOption(shape, color, pickByIndex(sizes, missingIndex + 1), answer.count),
      createVisualOption(pickByIndex(SHAPES, index), color, answer.size, answer.count),
    ],
    hint: "注意每格里有几个图形，以及图形大小。",
    explanationTitle: "尺寸/数量变化",
    explanation: "数量按 1、2、3 循环，大小也按小、中、大推进。",
  });
}

export function createMissingPositionQuestion(index: number, difficulty: TrainingDifficulty): PatternQuestion {
  const colors = rotate(COLORS.slice(0, 4), index + 1);
  const shapes = rotate(SHAPES, index + 2);
  const fullSequence = [0, 1, 2, 3, 4].map((step) =>
    createVisualOption(pickByIndex(shapes, step), pickByIndex(colors, step)),
  );
  const missingIndex = difficulty === "hard" ? 2 : 3;
  const answer = fullSequence[missingIndex];

  return createQuestion({
    id: `missing-position-${difficulty}-${index}`,
    kind: "visual",
    family: "missing-position",
    difficulty: difficulty === "hard" ? 8 : 7,
    title: "补上中间缺口",
    prompt: "缺口不一定在最后，要从前后一起推。",
    fullSequence,
    missingIndex,
    answer,
    distractors: [
      createVisualOption(answer.shape, pickByIndex(colors, missingIndex + 1)),
      createVisualOption(pickByIndex(shapes, missingIndex + 1), answer.colorName),
      createVisualOption(pickByIndex(shapes, missingIndex - 1), pickByIndex(colors, missingIndex - 1)),
    ],
    hint: "同时看缺口前后的颜色和形状顺序。",
    explanationTitle: "缺失位置变化",
    explanation: "缺口在序列中间，颜色和形状都要接上前后的循环。",
  });
}

export function createArithmeticQuestion(index: number, difficulty: TrainingDifficulty): PatternQuestion {
  const start = difficulty === "hard" ? 4 + index : 2 + index;
  const step = difficulty === "hard" ? 3 + (index % 4) : 2 + (index % 3);
  const values = [0, 1, 2, 3, 4].map((item) => start + item * step);
  const fullSequence = values.map(createNumericOption);
  const missingIndex = difficulty === "hard" && index % 2 === 1 ? 3 : 4;
  const answer = fullSequence[missingIndex];

  return createQuestion({
    id: `number-arithmetic-${difficulty}-${index}`,
    kind: "numeric",
    family: "numeric-sequence",
    difficulty: difficulty === "hard" ? 5 : 2,
    title: "数字等差",
    prompt: "观察数字之间的固定差值。",
    fullSequence,
    missingIndex,
    answer,
    distractors: [step - 1, step + 1, step + 2].map((delta) => createNumericOption(answer.value + delta)),
    hint: "先算相邻两个数字相差多少。",
    explanationTitle: "等差规律",
    explanation: `每次都加 ${step}，所以缺口是 ${answer.value}。`,
  });
}

export function createIncreasingDifferenceQuestion(index: number, difficulty: TrainingDifficulty): PatternQuestion {
  const start = difficulty === "hard" ? 3 + index : 2 + index;
  const firstDiff = difficulty === "hard" ? 2 + (index % 3) : 1 + (index % 2);
  const values = [start];

  for (let step = 0; step < 4; step += 1) {
    values.push(values[step] + firstDiff + step);
  }

  const fullSequence = values.map(createNumericOption);
  const missingIndex = difficulty === "hard" ? 3 : 4;
  const answer = fullSequence[missingIndex];

  return createQuestion({
    id: `number-increasing-diff-${difficulty}-${index}`,
    kind: "numeric",
    family: "numeric-sequence",
    difficulty: difficulty === "hard" ? 7 : 4,
    title: "差值递增",
    prompt: "相邻数字的差值也在变化。",
    fullSequence,
    missingIndex,
    answer,
    distractors: [-2, 1, 3].map((delta) => createNumericOption(answer.value + delta)),
    hint: "不要只看数字本身，先写出相邻差值。",
    explanationTitle: "相邻差值递增",
    explanation: `相邻差值依次为 ${[0, 1, 2, 3].map((step) => `+${firstDiff + step}`).join("、")}。`,
  });
}

export function createFibonacciQuestion(index: number, difficulty: TrainingDifficulty): PatternQuestion {
  const first = 1 + (index % 3);
  const second = difficulty === "hard" ? first + 2 : first + 1;
  const values = [first, second];

  for (let step = 2; step < 5; step += 1) {
    values.push(values[step - 1] + values[step - 2]);
  }

  const fullSequence = values.map(createNumericOption);
  const missingIndex = difficulty === "hard" && index % 2 === 0 ? 3 : 4;
  const answer = fullSequence[missingIndex];

  return createQuestion({
    id: `number-fibonacci-${difficulty}-${index}`,
    kind: "numeric",
    family: "numeric-sequence",
    difficulty: difficulty === "hard" ? 7 : 3,
    title: "前两项相加",
    prompt: "观察前后数字之间的关系。",
    fullSequence,
    missingIndex,
    answer,
    distractors: [-1, 2, 4].map((delta) => createNumericOption(answer.value + delta)),
    hint: "试试把前两个数字相加。",
    explanationTitle: "类斐波那契",
    explanation: `每一项等于前两项之和，所以缺口是 ${answer.value}。`,
  });
}

export function createInterleavedQuestion(index: number): PatternQuestion {
  const oddStart = 2 + index;
  const evenStart = 9 + index;
  const values = [oddStart, evenStart, oddStart + 2, evenStart + 3, oddStart + 4];
  const fullSequence = values.map(createNumericOption);
  const missingIndex = 3;
  const answer = fullSequence[missingIndex];

  return createQuestion({
    id: `number-interleaved-hard-${index}`,
    kind: "numeric",
    family: "numeric-sequence",
    difficulty: 8,
    title: "交错数字轨道",
    prompt: "奇数位和偶数位分别变化。",
    fullSequence,
    missingIndex,
    answer,
    distractors: [answer.value - 2, answer.value + 2, oddStart + 6].map(createNumericOption),
    hint: "分开看第 1、3、5 位和第 2、4 位。",
    explanationTitle: "数字奇偶双轨",
    explanation: "奇数位每次加 2，偶数位每次加 3，所以缺口来自偶数位轨道。",
  });
}

export function createPatternQuestion(difficulty: TrainingDifficulty, index: number): PatternQuestion {
  const normalFactories = [
    createColorCycleQuestion,
    createShapeCycleQuestion,
    createArithmeticQuestion,
    createFibonacciQuestion,
    createDualSyncQuestion,
    createDualSyncQuestion,
    createOddEvenQuestion,
    createSizeCountQuestion,
  ];
  const hardFactories: Array<(caseIndex: number, mode: TrainingDifficulty) => PatternQuestion> = [
    createDualSyncQuestion,
    createOddEvenQuestion,
    createArithmeticQuestion,
    createIncreasingDifferenceQuestion,
    createInterleavedQuestion,
    createSizeCountQuestion,
    createMissingPositionQuestion,
    createShapeCycleQuestion,
  ];
  const factories = difficulty === "hard" ? hardFactories : normalFactories;

  try {
    return factories[index](index, difficulty);
  } catch {
    return difficulty === "hard"
      ? createDualSyncQuestion(index, difficulty)
      : createColorCycleQuestion(index, difficulty);
  }
}

export function generatePatternSession(difficulty: TrainingDifficulty): PatternQuestion[] {
  return Array.from({ length: PATTERN_SESSION_LENGTH }, (_, index) => createPatternQuestion(difficulty, index));
}
