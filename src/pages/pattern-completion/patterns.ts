import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type PatternShape = "circle" | "square" | "triangle" | "diamond";
export type PatternColorName = "coral" | "amber" | "emerald" | "sky" | "violet";
export type PatternSize = "small" | "medium" | "large";
export type PatternPosition =
  | "center"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left";
export type PatternLayout = "sequence" | "grid";
export type PatternRuleFamily =
  | "dual-attribute-sequence"
  | "row-column-matrix"
  | "count-size-transform"
  | "position-shift";

export interface VisualPatternOption {
  type: "visual";
  id: string;
  shape: PatternShape;
  colorName: PatternColorName;
  colorHex: string;
  label: string;
  size: PatternSize;
  count: number;
  position: PatternPosition;
}

export type PatternOption = VisualPatternOption;
export type PatternCell = PatternOption | null;

export interface PatternQuestion {
  id: string;
  layout: PatternLayout;
  family: PatternRuleFamily;
  difficulty: number;
  title: string;
  prompt: string;
  cells: PatternCell[];
  columns: number;
  missingIndex: number;
  answer: PatternOption;
  options: PatternOption[];
  hint: string;
  ruleSummary: string;
  explanationTitle: string;
  explanation: string;
  ruleCount: number;
  partialDistractorIds: string[];
  distractorExplanations?: Record<string, string>;
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
  diamond: "菱形",
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

const POSITION_LABEL_MAP: Record<PatternPosition, string> = {
  center: "居中",
  top: "上方",
  right: "右侧",
  bottom: "下方",
  left: "左侧",
  "top-left": "左上",
  "top-right": "右上",
  "bottom-right": "右下",
  "bottom-left": "左下",
};

const SHAPES: PatternShape[] = ["circle", "square", "triangle", "diamond"];
const COLORS: PatternColorName[] = ["coral", "amber", "emerald", "sky", "violet"];
const SIZES: PatternSize[] = ["small", "medium", "large"];
const CARDINAL_POSITIONS: PatternPosition[] = ["top", "right", "bottom", "left"];
const CORNER_POSITIONS: PatternPosition[] = ["top-left", "top-right", "bottom-right", "bottom-left"];

const positiveModulo = (value: number, length: number) => ((value % length) + length) % length;

const pickByIndex = <T>(items: T[], index: number) => items[positiveModulo(index, items.length)];

const rotate = <T>(items: T[], offset: number) => {
  return items.map((_, index) => pickByIndex(items, index + offset));
};

export const createVisualOption = (params: {
  shape: PatternShape;
  colorName: PatternColorName;
  size?: PatternSize;
  count?: number;
  position?: PatternPosition;
}): VisualPatternOption => {
  const size = params.size ?? "medium";
  const count = params.count ?? 1;
  const position = params.position ?? "center";
  const countLabel = count > 1 ? `${count}个` : "";
  const sizeLabel = size === "medium" ? "" : SIZE_LABEL_MAP[size];
  const positionLabel = position === "center" ? "" : `${POSITION_LABEL_MAP[position]}`;

  return {
    type: "visual",
    id: `visual-${params.shape}-${params.colorName}-${size}-${count}-${position}`,
    shape: params.shape,
    colorName: params.colorName,
    colorHex: COLOR_HEX_MAP[params.colorName],
    label: `${positionLabel}${countLabel}${sizeLabel}${COLOR_LABEL_MAP[params.colorName]}${SHAPE_LABEL_MAP[params.shape]}`,
    size,
    count,
    position,
  };
};

const uniqueOptions = (options: PatternOption[]) => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
};

const fallbackOptions = (answer: PatternOption) => {
  return SHAPES.flatMap((shape) =>
    COLORS.map((colorName) =>
      createVisualOption({
        shape,
        colorName,
        size: answer.size,
        count: answer.count,
        position: answer.position,
      }),
    ),
  );
};

const orderOptions = (options: PatternOption[], offset: number) => {
  const unique = uniqueOptions(options);
  return rotate(unique, offset).slice(0, 4);
};

const buildOptions = (params: {
  answer: PatternOption;
  distractors: PatternOption[];
  partialDistractorIds: string[];
  offset: number;
}) => {
  const options = uniqueOptions([
    params.answer,
    ...params.distractors.filter((distractor) => distractor.id !== params.answer.id),
  ]);
  fallbackOptions(params.answer).forEach((option) => {
    if (options.length < 4 && !options.some((item) => item.id === option.id)) {
      options.push(option);
    }
  });

  return {
    options: orderOptions(options, params.offset),
    partialDistractorIds: params.partialDistractorIds.filter(
      (id) => id !== params.answer.id && options.some((option) => option.id === id),
    ),
  };
};

const withMissing = (items: PatternOption[], missingIndex: number): PatternCell[] => {
  return items.map((item, index) => (index === missingIndex ? null : item));
};

const createQuestion = (params: {
  id: string;
  layout: PatternLayout;
  family: PatternRuleFamily;
  difficulty: number;
  title: string;
  prompt: string;
  fullCells: PatternOption[];
  columns: number;
  missingIndex: number;
  answer: PatternOption;
  distractors: PatternOption[];
  partialDistractorIds: string[];
  hint: string;
  ruleSummary: string;
  explanationTitle: string;
  explanation: string;
  ruleCount: number;
  distractorExplanations?: Record<string, string>;
  optionOffset?: number;
}): PatternQuestion => {
  const optionResult = buildOptions({
    answer: params.answer,
    distractors: params.distractors,
    partialDistractorIds: params.partialDistractorIds,
    offset: params.optionOffset ?? params.missingIndex,
  });

  return {
    id: params.id,
    layout: params.layout,
    family: params.family,
    difficulty: params.difficulty,
    title: params.title,
    prompt: params.prompt,
    cells: withMissing(params.fullCells, params.missingIndex),
    columns: params.columns,
    missingIndex: params.missingIndex,
    answer: params.answer,
    options: optionResult.options,
    hint: params.hint,
    ruleSummary: params.ruleSummary,
    explanationTitle: params.explanationTitle,
    explanation: params.explanation,
    ruleCount: params.ruleCount,
    partialDistractorIds: optionResult.partialDistractorIds,
    distractorExplanations: params.distractorExplanations,
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
  const comboBonus = params.currentCombo > 0 ? 1 : 0;
  const speedBonus = params.elapsedMs <= params.targetMs ? 1 : 0;
  const hintPenalty = params.hintUsed ? 1 : 0;
  const score = Math.max(1, Math.min(5, baseScore + comboBonus + speedBonus - hintPenalty));

  return {
    baseScore,
    comboBonus,
    speedBonus,
    hintPenalty,
    score,
  };
}

export function createDualAttributeSequenceQuestion(
  index: number,
  difficulty: TrainingDifficulty,
): PatternQuestion {
  const shapes = rotate(SHAPES, index);
  const colors = rotate(COLORS, index + 1);
  const sizes = rotate(SIZES, index % SIZES.length);
  const isHard = difficulty === "hard";
  const fullCells = Array.from({ length: 5 }, (_, step) =>
    createVisualOption({
      shape: pickByIndex(shapes, step),
      colorName: pickByIndex(colors, isHard ? Math.floor(step / 2) + step : step),
      size: isHard ? pickByIndex(sizes, step) : "medium",
    }),
  );
  const missingIndex = isHard && index % 2 === 0 ? 3 : 4;
  const answer = fullCells[missingIndex];
  const colorOnly = createVisualOption({
    shape: pickByIndex(SHAPES, SHAPES.indexOf(answer.shape) + 1),
    colorName: answer.colorName,
    size: answer.size,
  });
  const shapeOnly = createVisualOption({
    shape: answer.shape,
    colorName: pickByIndex(COLORS, COLORS.indexOf(answer.colorName) + 1),
    size: answer.size,
  });
  const sizeTrap = createVisualOption({
    shape: answer.shape,
    colorName: answer.colorName,
    size: pickByIndex(SIZES, SIZES.indexOf(answer.size) + 1),
  });

  return createQuestion({
    id: `dual-attribute-${difficulty}-${index}`,
    layout: "sequence",
    family: "dual-attribute-sequence",
    difficulty: isHard ? 6 : 3,
    title: isHard ? "双线索错位推进" : "同时观察两条线索",
    prompt: "形状和颜色都在变化，找出同时满足两条规律的缺口。",
    fullCells,
    columns: 5,
    missingIndex,
    answer,
    distractors: [colorOnly, shapeOnly, sizeTrap],
    partialDistractorIds: [colorOnly.id, shapeOnly.id],
    hint: "先分别看形状和颜色，它们不是同一步变化。",
    ruleSummary: "形状一格一变，颜色按另一条节奏推进。",
    explanationTitle: "双属性序列",
    explanation: `缺口必须同时满足形状推进到${SHAPE_LABEL_MAP[answer.shape]}，颜色推进到${COLOR_LABEL_MAP[answer.colorName]}。`,
    ruleCount: isHard ? 3 : 2,
    distractorExplanations: {
      [colorOnly.id]: "这个选项颜色对了，但形状提前走了一步。",
      [shapeOnly.id]: "这个选项形状对了，但颜色没有接上对应节奏。",
      [sizeTrap.id]: "这个选项形状和颜色对了，但大小不符合本题节奏。",
    },
  });
}

export function createRowColumnMatrixQuestion(
  index: number,
  difficulty: TrainingDifficulty,
): PatternQuestion {
  const isHard = difficulty === "hard";
  const columns = isHard ? 3 : 3;
  const rows = isHard ? 3 : 2;
  const shapes = rotate(SHAPES.slice(0, 3), index);
  const colors = rotate(COLORS.slice(0, 4), index + 2);
  const counts = [1, 2, 3];
  const fullCells = Array.from({ length: rows * columns }, (_, cellIndex) => {
    const row = Math.floor(cellIndex / columns);
    const column = cellIndex % columns;
    return createVisualOption({
      shape: pickByIndex(shapes, column + row),
      colorName: pickByIndex(colors, row + column),
      count: isHard ? pickByIndex(counts, row + column) : 1,
    });
  });
  const missingIndex = isHard ? 4 : 5;
  const answer = fullCells[missingIndex];
  const row = Math.floor(missingIndex / columns);
  const column = missingIndex % columns;
  const rowOnly = createVisualOption({
    shape: answer.shape,
    colorName: pickByIndex(colors, row + column + 1),
    count: answer.count,
  });
  const columnOnly = createVisualOption({
    shape: pickByIndex(shapes, column + row + 1),
    colorName: answer.colorName,
    count: answer.count,
  });
  const countTrap = createVisualOption({
    shape: answer.shape,
    colorName: answer.colorName,
    count: pickByIndex(counts, answer.count),
  });

  return createQuestion({
    id: `row-column-${difficulty}-${index}`,
    layout: "grid",
    family: "row-column-matrix",
    difficulty: isHard ? 8 : 5,
    title: isHard ? "横纵交叉验证" : "行列一起看",
    prompt: "缺口要同时满足横向和纵向规律。",
    fullCells,
    columns,
    missingIndex,
    answer,
    distractors: [rowOnly, columnOnly, countTrap],
    partialDistractorIds: [rowOnly.id, columnOnly.id, countTrap.id],
    hint: "先横向看一遍，再纵向检查缺口。",
    ruleSummary: isHard ? "形状、颜色和数量都由行列位置决定。" : "形状按列推进，颜色沿行列斜向推进。",
    explanationTitle: "行列矩阵",
    explanation: `缺口位于第 ${row + 1} 行第 ${column + 1} 列，因此需要${COLOR_LABEL_MAP[answer.colorName]}${SHAPE_LABEL_MAP[answer.shape]}${answer.count > 1 ? `，数量为 ${answer.count}` : ""}。`,
    ruleCount: isHard ? 3 : 2,
    distractorExplanations: {
      [rowOnly.id]: "这个选项满足形状位置，但颜色不满足纵向推进。",
      [columnOnly.id]: "这个选项颜色对了，但形状不满足横向位置。",
      [countTrap.id]: "这个选项形状和颜色对了，但数量没有接上。",
    },
  });
}

export function createCountSizeTransformQuestion(
  index: number,
  difficulty: TrainingDifficulty,
): PatternQuestion {
  const isHard = difficulty === "hard";
  const shape = pickByIndex(SHAPES, index + 1);
  const colorName = pickByIndex(COLORS, index + 3);
  const counts = rotate([1, 2, 3], index);
  const sizes = rotate(SIZES, index + 1);
  const positions = rotate(CARDINAL_POSITIONS, index);
  const fullCells = Array.from({ length: 5 }, (_, step) =>
    createVisualOption({
      shape,
      colorName,
      count: pickByIndex(counts, step),
      size: pickByIndex(sizes, isHard ? step + 1 : step),
      position: isHard ? pickByIndex(positions, step) : "center",
    }),
  );
  const missingIndex = isHard ? 2 : 4;
  const answer = fullCells[missingIndex];
  const countOnly = createVisualOption({
    shape,
    colorName,
    count: answer.count,
    size: pickByIndex(SIZES, SIZES.indexOf(answer.size) + 1),
    position: answer.position,
  });
  const sizeOnly = createVisualOption({
    shape,
    colorName,
    count: pickByIndex(counts, missingIndex + 1),
    size: answer.size,
    position: answer.position,
  });
  const positionTrap = createVisualOption({
    shape,
    colorName,
    count: answer.count,
    size: answer.size,
    position: isHard ? pickByIndex(positions, missingIndex + 1) : "right",
  });

  return createQuestion({
    id: `count-size-${difficulty}-${index}`,
    layout: "sequence",
    family: "count-size-transform",
    difficulty: isHard ? 7 : 4,
    title: isHard ? "数量大小位置同看" : "数量和大小变化",
    prompt: "每格的数量和大小都可能在变化。",
    fullCells,
    columns: 5,
    missingIndex,
    answer,
    distractors: [countOnly, sizeOnly, positionTrap],
    partialDistractorIds: [countOnly.id, sizeOnly.id],
    hint: "注意数量和大小是两条不同的线索。",
    ruleSummary: isHard ? "数量、大小和位置各自循环。" : "数量按 1、2、3 循环，大小也按小、中、大推进。",
    explanationTitle: "数量/大小变换",
    explanation: `缺口处数量应为 ${answer.count}，大小应为${SIZE_LABEL_MAP[answer.size]}${isHard ? `，位置应在${POSITION_LABEL_MAP[answer.position]}` : ""}。`,
    ruleCount: isHard ? 3 : 2,
    distractorExplanations: {
      [countOnly.id]: "这个选项数量对了，但大小节奏不对。",
      [sizeOnly.id]: "这个选项大小对了，但数量节奏不对。",
      [positionTrap.id]: "这个选项数量和大小对了，但位置移动不对。",
    },
  });
}

export function createPositionShiftQuestion(
  index: number,
  difficulty: TrainingDifficulty,
): PatternQuestion {
  const isHard = difficulty === "hard";
  const positions = rotate(isHard ? CORNER_POSITIONS : CARDINAL_POSITIONS, index);
  const colors = rotate(COLORS, index + 1);
  const shape = pickByIndex(SHAPES, index + 2);
  const fullCells = Array.from({ length: 5 }, (_, step) =>
    createVisualOption({
      shape: isHard ? pickByIndex(SHAPES, index + step) : shape,
      colorName: pickByIndex(colors, isHard ? step : Math.floor(step / 2)),
      position: pickByIndex(positions, step),
    }),
  );
  const missingIndex = isHard ? 3 : 4;
  const answer = fullCells[missingIndex];
  const positionOnly = createVisualOption({
    shape: pickByIndex(SHAPES, index + missingIndex + 1),
    colorName: answer.colorName,
    position: answer.position,
  });
  const colorOnly = createVisualOption({
    shape: answer.shape,
    colorName: pickByIndex(colors, missingIndex + 1),
    position: answer.position,
  });
  const wrongPosition = createVisualOption({
    shape: answer.shape,
    colorName: answer.colorName,
    position: pickByIndex(positions, missingIndex + 1),
  });

  return createQuestion({
    id: `position-shift-${difficulty}-${index}`,
    layout: "sequence",
    family: "position-shift",
    difficulty: isHard ? 8 : 5,
    title: isHard ? "位置、颜色、形状同步判断" : "观察位置移动",
    prompt: "图形在格子里的位置沿固定方向移动。",
    fullCells,
    columns: 5,
    missingIndex,
    answer,
    distractors: [positionOnly, colorOnly, wrongPosition],
    partialDistractorIds: [positionOnly.id, colorOnly.id, wrongPosition.id],
    hint: "观察图形在格子里的位置移动方向。",
    ruleSummary: isHard ? "位置绕角移动，颜色和形状也同步推进。" : "位置按固定方向循环移动。",
    explanationTitle: "位置移动",
    explanation: `缺口处位置应在${POSITION_LABEL_MAP[answer.position]}，同时保持${COLOR_LABEL_MAP[answer.colorName]}${SHAPE_LABEL_MAP[answer.shape]}。`,
    ruleCount: isHard ? 3 : 2,
    distractorExplanations: {
      [positionOnly.id]: "这个选项位置对了，但形状没有接上。",
      [colorOnly.id]: "这个选项位置和形状对了，但颜色不对。",
      [wrongPosition.id]: "这个选项形状和颜色对了，但位置多走了一步。",
    },
  });
}

export function createPatternQuestion(difficulty: TrainingDifficulty, index: number): PatternQuestion {
  const normalFactories = [
    createDualAttributeSequenceQuestion,
    createCountSizeTransformQuestion,
    createRowColumnMatrixQuestion,
    createDualAttributeSequenceQuestion,
    createCountSizeTransformQuestion,
    createRowColumnMatrixQuestion,
    createPositionShiftQuestion,
    createPositionShiftQuestion,
  ];
  const hardFactories = [
    createDualAttributeSequenceQuestion,
    createRowColumnMatrixQuestion,
    createPositionShiftQuestion,
    createRowColumnMatrixQuestion,
    createCountSizeTransformQuestion,
    createPositionShiftQuestion,
    createDualAttributeSequenceQuestion,
    createCountSizeTransformQuestion,
  ];
  const factories = difficulty === "hard" ? hardFactories : normalFactories;
  const factory = factories[index] ?? createDualAttributeSequenceQuestion;

  return factory(index, difficulty);
}

export function generatePatternSession(difficulty: TrainingDifficulty): PatternQuestion[] {
  return Array.from({ length: PATTERN_SESSION_LENGTH }, (_, index) => createPatternQuestion(difficulty, index));
}
