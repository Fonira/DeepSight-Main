// Conventional Commits enforcement for DeepSight.
// Used by both husky and pre-commit (via conventional-pre-commit).
// Allowed types align with our recent commit history (feat/fix/chore/docs/...).
//
// Usage with husky:
//   npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'

module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "chore",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "revert",
        "ops",
      ],
    ],
    // We use long subject lines historically (PR-style commit messages).
    "subject-case": [0],
    "header-max-length": [1, "always", 100],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
