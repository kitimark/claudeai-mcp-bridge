### Requirement: Separate Build and Editor TypeScript Projects
The repository MUST define separate TypeScript project configurations for build output concerns and editor/test diagnostics concerns, while sharing common strict compiler behavior.

#### Scenario: Build configuration remains source-focused
- **WHEN** contributors run the canonical build-oriented typecheck command
- **THEN** TypeScript SHALL analyze the intended source project configuration without requiring test files to be included in build emit settings

#### Scenario: Editor/test configuration includes tests
- **WHEN** an editor analyzes files under `tests/**/*.ts`
- **THEN** TypeScript SHALL use a configured project context rather than inferred default options

### Requirement: Bun Test Typings Resolve in Editor Diagnostics
The editor/test TypeScript project MUST include Bun test type definitions so `bun:test` imports resolve without missing-type errors.

#### Scenario: Bun test import resolves
- **WHEN** a test file imports from `bun:test`
- **THEN** the editor TypeScript service SHALL resolve the module and its type declarations

#### Scenario: Node and Bun globals coexist where needed
- **WHEN** test files use Node and Bun-exposed APIs required by the repository
- **THEN** diagnostics SHALL not fail due to missing ambient type declarations that are part of supported test/runtime usage

### Requirement: Editor Setup Guidance Is Documented
The repository MUST document manual editor setup and troubleshooting guidance for VS Code and Zed so contributors can align diagnostics with repository TypeScript project configuration.

#### Scenario: Contributor can configure editor manually
- **WHEN** a contributor opens a fresh clone in VS Code or Zed
- **THEN** documentation SHALL provide clear steps to avoid inferred single-file diagnostics and use repository project configuration intent

### Requirement: Canonical Typecheck Workflow Is Documented
Repository documentation MUST define the canonical TypeScript typecheck command and explain why single-file or inferred-project checks may differ.

#### Scenario: Contributor troubleshooting follows docs
- **WHEN** a contributor sees editor-only diagnostics
- **THEN** documentation SHALL provide a clear path to compare against the canonical project-mode typecheck and identify configuration-scope differences
