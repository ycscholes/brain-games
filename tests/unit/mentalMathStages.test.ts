import {
  MATH_STAGES,
  generateMathOptions,
  generateMathProblem,
  getMathStage,
  type MathOperation,
  type MathStageId,
} from "../../src/pages/mental-math/mathStages";

function sampleProblems(stageId: MathStageId, count = 300) {
  return Array.from({ length: count }, () => generateMathProblem(stageId));
}

function getNumbers(question: string) {
  return (question.match(/\d+/g) || []).map(Number);
}

describe("mental math stage generation", () => {
  test("defines six fixed content stages with mapped point difficulty", () => {
    expect(MATH_STAGES.map((stage) => stage.id)).toEqual(["G1A", "G1B", "G2", "G3", "G4", "G5_6"]);
    expect(getMathStage("G1A").difficulty).toBe("normal");
    expect(getMathStage("G1B").difficulty).toBe("normal");
    expect(getMathStage("G2").difficulty).toBe("normal");
    expect(getMathStage("G3").difficulty).toBe("hard");
    expect(getMathStage("G4").difficulty).toBe("hard");
    expect(getMathStage("G5_6").difficulty).toBe("hard");
  });

  test("uses content-based display labels instead of grade labels", () => {
    const gradePattern = /一年级|二年级|三年级|四年级|五六年级/;

    expect(MATH_STAGES.map((stage) => stage.name)).toEqual([
      "10以内加减",
      "20以内进退位",
      "百以内与口诀",
      "万以内加减乘除",
      "多位数乘除",
      "整数四则混合",
    ]);

    MATH_STAGES.forEach((stage) => {
      expect(stage.name).not.toMatch(gradePattern);
      expect(stage.shortName).not.toMatch(gradePattern);
      expect(stage.summary).not.toMatch(gradePattern);
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

  test("hundred-range stage introduces multiplication but not division", () => {
    const operations = new Set<MathOperation>();

    sampleProblems("G2").forEach((problem) => {
      operations.add(problem.operation);
      expect(["add", "subtract", "multiply"]).toContain(problem.operation);
      expect(problem.answer).toBeGreaterThanOrEqual(0);
      if (problem.operation !== "multiply") {
        expect(problem.answer).toBeLessThanOrEqual(100);
      }
    });

    expect(operations.has("multiply")).toBe(true);
    expect(operations.has("divide")).toBe(false);
  });

  test("ten-thousand-range stage introduces integer division and keeps values in stage ranges", () => {
    const operations = new Set<MathOperation>();

    sampleProblems("G3").forEach((problem) => {
      operations.add(problem.operation);
      expect(["add", "subtract", "multiply", "divide"]).toContain(problem.operation);
      expect(problem.answer).toBeGreaterThanOrEqual(0);

      if (problem.operation === "add" || problem.operation === "subtract") {
        expect(problem.answer).toBeLessThanOrEqual(10000);
      }

      if (problem.operation === "divide") {
        const [dividend, divisor] = getNumbers(problem.question);
        expect(dividend).toBeGreaterThanOrEqual(10);
        expect(dividend).toBeLessThanOrEqual(999);
        expect(divisor).toBeGreaterThanOrEqual(2);
        expect(divisor).toBeLessThanOrEqual(9);
        expect(dividend % divisor).toBe(0);
      }
    });

    expect(operations.has("divide")).toBe(true);
  });

  test("multi-digit stage generates multiplication and exact division", () => {
    const operations = new Set<MathOperation>();

    sampleProblems("G4").forEach((problem) => {
      operations.add(problem.operation);
      expect(["multiply", "divide"]).toContain(problem.operation);

      if (problem.operation === "multiply") {
        getNumbers(problem.question).forEach((value) => {
          expect(value).toBeGreaterThanOrEqual(10);
          expect(value).toBeLessThanOrEqual(99);
        });
      } else {
        const [dividend, divisor] = getNumbers(problem.question);
        expect(dividend).toBeGreaterThanOrEqual(100);
        expect(dividend).toBeLessThanOrEqual(9999);
        expect(divisor).toBeGreaterThanOrEqual(2);
        expect(divisor).toBeLessThanOrEqual(99);
        expect(dividend % divisor).toBe(0);
      }
    });

    expect(operations.has("multiply")).toBe(true);
    expect(operations.has("divide")).toBe(true);
  });

  test("mixed arithmetic stage generates two-step integer problems", () => {
    sampleProblems("G5_6").forEach((problem) => {
      expect(problem.operation).toBe("mixed");
      expect(Number.isInteger(problem.answer)).toBe(true);
      expect(problem.answer).toBeGreaterThanOrEqual(0);
      expect(problem.question).toMatch(/[()+\-×÷]/);
    });
  });
});
