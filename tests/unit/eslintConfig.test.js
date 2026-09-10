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
