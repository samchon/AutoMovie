# Repository tooling

These commands operate this checkout. Generated production commands ship separately in `packages/template/scaffold`.

## Benchmark turn observer

`pnpm benchmark:turn <plan.json> <private-receipt-directory>` launches one configured native authoring command and observes it on a timer. The executable and argument array bypass a shell. On Windows, use an executable or a Node CLI entry instead of a `.cmd` launcher. The prompt file is forwarded to stdin as its original UTF-8 bytes.

The JSON plan has these fields:

| Field | Meaning |
| --- | --- |
| `runId`, `generation` | Existing run identity and positive integer generation. |
| `cwd` | Authoring directory, relative to the plan file. |
| `basisFile` | Frozen run record, relative to the plan file; its digest is rechecked before verification commands. |
| `promptFile` | UTF-8 input file, relative to the plan file. |
| `requestedModel` | Declared model intent. Actual model provenance remains unknown until independently observed. |
| `command` | `{ executable, args: string[] }` for the authoring turn. |
| `artifacts` | Paths relative to `cwd` whose size and modification signals are observed. |
| `checks` | `{ id, command }[]` of explicitly selected verification commands; ids are unique. |
| `pollMs` | Integer observation cadence in milliseconds, from 1 through 2147483647; 300000 means five minutes. |
| `stallMs` | Integer inactivity interval at least as long as `pollMs`. |

Each invocation creates a UUID directory containing private stdout/stderr logs and ordered `observations.jsonl` receipts. Records carry plan, basis and prompt digests, the owned process handle's PID and spawn observation, output growth, artifact signals and observation deadlines. Inactivity uses a monotonic clock. Native Codex JSON `thread.started` events supply an observed session id; unknown and plain output remain in the raw logs.

Successful author termination and an unchanged basis permit the declared checks to run. The reported fraction counts their successful exits only. No checks means no fraction. File existence, activity, a session message and process exit are not final benchmark judgment. Continuation and lifecycle decisions belong to the [experiment procedure](../.agents/skills/experiment/steering.md).

The observer performs no automatic retry or resume and starts no subagents of its own. Interrupting it or losing a log/receipt writer stops only its directly owned child handle and prevents successful completion. After an interruption, remaining verification commands stay `not-run`. It does not find or terminate unrelated processes; independently detached descendants remain subject to the run's ownership and cleanup procedure. Keep the output directory within the run's declared privacy and retention boundary.
