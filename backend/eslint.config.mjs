import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import security from "eslint-plugin-security";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "node_modules/**", "uploads/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Static security analysis of our own code (like Bandit for Python): unsafe regex, eval, child_process, ...
  security.configs.recommended,
  {
    // Security findings fail the build. detect-object-injection is switched off: it flags every
    // obj[key] access, which is overwhelmingly false positives in this code base.
    files: ["src/**/*.ts"],
    rules: {
      ...Object.fromEntries(
        Object.keys(security.configs.recommended.rules).map((rule) => [rule, "error"])
      ),
      "security/detect-object-injection": "off",
    },
  },
  {
    // jest.mock factories load helper modules with require()
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "security/detect-object-injection": "off",
    },
  },
  {
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      // The existing code base uses `any` in a few places; unused values are reported but do not fail CI
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  }
);
