import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

test("architecture guide covers the target boundaries", () => {
  const architecture = read("docs/architecture.md");
  for (const phrase of [
    "src/pages/",
    "src/domain/",
    "src/infrastructure/",
    "src/shared/",
    "pages/features -> domain/shared -> infrastructure adapters",
    "index/play/result",
    "getAwardedPoints()",
    "addPointsToPet()",
    "versioned",
    "generated",
    "CloudBase",
    "npm run test:puzzle-certification",
  ]) {
    expect(architecture).toContain(phrase);
  }
});

test("README links the durable documentation and names the validation tiers", () => {
  const readme = read("README.md");
  for (const phrase of [
    "[架构指南](docs/architecture.md)",
    "[游戏模块契约](docs/game-module-contract.md)",
    "[仓库清理清单](docs/repository-cleanup.md)",
    "npm test                # 默认快速确定性测试（排除认证套件）",
    "npm run test:puzzle-certification # 车阵突围完整题库认证（按触发条件运行）",
  ]) {
    expect(readme).toContain(phrase);
  }
  expect(readme).not.toContain("当前为预留链接");
});

test("game-module contract names every registration and validation surface", () => {
  const contract = read("docs/game-module-contract.md");
  for (const phrase of [
    "route registration",
    "gameCatalog",
    "share metadata",
    "pure logic",
    "tests",
    "points economy",
    "gauntlet",
    "result surface",
  ]) {
    expect(contract).toContain(phrase);
  }
});

test("documentation states the local guard and curated candidate scan boundary", () => {
  const architecture = read("docs/architecture.md");
  const contract = read("docs/game-module-contract.md");
  const verification = read("docs/verification.md");
  const generator = read("scripts/generate-traffic-escape-hard-puzzles.ts");

  for (const document of [architecture, contract]) {
    const normalized = document.replace(/\s+/g, " ");
    expect(normalized).toContain("single-client best-effort repeated-call guard");
    expect(normalized).toContain("exactly-once settlement");
    expect(normalized).toContain("not a distributed atomic guarantee");
    expect(normalized).toContain("CURATED_HARD_CANDIDATE_SEEDS");
    expect(normalized).toContain("not an exhaustive scan of every integer seed");
    expect(document).not.toContain("atomically");
  }
  expect(generator).toContain("CURATED_HARD_CANDIDATE_SEEDS");
  expect(architecture).not.toContain("2,000-seed");
  expect(verification).not.toContain("2,000-seed");
  expect(verification).toContain("CURATED_HARD_CANDIDATE_SEEDS");
  expect(verification).toContain("curated candidate scan");
  expect(verification).toContain("不是对该范围内每个整数 seed 的 exhaustive scan");
  expect(verification).not.toContain("当前正文尚未落地");
});
