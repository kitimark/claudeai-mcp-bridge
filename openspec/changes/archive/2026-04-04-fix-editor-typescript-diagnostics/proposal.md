## Why

TypeScript checks are clean in project mode, but VS Code and Zed can still report errors because test files are opened in inferred projects without Bun test types or the same compiler options as the build config. This creates noisy diagnostics that hide real issues and slows iteration.

## What Changes

- Introduce a split TypeScript configuration model so build output settings and editor/test diagnostics are configured independently.
- Add Bun test type support for editor type analysis of `tests/**/*.ts`.
- Keep repository configuration minimal by avoiding checked-in editor-specific workspace settings.
- Document the canonical typecheck command and manual editor setup guidance for VS Code and Zed.

## Capabilities

### New Capabilities
- `typescript-editor-projects`: Define required TypeScript project configuration behavior for build vs editor/test contexts, including Bun test typing support and predictable diagnostics.

### Modified Capabilities
- None.

## Impact

- Affected code/config: `tsconfig*.json` and `package.json` dev dependencies/scripts.
- Affected developer workflow: type diagnostics in VS Code and Zed; CI/local typecheck command documentation.
- No runtime API or connector behavior changes.
