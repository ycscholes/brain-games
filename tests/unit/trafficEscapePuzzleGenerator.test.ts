import {
  createTrafficEscapeHardCandidate,
  getTrafficEscapeHardSolvedTemplates,
} from "../../src/pages/traffic-escape/puzzleGenerator";
import {
  certifyTrafficEscapeHardPuzzle,
  getTrafficEscapeGeometryKey,
} from "../../src/pages/traffic-escape/puzzleQuality";

describe("traffic-escape hard puzzle generator", () => {
  test("uses multiple valid ten-vehicle solved templates", () => {
    const templates = getTrafficEscapeHardSolvedTemplates();

    expect(templates).toHaveLength(4);
    expect(templates.every((puzzle) => puzzle.size === 6 && puzzle.vehicles.length === 10)).toBe(true);
    expect(new Set(templates.map((puzzle) => getTrafficEscapeGeometryKey(puzzle))).size).toBe(4);
  });

  test("candidate generation is deterministic and never immediately reverses a move", () => {
    const first = createTrafficEscapeHardCandidate(20260907);
    const second = createTrafficEscapeHardCandidate(20260907);

    expect(first).toEqual(second);
    expect(first).not.toBeNull();
    expect(first!.generationTrace.some((move, index, trace) => index > 0
      && move.vehicleId === trace[index - 1].vehicleId
      && move.delta === -trace[index - 1].delta)).toBe(false);
  });

  test("a fixed seed corpus contains certifiable candidates", () => {
    const containsCertifiedCandidate = Array.from({ length: 500 }, (_, index) => index + 1)
      .map(createTrafficEscapeHardCandidate)
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .some((candidate) => certifyTrafficEscapeHardPuzzle(candidate.puzzle).accepted);

    expect(containsCertifiedCandidate).toBe(true);
  });
});
