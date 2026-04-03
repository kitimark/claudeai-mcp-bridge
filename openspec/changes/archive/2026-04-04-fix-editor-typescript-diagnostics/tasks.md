## 1. TypeScript Project Split

- [x] 1.1 Create shared/base TypeScript config for strict common options used by all project variants.
- [x] 1.2 Create a build-focused TypeScript config that preserves existing emit/declaration behavior for `src`.
- [x] 1.3 Create an editor/test TypeScript config that uses `noEmit` and includes `src` plus `tests`.
- [x] 1.4 Update TypeScript scripts/entry points to call the intended config(s) explicitly.

## 2. Bun Typing and Editor Workspace Setup

- [x] 2.1 Add Bun type definition dependency required by editor TypeScript analysis.
- [x] 2.2 Configure editor/test TypeScript project to include Bun typings for `bun:test` imports.
- [x] 2.3 Remove checked-in VS Code and Zed workspace settings to keep repository configuration editor-agnostic.
- [x] 2.4 Keep only canonical build-oriented typecheck script in `package.json` (remove editor-only helper script).

## 3. Documentation and Verification

- [x] 3.1 Update repository documentation with canonical project-mode typecheck command and manual editor setup/troubleshooting notes.
- [x] 3.2 Run canonical typecheck command, build, and tests to confirm the new config structure passes.
- [x] 3.3 Perform editor smoke checks in VS Code and Zed to confirm `bun:test` and JSON-import diagnostics are resolved after manual setup guidance.
