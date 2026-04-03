## 1. Define manual check inputs and protocol signature

- [ ] 1.1 Document the pinned known-good model (`pinned_version`, `candidate_version`) and pin promotion rule.
- [ ] 1.2 Define the required static signature markers (discovery path, proxy path, required headers, session/error semantics).
- [ ] 1.3 Create a repeatable command checklist for unpacking official npm artifacts and extracting signature evidence.

## 2. Define runtime canary procedure

- [ ] 2.1 Document the runtime canary steps for discovery and MCP proxy connectivity checks.
- [ ] 2.2 Define minimum evidence capture for runtime outcomes (pass/fail, status/error text, timestamp).
- [ ] 2.3 Define stop conditions for `break-risk` classification when runtime checks fail.

## 3. Define classification and decision rubric

- [ ] 3.1 Document classification criteria for `safe`, `watch`, and `break-risk`.
- [ ] 3.2 Document decision mapping from classification to pin action (`promote` or `hold`).
- [ ] 3.3 Add guidance for handling ambiguous cases (static drift present but runtime pass).

## 4. Standardize manual report output

- [ ] 4.1 Create a report template with required fields (run time, versions, static result, runtime result, classification, decision, notes).
- [ ] 4.2 Define where manual reports are stored during this phase and naming convention for runs.
- [ ] 4.3 Run one full manual proof cycle using the template and record the first baseline report.
