"use strict";
const js = require("@eslint/js");
const globals = require("globals");
const sonarjs = require("eslint-plugin-sonarjs");

// Complexity limits. Existing violations live in eslint-suppressions.json, which
// can only shrink: a new violation fails, and so does a fixed one until pruned
// (npm run lint:prune).
const limits = {
  complexity: ["error", 10],
  "sonarjs/cognitive-complexity": ["error", 15],
  "max-depth": ["error", 4],
  "max-lines-per-function": ["error", 80],
  "max-params": ["error", 4],
  "max-nested-callbacks": ["error", 3],
};

module.exports = [
  { ignores: ["docs/", "node_modules/", "sources/"] },
  js.configs.recommended,
  {
    files: ["build.js", "validate.js", "watch.js", "scripts/**/*.js", "eslint.config.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
    plugins: { sonarjs },
    rules: limits,
  },
  {
    files: ["assets/site.js"],
    languageOptions: { sourceType: "script", globals: globals.browser },
    plugins: { sonarjs },
    rules: limits,
  },
];
