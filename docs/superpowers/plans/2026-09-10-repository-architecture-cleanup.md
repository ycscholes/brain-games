# Repository Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变任何游戏规则、积分、存储键、导航语义或远程素材版本的前提下，把仓库整理成可验证、可定位、依赖方向清晰且适合 GPT 维护的 Taro 项目。

**Architecture:** 按“验证门槛 → 证据清理 → 持久文档 → 领域边界 → 路由可读性”的顺序增量迁移。页面/feature 只组合 domain、shared 和 infrastructure；宠物类型与结算编排先从页面依赖中移出，Traffic Escape 继续保留 `index/play/result`、本地序列化 run 和 exactly-once settlement。

**Tech Stack:** Taro 4.1、React 18、TypeScript 5.9、ESLint 8.57 flat config、Jest 29、Prettier 3、Node.js 22、CloudBase storage/check 脚本、微信小程序构建。

---

## 全局执行约束

- 执行从当前已提交的计划基线 `99cc1b3` 开始。先在当前主检出中运行 `git status --short --untracked-files=all`，确认只有用户 output 文件，再创建普通分支 `git switch -c codex/repository-architecture-cleanup`；禁止创建或使用 Git worktree。随后记录 `BASE_SHA="$(git rev-parse HEAD)"` 并执行 `test "$BASE_SHA" = 99cc1b3`。所有阶段 diff 都使用这个 recorded `BASE_SHA`，不使用更早的设计提交作为基线。
- 当前已知用户文件为 `output/official-account/hidato/` 与 `output/official-account/memory-challenge/`。每个任务开始和提交前都运行 `git status --short --untracked-files=all`；这两个目录必须始终保持未跟踪、未暂存、内容不变。任何 `git add` 都使用明确文件列表，禁止 `git add .`、`git add -A` 和 `git clean`。
- 不删除或修改 `asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png`、运行时宠物素材、`.env.*`、`project.private.config.json`、CloudBase 线上路径或云函数部署配置；本计划不上传、不部署、不发布、不推送。
- 六个阶段按顺序执行，每个任务先红后绿，再运行该阶段门槛并提交。任务失败时只回滚该任务的新增文件和修改，不通过放宽断言、屏蔽规则或把慢测试重新塞回默认 suite 来恢复绿色。
- 任何奖励行为都继续经过 `getAwardedPoints()` 与 `addPointsToPet()`；闯关子局仍只调用 `completeGauntletLegIfNeeded()`，不写普通训练记录、不二次发放积分。Traffic Escape 的 run 先由 `settleTrafficEscapeRun()` 标记为 settled，结算服务只能在该返回值非空时继续。
- 所有路径均相对于仓库根目录。每次代码提交后至少运行受影响的 focused Jest、`npm run typecheck` 和 `npm run lint`；阶段收尾再运行阶段门槛。计划执行阶段不使用 worktree；每次 review checkpoint 都运行 `git diff "$BASE_SHA"..HEAD --name-only`。

## 文件地图与交叉依赖

| 边界 | 文件/目录 | 责任与交叉依赖 |
| --- | --- | --- |
| 验证配置 | `eslint.config.mjs`、`.eslintrc`、`jest.config.js`、`package.json` | flat ESLint、Jest 默认/认证 suite、`verify` 命令；阶段 1/2/6 共同修改，先完成 ESLint 再扩展脚本与格式门槛 |
| 结果分享 | `tests/unit/stickerPublishing.test.ts`、`src/pages/traffic-escape/result.tsx` | ordinary result surface 的回归清单；阶段 1 先修清单，阶段 6 只移动 JSX 不改变结果路由 |
| Traffic Escape 认证 | `src/pages/traffic-escape/{gameLogic,puzzleGenerator,puzzleQuality,hardPuzzles.generated}.ts`、`scripts/generate-traffic-escape-hard-puzzles.{ts,sh}`、`tests/unit/trafficEscapePuzzle*.test.ts` | 默认 suite 只验证确定性/形状；完整 36 题 BFS 与 2,000 seed 扫描由显式认证命令运行 |
| 宠物 domain | `src/domain/pet/{types,assets,sprite}.ts`、现有 `src/pages/pet/{types,petAssets}.ts` | 新 domain 是唯一类型源；页面兼容 re-export 只允许存在于迁移中，阶段 5 结束前删除 |
| 训练结算 | `src/domain/training/settlement.ts`、`src/services/gameSettlementService.ts`、`src/utils/{trainingStorage,petStorage,gameGauntlet}.ts`、所有使用奖励的 route | 先定义输入/输出契约并做 service 单测，再分批迁移页面；`gameGauntlet.ts` 的最终汇总奖励不由 ordinary settlement 重复执行 |
| 文档 | `docs/architecture.md`、`docs/game-module-contract.md`、`README.md`、`docs/points-economy.md` | 架构入口与游戏契约；积分权威规则不重写，只补充边界和验证命令 |
| 路由拆分 | `src/pages/{traffic-escape,music-theory,memory-challenge,bird-count,pet,pattern-completion,mental-math}` | 先格式化和 characterization，再按视图/控制器拆分；不引入通用 game-page framework |

---

## Phase 1 — 恢复可信的验证门槛

### Task 1: 用 flat config 恢复有规则的 ESLint

**Files:**
- Modify: `eslint.config.mjs`
- Delete: `.eslintrc`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/unit/eslintConfig.test.js`

- [ ] **Step 1: 先写会失败的规则存在性回归测试。** 在 `tests/unit/eslintConfig.test.js` 中执行 ESLint CLI 的 `--print-config`，验证 React、Hooks、TypeScript、import 和 JSX quote 规则不是 `off`，并验证 Node/Jest 文件能够被读取为 CommonJS 环境。

```js
const { execFileSync } = require("node:child_process");
const path = require("node:path");

function printedConfig(file) {
  const output = execFileSync(
    process.execPath,
    [path.resolve("node_modules/eslint/bin/eslint.js"), "--print-config", file],
    { encoding: "utf8" },
  );
  return JSON.parse(output);
}

describe("ESLint flat config", () => {
  test("applies meaningful React, Hooks, TypeScript and import rules to TSX", () => {
    const config = printedConfig("src/pages/mental-math/index.tsx");

    expect(config.rules["react/jsx-uses-react"]).toEqual([0]);
    expect(config.rules["react-hooks/rules-of-hooks"][0]).toBeGreaterThan(0);
    expect(config.rules["@typescript-eslint/no-explicit-any"][0]).toBeGreaterThan(0);
    expect(config.rules["import/no-unresolved"][0]).toBeGreaterThan(0);
    expect(config.rules["jsx-quotes"]).toEqual([2, "prefer-double"]);
  });

  test("uses a script override without applying browser JSX globals", () => {
    const config = printedConfig("scripts/generate-traffic-escape-hard-puzzles.ts");

    expect(config.languageOptions.globals.process).toBe("readonly");
    expect(config.languageOptions.sourceType).toBe("module");
  });
});
```

- [ ] **Step 2: 运行 focused test，确认当前空规则配置不能满足断言。**

Run: `npx jest tests/unit/eslintConfig.test.js --runInBand`

Expected: FAIL because the current `eslint.config.mjs` exports `rules: {}` and does not expose the Taro/React/Hooks/TypeScript rules.

- [ ] **Step 3: 编写候选 flat 配置并先测量新增规则的 baseline。** 在 `eslint.config.mjs` 里使用 `FlatCompat` 转换 `taro/react`，显式注册 `@typescript-eslint`、`react`、`react-hooks` 和 `import` 插件；用 `files` 区分 `src/config/**/*.ts`、`src/services/**/*.ts`、`src/utils/**/*.ts`、`scripts/**/*.{js,ts,mjs}`、`tests/**/*.{js,ts,tsx}`、`cloudfunctions/**/*.js` 和 React TSX。保留 `react/jsx-uses-react`、`react/react-in-jsx-scope` 关闭项与 `jsx-quotes: ["error", "prefer-double"]`，对 Jest globals、Node globals、CommonJS cloud functions 分别设置环境，不使用 `/* eslint-disable */` 全局豁免。候选配置写入工作树后，先测量当前源码在新增规则下的 violations，不假设 lint 已经变绿：

```js
import { FlatCompat } from "@eslint/eslintrc";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  { ignores: ["dist/**", "node_modules/**", "output/**", "tmp/**", ".temp/**"] },
  ...compat.extends("taro/react"),
  {
    files: ["**/*.{js,ts,tsx,mjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
      globals: { console: "readonly", process: "readonly", require: "readonly", module: "readonly" },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      react: reactPlugin,
      "react-hooks": hooksPlugin,
    },
    settings: { react: { version: "detect" }, "import/resolver": { typescript: true } },
    rules: {
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "import/no-unresolved": "error",
      "import/no-duplicates": "error",
      "jsx-quotes": ["error", "prefer-double"],
    },
  },
  {
    files: ["tests/**/*.{js,ts,tsx}", ".trae/rules/tests/**/*.js"],
    languageOptions: { globals: { jest: "readonly", describe: "readonly", test: "readonly", expect: "readonly", beforeEach: "readonly", afterEach: "readonly" } },
  },
  {
    files: ["scripts/**/*.{js,ts,mjs}"],
    languageOptions: { sourceType: "module", globals: { __dirname: "readonly", __filename: "readonly", Buffer: "readonly" } },
  },
  {
    files: ["cloudfunctions/**/*.js", "*.config.js"],
    languageOptions: { sourceType: "commonjs", globals: { __dirname: "readonly", __filename: "readonly", Buffer: "readonly" } },
  },
];
```

The implementation worker must remove the unused `require` helper if the final config does not need it; the printed-config regression test, not the snippet's incidental imports, is the acceptance authority.

- [ ] **Step 4: 输出新增规则的 baseline 报告。**

Run: `npx eslint src config scripts tests .trae/rules --format json > /tmp/brain-games-eslint-new-rules.json; eslint_status=$?; node -e 'const r=require("/tmp/brain-games-eslint-new-rules.json"); const rows=r.flatMap((f)=>f.messages.map((m)=>({file:f.filePath,rule:m.ruleId,severity:m.severity,line:m.line}))); console.log(JSON.stringify({eslintStatus:process.argv[1],count:rows.length,byRule:Object.groupBy(rows,(x)=>x.rule)},null,2))' "$eslint_status"; exit 0`

Expected: the command always writes a complete report and prints the exact pre-existing violation count grouped by rule; a non-zero ESLint status is evidence to act on, not a reason to weaken the candidate configuration. Save the report outside the repository and do not commit it.

- [ ] **Step 5: 若 baseline 暴露既有 lint debt，先修 debt 并独立提交。** 只修报告中已存在的 source/test/script violations；保持 rule severity，不添加全局 ignore、file-wide disable 或 broad override。每次修复后，用 baseline JSON 中的明确文件路径运行 ESLint、相关 focused Jest 和 `npm run typecheck`，再只暂存这些明确文件：

```bash
node -e 'const {execFileSync}=require("node:child_process"); const r=require("/tmp/brain-games-eslint-new-rules.json"); const files=[...new Set(r.filter((f)=>f.messages.length>0).map((f)=>f.filePath.replace(process.cwd()+"/","")))]; execFileSync("git",["add","--",...files],{stdio:"inherit"})'
git diff --cached --check
git commit -m "fix: clear existing eslint baseline debt"
```

Expected: the Node command stages only the literal files present in the baseline JSON; this commit contains only pre-existing lint-debt fixes. If baseline count is zero, skip the commit and record `0 violations` in the task review note. Do not use `git add src`, `git add tests`, or another directory-wide staging command.

- [ ] **Step 6: 将必要的 flat-config bridge 作为直接开发依赖锁定，并运行 focused checks。** 若 `@eslint/eslintrc` 不是 `package.json` 的直接依赖，执行 `npm install --save-dev --save-exact @eslint/eslintrc@3.3.1`，保留现有 ESLint 8.57 范围，不升级 ESLint 或 Taro。

Run: `npx jest tests/unit/eslintConfig.test.js --runInBand && npx eslint src/pages/mental-math/index.tsx scripts/generate-traffic-escape-hard-puzzles.ts tests/unit/eslintConfig.test.js --max-warnings=0`

Expected: PASS; `--print-config` shows non-zero React/Hooks/TypeScript/import rules and the focused lint command exits 0. If the installed lockfile resolves a different compatible `@eslint/eslintrc` patch, record that exact resolved version in `package-lock.json` rather than broadening the dependency range.

- [ ] **Step 7: 确认旧配置不再被读取并提交配置恢复。**

Run: `test ! -e .eslintrc && npm run lint:code -- --debug 2>&1 | rg "eslint.config.mjs|Using flat config"`

Expected: `.eslintrc` is absent, the debug output references `eslint.config.mjs`, and lint exits 0. Then commit only the task files:

```bash
git add eslint.config.mjs .eslintrc package.json package-lock.json tests/unit/eslintConfig.test.js
git diff --cached --check
git commit -m "fix: restore meaningful eslint validation"
```

### Task 2: 修复 ordinary result surface 的 stale regression

**Files:**
- Modify: `tests/unit/stickerPublishing.test.ts:191-218`
- Verify: `src/pages/traffic-escape/result.tsx:1-15`
- Verify: all ordinary result components enumerated by the test

- [ ] **Step 1: 把 Traffic Escape 的清单项改成真正的结果页。** 在现有 `pageFiles` 数组中将 `"traffic-escape/index.tsx"` 改为 `"traffic-escape/result.tsx"`；保留其他 ordinary result surface 与 `bird-count/components/FarmCountResult.tsx` 不变。不要通过在 start page 里重新添加 `StickerShareButton` 来满足测试。

```ts
const pageFiles = [
  // ...existing ordinary result surfaces...
  "sumplete-grid/index.tsx",
  "traffic-escape/result.tsx",
  "netwalk/index.tsx",
  // ...remaining ordinary result surfaces...
];
```

- [ ] **Step 2: 先运行回归测试，确认旧断言在当前代码上失败。**

Run: `npx jest tests/unit/stickerPublishing.test.ts --runInBand`

Expected: FAIL at the old `traffic-escape/index.tsx` expectation because the actual share action is in `src/pages/traffic-escape/result.tsx`.

- [ ] **Step 3: 运行修正后的 focused test 和静态引用检查。**

Run: `npx jest tests/unit/stickerPublishing.test.ts --runInBand && rg -n "StickerShareButton" src/pages/traffic-escape/result.tsx && ! rg -n "StickerShareButton" src/pages/traffic-escape/index.tsx`

Expected: PASS; result page contains the share action and start page does not gain a result-only share action.

- [ ] **Step 4: 提交最小回归修复。**

```bash
git add tests/unit/stickerPublishing.test.ts
git diff --cached --check
git commit -m "test: point result sharing regression at traffic result"
```

### Task 3: Phase 1 gate

**Files:**
- Verify: `eslint.config.mjs`, `package.json`, `package-lock.json`, `tests/unit/eslintConfig.test.js`, `tests/unit/stickerPublishing.test.ts`

- [ ] **Step 1: 运行 Phase 1 的完整门槛。**

Run: `npx jest tests/unit/eslintConfig.test.js tests/unit/stickerPublishing.test.ts --runInBand && npm run typecheck && npm run lint`

Expected: focused Jest、TypeScript、ESLint 与既有项目规则检查全部 PASS，ESLint 以 `--max-warnings=0` 退出 0。

- [ ] **Step 2: 检查阶段提交范围和用户文件。**

Run: `git status --short --untracked-files=all && git diff "$BASE_SHA"..HEAD --name-only`

Expected: 只出现 Phase 1 文件；两个 `output/official-account/hidato/`、`output/official-account/memory-challenge/` 仍是未跟踪项且未出现在任何 commit 中。

---

## Phase 2 — 分离快速测试和题库认证

### Task 4: 拆分 default Jest 与 Traffic Escape certification suite

**Files:**
- Modify: `tests/unit/trafficEscapePuzzleGenerator.test.ts`
- Modify: `tests/unit/trafficEscapePuzzleQuality.test.ts`
- Create: `tests/certification/trafficEscapePuzzleCertification.test.ts`
- Modify: `package.json`
- Modify: `jest.config.js`

- [ ] **Step 1: 先锁定默认 suite 的快速断言。** 保留 `tests/unit/trafficEscapePuzzleGenerator.test.ts` 中的 generated source byte-size、六个独立模板、seed determinism、trace replay、48–72 reverse moves 和固定 seed corpus；保留 `tests/unit/trafficEscapePuzzleQuality.test.ts` 中纯分析/规则/失败信息/geometry key/anchor 规则。新增一个默认测试直接读取 `src/pages/traffic-escape/hardPuzzles.generated.ts` 的导出，断言 `CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES` 长度为 36、每题 10 车且每题有一个 target，不执行 BFS 全库重算。

```ts
import { CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES } from "../../src/pages/traffic-escape/hardPuzzles.generated";

test("ships the serialized 36-puzzle runtime bank shape", () => {
  expect(CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES).toHaveLength(36);
  expect(CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES.every((puzzle) => (
    puzzle.size === 6
    && puzzle.vehicles.length === 10
    && puzzle.vehicles.filter((vehicle) => vehicle.isTarget).length === 1
  ))).toBe(true);
});
```

- [ ] **Step 2: 将昂贵认证移入独立文件。** 从 `tests/unit/trafficEscapePuzzleGenerator.test.ts` 移出 `collectCertifiedPuzzles({ firstSeed: 1, lastSeed: 2_000, count: 36 })` 的 36 题 BFS/结构多样性测试，放入 `tests/certification/trafficEscapePuzzleCertification.test.ts`。运行时序列化导出只逐题调用 `certifyTrafficEscapeHardPuzzle()`；完整 bank diversity 必须使用 `collectCertifiedPuzzles()` 返回的原始带真实 `templateId` 数据调用 `certifyTrafficEscapeHardPuzzleBank()`，禁止把所有 template id 改写成 `runtime-bank`。

```ts
import { CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES } from "../../src/pages/traffic-escape/hardPuzzles.generated";
import { collectCertifiedPuzzles } from "../../scripts/generate-traffic-escape-hard-puzzles";
import { certifyTrafficEscapeHardPuzzle, certifyTrafficEscapeHardPuzzleBank } from "../../src/pages/traffic-escape/puzzleQuality";

test("certifies every serialized runtime puzzle individually", () => {
  expect(CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES.every((puzzle) => certifyTrafficEscapeHardPuzzle(puzzle).accepted)).toBe(true);
});

test("scans the approved 2,000-seed collection range", () => {
  const selected = collectCertifiedPuzzles({ firstSeed: 1, lastSeed: 2_000, count: 36 });
  expect(selected).toHaveLength(36);
  expect(certifyTrafficEscapeHardPuzzleBank(selected).accepted).toBe(true);
});
```

- [ ] **Step 3: 先运行分拆后的命令，记录当前预期。**

Run: `npx jest tests/unit/trafficEscapePuzzleGenerator.test.ts tests/unit/trafficEscapePuzzleQuality.test.ts --runInBand`

Expected: PASS and completes without running the 2,000-seed scan. Run: `npx jest tests/certification/trafficEscapePuzzleCertification.test.ts --runInBand`；Expected: PASS and explicitly reports the expensive certification tests.

- [ ] **Step 4: 更新 Jest/package scripts。** 保持 `jest.config.js` 的 `roots` 覆盖 `tests` 与 `.trae/rules/tests`，在 `package.json` 中设置：

```json
{
  "test": "jest --runInBand --testPathIgnorePatterns=/tests\\/certification/",
  "test:puzzle-certification": "jest --runInBand tests/certification",
  "verify": "npm test && npm run typecheck && npm run lint && npm run assets:check && npm run audio:check && npm run secrets:check && git diff --check"
}
```

The worker must preserve every existing script and validate the JSON escaping with `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`.

- [ ] **Step 5: 提交测试分层。**

Run: `npm test && npm run test:puzzle-certification`

Expected: default suite PASS without certification tests; explicit certification suite PASS with the full 36-puzzle and 2,000-seed checks.

```bash
git add tests/unit/trafficEscapePuzzleGenerator.test.ts tests/unit/trafficEscapePuzzleQuality.test.ts tests/certification/trafficEscapePuzzleCertification.test.ts package.json jest.config.js
git diff --cached --check
git commit -m "test: separate puzzle certification from fast suite"
```

### Task 5: 写明认证触发条件并建立可审查的验证命令

**Files:**
- Modify: `README.md:87-108`
- Create: `docs/verification.md`
- Verify: `package.json`

- [ ] **Step 1: 写文档回归断言的目标内容。** 在 `tests/unit/readmeVerification.test.ts` 新增文本断言，要求 README 同时链接 `docs/architecture.md` 和 `docs/verification.md`，并包含 `npm run test:puzzle-certification`、`npm run verify`。

```ts
import { readFileSync } from "node:fs";

const readme = readFileSync("README.md", "utf8");

test("documents fast verification and explicit puzzle certification", () => {
  expect(readme).toContain("docs/architecture.md");
  expect(readme).toContain("docs/verification.md");
  expect(readme).toContain("npm run test:puzzle-certification");
  expect(readme).toContain("npm run verify");
});
```

- [ ] **Step 2: 运行文本测试确认文档尚未完成。**

Run: `npx jest tests/unit/readmeVerification.test.ts --runInBand`

Expected: FAIL because the two durable-document links and explicit certification command are not yet present.

- [ ] **Step 3: 添加验证文档和 README 入口。** `docs/verification.md` 必须明确：`npm test` 是秒级 deterministic suite；`npm run test:puzzle-certification` 在 Traffic Escape generator、quality rules 或 `src/pages/traffic-escape/hardPuzzles.generated.ts` 变化时强制运行；`npm run verify` 不上传、不部署；`npm run build:weapp` 只证明 package generation，不证明 Developer Tools 或真机行为。README 的开发命令区加入三个命令和 architecture link，不重写积分规则。

- [ ] **Step 4: 运行文档 focused test 与命令。**

Run: `npx jest tests/unit/readmeVerification.test.ts --runInBand && npm run verify`

Expected: PASS; `verify` 顺序执行 fast tests、typecheck、lint、assets、audio、secrets 和 whitespace，没有执行 certification、build、upload 或 deploy。

- [ ] **Step 5: 提交 Phase 2 文档与门槛。**

```bash
git add README.md docs/verification.md tests/unit/readmeVerification.test.ts
git diff --cached --check
git commit -m "docs: document fast verification and puzzle certification"
```

### Task 6: Phase 2 gate

- [ ] **Step 1: 在当前 HEAD 上顺序运行两类 suite。**

Run: `npm test && npm run test:puzzle-certification && npm run typecheck && npm run lint`

Expected: 两类测试均 PASS；默认 suite 不隐式执行 2,000 seed 扫描，显式认证 suite 完整执行。

- [ ] **Step 2: 检查命令和用户文件范围。**

Run: `git status --short --untracked-files=all && git diff "$BASE_SHA"..HEAD --name-only`

Expected: 仅出现 Phase 1/2 计划内文件；用户 `output/official-account/hidato` 与 `memory-challenge` 仍未跟踪且未暂存。

---

## Phase 3 — 证据驱动的删除与本地产物清理

### Task 7: 删除确认无引用的代码与素材

**Files:**
- Delete: `src/hooks/useAudioFeedback.ts`
- Delete: `scripts/fixtures/custom-pet-user-reference-dog.jpg`
- Delete: `asset-backups/cloudbase-images/pets/food-steak.png`
- Delete: `asset-backups/cloudbase-images/pets/pose-reference-sheet.png`
- Delete: `cloudfunctions/shared/assets/pose-reference-sheet.png`
- Modify: `scripts/sync-cloudbase-images.sh`
- Modify: focused asset/custom-pet tests only if the reference search finds an assertion tied to a deleted candidate

- [ ] **Step 1: 对每个候选运行三层仓库引用审计。** 第一层搜索完整相对路径；第二层搜索 basename、import symbol 和源文件名；第三层搜索运行时 remote key/manifest key。三层都必须没有 active source、test、config、script 或 CloudBase manifest 引用后才允许删除，历史 plans/specs/reviews 命中必须单独分类而不能直接当作活跃引用。

Run: `for f in src/hooks/useAudioFeedback.ts scripts/fixtures/custom-pet-user-reference-dog.jpg asset-backups/cloudbase-images/pets/food-steak.png asset-backups/cloudbase-images/pets/pose-reference-sheet.png cloudfunctions/shared/assets/pose-reference-sheet.png; do echo "--- $f"; rg -n --hidden --glob '!node_modules/**' --glob '!output/**' --fixed-strings "$f" . || true; done`

Expected: the full-path scan identifies every textual path occurrence. Continue with the basename/symbol scan:

Run: `rg -n --hidden --glob '!node_modules/**' --glob '!output/**' --glob '!docs/superpowers/plans/**' --glob '!docs/superpowers/specs/**' --glob '!docs/reviews/**' "useAudioFeedback|custom-pet-user-reference-dog|food-steak|pose-reference-sheet|cat-reference-sheet|food-steak\.png|pose-reference-sheet\.png" . || true`

Expected: no active source/test/config/script import symbol or basename remains for the deletion candidates; any `cat-reference-sheet` hit is classified separately because the custom-pet worker currently owns that key. Finish with remote-key scan:

Run: `rg -n --hidden --glob '!node_modules/**' --glob '!output/**' "pets/food-steak\.png|pets/pose-reference-sheet\.png|previews/pet-sheet-preview\.png|app-icons/.*(barbell|-[vV][123])" src scripts cloudfunctions project.config.json tests asset-backups || true`

Expected: only the deliberately removed manifest entries are present for candidates; `food-steak`, pose sheets and fixture have no active remote key. If any of the three scans finds a real active reference, stop this deletion batch and update its legitimate owner/test first; do not delete a file to make a test pass.

- [ ] **Step 2: 运行删除前的相关测试。**

Run: `npx jest tests/unit/audioFeedbackService.test.ts tests/unit/customPetWorker.test.js tests/unit/remoteAssets.test.ts tests/unit/petAssets.test.ts --runInBand`

Expected: PASS；这是删除前的行为基线。

- [ ] **Step 3: 删除候选并同步 asset-check manifest。** 从 `scripts/sync-cloudbase-images.sh` 的 `EXPECTED_ASSETS` 移除 `pets/pose-reference-sheet.png`，保留 `pets/cat-reference-sheet.png`（它仍被 custom-pet worker 使用）以及所有运行时宠物素材；不要改 remote asset version 或上传路径。

- [ ] **Step 4: 运行删除后检查。**

Run: `rg -n --hidden --glob '!node_modules/**' --glob '!output/**' --glob '!docs/superpowers/plans/**' --glob '!docs/superpowers/specs/**' --glob '!docs/reviews/**' "useAudioFeedback|custom-pet-user-reference-dog|food-steak|pose-reference-sheet" src scripts cloudfunctions project.config.json tests asset-backups || true; npm run assets:check; npx jest tests/unit/audioFeedbackService.test.ts tests/unit/customPetWorker.test.js tests/unit/remoteAssets.test.ts tests/unit/petAssets.test.ts --runInBand`

Expected: 仅保留历史文档中不构成运行时引用的文字（若有）；asset check 与 focused tests PASS。若 `audioFeedbackService.test.ts` 仍直接测试 deleted hook，则按当前服务 API 改为测试 `src/services/audio/audioFeedbackService.ts`，不恢复 hook。

- [ ] **Step 5: 提交这一组删除。**

```bash
git add -u src/hooks/useAudioFeedback.ts scripts/fixtures/custom-pet-user-reference-dog.jpg asset-backups/cloudbase-images/pets/food-steak.png asset-backups/cloudbase-images/pets/pose-reference-sheet.png cloudfunctions/shared/assets/pose-reference-sheet.png scripts/sync-cloudbase-images.sh tests/unit/audioFeedbackService.test.ts tests/unit/customPetWorker.test.js tests/unit/remoteAssets.test.ts tests/unit/petAssets.test.ts
git diff --cached --name-only
git diff --cached --check
git commit -m "chore: remove unused source and asset artifacts"
```

Expected: staged names are exactly the listed candidates/manifest and any explicitly updated focused tests; do not stage `output/`.

### Task 8: 删除 app-icon 变体并保留选定图标

**Files:**
- Delete: `asset-backups/cloudbase-images/app-icons/app-icon-daily-brain-training-line-barbell-brain-v1.png`
- Delete: `asset-backups/cloudbase-images/app-icons/app-icon-daily-brain-training-line-barbell-v1.png`
- Delete: `asset-backups/cloudbase-images/app-icons/app-icon-daily-brain-training-line-barbell-v2.png`
- Delete: `asset-backups/cloudbase-images/app-icons/app-icon-daily-brain-training-line-barbell-v3.png`
- Delete: `asset-backups/cloudbase-images/app-icons/app-icon-daily-brain-training-line-v1.png`
- Delete: `asset-backups/cloudbase-images/app-icons/app-icon-daily-brain-training-line-v2.png`
- Delete: `asset-backups/cloudbase-images/app-icons/app-icon-daily-brain-training-line-v3.png`
- Verify retained: `asset-backups/cloudbase-images/app-icons/app-icon-daily-brain-training.png`
- Verify retained: `asset-backups/cloudbase-images/app-icons/app-icon-daily-brain-training-line.png`

- [ ] **Step 1: 审计变体引用和 manifest。**

Run: `for f in asset-backups/cloudbase-images/app-icons/*; do case "$f" in *barbell*|*-v1.png|*-v2.png|*-v3.png) echo "--- $f"; rg -n --hidden --glob '!node_modules/**' --glob '!output/**' --fixed-strings "$(basename "$f")" . || true;; esac; done; rg -n "app-icon-daily-brain-training(-line)?\.png" scripts src project.config.json README.md`

Expected: only the two non-variant files are in `scripts/sync-cloudbase-images.sh` and remain in the manifest; no deleted variant is referenced by source, config, tests or docs.

- [ ] **Step 2: 运行资产基线和删除后检查。**

Run: `npm run assets:check`

Expected: PASS before and after deletion because the manifest contains only the two retained icons. Delete only the seven variant files, then rerun the command and `git diff --check`.

- [ ] **Step 3: 提交 app-icon 清理。**

```bash
git add -u asset-backups/cloudbase-images/app-icons
git diff --cached --name-status
git diff --cached --check
git commit -m "chore: remove obsolete app icon variants"
```

Expected: staged status lists exactly seven deletions and no `output/` path.

### Task 9: 删除历史噪声和 broken repository skill links

**Files:**
- Delete: `.trae/documents/plan_20260212_094742.md`
- Delete: `.superpowers/sdd/2026-09-07-traffic-escape-ten-vehicle-atlas/task-4-report.md`
- Delete: every broken symlink under `.claude/skills/` listed by `find .claude/skills -type l ! -exec test -e {} \; -print`
- Modify: `docs/architecture.md` to record deferred external-entry candidates
- Defer deletion: `.claude/settings.json`, `skills-lock.json`, `CLAUDE.MD` until external-tool ownership is disproven

- [ ] **Step 1: 验证内部引用、symlink 状态和外部工具入口。**

Run: `find .claude/skills -type l ! -exec test -e {} \; -print; rg -n --hidden --glob '!node_modules/**' --glob '!output/**' "\.claude/settings\.json|skills-lock\.json|CLAUDE\.MD|\.trae/documents|\.superpowers/sdd" package.json package-lock.json .github scripts src tests docs project.config.json AGENTS.md || true; git ls-files -s .claude/settings.json skills-lock.json CLAUDE.MD`

Expected: broken symlink list contains only the duplicate repository skill-link farm; internal search is not treated as proof that the three external-entry candidates are obsolete. Read each candidate and inspect any configured external tool entry points available on the host (for example Claude/Codex skill discovery paths and the symlink targets) without editing outside the repository. Keep `.trae/rules/`, its validator and `.trae/rules/tests/` because `lint:rules` depends on them.

- [ ] **Step 2: 运行删除前规则门槛。**

Run: `npm run lint:rules && npx jest .trae/rules/tests/validator.test.js --runInBand`

Expected: PASS; this proves the active `.trae/rules` path is unrelated to the stale `.trae/documents` and broken `.claude` links.

- [ ] **Step 3: 记录外部入口结论；对未证明确认废弃的文件暂不删除。** 如果 host inspection 明确证明 `.claude/settings.json`、`skills-lock.json` 或 `CLAUDE.MD` 仍是外部工具入口，保留原文件；如果没有足够证据证明其废弃，也保留原文件。只把三者列入 `docs/architecture.md` 的“建议删除、暂不执行”清单，写明外部 owner 未确认、当前 commit 不删除。只有明确完成外部入口审计且确认废弃时，才另开后续任务，不在本 cleanup 计划里删除它们。

- [ ] **Step 4: 删除已确认的历史/断链文件并运行引用扫描。** 删除前一步精确列出的 `.trae/documents`、`.superpowers/sdd` 文件和 broken symlinks，执行：

Run: `rg -n --hidden --glob '!node_modules/**' --glob '!output/**' "\.claude/skills|skills-lock|CLAUDE\.MD|\.trae/documents|\.superpowers/sdd" . || true`

Expected: no active repository reference remains for the deleted history/links; `.claude/settings.json`, `skills-lock.json` and `CLAUDE.MD` remain present unless the separate external-entry audit produced proof and a separately reviewed scope change. Do not delete any current `docs/superpowers/specs/2026-09-10-repository-architecture-cleanup-design.md` file.

- [ ] **Step 5: 提交历史噪声清理。**

```bash
git add -u .trae/documents .superpowers/sdd .claude/skills
git add docs/architecture.md
git diff --cached --name-status
git diff --cached --check
git commit -m "chore: remove stale repository metadata"
```

Expected: commit contains only confirmed stale metadata, broken links and the deferred-candidate note; `.trae/rules` remains tracked, the three external-entry candidates are not staged, and both user `output/` directories remain untracked.

### Task 10: 清理 ignored local artifacts（不提交）并完成 Phase 3 gate

**Files:**
- Verify/possibly remove locally: `dist/`, `.temp/`, `.rn_temp/`, `tmp/`
- Never remove in this phase: `node_modules/`
- Never stage: any ignored local directory or `output/official-account/*`

- [ ] **Step 1: 记录清理前目录大小和忽略产物。**

Run: `git status --short --ignored --untracked-files=all | sed -n '1,160p'; for d in dist .temp .rn_temp tmp; do if test -d "$d"; then du -sh -- "$d"; else echo "$d absent"; fi; done; test -d node_modules && du -sh -- node_modules`

Expected: only explicitly ignored build/cache directories are candidates; the size lines are captured in the task review; `node_modules/` is observed but never a deletion target. No command may traverse or remove `output/official-account/hidato` or `output/official-account/memory-challenge`.

- [ ] **Step 2: 只有在所有依赖验证结束后清理可重建缓存。** 若需要释放空间，只对仓库根目录下明确列出的 `dist/`、`.temp/`、`.rn_temp/`、`tmp/` 执行：`for d in dist .temp .rn_temp tmp; do test -d "$d" && rm -rf -- "$d"; done`；绝不删除 `node_modules/`，也不运行 `npm ci` 作为本地清理副作用。清理后重新运行相同的 size loop，记录每个目录的新大小或 `absent`。

- [ ] **Step 3: 运行 Phase 3 完整门槛。**

Run: `npm run verify && npm run test:puzzle-certification && git diff --check && git status --short --untracked-files=all`

Expected: all checks PASS；Git status 只保留两个用户 output 目录为未跟踪，且没有任何 `output/` 文件被 staged 或 committed。

---

## Phase 4 — 持久架构文档

### Task 11: 新增架构入口和 game-module contract

**Files:**
- Create: `docs/architecture.md`
- Create: `docs/game-module-contract.md`
- Modify: `README.md:54-66,87-108,133-139`
- Create: `tests/unit/architectureDocs.test.ts`

- [ ] **Step 1: 先写文档结构回归测试。** 测试必须读取两个新文档与 README，断言包含 target tree、依赖箭头、Traffic Escape `index/play/result`、settlement 顺序、remote asset version、generated file、CloudBase boundary、fast/certification 命令、route registration、catalog、share metadata、pure logic、tests、points economy、gauntlet 和 result surface 关键词。

```ts
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");

test("architecture guide covers the target boundaries", () => {
  const architecture = read("docs/architecture.md");
  for (const phrase of [
    "src/pages/", "src/domain/", "src/infrastructure/", "src/shared/",
    "pages/features -> domain/shared -> infrastructure adapters",
    "index/play/result", "getAwardedPoints()", "addPointsToPet()",
    "versioned", "generated", "CloudBase", "npm run test:puzzle-certification",
  ]) expect(architecture).toContain(phrase);
});

test("game-module contract names every registration and validation surface", () => {
  const contract = read("docs/game-module-contract.md");
  for (const phrase of ["route registration", "gameCatalog", "share metadata", "pure logic", "tests", "points economy", "gauntlet", "result surface"]) {
    expect(contract).toContain(phrase);
  }
});
```

- [ ] **Step 2: 运行测试确认文档缺失。**

Run: `npx jest tests/unit/architectureDocs.test.ts --runInBand`

Expected: FAIL because the two documents do not exist.

- [ ] **Step 3: 编写 `docs/architecture.md`。** 文档按以下章节写成新 GPT session 的单一入口：`Directory responsibilities`；target tree；allowed dependency direction；game lifecycle（start/play/result、serialized run、exactly-once settlement）；points/gauntlet sequence；CloudBase client/repository boundary；versioned remote assets and `asset-backups/`；generated files such as `hardPuzzles.generated.ts`；fast, certification, typecheck, lint, asset/audio/secrets/build commands；明确 build 不是 live WeChat/device evidence。文档只记录当前实现与本设计批准的边界，不复制历史设计全文。

- [ ] **Step 4: 编写 `docs/game-module-contract.md`。** 为每个游戏规定 route registration（`src/app.config.ts`）、catalog registration（`src/config/gameCatalog.ts`）、share metadata（`src/utils/share.ts`）、pure logic (`gameLogic.ts` 或等价 domain file)、focused tests、`docs/points-economy.md` 约束、gauntlet callback、ordinary result surface 与 exact settlement owner。注明 compatibility aliases/storage keys 不得擅自删除，generated files 只能通过脚本更新。

- [ ] **Step 5: 更新 README 入口，不改变产品事实。** 项目结构区链接两个文档；命令区区分快速 suite、puzzle certification 和 `npm run verify`；文档维护区把 architecture guide、game-module contract、points economy 列为长期入口，说明历史 plans/specs/reviews 只保留仍有决策价值的内容。

- [ ] **Step 6: 运行文档测试和 lint，并提交。**

Run: `npx jest tests/unit/architectureDocs.test.ts --runInBand && npm run typecheck && npm run lint`

Expected: PASS with no new lint warnings.

```bash
git add docs/architecture.md docs/game-module-contract.md README.md tests/unit/architectureDocs.test.ts
git diff --cached --check
git commit -m "docs: add durable repository architecture guide"
```

### Task 12: 提取历史决策并删除已完成噪声

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/game-module-contract.md`
- Verify/delete only after evidence: completed documents under `docs/superpowers/plans/`, `docs/superpowers/specs/`, `docs/reviews/`
- Keep until final cleanup: `docs/superpowers/specs/2026-09-10-repository-architecture-cleanup-design.md` and this plan

- [ ] **Step 1: 建立历史文档索引，不凭文件名删除。** 对每个候选运行：

Run: `for f in docs/superpowers/plans/*.md docs/superpowers/specs/*.md docs/reviews/*.md; do printf '%s\t' "$f"; git log -1 --format='%h %s' -- "$f"; done > /tmp/brain-games-history-index.txt; rg -n "traffic|pet|points|navigation|audio|refactor|catalog|official-account|repository" /tmp/brain-games-history-index.txt`

Expected: index is outside the repository and gives a reviewable list; no repository file changes occur.

- [ ] **Step 2: 将仍有效的决策写入 durable docs。** 至少提取：Traffic Escape 的 `index/play/result` 与 serialized run/exactly-once rules；points economy 的 shared pipeline and gauntlet exception；versioned CloudBase asset rule；route/catalog/share contract；generated hard-puzzle source-of-truth；验证命令和 live-evidence boundary。每条内容注明当前 source/test authority，例如 `src/pages/traffic-escape/run.ts`、`src/utils/gameGauntlet.ts`、`docs/points-economy.md`。

- [ ] **Step 3: 逐文件验证“已完成”再删除。** 只有当文档中的实现已在当前 source、tests 和 git history 中可定位，且其唯一仍有效内容已经进入两个 durable docs 时，才删除该文件。保留未完成设计、仍需作为 rationale 的 cleanup design，以及本 implementation plan。执行：

Run: `git diff -- docs/architecture.md docs/game-module-contract.md; rg -n "2026-09-10-repository-architecture-cleanup" docs README.md`

Expected: durable docs contain the extracted decisions, and the cleanup design/plan remain linked until the final project closeout.

- [ ] **Step 4: 运行 docs/README 回归和提交。**

Run: `npx jest tests/unit/architectureDocs.test.ts tests/unit/readmeVerification.test.ts --runInBand && git diff --check`

Expected: PASS; commit message must list only the reviewed historical deletions and durable docs.

```bash
git add docs/architecture.md docs/game-module-contract.md README.md docs/superpowers/plans docs/superpowers/specs docs/reviews
git diff --cached --name-status
git diff --cached --check
git commit -m "docs: consolidate completed architecture decisions"
```

### Task 13: Phase 4 gate

- [ ] **Step 1: 验证新 session 可从 durable docs 定位所有入口。**

Run: `rg -n "src/pages|src/domain|src/infrastructure|src/shared|gameCatalog|share metadata|points economy|gauntlet|result surface|test:puzzle-certification|build:weapp" docs/architecture.md docs/game-module-contract.md README.md`

Expected: every required boundary and command appears in at least one durable entry document.

- [ ] **Step 2: 运行阶段门槛。**

Run: `npm run verify && npm run test:puzzle-certification && npm run typecheck && npm run lint && git diff --check`

Expected: PASS; no output directory is staged.

---

## Phase 5 — 宠物领域与共享结算边界

### Task 14: 创建 pet domain types/assets/sprite，并先做类型迁移

**Files:**
- Create: `src/domain/pet/types.ts`
- Create: `src/domain/pet/assets.ts`
- Create: `src/domain/pet/sprite.ts`
- Modify temporarily: `src/pages/pet/types.ts`
- Modify temporarily: `src/pages/pet/petAssets.ts`
- Modify: `src/pages/pet/components/PetSprite/types.ts`
- Modify: `src/utils/petStorage.ts`
- Modify: `src/config/remoteAssets.ts`
- Modify: `src/services/user-data/types.ts`
- Modify: `src/services/custom-pet/types.ts`
- Modify: `src/services/custom-pet/customPetService.ts`
- Modify: `src/pages/pet/petDisplayPool.ts`
- Modify: tests importing page-owned types (`tests/unit/petAssets.test.ts`, `petFoodConfig.test.ts`, `petDisplayPool.test.ts`, `memoryChallengeGameLogic.test.ts`, `remoteAssets.test.ts`)

- [ ] **Step 1: 为 domain contract 写红测试。** 将 `tests/unit/petAssets.test.ts` 与 `tests/unit/petFoodConfig.test.ts` 的 imports 先改为新 domain paths，并新增边界测试：`createStandardPetAssetRef("dog")` 的 kind/skin、custom asset key、每个 `PetSkin` 三档 food loadout、`PetSpriteMood` 四值。此时新文件不存在，focused tests 必须 FAIL。

```ts
import { createCustomPetAssetRef, createStandardPetAssetRef, getPetAssetKey } from "../../src/domain/pet/assets";
import { getFoodItemsForPetSkin, PET_SKIN_NAME, type PetSkin } from "../../src/domain/pet/types";

test("domain asset refs preserve standard and custom identity", () => {
  expect(createStandardPetAssetRef("dog")).toEqual({ kind: "standard", skin: "dog" });
  expect(getPetAssetKey(createCustomPetAssetRef("cat", "asset-1"))).toBe("custom:asset-1");
});

test("every pet skin keeps its three-item food loadout", () => {
  (Object.keys(PET_SKIN_NAME) as PetSkin[]).forEach((skin) => {
    expect(getFoodItemsForPetSkin(skin)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: 移动纯 domain 定义，不改变值。** 把 `src/pages/pet/types.ts` 的 `PetStatus`、`PetSkin`、`PetData`、`PetStorageData`、`FoodItem`、food catalog/loadout、skin labels、adoption/hunger constants 和 `getFoodItemsForPetSkin()` 原样移到 `src/domain/pet/types.ts`；把 `PetAssetRef` 及其 constructors/lookup 移到 `src/domain/pet/assets.ts`；把 `PetSpriteMood` 与 `PetSpriteSize` 移到 `src/domain/pet/sprite.ts`。新 domain 文件不得 import `src/pages`。

- [ ] **Step 3: 加入迁移期兼容 re-export。** `src/pages/pet/types.ts` 只暂时保留 `export * from "../../domain/pet/types";`，`src/pages/pet/petAssets.ts` 只暂时保留 `export * from "../../domain/pet/assets";`；组件的 `PetSpriteProps` 留在页面组件目录，但其 `skin/status/mood/size` 类型从 domain 导入。所有 config/service/utils imports 改为 domain paths，测试 imports 同步改为 domain paths。

```ts
// src/pages/pet/types.ts (migration-only compatibility surface)
export * from "../../domain/pet/types";

// src/pages/pet/petAssets.ts (migration-only compatibility surface)
export * from "../../domain/pet/assets";
```

- [ ] **Step 4: 运行 focused tests 和依赖方向检查。**

Run: `npx jest tests/unit/petAssets.test.ts tests/unit/petFoodConfig.test.ts tests/unit/petDisplayPool.test.ts tests/unit/petStorage.test.ts tests/unit/remoteAssets.test.ts tests/unit/memoryChallengeGameLogic.test.ts --runInBand && npm run typecheck && ! rg -n 'from "\.\.?/.*pages/pet' src/config src/services src/utils src/domain`

Expected: PASS; no config/service/utils/domain module imports from `src/pages/pet`.

- [ ] **Step 5: 删除迁移期 re-export，并确认无页面类型引用。** 运行：

Run: `rg -n "from .*pages/pet/(types|petAssets)|from .*pet/components/PetSprite/types" src tests || true`

Expected: only the component's local `PetSpriteProps` import remains if it imports domain sprite types indirectly; no non-view module uses page-owned types. Delete the two compatibility files only after this scan is empty, then rerun the focused suite.

- [ ] **Step 6: 提交 domain migration。**

```bash
git add src/domain/pet src/pages/pet/types.ts src/pages/pet/petAssets.ts src/pages/pet/components/PetSprite/types.ts src/pages/pet/petDisplayPool.ts src/utils/petStorage.ts src/config/remoteAssets.ts src/services/user-data/types.ts src/services/custom-pet/types.ts src/services/custom-pet/customPetService.ts tests/unit/petAssets.test.ts tests/unit/petFoodConfig.test.ts tests/unit/petDisplayPool.test.ts tests/unit/petStorage.test.ts tests/unit/remoteAssets.test.ts tests/unit/memoryChallengeGameLogic.test.ts
git diff --cached --check
git commit -m "refactor: move pet contracts out of pages"
```

### Task 15: Move canonical training contracts before settlement work

**Files:**
- Create: `src/domain/training/types.ts`
- Modify: `src/utils/trainingStorage.ts`
- Modify: `src/utils/gameFlowSession.ts`
- Modify: `src/utils/gameGauntlet.ts`
- Modify: `src/utils/petStorage.ts`
- Verify: `tests/unit/trainingStorage.test.ts`, `tests/unit/gameGauntlet.test.ts`, `tests/unit/petStorage.test.ts`

- [ ] **Step 1: 先运行当前 characterization tests，并列出源码中的全部 canonical exports。**

Run: `npx jest tests/unit/trainingStorage.test.ts tests/unit/gameGauntlet.test.ts tests/unit/petStorage.test.ts --runInBand && rg -n '^export (type|interface) ' src/utils/trainingStorage.ts`

Expected: existing behavior is green and the `rg` output, not a hand-written example, is the authoritative list of every type to move. Include all current `TrainingGameId`, outcome/difficulty/reward policy, record, summary, dashboard and settings declarations that are exported by the source; do not replace the declaration with a shortened union.

- [ ] **Step 2: 只移动 canonical declarations，不改变字段或 literals。** Copy the exact current exported declarations from `src/utils/trainingStorage.ts` into `src/domain/training/types.ts`, preserving every union member, optional field, alias and property type. Update `trainingStorage.ts` to import the domain types and re-export them for compatibility; update `gameFlowSession.ts`, `gameGauntlet.ts` and `petStorage.ts` to import from domain where they are domain consumers. Do not add settlement orchestration in this pure type move.

- [ ] **Step 3: 运行类型/行为回归并提交纯重构。**

Run: `npx jest tests/unit/trainingStorage.test.ts tests/unit/gameGauntlet.test.ts tests/unit/petStorage.test.ts --runInBand && npm run typecheck && git diff --check`

Expected: PASS; `git diff -- src/utils/trainingStorage.ts src/domain/training/types.ts` shows only relocation/re-export changes and no scoring/storage behavior change.

```bash
git add src/domain/training/types.ts src/utils/trainingStorage.ts src/utils/gameFlowSession.ts src/utils/gameGauntlet.ts src/utils/petStorage.ts tests/unit/trainingStorage.test.ts tests/unit/gameGauntlet.test.ts tests/unit/petStorage.test.ts
git diff --cached --check
git commit -m "refactor: move canonical training contracts"
```

### Task 16: Write the settlement RED test, then implement the typed service

**Files:**
- Create: `src/domain/training/settlement.ts`
- Create: `src/services/gameSettlementService.ts`
- Create: `tests/unit/gameSettlementService.test.ts`
- Verify: `src/utils/trainingStorage.ts`, `src/utils/petStorage.ts`, `src/utils/gameGauntlet.ts`

- [ ] **Step 1: 先只写 service RED test，不修改 production service 或 route。** In `tests/unit/gameSettlementService.test.ts`, mock `getAwardedPoints`, `addPointsToPet`, `recordTrainingSession`, and `completeGauntletLegIfNeeded`. Add tests for one ordinary completed settlement, one interrupted settlement with zero score, a gauntlet short-circuit, reward-policy forwarding, and exactly one points calculation.

```ts
test("ordinary completion awards once and records once", () => {
  const result = settleGame({ gameId: "hidato", score: 32, difficulty: "hard", durationSeconds: 91, outcome: "completed" });
  expect(getAwardedPoints).toHaveBeenCalledTimes(1);
  expect(addPointsToPet).toHaveBeenCalledTimes(1);
  expect(recordTrainingSession).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({ awardedPoints: 48, gauntletHandled: false, record: expect.any(Object) });
});

test("gauntlet leg stops before ordinary reward and record", () => {
  completeGauntletLegIfNeeded.mockReturnValue(true);
  const result = settleGame({ gameId: "hidato", score: 32, difficulty: "hard", outcome: "completed" });
  expect(result.gauntletHandled).toBe(true);
  expect(addPointsToPet).not.toHaveBeenCalled();
  expect(recordTrainingSession).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行 RED test，确认 service 缺失而非类型迁移缺失。**

Run: `npx jest tests/unit/gameSettlementService.test.ts --runInBand`

Expected: FAIL because `src/services/gameSettlementService.ts` and `src/domain/training/settlement.ts` do not yet exist; the canonical type migration from Task 15 is already green and is not part of this RED result.

- [ ] **Step 3: 定义 typed contract 并实现最小编排。** `src/domain/training/settlement.ts` imports the exact types from `./types` and defines `GameSettlementInput` with `gameId`, `score`, optional `difficulty`, `durationSeconds`, `mode`, `outcome`, and optional `rewardPolicy`; it defines `GameSettlementResult` with `awardedPoints`, `gauntletHandled`, and nullable `TrainingRecord`. `settleGame(input)` computes `getAwardedPoints()` once, calls `completeGauntletLegIfNeeded()` first, returns `{ awardedPoints, gauntletHandled: true, record: null }` when handled, otherwise calls `addPointsToPet()` and `recordTrainingSession()`. Do not duplicate caps, aliases or final `game-gauntlet` aggregation.

- [ ] **Step 4: 运行 focused tests/typecheck 并提交 service。**

Run: `npx jest tests/unit/gameSettlementService.test.ts tests/unit/trainingStorage.test.ts tests/unit/gameGauntlet.test.ts tests/unit/petStorage.test.ts --runInBand && npm run typecheck`

Expected: PASS; shared points pipeline and gauntlet final aggregation remain unchanged.

```bash
git add src/domain/training/settlement.ts src/services/gameSettlementService.ts tests/unit/gameSettlementService.test.ts
git diff --cached --check
git commit -m "refactor: add shared game settlement service"
```

### Task 17A: Migrate ordinary settlement batch 1

**Files:**
- Modify: `src/pages/color-trap/index.tsx`, `src/pages/spatial-rotation/index.tsx`, `src/pages/hidato/index.tsx`, `src/pages/tents-camp/index.tsx`, `src/pages/sumplete-grid/index.tsx`
- Verify: `tests/unit/colorTrapGameLogic.test.ts`, `tests/unit/spatialRotationGameLogic.test.ts`, `tests/unit/hidatoGameLogic.test.ts`, `tests/unit/tentsCampGameLogic.test.ts`, `tests/unit/sumpleteGridGameLogic.test.ts`, `tests/unit/gameSettlementService.test.ts`

- [ ] **Step 1: 记录这五个 route 的 current settlement arguments。** Run `rg -n "getAwardedPoints|addPointsToPet|recordTrainingSession|completeGauntletLegIfNeeded" src/pages/color-trap/index.tsx src/pages/spatial-rotation/index.tsx src/pages/hidato/index.tsx src/pages/tents-camp/index.tsx src/pages/sumplete-grid/index.tsx` and preserve each current game id, score, difficulty, duration, mode, outcome and best-score side effect.
- [ ] **Step 2: 用 `settleGame({ gameId, score, difficulty, durationSeconds, mode, outcome, rewardPolicy })` 替换重复编排。** Keep view state/navigation and return immediately when `gauntletHandled` is true; do not change any score/cap constant.
- [ ] **Step 3: 运行 focused tests、typecheck、lint 和 review checkpoint。** Run: `npx jest tests/unit/colorTrapGameLogic.test.ts tests/unit/spatialRotationGameLogic.test.ts tests/unit/hidatoGameLogic.test.ts tests/unit/tentsCampGameLogic.test.ts tests/unit/sumpleteGridGameLogic.test.ts tests/unit/gameSettlementService.test.ts --runInBand && npm run typecheck && npm run lint && git diff "$BASE_SHA"..HEAD --name-only`
- [ ] **Step 4: 提交只包含本批文件。**

```bash
git add src/pages/color-trap/index.tsx src/pages/spatial-rotation/index.tsx src/pages/hidato/index.tsx src/pages/tents-camp/index.tsx src/pages/sumplete-grid/index.tsx tests/unit/colorTrapGameLogic.test.ts tests/unit/spatialRotationGameLogic.test.ts tests/unit/hidatoGameLogic.test.ts tests/unit/tentsCampGameLogic.test.ts tests/unit/sumpleteGridGameLogic.test.ts tests/unit/gameSettlementService.test.ts
git diff --cached --check
git commit -m "refactor: migrate reasoning routes to settlement service"
```

### Task 17B: Migrate ordinary settlement batch 2

**Files:**
- Modify: `src/pages/netwalk/index.tsx`, `src/pages/loop-line/index.tsx`, `src/pages/word-scramble/index.tsx`, `src/pages/digit-span/index.tsx`, `src/pages/number-order/index.tsx`
- Verify: `tests/unit/netwalkGameLogic.test.ts`, `tests/unit/loopLineGameLogic.test.ts`, `tests/unit/wordScrambleGameLogic.test.ts`, `tests/unit/numberOrderGameLogic.test.ts`, `tests/unit/gameSettlementService.test.ts`

- [ ] **Step 1: 先运行这五个 route 的 characterization suite。** Run: `npx jest tests/unit/netwalkGameLogic.test.ts tests/unit/loopLineGameLogic.test.ts tests/unit/wordScrambleGameLogic.test.ts tests/unit/numberOrderGameLogic.test.ts --runInBand`.
- [ ] **Step 2: 迁移 settlement 并保留每个 route 的 mode/difficulty/storage/navigation semantics。** Use the typed service; do not introduce a generic route wrapper.
- [ ] **Step 3: 运行 focused tests、typecheck、lint 和 review checkpoint。** Run: `npx jest tests/unit/netwalkGameLogic.test.ts tests/unit/loopLineGameLogic.test.ts tests/unit/wordScrambleGameLogic.test.ts tests/unit/numberOrderGameLogic.test.ts tests/unit/gameSettlementService.test.ts --runInBand && npm run typecheck && npm run lint && git diff "$BASE_SHA"..HEAD --name-only`.
- [ ] **Step 4: 提交明确文件列表。**

```bash
git add src/pages/netwalk/index.tsx src/pages/loop-line/index.tsx src/pages/word-scramble/index.tsx src/pages/digit-span/index.tsx src/pages/number-order/index.tsx tests/unit/netwalkGameLogic.test.ts tests/unit/loopLineGameLogic.test.ts tests/unit/wordScrambleGameLogic.test.ts tests/unit/numberOrderGameLogic.test.ts tests/unit/gameSettlementService.test.ts
git diff --cached --check
git commit -m "refactor: migrate memory routes to settlement service"
```

### Task 17C: Migrate multi-mode ordinary settlement batch 3

**Files:**
- Modify: `src/pages/multiple-object-tracking/index.tsx`, `src/pages/bird-count/index.tsx`
- Verify: `tests/unit/birdCountGameLogic.test.ts`, `tests/unit/gameGauntlet.test.ts`, `tests/unit/gameSettlementService.test.ts`

- [ ] **Step 1: 先运行 multi-mode characterization tests 和 source audit。** Run: `npx jest tests/unit/birdCountGameLogic.test.ts tests/unit/gameGauntlet.test.ts --runInBand && rg -n "getAwardedPoints|addPointsToPet|recordTrainingSession|completeGauntletLegIfNeeded|mode|difficulty" src/pages/multiple-object-tracking/index.tsx src/pages/bird-count/index.tsx`.
- [ ] **Step 2: 迁移所有 normal/gauntlet branches。** Preserve Farm Count `speed`/`yard` mode, reward difficulty, and both ordinary/gauntlet completion branches; service calls must be one per completion path and must short-circuit before ordinary record/reward for gauntlet.
- [ ] **Step 3: 运行 focused tests、typecheck、lint 和 review checkpoint。** Run: `npx jest tests/unit/birdCountGameLogic.test.ts tests/unit/gameGauntlet.test.ts tests/unit/gameSettlementService.test.ts --runInBand && npm run typecheck && npm run lint && git diff "$BASE_SHA"..HEAD --name-only`.
- [ ] **Step 4: 提交明确文件列表。**

```bash
git add src/pages/multiple-object-tracking/index.tsx src/pages/bird-count/index.tsx tests/unit/birdCountGameLogic.test.ts tests/unit/gameGauntlet.test.ts tests/unit/gameSettlementService.test.ts
git diff --cached --check
git commit -m "refactor: migrate multi-mode routes to settlement service"
```

### Task 17D: Migrate scoring/mode ordinary settlement batch 4

**Files:**
- Modify: `src/pages/rock-paper-scissors/index.tsx`, `src/pages/mental-math/index.tsx`, `src/pages/music-theory/index.tsx`, `src/pages/pattern-completion/index.tsx`, `src/pages/memory-challenge/index.tsx`, `src/pages/twenty-four/index.tsx`
- Verify: `tests/unit/rockPaperScissorsHighScore.test.ts`, `tests/unit/mentalMathStages.test.ts`, `tests/unit/musicTheoryGameLogic.test.ts`, `tests/unit/patternCompletionPatterns.test.ts`, `tests/unit/memoryChallengeGameLogic.test.ts`, `tests/unit/twentyFourGameLogic.test.ts`, `tests/unit/gameSettlementService.test.ts`

- [ ] **Step 1: 先运行 characterization tests 并记录 custom reward policies。** Run: `npx jest tests/unit/rockPaperScissorsHighScore.test.ts tests/unit/mentalMathStages.test.ts tests/unit/musicTheoryGameLogic.test.ts tests/unit/patternCompletionPatterns.test.ts tests/unit/memoryChallengeGameLogic.test.ts tests/unit/twentyFourGameLogic.test.ts --runInBand && rg -n "rewardPolicy|getAwardedPoints|addPointsToPet|recordTrainingSession|completeGauntletLegIfNeeded" src/pages/rock-paper-scissors/index.tsx src/pages/mental-math/index.tsx src/pages/music-theory/index.tsx src/pages/pattern-completion/index.tsx src/pages/memory-challenge/index.tsx src/pages/twenty-four/index.tsx`.
- [ ] **Step 2: 迁移六个 route，透传自定义 strategy。** Preserve timed/challenge score derivation, high-score writes, Memory Challenge custom caps, mode strings and gauntlet behavior; pages never calculate points themselves.
- [ ] **Step 3: 运行 focused tests、typecheck、lint 和 review checkpoint。** Run: `npx jest tests/unit/rockPaperScissorsHighScore.test.ts tests/unit/mentalMathStages.test.ts tests/unit/musicTheoryGameLogic.test.ts tests/unit/patternCompletionPatterns.test.ts tests/unit/memoryChallengeGameLogic.test.ts tests/unit/twentyFourGameLogic.test.ts tests/unit/gameSettlementService.test.ts --runInBand && npm run typecheck && npm run lint && git diff "$BASE_SHA"..HEAD --name-only`.
- [ ] **Step 4: 提交明确文件列表。**

```bash
git add src/pages/rock-paper-scissors/index.tsx src/pages/mental-math/index.tsx src/pages/music-theory/index.tsx src/pages/pattern-completion/index.tsx src/pages/memory-challenge/index.tsx src/pages/twenty-four/index.tsx tests/unit/rockPaperScissorsHighScore.test.ts tests/unit/mentalMathStages.test.ts tests/unit/musicTheoryGameLogic.test.ts tests/unit/patternCompletionPatterns.test.ts tests/unit/memoryChallengeGameLogic.test.ts tests/unit/twentyFourGameLogic.test.ts tests/unit/gameSettlementService.test.ts
git diff --cached --check
git commit -m "refactor: migrate scoring routes to settlement service"
```

### Task 17E: Migrate Traffic Escape as a separate exactly-once task

**Files:**
- Modify: `src/pages/traffic-escape/play.tsx`
- Verify: `src/pages/traffic-escape/run.ts`, `tests/unit/trafficEscapeRun.test.ts`, `tests/unit/trafficEscapeGameLogic.test.ts`, `tests/unit/gameSettlementService.test.ts`

- [ ] **Step 1: 先运行 run-state characterization。** Run: `npx jest tests/unit/trafficEscapeRun.test.ts tests/unit/trafficEscapeGameLogic.test.ts --runInBand`; keep `settleTrafficEscapeRun(runId, result)` as the only active-to-settled transition.
- [ ] **Step 2: migrate completion only after the RED/GREEN service contract exists.** In `finishGame`, compute score and `isNewBest`, call `settleTrafficEscapeRun`, return on null, then call `settleGame` once; redirect to `/pages/traffic-escape/result?runId=...` only after ordinary settlement. In `backToStart`, keep `abandonGameRun` first and call `settleGame` with score 0 and outcome interrupted once; preserve gauntlet interruption and `Taro.navigateBack()`.
- [ ] **Step 3: add exactly-once regression and run focused review checkpoint.** Run: `npx jest tests/unit/trafficEscapeRun.test.ts tests/unit/trafficEscapeGameLogic.test.ts tests/unit/gameSettlementService.test.ts --runInBand && npm run typecheck && npm run lint && ! rg -n "getAwardedPoints|addPointsToPet|recordTrainingSession|completeGauntletLegIfNeeded" src/pages/traffic-escape/play.tsx && git diff "$BASE_SHA"..HEAD --name-only`.
- [ ] **Step 4: commit only Traffic Escape files.**

```bash
git add src/pages/traffic-escape/play.tsx src/pages/traffic-escape/run.ts tests/unit/trafficEscapeRun.test.ts tests/unit/trafficEscapeGameLogic.test.ts tests/unit/gameSettlementService.test.ts
git diff --cached --check
git commit -m "refactor: preserve traffic escape exactly once settlement"
```

### Task 18: Phase 5 dependency and reward gate

- [ ] **Step 1: 证明配置、服务、工具、domain 均不依赖 pages。**

Run: `! rg -n '^import .*from ["].*pages|^import type .*from ["].*pages' src/config src/services src/utils src/domain`

Expected: exit 0 with no matches. Page components may import domain/shared/service; reverse direction is forbidden.

- [ ] **Step 2: 证明 settlement owner 唯一且积分规则未漂移。**

Run: `rg -n "getAwardedPoints|addPointsToPet|recordTrainingSession|completeGauntletLegIfNeeded" src/pages src/services src/utils | sed -n '1,320p'`

Expected: route completion flows call `settleGame`; `stickerRewards.ts` and `gameGauntlet.ts` retain their intentionally separate reward responsibilities; no page hand-rolls caps/multipliers.

- [ ] **Step 3: 运行完整阶段门槛。**

Run: `npm run verify && npm run test:puzzle-certification && npm run build:weapp && git diff --check`

Expected: all checks/build PASS; build only proves package generation and is not reported as live WeChat/device proof.

---

## Phase 6 — 路由可读性与增量拆分

### Task 19: 建立格式化门槛并先格式化 Traffic Escape

**Files:**
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/pages/traffic-escape/index.tsx`
- Modify: `src/pages/traffic-escape/play.tsx`
- Modify: `src/pages/traffic-escape/result.tsx`
- Modify: `src/pages/traffic-escape/index.scss`
- Create: `tests/unit/formattingConfig.test.ts`

- [ ] **Step 1: 写 formatting command regression。**

```ts
import { execFileSync } from "node:child_process";

test("format check covers route and config source", () => {
  const output = execFileSync("npm", ["run", "format:check"], { encoding: "utf8" });
  expect(output).toContain("Checking formatting");
});
```

- [ ] **Step 2: 运行 focused test 确认 command 尚不存在。**

Run: `npx jest tests/unit/formattingConfig.test.ts --runInBand`

Expected: FAIL because `format:check` is not in `package.json`.

- [ ] **Step 3: 添加锁定版本的 Prettier 配置和脚本。** 执行 `npm install --save-dev --save-exact prettier@3.6.2`；新增 `.prettierrc.json`（`semi: true`、`singleQuote: false`、`trailingComma: "all"`、`printWidth: 100`、`tabWidth: 2`），`.prettierignore` 忽略 `dist/`、`node_modules/`、`output/`、`asset-backups/`、generated puzzle source。加入：

```json
{
  "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,scss}\" \"tests/**/*.{ts,tsx,js,jsx}\" \"scripts/**/*.{ts,js,mjs}\" README.md docs/architecture.md docs/game-module-contract.md docs/verification.md",
  "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,scss}\" \"tests/**/*.{ts,tsx,js,jsx}\" \"scripts/**/*.{ts,js,mjs}\" README.md docs/architecture.md docs/game-module-contract.md docs/verification.md"
}
```

Do not format generated puzzle data, historical plans/specs/reviews, remote image binaries or the two user output directories. Add `npm run format:check` to `verify` after `lint`.

- [ ] **Step 4: 先对 Traffic Escape 运行 format，再用 characterization tests 锁行为。**

Run: `npx prettier --write src/pages/traffic-escape/index.tsx src/pages/traffic-escape/play.tsx src/pages/traffic-escape/result.tsx src/pages/traffic-escape/index.scss && npx jest tests/unit/trafficEscapeGameLogic.test.ts tests/unit/trafficEscapeRun.test.ts tests/unit/trafficEscapePuzzleQuality.test.ts --runInBand && npm run format:check`

Expected: formatting passes; game logic, run state, and quality tests remain green; no score/reward/navigation assertion changes are accepted as part of formatting.

- [ ] **Step 5: 提交 formatting gate 和 Traffic formatting。**

```bash
git add .prettierrc.json .prettierignore package.json package-lock.json tests/unit/formattingConfig.test.ts src/pages/traffic-escape/index.tsx src/pages/traffic-escape/play.tsx src/pages/traffic-escape/result.tsx src/pages/traffic-escape/index.scss
git diff --cached --check
git commit -m "style: enforce route formatting"
```

### Task 20: 拆分 Music Theory、Memory Challenge、Bird Count

**Files:**
- Modify: `src/pages/music-theory/index.tsx`
- Create: `src/pages/music-theory/components/MusicTheoryStartPanel.tsx`
- Create: `src/pages/music-theory/components/MusicTheoryPlayPanel.tsx`
- Create: `src/pages/music-theory/components/MusicTheoryResultPanel.tsx`
- Modify: `src/pages/memory-challenge/index.tsx`
- Create: `src/pages/memory-challenge/components/MemoryChallengeStartPanel.tsx`
- Create: `src/pages/memory-challenge/components/MemoryChallengePlayPanel.tsx`
- Create: `src/pages/memory-challenge/components/MemoryChallengeResultPanel.tsx`
- Modify: existing `src/pages/bird-count/components/{FarmCountPlayArea,FarmCountResult,FarmCountStartPanel}.tsx` only for prop/type ownership
- Modify: `tests/unit/musicTheoryGameLogic.test.ts`, `tests/unit/memoryChallengeGameLogic.test.ts`, `tests/unit/birdCountGameLogic.test.ts`

- [ ] **Step 1: 先运行 characterization suite 和记录 route state。**

Run: `npx jest tests/unit/musicTheoryGameLogic.test.ts tests/unit/memoryChallengeGameLogic.test.ts tests/unit/birdCountGameLogic.test.ts --runInBand && wc -l src/pages/music-theory/index.tsx src/pages/memory-challenge/index.tsx src/pages/bird-count/index.tsx`

Expected: all pure logic tests PASS; route state variables and callbacks are recorded before JSX extraction.

- [ ] **Step 2: 定义 view-only props，不复制业务逻辑。** Start panel 只接收 current difficulty/mode labels and callbacks；play panel 只接收 question/state/feedback and answer callbacks；result panel 只接收 score/accuracy/awardedPoints/isNewBest and navigation callbacks。`gameLogic.ts`、timer、audio、settlement、storage and gauntlet remain in route/controller. Existing Bird Count components keep their behavior and only receive typed props from the route.

```ts
export interface MusicTheoryResultPanelProps {
  score: number;
  awardedPoints: number;
  isNewBest: boolean;
  onRestart: () => void;
  onBack: () => void;
}
```

- [ ] **Step 3: 按一个页面一个 commit 提取 JSX。** 先拆 Music Theory，运行 focused tests/typecheck/format；再拆 Memory Challenge；最后只修 Bird Count 现有 components 的 prop interfaces。每个 route entry 只保留 parameter parsing, controller callbacks, lifecycle hooks and composition。

- [ ] **Step 4: 每页运行 focused check 并提交。**

Run: `npx jest tests/unit/musicTheoryGameLogic.test.ts --runInBand && npm run typecheck && npm run format:check && npm run lint`

Expected: PASS; then commit:

```bash
git add src/pages/music-theory tests/unit/musicTheoryGameLogic.test.ts
git diff --cached --check
git commit -m "refactor: split music theory route views"
```

Repeat the same command and commit pattern for `src/pages/memory-challenge` (`refactor: split memory challenge route views`) and the Bird Count prop-only batch (`refactor: clarify bird count route views`).

### Task 21: 拆分 Pet、Pattern Completion、Mental Math

**Files:**
- Modify: `src/pages/pet/index.tsx`
- Create: `src/pages/pet/components/PetOverviewPanel.tsx`
- Create: `src/pages/pet/components/PetFoodPanel.tsx`
- Create: `src/pages/pet/components/PetAdoptionPanel.tsx`
- Modify: `src/pages/pattern-completion/index.tsx`
- Create: `src/pages/pattern-completion/components/PatternStartPanel.tsx`
- Create: `src/pages/pattern-completion/components/PatternPlayPanel.tsx`
- Create: `src/pages/pattern-completion/components/PatternResultPanel.tsx`
- Modify: `src/pages/mental-math/index.tsx`
- Create: `src/pages/mental-math/components/MentalMathStartPanel.tsx`
- Create: `src/pages/mental-math/components/MentalMathPlayPanel.tsx`
- Create: `src/pages/mental-math/components/MentalMathResultPanel.tsx`
- Modify: `tests/unit/petStorage.test.ts`, `tests/unit/patternCompletionPatterns.test.ts`, `tests/unit/mentalMathStages.test.ts`

- [ ] **Step 1: 先锁定页面行为边界。** 运行：

Run: `npx jest tests/unit/petStorage.test.ts tests/unit/patternCompletionPatterns.test.ts tests/unit/mentalMathStages.test.ts tests/unit/gameSettlementService.test.ts --runInBand`

Expected: PASS; capture existing pet hunger/adoption/feed behavior, pattern stage scoring, mental-math challenge termination, and settlement invocation as the characterization baseline.

- [ ] **Step 2: 只提取 view components。** Pet panels receive `PetData`, `FoodItem[]`, loading/error state, and callbacks; they do not import `src/utils/petStorage` directly. Pattern/Mental Math panels receive derived display state and callbacks; pure rules remain in `patterns.ts`/`mathStages.ts` or `gameLogic.ts`; settlement remains in `gameSettlementService.ts`.

```ts
export interface PetFoodPanelProps {
  pet: PetData | null;
  foods: FoodItem[];
  busyFoodId: string | null;
  onFeed: (food: FoodItem) => void;
}
```

- [ ] **Step 3: 分三个小批次提取并运行 focused checks。** Pet first, Pattern Completion second, Mental Math third. After each extraction run the corresponding unit tests, `npm run typecheck`, `npm run format:check`, and `npm run lint`; preserve every existing class name/text/handler order.

- [ ] **Step 4: 按页面提交。**

```bash
git add src/pages/pet tests/unit/petStorage.test.ts
git diff --cached --check
git commit -m "refactor: split pet route views"

git add src/pages/pattern-completion tests/unit/patternCompletionPatterns.test.ts
git diff --cached --check
git commit -m "refactor: split pattern completion route views"

git add src/pages/mental-math tests/unit/mentalMathStages.test.ts
git diff --cached --check
git commit -m "refactor: split mental math route views"
```

### Task 22: Phase 6 final gate and cleanup-plan closeout

**Files:**
- Verify all changed files in Phases 1–6
- At final cleanup only: delete `docs/superpowers/plans/2026-09-10-repository-architecture-cleanup.md` after all tasks are complete; retain `docs/superpowers/specs/2026-09-10-repository-architecture-cleanup-design.md` as rationale

- [ ] **Step 1: 运行完整验证。**

Run: `npm test && npm run test:puzzle-certification && npm run typecheck && npm run lint && npm run format:check && npm run assets:check && npm run audio:check && npm run secrets:check && npm run build:weapp && git diff --check`

Expected: every command exits 0. This is repository/build evidence only; do not claim live WeChat Developer Tools, device, CloudBase upload, deployment, or publication evidence.

- [ ] **Step 2: 运行架构约束扫描。**

Run: `! rg -n '^import .*from ["].*pages|^import type .*from ["].*pages' src/config src/services src/utils src/domain; rg -n "getAwardedPoints|addPointsToPet|recordTrainingSession|completeGauntletLegIfNeeded" src/pages src/services src/utils; git status --short --untracked-files=all`

Expected: no forbidden inward imports; settlement call sites match the documented ownership; only the two user-owned output directories may remain untracked.

- [ ] **Step 3: 审核每个 commit 的范围。**

Run: `git log --oneline "$BASE_SHA"..HEAD; git diff --stat "$BASE_SHA"..HEAD; git diff --name-only "$BASE_SHA"..HEAD | rg '^output/' && exit 1 || true`

Expected: commits are phase/task scoped, no `output/` file appears in the diff, and no CloudBase upload/deploy command was run.

- [ ] **Step 4: 先写完成摘要、保留/删除清单和验证命令，再决定是否 close plan。** 在 `docs/architecture.md` 写入本 cleanup 的完成摘要、实际保留项（包括外部入口候选）和实际删除项，并写入最终 verification 命令及其日期/commit。只有当该摘要、清单和命令已落盘，所有 completion criteria 均满足且 final verification 已通过时，才删除本 execution plan；任何一项缺失或仍有未完成批次时，保留计划并报告未完成项。始终保留 `docs/superpowers/specs/2026-09-10-repository-architecture-cleanup-design.md` 作为 rationale。若满足删除条件，删除计划必须是单独提交：

```bash
git add -u docs/superpowers/plans/2026-09-10-repository-architecture-cleanup.md
git diff --cached --check
git commit -m "chore: close repository architecture cleanup plan"
```

## Self-review checklist for the implementation worker

- [ ] Six design phases each have an independently green, scoped commit boundary.
- [ ] Execution started from `99cc1b3` on ordinary branch `codex/repository-architecture-cleanup`; all phase diffs use recorded `BASE_SHA`, with no worktree.
- [ ] Every behavior-changing/refactoring batch starts with a focused characterization or regression test and records the expected red result before implementation.
- [ ] The two user-owned untracked output directories were never opened for editing, added, removed, or included in a commit.
- [ ] ESLint baseline violations were measured before activation; any existing debt was fixed in a separate scoped commit, without broad disables.
- [ ] ESLint uses one active flat configuration with meaningful React, Hooks, TypeScript, Node, Jest and Taro rules; `.eslintrc` is gone.
- [ ] Fast Jest and full puzzle certification are separate commands; `verify` does not upload/deploy/build implicitly.
- [ ] Every tracked deletion had a repository-wide reference audit and paired manifest/test update where applicable.
- [ ] Deletion audits covered full paths, basenames/import symbols and remote keys; `.claude/settings.json`, `skills-lock.json` and `CLAUDE.MD` were deleted only with external-entry proof, otherwise documented as deferred.
- [ ] `docs/architecture.md` and `docs/game-module-contract.md` are sufficient without reading historical plans.
- [ ] No `src/config`, `src/services`, `src/utils`, or `src/domain` module imports from `src/pages`.
- [ ] Settlement still computes points once, completes gauntlet first, and records ordinary games only; Traffic Escape remains exactly-once.
- [ ] Canonical training types came from the current source declarations without a shortened replacement union; the service RED test ran after the pure type move.
- [ ] Route extraction changes readability only; score, difficulty, mode, storage, rewards, run state and navigation behavior are covered by focused tests.
- [ ] Final report distinguishes tests/build/mocks from live WeChat/device/CloudBase evidence.
