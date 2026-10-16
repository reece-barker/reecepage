// Lint rules. The recommended set plus a few that catch the mistakes I actually make
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "public/", "var/", "coverage/", "test-results/", "playwright-report/", ".transfer/", "assets/vendor/"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node } },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-console": "off",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error"
    }
  },
  {
    // Browser code. main.js is an old style script on purpose (runs everywhere), tree.js is a module
    files: ["assets/js/**/*.js"],
    languageOptions: { globals: { ...globals.browser } },
    rules: { "no-var": "off", "prefer-const": "off", "object-shorthand": "off" }
  },
  {
    files: ["assets/js/main.js"],
    languageOptions: { sourceType: "script" }
  },
  {
    // page.evaluate callbacks in the playwright scripts and tests run in the browser
    files: ["scripts/**/*.js", "tests/e2e/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  }
];
