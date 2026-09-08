import { renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createTrafficEscapeHardCandidate } from "../src/pages/traffic-escape/puzzleGenerator";
import {
  HARD_PUZZLE_BANK_DIVERSITY_RULES,
  certifyTrafficEscapeHardPuzzle,
  certifyTrafficEscapeHardPuzzleBank,
  getTrafficEscapeGeometryKey,
  type CertifiedTrafficEscapePuzzle,
  type TrafficEscapePuzzleBankEntry,
  type TrafficEscapePuzzleAnalysis,
} from "../src/pages/traffic-escape/puzzleQuality";

interface CollectionOptions {
  firstSeed: number;
  lastSeed: number;
  count: number;
}

export interface CollectedCertifiedPuzzle extends TrafficEscapePuzzleBankEntry {
  puzzle: CertifiedTrafficEscapePuzzle;
  seed: number;
  templateId: string;
  analysis: TrafficEscapePuzzleAnalysis;
}

const OUTPUT_PATH = resolve("src/pages/traffic-escape/hardPuzzles.generated.ts");
const TEMP_PATH = `${OUTPUT_PATH}.tmp`;
const CURATED_HARD_CANDIDATE_SEEDS = [
  150, 186, 216, 294, 261, 303, 483, 783, 203, 305, 431, 1577, 92, 134, 242, 428,
  64, 88, 118, 184, 25, 151, 259, 529, 467, 1835, 2087, 336, 420, 564, 666, 684,
  714, 798, 858,
  948, 1002, 1038, 541, 727, 853, 919, 943, 955, 1045, 1147, 548, 620, 915, 232,
  442, 520, 874, 934, 976, 1036, 1090, 1102, 1132, 593, 1097,
] as const;

export function collectCertifiedPuzzles({
  firstSeed,
  lastSeed,
  count,
}: CollectionOptions): CollectedCertifiedPuzzle[] {
  const acceptedByGeometry = new Map<string, CollectedCertifiedPuzzle>();
  const candidateSeeds = CURATED_HARD_CANDIDATE_SEEDS
    .filter((seed) => seed >= firstSeed && seed <= lastSeed);

  for (const seed of candidateSeeds) {
    if (acceptedByGeometry.size >= count) break;
    const candidate = createTrafficEscapeHardCandidate(seed);
    if (!candidate) continue;
    const geometryKey = getTrafficEscapeGeometryKey(candidate.puzzle);
    if (acceptedByGeometry.has(geometryKey)) continue;

    const certification = certifyTrafficEscapeHardPuzzle(candidate.puzzle);
    if (!certification.accepted || !certification.analysis) continue;

    const entry: CollectedCertifiedPuzzle = {
      seed,
      templateId: candidate.templateId,
      analysis: certification.analysis,
      puzzle: {
        ...candidate.puzzle,
        solutionMoves: certification.analysis.solutionMoves.map((move) => ({ ...move })),
      },
    };
    const prospective = [...acceptedByGeometry.values(), entry];
    const templateAppearances = prospective.filter(({ templateId }) => (
      templateId === candidate.templateId
    )).length;
    const requiredTemplateSlots = HARD_PUZZLE_BANK_DIVERSITY_RULES.minimumDistinctTemplates
      * HARD_PUZZLE_BANK_DIVERSITY_RULES.minimumTemplateAppearances;
    if (acceptedByGeometry.size < requiredTemplateSlots
      && templateAppearances > HARD_PUZZLE_BANK_DIVERSITY_RULES.minimumTemplateAppearances) {
      continue;
    }
    const partialCertification = certifyTrafficEscapeHardPuzzleBank(prospective, {
      expectedPuzzleCount: prospective.length,
      minimumDistinctAnchors: 0,
      minimumColumnBandAppearances: 0,
      minimumRowBandAppearances: 0,
      minimumDistinctTemplates: 0,
      minimumTemplateAppearances: 0,
    });
    if (!partialCertification.accepted) continue;

    acceptedByGeometry.set(geometryKey, entry);
    process.stdout.write("Accepted " + acceptedByGeometry.size + "/" + count + " at seed " + seed + "\n");
  }

  const selected = [...acceptedByGeometry.values()]
    .sort((left, right) => getTrafficEscapeGeometryKey(left.puzzle)
      .localeCompare(getTrafficEscapeGeometryKey(right.puzzle)))
    .slice(0, count);
  const bankCertification = certifyTrafficEscapeHardPuzzleBank(selected, {
    expectedPuzzleCount: count,
  });
  if (!bankCertification.accepted) {
    throw new Error("Unable to collect a structurally diverse bank: " + bankCertification.failures.join("; "));
  }

  return selected;
}

export function serializeCertifiedPuzzles(selected: readonly CollectedCertifiedPuzzle[]) {
  const serializedPuzzles = JSON.stringify(selected.map(({ puzzle }) => puzzle));
  return `// Generated file, do not edit. Run npm run traffic-escape:puzzles.\n`
    + `import type { CertifiedTrafficEscapePuzzle } from "./puzzleQuality";\n\n`
    + `export const CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES = ${serializedPuzzles}`
    + ` satisfies readonly CertifiedTrafficEscapePuzzle[];\n`;
}

function getRange(values: number[]) {
  return `${Math.min(...values)}–${Math.max(...values)}`;
}

export function run() {
  const selected = collectCertifiedPuzzles({ firstSeed: 1, lastSeed: 20_000, count: 36 });

  if (selected.length !== 36) {
    throw new Error(`Expected 36 certified puzzles, received ${selected.length}`);
  }

  writeFileSync(TEMP_PATH, serializeCertifiedPuzzles(selected), "utf8");
  renameSync(TEMP_PATH, OUTPUT_PATH);

  const analyses = selected.map(({ analysis }) => analysis);
  const seeds = selected.map(({ seed }) => seed);
  process.stdout.write([
    `Wrote ${selected.length} certified puzzles to ${OUTPUT_PATH}`,
    `Accepted seed range: ${getRange(seeds)}`,
    `Shortest moves: ${getRange(analyses.map(({ shortestMoveCount }) => shortestMoveCount))}`,
    `Distinct vehicles: ${getRange(analyses.map(({ distinctMovedVehicleCount }) => distinctMovedVehicleCount))}`,
    `Dependency depth: ${getRange(analyses.map(({ dependencyDepth }) => dependencyDepth))}`,
    `Legal first moves: ${getRange(analyses.map(({ legalFirstMoveCount }) => legalFirstMoveCount))}`,
    `Optimal first moves: ${getRange(analyses.map(({ optimalFirstMoveCount }) => optimalFirstMoveCount))}`,
    `Visited states: ${getRange(analyses.map(({ visitedStateCount }) => visitedStateCount))}`,
  ].join("\n") + "\n");
}

if (require.main === module) run();
