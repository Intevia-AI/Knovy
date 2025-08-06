import { config as baseConfig } from "./packages/eslint-config/base.js";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config} */
export default tseslint.config(
  ...baseConfig,
  {
    ignores: ["apps/**", "packages/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    parserOptions: {
      project: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
);