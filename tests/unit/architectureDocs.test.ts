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
