## Context

This repository integrates Claude.ai connectors through MCP and relies on protocol details observed from official Claude Code behavior. Protocol drift can happen from either npm package updates or backend rollout changes. The team wants a manual first process that is lightweight, repeatable, and produces evidence that can be upgraded into automation later.

Constraints:
- Manual execution only for now (no scheduler/CI dependency in phase 1).
- Checks must not require modifying production code to run.
- Results must be consistent enough that different operators reach the same conclusion.

Stakeholders:
- Bridge maintainers who decide when to update assumptions.
- Operators who run compatibility checks before pin promotion.

## Goals / Non-Goals

**Goals:**
- Define a pinned known-good comparison model (`pinned -> candidate`).
- Define a static signature extraction checklist from official npm package artifacts.
- Define a runtime canary checklist that validates live discovery/proxy behavior.
- Define a severity rubric and decision rules for pin promotion.
- Standardize report output for each run.

**Non-Goals:**
- Full automation, scheduling, or alerting in this change.
- Replacing runtime checks with static checks only.
- Guaranteeing zero breakage across all server-side rollout conditions.

## Decisions

### Decision: Use dual-signal validation (static + runtime)
- **Chosen**: Static package signature diff plus runtime canary must both be considered.
- **Why**: Static diff alone misses server-side-only changes; runtime alone lacks early visibility into upcoming client contract shifts.
- **Alternatives considered**:
  - Static-only check: rejected due to blind spots for backend-only rollout.
  - Runtime-only check: rejected because it cannot explain what changed in client assumptions.

### Decision: Adopt pinned-known-good workflow
- **Chosen**: Compare current candidate version against last verified pin; promote pin only on pass.
- **Why**: Keeps change control explicit and auditable.
- **Alternatives considered**:
  - Compare only latest vs latest-1: rejected because it ignores operator-validated state.

### Decision: Standardize protocol signature fields
- **Chosen**: Include endpoint/path/header/session/auth markers (for example: discovery path, proxy path, beta header token, session header, session-expired signal).
- **Why**: These are high-impact contract surfaces for this bridge.
- **Alternatives considered**:
  - Ad-hoc grep each time: rejected due to inconsistent coverage.

### Decision: Classify outcomes with explicit actions
- **Chosen**:
  - `safe`: no material drift and runtime canary passes -> promote pin.
  - `watch`: static drift without runtime failure -> hold or promote with note.
  - `break-risk`: runtime failure or critical contract drift -> hold pin and investigate.
- **Why**: Reduces ambiguity in operational decisions.

## Risks / Trade-offs

- **[Risk] Backend requires new behavior before npm package reflects it** -> **Mitigation**: runtime canary is mandatory for each candidate.
- **[Risk] Static extraction misses dynamically generated headers** -> **Mitigation**: classify static results as advisory unless runtime confirms.
- **[Risk] Manual process drift between operators** -> **Mitigation**: enforce a single checklist and report template.
- **[Trade-off] Manual operation is slower than automation** -> **Mitigation**: capture structured outputs that map directly to future scripting.

## Migration Plan

1. Add capability spec defining required manual check behavior and evidence format.
2. Add tasks to run the process against a pinned and candidate version.
3. Run one full proof cycle and store report in a predictable location.
4. After at least one successful manual cycle, evaluate automation as follow-up change.

Rollback strategy:
- If the process is noisy or unclear, continue using current pin policy while refining the checklist in a follow-up proposal.

## Open Questions

- Should `watch` status allow pin promotion by default or require explicit maintainer approval?
- What minimum runtime canary surface is acceptable for manual checks (`discovery` only vs `discovery + tools/list + tool call`)?
- Where should manual reports live long-term (`ideas/`, `docs/`, or `openspec/changes/.../evidence/`)?
