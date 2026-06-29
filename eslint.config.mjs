import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "generated/**",
      "node_modules/**",
    ],
  },

  js.configs.recommended,

  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: ["**/*.ts"],

    languageOptions: {
      parser,
      parserOptions: {
        project: "./tsconfig.test.json",
        tsconfigRootDir: import.meta.dirname,
        sourceType: "module",
        ecmaVersion: "latest",
      },
      globals: {
        ...globals.node,
      },
    },

    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
    },

    settings: {
      "import/resolver": {
        typescript: true,
      },
    },

    rules: {
      // Disable JS versions in favor of TS versions
      "no-unused-vars": "off",
      // TypeScript's own type-checking handles this better; the JS rule produces
      // false positives for namespace augmentations (e.g. Express.Multer.File).
      // See: https://typescript-eslint.io/troubleshooting/faqs/eslint#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      "no-undef": "off",

      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",

      // Imports
      "import/no-unresolved": "error",
      "import/no-duplicates": "error",
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],

      // General
      "no-console": "off",
    },
  },

  {
    files: ["tests/**/*.ts", "**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  eslintConfigPrettier,
];