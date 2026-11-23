import js from "@eslint/js";
import tseslint from "typescript-eslint";
import solid from "eslint-plugin-solid";
import globals from "globals";
import prettier from "eslint-config-prettier/flat";

// The type checker is TypeScript 7 (the `typescript-7` alias); the `typescript` package that
// typescript-eslint wants as a parser is 6.x, which is why both are installed. `npm run typecheck`
// names the alias, so nothing here decides which compiler gates a build.
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "dist-mock/**",
      "dist-ssr/**",
      "coverage/**",
      "node_modules/**",
      ".vite/**",
      // not pushed to the repo: local scripts and their virtualenv
      "agent/**",
      "embedding/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      solid.configs["flat/typescript"],
    ],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // The base rule cannot tell a type import from a value import, and reports the first as unused.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // An absent field arrives from the API as null, but the model types call those fields optional.
      // `== null` is the one test that covers both, so it stays; every other `==` is an error.
      eqeqeq: ["error", "always", { null: "ignore" }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    // This file and the two Vite configs run on the command line, not in a page.
    files: ["*.config.ts", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
  // Last, so it switches off the rules that disagree with Prettier about layout. Formatting itself
  // is Prettier's job: no prettier/prettier rule here, and `npm run format` does the writing.
  prettier,
);
