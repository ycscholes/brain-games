import { readFileSync } from "node:fs";

const readme = readFileSync("README.md", "utf8");

test("documents fast verification and explicit puzzle certification", () => {
  expect(readme).toContain("docs/architecture.md");
  expect(readme).toContain("docs/verification.md");
  expect(readme).toContain("npm run test:puzzle-certification");
  expect(readme).toContain("npm run verify");
});
