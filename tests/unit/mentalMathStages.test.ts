import {
  CUSTOM_RANGE_OPTIONS,
  MATH_STAGES,
  generateMathOptions,
  generateMathProblem,
  getCustomMathProfile,
  getMathStage,
  type CustomMathConfig,
  type CustomMathOperation,
  type MathOperation,
  type MathStageId,
} from "../../src/pages/mental-math/mathStages";

function sampleProblems(stageId: MathStageId, count = 300, customConfig?: CustomMathConfig) {
  return Array.from({ length: count }, () => generateMathProblem(stageId, customConfig));
}

function getNumbers(question: string) {
  return (question.match(/\d+/g) || []).map(Number);
}

describe("mental math stage generation", () => {
  test("defines fixed content stages plus custom training with mapped point difficulty", () => {
    expect(MATH_STAGES.map((stage) => stage.id)).toEqual([
      "G1A",
      "G1B",
      "G2_ADD",
      "G2_MUL",
      "G3_ADD",
      "G4_MIXED_100",
      "CUSTOM",
    ]);
    expect(getMathStage("G1A").difficulty).toBe("normal");
    expect(getMathStage("G1B").difficulty).toBe("normal");
    expect(getMathStage("G2_ADD").difficulty).toBe("normal");
    expect(getMathStage("G2_MUL").difficulty).toBe("normal");
    expect(getMathStage("G3_ADD").difficulty).toBe("hard");
    expect(getMathStage("G4_MIXED_100").difficulty).toBe("hard");
  });

  test("uses updated content labels and removes multi-digit multiplication/division", () => {
    expect(MATH_STAGES.map((stage) => stage.name)).toEqual([
      "10以内加减",
      "20以内进退位",
      "百以内加减法",
      "乘法口诀",
      "万以内加减法",
      "100以内四则混合",
      "自定义训练",
    ]);

    MATH_STAGES.forEach((stage) => {
      expect(stage.name).not.toBe("百以内与口诀");
      expect(stage.name).not.toBe("万以内加减乘除");
      expect(stage.name).not.toBe("多位数乘除");
      expect(stage.name).not.toBe("整数四则混合");
    });
  });

  test("all stages produce integer answers and four unique integer options", () => {
    MATH_STAGES.forEach((stage) => {
      sampleProblems(stage.id, 80).forEach((problem) => {
        expect(Number.isInteger(problem.answer)).toBe(true);

        const options = generateMathOptions(problem.answer);
        expect(options).toHaveLength(4);
        expect(new Set(options).size).toBe(4);
        expect(options).toContain(problem.answer);
        options.forEach((option) => {
          expect(Number.isInteger(option)).toBe(true);
          expect(option).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  test("early addition and subtraction stages stay within range", () => {
    const expectations: Array<[MathStageId, number]> = [
      ["G1A", 10],
      ["G1B", 20],
    ];

    expectations.forEach(([stageId, maxAnswer]) => {
      sampleProblems(stageId).forEach((problem) => {
        expect(["add", "subtract"]).toContain(problem.operation);
        expect(problem.answer).toBeGreaterThanOrEqual(0);
        expect(problem.answer).toBeLessThanOrEqual(maxAnswer);
        getNumbers(problem.question).forEach((value) => {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(maxAnswer);
        });
      });
    });
  });

  test("hundred-range addition stage does not generate multiplication or division", () => {
    sampleProblems("G2_ADD").forEach((problem) => {
      expect(["add", "subtract"]).toContain(problem.operation);
      expect(problem.answer).toBeGreaterThanOrEqual(0);
      expect(problem.answer).toBeLessThanOrEqual(100);
      getNumbers(problem.question).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });
  });

  test("multiplication table stage only generates 2-9 multiplication facts", () => {
    sampleProblems("G2_MUL").forEach((problem) => {
      expect(problem.operation).toBe("multiply");
      expect(problem.answer).toBeGreaterThanOrEqual(4);
      expect(problem.answer).toBeLessThanOrEqual(81);
      getNumbers(problem.question).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(2);
        expect(value).toBeLessThanOrEqual(9);
      });
    });
  });

  test("ten-thousand-range stage only generates addition and subtraction", () => {
    sampleProblems("G3_ADD").forEach((problem) => {
      expect(["add", "subtract"]).toContain(problem.operation);
      expect(problem.answer).toBeGreaterThanOrEqual(0);
      expect(problem.answer).toBeLessThanOrEqual(10000);
      getNumbers(problem.question).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(10000);
      });
    });
  });

  test("100-range mixed arithmetic stage generates two-step integer problems", () => {
    sampleProblems("G4_MIXED_100").forEach((problem) => {
      expect(problem.operation).toBe("mixed");
      expect(Number.isInteger(problem.answer)).toBe(true);
      expect(problem.answer).toBeGreaterThanOrEqual(0);
      expect(problem.answer).toBeLessThanOrEqual(100);
      expect(problem.question).toMatch(/[()+\-×÷]/);
      getNumbers(problem.question).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });
  });

  test("custom training generates valid problems for each range and operation", () => {
    const operations: CustomMathOperation[] = ["add", "subtract", "multiply", "divide"];

    CUSTOM_RANGE_OPTIONS.forEach((range) => {
      operations.forEach((operation) => {
        sampleProblems("CUSTOM", 80, { operations: [operation], rangeId: range.id }).forEach((problem) => {
          expect(problem.operation).toBe(operation);
          expect(problem.answer).toBeGreaterThanOrEqual(0);
          expect(problem.answer).toBeLessThanOrEqual(range.max);
          getNumbers(problem.question).forEach((value) => {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(range.max);
          });

          if (operation === "divide") {
            const [dividend, divisor] = getNumbers(problem.question);
            expect(dividend % divisor).toBe(0);
          }
        });
      });
    });
  });

  test("custom training can mix selected operations and maps coefficients to point difficulty", () => {
    const easyProfile = getCustomMathProfile({ operations: ["add"], rangeId: "within10" });
    const mediumProfile = getCustomMathProfile({ operations: ["add", "subtract"], rangeId: "within100" });
    const hardProfile = getCustomMathProfile({ operations: ["multiply", "divide"], rangeId: "within10000" });
    const fullProfile = getCustomMathProfile({
      operations: ["add", "subtract", "multiply", "divide"],
      rangeId: "unlimited",
    });

    expect(easyProfile).toMatchObject({ coefficient: 1, difficulty: "normal", operationsKey: "add" });
    expect(mediumProfile).toMatchObject({ coefficient: 1.32, difficulty: "normal", operationsKey: "add-subtract" });
    expect(hardProfile).toMatchObject({ coefficient: 2.4, difficulty: "hard", operationsKey: "multiply-divide" });
    expect(fullProfile).toMatchObject({ coefficient: 3.6, difficulty: "hard", operationsKey: "add-subtract-multiply-divide" });

    const seenOperations = new Set<MathOperation>();
    sampleProblems("CUSTOM", 300, {
      operations: ["add", "subtract", "multiply", "divide"],
      rangeId: "within100",
    }).forEach((problem) => {
      seenOperations.add(problem.operation);
    });

    expect(seenOperations).toEqual(new Set(["add", "subtract", "multiply", "divide"]));
  });
});
