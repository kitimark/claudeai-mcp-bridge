### Requirement: Pinned Known-Good Comparison
The project SHALL use a pinned known-good Claude Code npm version as the baseline for each manual protocol drift check, and SHALL compare that pin against a candidate newer version.

#### Scenario: Candidate selected against pin
- **WHEN** an operator starts a manual check
- **THEN** the operator records both `pinned_version` and `candidate_version` before analysis begins

#### Scenario: Pin promotion after successful check
- **WHEN** static and runtime checks both pass with no break-risk classification
- **THEN** the candidate version is eligible to become the new pinned known-good version

### Requirement: Static Protocol Signature Evidence
The project SHALL extract and compare a protocol signature from official `@anthropic-ai/claude-code` npm artifacts for the pinned and candidate versions.

#### Scenario: Signature includes contract-critical markers
- **WHEN** static analysis is run
- **THEN** the output includes endpoint/path/header/session markers needed to judge MCP compatibility impact

#### Scenario: Static evidence is persisted
- **WHEN** static analysis completes
- **THEN** results include version metadata and enough evidence to trace what changed between versions

### Requirement: Runtime Canary Validation
The project SHALL run a runtime canary against live Anthropic discovery/proxy behavior for the candidate version context before final decision.

#### Scenario: Runtime canary confirms behavior
- **WHEN** runtime checks execute
- **THEN** the process verifies discovery and MCP proxy interaction outcomes and captures errors when present

### Requirement: Drift Classification and Decision
The project SHALL classify each manual check result as `safe`, `watch`, or `break-risk`, and SHALL emit a pin decision (`promote` or `hold`).

#### Scenario: Break-risk is detected
- **WHEN** runtime canary fails or critical contract drift is identified
- **THEN** the decision is `hold` and the report includes blocking evidence

#### Scenario: Watch status is detected
- **WHEN** static drift is present but runtime canary passes
- **THEN** the report marks `watch` and records whether pin promotion is approved or deferred

### Requirement: Standard Manual Report Format
The project SHALL produce a standardized report for each manual check run.

#### Scenario: Required report fields are captured
- **WHEN** a manual check is completed
- **THEN** the report includes run timestamp, pinned version, candidate version, static result, runtime result, final classification, decision, and notes
