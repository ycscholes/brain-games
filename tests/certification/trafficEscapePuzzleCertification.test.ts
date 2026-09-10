import { CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES } from "../../src/pages/traffic-escape/hardPuzzles.generated";
import { collectCertifiedPuzzles } from "../../scripts/generate-traffic-escape-hard-puzzles";
import {
  certifyTrafficEscapeHardPuzzle,
  certifyTrafficEscapeHardPuzzleBank,
} from "../../src/pages/traffic-escape/puzzleQuality";

describe("traffic-escape puzzle certification", () => {
  test("certifies every serialized runtime puzzle individually", () => {
    expect(CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES.every((puzzle) => (
      certifyTrafficEscapeHardPuzzle(puzzle).accepted
    ))).toBe(true);
  });

  test("scans the approved 2,000-seed collection range", () => {
    const selected = collectCertifiedPuzzles({ firstSeed: 1, lastSeed: 2_000, count: 36 });

    expect(selected).toHaveLength(36);
    expect(certifyTrafficEscapeHardPuzzleBank(selected).accepted).toBe(true);
  });
});
