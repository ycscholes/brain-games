import { execFileSync } from "node:child_process";

test("format check covers route and config source", () => {
  const output = execFileSync("npm", ["run", "format:check"], { encoding: "utf8" });
  expect(output).toContain("Checking formatting");
});
