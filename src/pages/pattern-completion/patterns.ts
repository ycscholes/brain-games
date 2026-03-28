export type PatternShape = "circle" | "square" | "triangle";
export type PatternColorName = "coral" | "amber" | "emerald" | "sky" | "violet";

export interface PatternOption {
  id: string;
  shape: PatternShape;
  colorName: PatternColorName;
  colorHex: string;
  label: string;
}

export interface PatternQuestion {
  id: string;
  difficulty: number;
  description: string;
  sequence: [PatternOption, PatternOption, PatternOption, PatternOption];
  answer: PatternOption;
  options: PatternOption[];
}

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

const createOption = (
  shape: PatternShape,
  colorName: PatternColorName
): PatternOption => {
  return {
    id: `${shape}-${colorName}`,
    shape,
    colorName,
    colorHex: COLOR_HEX_MAP[colorName],
    label: `${COLOR_LABEL_MAP[colorName]}${SHAPE_LABEL_MAP[shape]}`,
  };
};

const circleCoral = createOption("circle", "coral");
const circleAmber = createOption("circle", "amber");
const circleEmerald = createOption("circle", "emerald");
const circleSky = createOption("circle", "sky");
const circleViolet = createOption("circle", "violet");

const squareCoral = createOption("square", "coral");
const squareAmber = createOption("square", "amber");
const squareEmerald = createOption("square", "emerald");
const squareSky = createOption("square", "sky");
const squareViolet = createOption("square", "violet");

const triangleCoral = createOption("triangle", "coral");
const triangleAmber = createOption("triangle", "amber");
const triangleEmerald = createOption("triangle", "emerald");
const triangleSky = createOption("triangle", "sky");
const triangleViolet = createOption("triangle", "violet");

export const PATTERN_QUESTION_BANK: PatternQuestion[] = [
  {
    id: "pattern-1",
    difficulty: 1,
    description: "颜色按红、蓝交替出现，形状保持不变。",
    sequence: [circleCoral, circleSky, circleCoral, circleSky],
    answer: circleCoral,
    options: [circleCoral, circleSky, squareCoral],
  },
  {
    id: "pattern-2",
    difficulty: 2,
    description: "形状在方形与三角形之间来回切换，颜色保持一致。",
    sequence: [squareEmerald, triangleEmerald, squareEmerald, triangleEmerald],
    answer: squareEmerald,
    options: [squareEmerald, triangleEmerald, circleEmerald, squareSky],
  },
  {
    id: "pattern-3",
    difficulty: 3,
    description: "颜色按三步循环推进，形状保持不变。",
    sequence: [circleAmber, circleSky, circleViolet, circleAmber],
    answer: circleSky,
    options: [circleSky, circleViolet, circleAmber],
  },
  {
    id: "pattern-4",
    difficulty: 4,
    description: "形状按圆形、三角形、方形的顺序循环，颜色保持不变。",
    sequence: [circleCoral, triangleCoral, squareCoral, circleCoral],
    answer: triangleCoral,
    options: [triangleCoral, squareCoral, circleCoral, triangleSky],
  },
  {
    id: "pattern-5",
    difficulty: 5,
    description: "颜色按红、蓝、绿循环，形状则在圆形与方形之间交替。",
    sequence: [circleCoral, squareSky, circleEmerald, squareCoral],
    answer: circleSky,
    options: [circleSky, squareEmerald, squareSky, circleCoral],
  },
  {
    id: "pattern-6",
    difficulty: 6,
    description: "形状按三角形、圆形、方形循环；颜色每两步更换一次。",
    sequence: [triangleViolet, circleViolet, squareAmber, triangleAmber],
    answer: circleEmerald,
    options: [circleEmerald, squareEmerald, circleAmber, circleViolet],
  },
  {
    id: "pattern-7",
    difficulty: 7,
    description: "奇数位与偶数位分别成组变化：颜色固定，形状各自递进。",
    sequence: [circleCoral, circleSky, squareCoral, squareSky],
    answer: triangleCoral,
    options: [triangleCoral, triangleSky, squareCoral, triangleEmerald],
  },
  {
    id: "pattern-8",
    difficulty: 8,
    description: "每种颜色连续出现两次，同时奇偶位形状分别保持一致并同步换色。",
    sequence: [triangleAmber, circleAmber, triangleEmerald, circleEmerald],
    answer: triangleSky,
    options: [triangleSky, circleSky, squareAmber, squareEmerald],
  },
  {
    id: "pattern-9",
    difficulty: 9,
    description: "颜色和形状都按三步循环一起推进，完整序列会重复。",
    sequence: [circleCoral, squareAmber, triangleEmerald, circleCoral],
    answer: squareAmber,
    options: [squareAmber, triangleEmerald, circleCoral, triangleAmber],
  },
  {
    id: "pattern-10",
    difficulty: 10,
    description: "形状按圆形、方形、三角形循环；颜色每两步向前推进一次。",
    sequence: [circleCoral, squareCoral, triangleSky, circleSky],
    answer: squareEmerald,
    options: [squareEmerald, triangleEmerald, squareSky, squareCoral],
  },
];
