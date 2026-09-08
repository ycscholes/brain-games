import type { TrafficEscapePuzzle } from "../../src/pages/traffic-escape/gameLogic";
import {
  HARD_PUZZLE_BANK_DIVERSITY_RULES,
  HARD_PUZZLE_QUALITY_RULES,
  analyzeTrafficEscapePuzzle,
  certifyTrafficEscapeHardPuzzle,
  certifyTrafficEscapeHardPuzzleBank,
  getTrafficEscapeGeometryKey,
  getTrafficEscapeVerticalAnchorKeys,
} from "../../src/pages/traffic-escape/puzzleQuality";

const certifiedFixture: TrafficEscapePuzzle = {
  id: "traffic-escape-certified-fixture",
  size: 6,
  exitRow: 2,
  vehicles: [
    { id: "target", row: 2, col: 0, length: 2, orientation: "horizontal", color: "target", isTarget: true },
    { id: "v1", row: 2, col: 2, length: 3, orientation: "vertical", color: "cyan" },
    { id: "v2", row: 0, col: 5, length: 3, orientation: "vertical", color: "violet" },
    { id: "v3", row: 2, col: 3, length: 2, orientation: "vertical", color: "lime" },
    { id: "v4", row: 4, col: 0, length: 2, orientation: "vertical", color: "coral" },
    { id: "v5", row: 4, col: 4, length: 2, orientation: "horizontal", color: "amber" },
    { id: "v6", row: 5, col: 2, length: 2, orientation: "horizontal", color: "cyan" },
    { id: "v7", row: 5, col: 4, length: 2, orientation: "horizontal", color: "violet" },
    { id: "v8", row: 0, col: 2, length: 2, orientation: "horizontal", color: "lime" },
    { id: "v9", row: 0, col: 1, length: 2, orientation: "vertical", color: "coral" },
  ],
  solutionMoves: [
    { vehicleId: "v4", delta: -1 },
    { vehicleId: "v5", delta: -1 },
    { vehicleId: "v6", delta: -2 },
    { vehicleId: "v1", delta: 1 },
    { vehicleId: "v7", delta: -1 },
    { vehicleId: "v2", delta: 3 },
    { vehicleId: "v8", delta: 2 },
    { vehicleId: "v3", delta: -2 },
    { vehicleId: "target", delta: 4 },
  ],
};

function relabelPuzzle(puzzle: TrafficEscapePuzzle): TrafficEscapePuzzle {
  const idMap = new Map(puzzle.vehicles.map((vehicle, index) => [vehicle.id, `renamed-${index}`]));
  return {
    ...puzzle,
    id: "different-puzzle-id",
    vehicles: puzzle.vehicles.map((vehicle, index) => ({
      ...vehicle,
      id: idMap.get(vehicle.id)!,
      color: vehicle.isTarget ? "target" : index % 2 === 0 ? "amber" : "violet",
      appearance: vehicle.length === 2 ? "pink-sport" : "box-truck",
    })),
    solutionMoves: puzzle.solutionMoves.map((move) => ({
      ...move,
      vehicleId: idMap.get(move.vehicleId)!,
    })),
  };
}

describe("traffic-escape hard puzzle quality", () => {
  test("hard certification encodes the two-to-three-minute target", () => {
    expect(HARD_PUZZLE_QUALITY_RULES).toEqual({
      size: 6,
      vehicleCount: 10,
      minimumMoves: 8,
      maximumMoves: 12,
      minimumDistinctVehicles: 5,
      minimumDependencyDepth: 3,
      minimumLegalFirstMoves: 4,
      maximumOptimalFirstMoves: 2,
      maximumVisitedStates: 12_000,
      requireTargetOnlyOnFinalMove: true,
    });
  });

  test("accepts a real ten-vehicle puzzle with a deep shortest route", () => {
    const analysis = analyzeTrafficEscapePuzzle(certifiedFixture);

    expect(analysis).toMatchObject({
      shortestMoveCount: 9,
      distinctMovedVehicleCount: 9,
      dependencyDepth: 6,
      legalFirstMoveCount: 8,
      optimalFirstMoveCount: 2,
      visitedStateCount: 6163,
      targetOnlyOnFinalMove: true,
    });
    expect(analysis?.solutionMoves).toEqual(certifiedFixture.solutionMoves);
    expect(certifyTrafficEscapeHardPuzzle(certifiedFixture)).toEqual({
      accepted: true,
      failures: [],
      analysis,
    });
  });

  test.each([
    ["route below the configured minimum", { minimumMoves: 10 }],
    ["too many optimal openings", { maximumOptimalFirstMoves: 0 }],
    ["shallow dependency chain", { minimumDependencyDepth: 7 }],
  ])("rejects %s", (_label, override) => {
    expect(certifyTrafficEscapeHardPuzzle(certifiedFixture, override).accepted).toBe(false);
  });

  test("returns every failed rule rather than stopping after the first", () => {
    const certification = certifyTrafficEscapeHardPuzzle(certifiedFixture, {
      minimumMoves: 10,
      minimumDistinctVehicles: 10,
      minimumDependencyDepth: 7,
      minimumLegalFirstMoves: 9,
      maximumOptimalFirstMoves: 1,
      maximumVisitedStates: 6_000,
    });

    expect(certification.failures).toHaveLength(6);
  });

  test("geometry keys ignore ids, colors, and appearances", () => {
    expect(getTrafficEscapeGeometryKey(certifiedFixture))
      .toBe(getTrafficEscapeGeometryKey(relabelPuzzle(certifiedFixture)));
  });

  test("extracts sorted non-target vertical anchors", () => {
    expect(getTrafficEscapeVerticalAnchorKeys(certifiedFixture)).toEqual([
      "0:4:2",
      "1:0:2",
      "2:2:3",
      "3:2:2",
      "5:0:3",
    ]);
  });

  test("rejects a bank that repeats the same vertical-car structure", () => {
    const certification = certifyTrafficEscapeHardPuzzleBank(
      Array.from({ length: 36 }, () => ({
        puzzle: certifiedFixture,
        templateId: "same-template",
      })),
    );

    expect(HARD_PUZZLE_BANK_DIVERSITY_RULES).toMatchObject({
      expectedPuzzleCount: 36,
      maximumAnchorFrequency: 17,
      minimumDistinctAnchors: 20,
    });
    expect(certification.accepted).toBe(false);
    expect(certification.failures).toEqual(expect.arrayContaining([
      expect.stringContaining("vertical anchor"),
      expect.stringContaining("distinct vertical anchors"),
      expect.stringContaining("template"),
    ]));
  });
});
