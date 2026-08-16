/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "turbo", "prettier"],
  plugins: ["@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  ignorePatterns: [".next/", "dist/", "node_modules/", "supabase/"],
};
