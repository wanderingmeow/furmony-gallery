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
      // A translation written into state stays in the language it was written in, and the reader who
      // changes language mid-request is left reading the old one. Keep the key; call `tr` where the
      // line is read. A signal opened with a sentence is the same trap at load time.
      "no-restricted-syntax": [
        "error",
        {
          // `setLine(tr("push.opening"))`: the sentence goes in, and the language comes with it.
          selector:
            'CallExpression[callee.name=/^set[A-Z][A-Za-z0-9]*$/] > CallExpression[callee.name="tr"]',
          message:
            "Store the key, not tr(...): a sentence kept in state does not follow the language. Read: tr(key()).",
        },
        {
          // The same through one more call: `setLine(tell(tr("push.opening")))`. A function handed to
          // the setter is left alone, because reading it later is the shape that stays correct.
          selector:
            'CallExpression[callee.name=/^set[A-Z][A-Za-z0-9]*$/] :not(ArrowFunctionExpression, FunctionExpression, FunctionDeclaration) > CallExpression[callee.name="tr"]',
          message:
            "Store the key, not tr(...): a sentence kept in state does not follow the language. Read: tr(key()).",
        },
        {
          selector:
            'CallExpression[callee.name="createSignal"] > CallExpression[callee.name="tr"]',
          message:
            "A signal opened with tr(...) is translated once, at load. Open it with the key and translate where it is read.",
        },
        {
          selector:
            'CallExpression[callee.name="createStore"] CallExpression[callee.name="tr"]',
          message:
            "A store opened with tr(...) holds a sentence from the language at load. Keep the key.",
        },
        {
          // The phase that does an effect's work tracks nothing, so a bare callback leaves what
          // wakes the effect unwritten: the reason has to be readable where the effect stands.
          selector:
            'CallExpression[callee.name="createEffect"] > :is(ArrowFunctionExpression, FunctionExpression)',
          message:
            "createEffect has to name its source: createEffect(on(deps, fn)). Pass what the body needs out of the source instead of reading it there.",
        },
      ],
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
