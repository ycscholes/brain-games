# Traffic Escape Structural Diversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Produce a deterministic 36-puzzle hard bank with varied vertical-car structures while retaining all existing difficulty certification.

**Architecture:** puzzleGenerator.ts supplies eight independent solved templates and candidate provenance. puzzleQuality.ts exposes pure anchor analysis and bank-level diversity certification. The offline script selects only quality-certified candidates which also satisfy diversity quotas; the runtime bank remains geometry plus solution moves.

**Tech Stack:** TypeScript, Jest, Node scripts, Taro/WeChat Mini Program.

---

### Task 1: Bank diversity analyzer

**Files:**
- Modify: src/pages/traffic-escape/puzzleQuality.ts
- Modify: tests/unit/trafficEscapePuzzleQuality.test.ts

- [ ] **Step 1: Add failing analyzer tests**

Write fixture tests for getTrafficEscapeVerticalAnchorKeys(puzzle) and certifyTrafficEscapeHardPuzzleBank(entries). Assert anchors are sorted col:row:length; a repeated 36-entry fixture fails maximum-frequency and distinct-anchor rules.

Run: npm test -- --runInBand tests/unit/trafficEscapePuzzleQuality.test.ts

Expected: FAIL because neither public API exists.

- [ ] **Step 2: Implement rules and APIs**

After HARD_PUZZLE_QUALITY_RULES, add:

~~~
export const HARD_PUZZLE_BANK_DIVERSITY_RULES = {
  expectedPuzzleCount: 36,
  maximumAnchorFrequency: 6,
  minimumDistinctAnchors: 28,
  minimumColumnBandAppearances: 8,
  minimumRowBandAppearances: 8,
  minimumTemplateAppearances: 3,
} as const;
~~~

Add getTrafficEscapeVerticalAnchorKeys, which ignores target and horizontal vehicles, and certifyTrafficEscapeHardPuzzleBank. The latter accepts entries with puzzle and templateId, counts col,row,length anchors, Math.floor(col / 2) column bands, Math.floor(row / 2) row bands, and template IDs. It returns deterministic failures and a summary of those counts.

- [ ] **Step 3: Pass tests and commit**

Run: npm test -- --runInBand tests/unit/trafficEscapePuzzleQuality.test.ts

Expected: PASS; existing per-puzzle certificate remains unchanged.

Run:

~~~
git add src/pages/traffic-escape/puzzleQuality.ts tests/unit/trafficEscapePuzzleQuality.test.ts
git commit -m "feat: certify traffic escape puzzle diversity"
~~~

### Task 2: Eight independent solved templates

**Files:**
- Modify: src/pages/traffic-escape/puzzleGenerator.ts
- Modify: tests/unit/trafficEscapePuzzleGenerator.test.ts

- [ ] **Step 1: Add template-diversity tests**

Replace the four-template expectation with tests asserting eight templates, eight geometry keys, and at least 20 distinct vertical anchors across templates. Also assert every template has 10 vehicles and one horizontal target at exitRow.

Run: npm test -- --runInBand tests/unit/trafficEscapePuzzleGenerator.test.ts -t "uses eight independent"

Expected: FAIL because the implementation exposes four derived templates.

- [ ] **Step 2: Replace derived mirrors with explicit layouts**

Replace BASE_SOLVED_VEHICLES, reflectVehicleVertically, and boolean-derived createTemplateDefinition with eight literal SolvedTemplateDefinition entries. Each has an id, its own solved TrafficEscapePuzzle, and gateMove; IDs remain traffic-escape-hard-template-1 through traffic-escape-hard-template-8.

Every template keeps a target with col 4, length 2, horizontal orientation, and isTarget true; it has exactly 10 vehicles and exitRow 2 or 3. Every pair differs in at least two non-target vertical anchors by column, row band, length, or gate position.

- [ ] **Step 3: Keep deterministic provenance and pass tests**

Keep templateId on TrafficEscapeHardCandidate, modulo template selection, target setup relocation, and replayable reverse walk. Update tests to expect all eight IDs from seeds 0 through 7.

Run: npm test -- --runInBand tests/unit/trafficEscapePuzzleGenerator.test.ts

Expected: PASS, including deterministic trace replay and no immediate reverse.

Run:

~~~
git add src/pages/traffic-escape/puzzleGenerator.ts tests/unit/trafficEscapePuzzleGenerator.test.ts
git commit -m "feat: diversify traffic escape solved templates"
~~~

### Task 3: Diversity-aware offline selection and generated bank

**Files:**
- Modify: scripts/generate-traffic-escape-hard-puzzles.ts
- Modify: tests/unit/trafficEscapePuzzleGenerator.test.ts
- Modify: src/pages/traffic-escape/hardPuzzles.generated.ts

- [ ] **Step 1: Add a failing complete-bank test**

Test collectCertifiedPuzzles with firstSeed 1, lastSeed 40000, and count 36. Assert it returns 36 entries and certifyTrafficEscapeHardPuzzleBank(selected).accepted is true.

Expected: FAIL because collected entries do not carry templateId and selection ignores bank rules.

- [ ] **Step 2: Select with provenance and quotas**

Extend CollectedCertifiedPuzzle with templateId. Preserve geometry uniqueness and single-puzzle quality certification. Before accepting a candidate, construct the prospective set and reject a candidate that exceeds maximumAnchorFrequency; prefer candidates which fill an underrepresented template, column band, or row band. After scanning, require exactly 36 entries and a passing bank certificate; otherwise throw an error with the diversity summary.

- [ ] **Step 3: Keep metrics offline and regenerate**

Keep serializeCertifiedPuzzles mapping only puzzle. Add generator output for distinct-anchor count, maximum anchor frequency, and sorted template contributions. Run:

~~~
npm run traffic-escape:puzzles
npm test -- --runInBand tests/unit/trafficEscapePuzzleGenerator.test.ts tests/unit/trafficEscapePuzzleQuality.test.ts
~~~

Expected: 36 certified puzzles, all bank diversity quotas pass, and source remains at most 80000 bytes.

- [ ] **Step 4: Commit**

~~~
git add scripts/generate-traffic-escape-hard-puzzles.ts src/pages/traffic-escape/hardPuzzles.generated.ts tests/unit/trafficEscapePuzzleGenerator.test.ts
git commit -m "feat: generate diverse traffic escape hard bank"
~~~

### Task 4: Runtime regression and documentation

**Files:**
- Modify: tests/unit/trafficEscapeGameLogic.test.ts
- Modify: docs/points-economy.md

- [ ] **Step 1: Cover the imported runtime bank**

Add an all-bank test validating every imported hard puzzle against existing per-puzzle quality rules and the new bank diversity certificate with generator provenance from a test-only collection. Keep existing tests for bank-only runtime selection and optimal/non-optimal hint paths.

Run: npm test -- --runInBand tests/unit/trafficEscapeGameLogic.test.ts

Expected: PASS.

- [ ] **Step 2: Document varied layouts and commit**

Update the 车阵突围 paragraph in docs/points-economy.md: the 36 offline-certified hard puzzles now vary vertical-car structures, while 10 cars, 8–12 moves, 150/210-second speed thresholds, 50-point cap, and shared rewards remain unchanged.

Run:

~~~
git add tests/unit/trafficEscapeGameLogic.test.ts docs/points-economy.md
git commit -m "test: cover diverse traffic escape hard puzzles"
~~~

### Task 5: Full validation and visual acceptance

**Files:**
- Verify: src/pages/traffic-escape/hardPuzzles.generated.ts
- Verify: dist/pages/traffic-escape/index.*

- [ ] **Step 1: Run automated gates**

~~~
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build:weapp
npm run secrets:check
git diff --check
~~~

Expected: all pass; only the known non-blocking Taro punycode deprecation warning may appear before Compiled successfully.

- [ ] **Step 2: Verify output and visual variation**

Check generated source stays at or below 80000 bytes. In WeChat Developer Tools, start eight different hard seeds and verify the vertical cars span different column/row bands, do not repeat the screenshot's fixed two-wall silhouette, hints remain responsive, and completion, score, training, share, and gauntlet behavior is unchanged.
