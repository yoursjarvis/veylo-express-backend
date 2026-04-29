import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

export default [
  {
    ignores: ["dist/**", "coverage/**", "generated/**"],
  },
  {
    files: ["**/*.ts"],

    languageOptions: {
      parser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest"
      }
    },

    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin
    },

    settings: {
      "import/resolver": {
        typescript: {}
      }
    },

    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "import/no-unresolved": "error"
    }
  }
];
