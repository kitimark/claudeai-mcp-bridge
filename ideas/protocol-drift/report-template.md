# Protocol Drift Check Report

## Run Metadata

- `run_timestamp`: <ISO-8601>
- `operator`: <name>
- `pinned_version`: <version>
- `candidate_version`: <version>
- `ua_version_override`: <value used for CLAUDE_CODE_UA_VERSION>

## Static Check Results

- Dist-tags snapshot: <summary>
- Publish-time snapshot: <summary>
- Marker comparison summary:
  - <marker>: <same/changed/missing>
  - <marker>: <same/changed/missing>
- Package dist metadata diff:
  - `shasum`: <old> -> <new>
  - `integrity`: <old> -> <new>
  - `fileCount`: <old> -> <new>
  - `unpackedSize`: <old> -> <new>

## Runtime Canary Results

- Discovery check: <pass/fail>
- Proxy connectivity check: <pass/fail>
- Tools list check: <pass/fail>
- Identity header parity:
  - `User-Agent` shape: <pass/fail + observed value>
  - `X-Mcp-Client-Session-Id` lifecycle: <stable-in-process / mismatch>
- Key output/errors:
  - <line 1>
  - <line 2>

## Classification and Decision

- `classification`: <safe|watch|break-risk>
- `decision`: <promote|hold>

## Notes

- <reasoning>
- <follow-up action>
