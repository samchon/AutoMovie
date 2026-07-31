# `@automovie/benchmark-runner`

This package is the filesystem and external-agent execution layer kept outside
the pure `@automovie/benchmark` law/judge package. Give
`runAutoMovieBenchmark` one registered task id, an archive root outside the
repository, and an agent adapter. The adapter works in a prepared `project/`
directory and returns a submission draft plus its transcript.

The runner seals the draft, invokes the deterministic judge, distinguishes
`infra-excluded`, `gate-failed`, and `scored`, builds the surface and actual MCP
tool-inventory reports, and publishes:

```text
<run-root>/.benchmarks/<campaign>/<sha256-hex>/
  brief.md
  task.json
  project/
  transcript/stdout.txt
  transcript/stderr.txt
  trace/oracle.jsonl.gz
  project-tree.json
  submission-draft.json
  submission.json
  verdict.json
  report.json
  tool-inventory.json
```

The temporary workspace and final archive both stay outside the source
repository. Existing content-addressed runs are never overwritten.

```ts
import {
  createProcessAutoMovieBenchmarkAgent,
  runAutoMovieBenchmark,
} from "@automovie/benchmark-runner";

const result = await runAutoMovieBenchmark({
  taskId: "short/austerlitz-teaser",
  campaign: "redesign-cycle-1",
  repositoryRoot: process.cwd(),
  runRoot: process.env.AUTOMOVIE_BENCHMARK_ROOT!,
  agent: createProcessAutoMovieBenchmarkAgent({
    command: "my-agent-wrapper",
    timeoutMs: 60 * 60 * 1000,
  }),
});
```

The wrapper receives task, brief, project, and submission paths through
`AUTOMOVIE_BENCHMARK_*` environment variables. It must exit successfully and
write the complete submission draft. Adapter failures leave the runner-owned
`.pending-*` directory and `runner-error.txt` for diagnosis but publish no
content-addressed run. The runner recomputes `treeDigest` from the archived
project's regular-file bytes and unfollowed link identities; it never accepts
the adapter's unverified tree claim. It likewise recomputes
`transcriptDigest` from the separately archived stdout and stderr values.
