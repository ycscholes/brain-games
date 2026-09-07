import { renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createTrafficEscapeHardCandidate } from "../src/pages/traffic-escape/puzzleGenerator";
import {
  certifyTrafficEscapeHardPuzzle,
  getTrafficEscapeGeometryKey,
  type CertifiedTrafficEscapePuzzle,
  type TrafficEscapePuzzleAnalysis,
} from "../src/pages/traffic-escape/puzzleQuality";

interface CollectionOptions {
  firstSeed: number;
  lastSeed: number;
  count: number;
}

interface CollectedCertifiedPuzzle {
  puzzle: CertifiedTrafficEscapePuzzle;
  seed: number;
  analysis: TrafficEscapePuzzleAnalysis;
}

const OUTPUT_PATH = resolve("src/pages/traffic-escape/hardPuzzles.generated.ts");
const TEMP_PATH = `${OUTPUT_PATH}.tmp`;

export function collectCertifiedPuzzles({
  firstSeed,
  lastSeed,
  count,
}: CollectionOptions): CollectedCertifiedPuzzle[] {
  const acceptedByGeometry = new Map<string, CollectedCertifiedPuzzle>();

  for (let seed = firstSeed; seed <= lastSeed && acceptedByGeometry.size < count; seed += 1) {
    const candidate = createTrafficEscapeHardCandidate(seed);
    if (!candidate) continue;
    const geometryKey = getTrafficEscapeGeometryKey(candidate.puzzle);
    if (acceptedByGeometry.has(geometryKey)) continue;

    const certification = certifyTrafficEscapeHardPuzzle(candidate.puzzle);
    if (!certification.accepted || !certification.analysis) continue;

    acceptedByGeometry.set(geometryKey, {
      seed,
      analysis: certification.analysis,
      puzzle: {
        ...candidate.puzzle,
        solutionMoves: certification.analysis.solutionMoves.map((move) => ({ ...move })),
      },
    });
    process.stdout.write(`Accepted ${acceptedByGeometry.size}/${count} at seed ${seed}\n`);
  }

  return [...acceptedByGeometry.values()]
    .sort((left, right) => getTrafficEscapeGeometryKey(left.puzzle)
      .localeCompare(getTrafficEscapeGeometryKey(right.puzzle)))
    .slice(0, count);
}

export function serializeCertifiedPuzzles(selected: readonly CollectedCertifiedPuzzle[]) {
  const serializedPuzzles = JSON.stringify(selected.map(({ puzzle }) => puzzle), null, 2);
  return `// Generated file, do not edit. Run npm run traffic-escape:puzzles.\n`
    + `import type { CertifiedTrafficEscapePuzzle } from "./puzzleQuality";\n\n`
    + `export const CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES = ${serializedPuzzles}`
    + ` satisfies readonly CertifiedTrafficEscapePuzzle[];\n`;
}

function getRange(values: number[]) {
  return `${Math.min(...values)}–${Math.max(...values)}`;
}

function run() {
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

run();
