## Context

The repository currently has a single `tsconfig.json` focused on build output for `src/**/*`. This is sufficient for CLI typecheck (`bunx tsc --noEmit`) but incomplete for editors because test files can be analyzed in inferred projects without Bun test typings and without the same module options used by the project. The result is inconsistent diagnostics between terminal and editor.

Constraints:
- Preserve current runtime/build behavior for `src` output.
- Improve diagnostics in both VS Code and Zed.
- Keep repository configuration minimal and avoid editor-specific project files where possible.

## Goals / Non-Goals

**Goals:**
- Separate build-focused TypeScript settings from editor/test diagnostics settings.
- Ensure `tests/**/*.ts` receives configured project analysis (not inferred project defaults).
- Ensure Bun test imports and project JSON imports resolve in editor diagnostics.
- Keep a clear canonical typecheck command for contributors.
- Provide manual editor setup guidance without enforcing checked-in editor workspace settings.

**Non-Goals:**
- Refactor runtime code paths unrelated to type configuration.
- Introduce new test frameworks or migrate away from Bun.
- Change MCP runtime behavior.

## Decisions

1. **Adopt split TypeScript configs (shared base + build + editor/test)**
   - Decision: Use a shared base config for strict common options, a build config for emit/declaration concerns, and an editor/test config for `noEmit` analysis over `src` + `tests`.
   - Rationale: Build and editor concerns conflict (`rootDir`, `include`, and test-specific typings). Split configs avoid hidden compromises.
   - Alternatives considered:
     - Keep one config and broaden `include` to tests: rejected because build-oriented options (`rootDir`, output/declaration concerns) can cause friction for test files.
     - Suppress editor diagnostics for tests: rejected because it hides real issues.

2. **Add explicit Bun typing support for editor/test project**
   - Decision: Install Bun type definitions and reference them from the editor/test TypeScript project.
   - Rationale: `bun:test` imports must resolve through tsserver in editors, not only at runtime.
   - Alternatives considered:
     - Keep types implicit via Bun runtime only: rejected because editor diagnostics remain inconsistent.

3. **Do not commit editor-specific workspace settings**
   - Decision: Do not require `.vscode/` or `.zed/` settings in repository source.
   - Rationale: Keeps repository lean and avoids editor-specific policy in versioned project files.
   - Alternatives considered:
     - Commit workspace settings: rejected for this change after scope refinement toward minimal repository config.

4. **Use one canonical typecheck script for repository workflows**
   - Decision: Keep `typecheck` as canonical build-oriented check and document manual editor guidance in README.
   - Rationale: Clarifies authoritative checks while avoiding additional editor-specific scripts.

## Risks / Trade-offs

- **[Manual setup drift]** Editors may still vary per developer settings → **Mitigation:** provide explicit troubleshooting and manual setup guidance in documentation.
- **[Config sprawl]** More config files can confuse contributors → **Mitigation:** use clear naming (`base`, `build`, `editor`) and concise docs.
- **[Type package drift]** Bun type package version mismatch can reintroduce errors → **Mitigation:** pin/track via lockfile and validate in CI/local checks.

## Migration Plan

1. Introduce split TypeScript config files and wire scripts to intended project file(s).
2. Add Bun type dependency and include it in editor/test config.
3. Remove checked-in editor workspace settings from repository.
4. Update docs with canonical typecheck and manual editor troubleshooting notes.
5. Validate with project typecheck, build, test, and editor diagnostics smoke checks.

Rollback strategy:
- Revert TypeScript config and documentation changes as a single unit if diagnostics regress.

## Open Questions

- Should CI enforce a separate editor-focused TypeScript check in addition to build-focused check?
- If diagnostics issues recur, should checked-in workspace settings be reconsidered in a future change?
