/**
 * Project Rules Validator for cici-brain-training
 * Validates code against defined project rules.
 */

const fs = require("fs");

/**
 * Validates code against a specific rule.
 * @param {string} code - The source code to validate.
 * @param {string} ruleName - The name of the rule to check.
 * @returns {boolean} - Returns true if valid, false otherwise.
 */
function validateRules(code, ruleName) {
  switch (ruleName) {
    case "no-explicit-any":
      // Matches ': any', '<any>', 'as any', but excludes comments
      const anyRegex =
        /(?<!\/\/.*)(?<!\/\*[\s\S]*)\b(:\s*any|\bany\b(?=\s*>)|as\s+any)\b/g;
      return !anyRegex.test(code);

    case "async-try-catch":
      // Matches 'await' that is not wrapped in 'try'
      // This is a simplified check: it looks for 'await' and ensures 'try' exists in the same function scope
      // In a real validator, we'd use an AST parser.
      const awaitMatches = code.match(/await\s+/g) || [];
      const tryMatches = code.match(/try\s*\{/g) || [];
      return awaitMatches.length === 0 || tryMatches.length > 0;

    case "use-load-instead-of-effect":
      // Matches useEffect with empty dependency array in a file that might be a page
      const hasUseEffect =
        /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\[\s*\]\s*\)/.test(
          code,
        );
      const hasUseLoad = /useLoad\s*\(/.test(code);
      return !(hasUseEffect && !hasUseLoad);

    case "no-magic-numbers":
      // Ignore CSS units and allow trivial numeric literals often used in loops or indexes.
      const sanitizedCode = code.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "");
      const numericMatches = sanitizedCode.match(/(?<![\w.])-?\b\d+(?:\.\d+)?\b(?!\s*(px|rpx|rem|em|%|vh|vw))/g) || [];
      return numericMatches.every((value) => ["0", "1", "-1"].includes(value));

    default:
      return true;
  }
}

module.exports = { validateRules };

// CLI Support
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      "Usage: node project_rules_validator.js <file_path> <rule_name>",
    );
    process.exit(1);
  }

  const filePath = args[0];
  const ruleName = args[1];

  try {
    const code = fs.readFileSync(filePath, "utf8");
    const isValid = validateRules(code, ruleName);
    if (!isValid) {
      console.error(`Rule violation: [${ruleName}] in ${filePath}`);
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }
}
