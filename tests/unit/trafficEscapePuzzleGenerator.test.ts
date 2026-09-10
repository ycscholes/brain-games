import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createTrafficEscapeHardCandidate,
  getTrafficEscapeHardSolvedTemplates,
} from "../../src/pages/traffic-escape/puzzleGenerator";
import {
  applyTrafficEscapeMove,
  createTrafficEscapeState,
  getTrafficEscapeStateKey,
} from "../../src/pages/traffic-escape/gameLogic";
import {
  getTrafficEscapeGeometryKey,
  getTrafficEscapeVerticalAnchorKeys,
} from "../../src/pages/traffic-escape/puzzleQuality";
import { CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES } from "../../src/pages/traffic-escape/hardPuzzles.generated";

describe("traffic-escape hard puzzle generator", () => {
  test("keeps the generated runtime puzzle bank within 80 KB", () => {
    const generatedSource = readFileSync(
      resolve("src/pages/traffic-escape/hardPuzzles.generated.ts"),
      "utf8",
    );

    expect(Buffer.byteLength(generatedSource, "utf8")).toBeLessThanOrEqual(80_000);
  });

  test("ships the serialized 36-puzzle runtime bank shape", () => {
    expect(CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES).toHaveLength(36);
    expect(CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES.every((puzzle) => (
      puzzle.size === 6
      && puzzle.vehicles.length === 10
      && puzzle.vehicles.filter((vehicle) => vehicle.isTarget).length === 1
    ))).toBe(true);
  });

  test("uses six independently certified ten-vehicle solved templates", () => {
    const templates = getTrafficEscapeHardSolvedTemplates();

    expect(templates).toHaveLength(6);
    expect(templates.every((puzzle) => puzzle.size === 6 && puzzle.vehicles.length === 10)).toBe(true);
    expect(templates.every((puzzle) => (
      puzzle.vehicles.filter((vehicle) => vehicle.isTarget).length === 1
      && puzzle.vehicles.find((vehicle) => vehicle.isTarget)?.orientation === "horizontal"
      && puzzle.vehicles.find((vehicle) => vehicle.isTarget)?.row === puzzle.exitRow
    ))).toBe(true);
    expect(new Set(templates.map((puzzle) => getTrafficEscapeGeometryKey(puzzle))).size).toBe(6);
    expect(new Set(templates.flatMap(getTrafficEscapeVerticalAnchorKeys)).size).toBeGreaterThanOrEqual(14);
  });

  test("rotates across all six hard puzzle templates", () => {
    expect(Array.from({ length: 6 }, (_, seed) => createTrafficEscapeHardCandidate(seed)?.templateId))
      .toEqual(Array.from({ length: 6 }, (_, index) => "traffic-escape-hard-template-" + (index + 1)));
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

  test("generation trace replays every transition from its declared initial puzzle", () => {
    const candidate = createTrafficEscapeHardCandidate(20260907);

    expect(candidate).not.toBeNull();
    let state = createTrafficEscapeState(candidate!.generationStartPuzzle);
    const visitedStateKeys = new Set([getTrafficEscapeStateKey(state)]);
    candidate!.generationTrace.forEach((move) => {
      const result = applyTrafficEscapeMove(candidate!.generationStartPuzzle, state, move);
      expect(result.moved).toBe(true);
      state = result.state;
      const stateKey = getTrafficEscapeStateKey(state);
      expect(visitedStateKeys.has(stateKey)).toBe(false);
      visitedStateKeys.add(stateKey);
    });

    expect(state.vehicles).toEqual(candidate!.puzzle.vehicles);
  });

  test("performs 48 to 72 non-target reverse moves", () => {
    const candidate = createTrafficEscapeHardCandidate(20260907);
    const targetId = candidate!.puzzle.vehicles.find((vehicle) => vehicle.isTarget)!.id;

    expect(candidate!.generationTrace.length).toBeGreaterThanOrEqual(48);
    expect(candidate!.generationTrace.length).toBeLessThanOrEqual(72);
    expect(candidate!.generationTrace.every((move) => move.vehicleId !== targetId)).toBe(true);
    expect(candidate!.initialTargetRelocation).toEqual({
      vehicleId: targetId,
      fromCol: 4,
      toCol: 0,
    });
  });

});
