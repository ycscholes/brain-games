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
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        console: "readonly",
        process: "readonly",
        require: "readonly",
        module: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      react: reactPlugin,
      "react-hooks": hooksPlugin,
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": { typescript: true },
    },
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
    languageOptions: {
      globals: {
        jest: "readonly",
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    rules: {
      // Jest setup intentionally uses CommonJS and hoisted mocks before imports.
      "import/no-commonjs": "off",
      "import/first": "off",
    },
  },
  {
    files: [".trae/rules/**/*.js"],
    rules: {
      // The project rule validator is a standalone CommonJS CLI.
      "import/no-commonjs": "off",
      "import/first": "off",
    },
  },
  {
    files: ["scripts/**/*.{js,ts,mjs}"],
    languageOptions: {
      sourceType: "module",
      globals: { __dirname: "readonly", __filename: "readonly", Buffer: "readonly" },
    },
  },
  {
    files: ["cloudfunctions/**/*.js", "*.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { __dirname: "readonly", __filename: "readonly", Buffer: "readonly" },
    },
  },
];
