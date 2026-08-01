# `@automovie/benchmark-runner`

This package executes registered `@automovie/benchmark` scenarios while the
pure benchmark package remains free of processes and filesystems. The trust
boundary is deliberate:

- the external agent receives only a writable project, a candidate copy of the
  task, and the exact brief on stdin;
- a host-owned MCP probe performs the real `initialize` and `tools/list`;
- a trusted collector reads compiler, capture, review, and render receipts
  after the agent exits;
- the runner copies resident frame and deliverable bytes into isolated archive
  staging, parses them, computes their digests, and seals their archive paths;
- infrastructure incidents are classified by the runner. Candidate output
  cannot remove itself from the score denominator.

The runner writes direct observations to an append-only gzip trace from run
start, then atomically publishes:

```text
<run-root>/.benchmarks/<campaign>/
  .archive-<submission-sha256>.commit.json
  <submission-sha256>/
    .archive-commit.json
    brief.md
    task.json
    project/
    evidence/frames/
    evidence/deliverables/
    transcript/stdout.txt
    transcript/stderr.txt
    trace/oracle.jsonl.gz
    project-tree.json
    tool-sessions.json
    tool-inventory.json
    submission.json
    verdict.json
    report.json
```

The candidate workspace is a separate temporary directory. Task/brief
originals, trace, transcripts, inventory, and copied evidence are never exposed
as candidate-writable paths. Before publication the runner reopens and hashes
the staged project, transcripts, tool sessions, and every evidence file.
Publication is committed only when the internal and campaign-sibling commit
records are the same physical hard-linked file and bind the verified archive
shape and bytes. A 64-hex directory without that sibling record is retained as
uncommitted crash evidence and is never accepted as an immutable archive.

## Run Codex against the five-tool server

Build the packages once, then use the installed Codex CLI and the packaged MCP
binary. The collector is project-specific because scenario observations must
come from actual generated state and receipts, not a generic filename
convention.

```ts
import {
  createCodexAutoMovieBenchmarkAgent,
  createProcessAutoMovieBenchmarkMcpTarget,
  runAutoMovieBenchmark,
} from "@automovie/benchmark-runner";
import path from "node:path";

const mcpBin = path.join(
  path.dirname(require.resolve("@automovie/mcp/package.json")),
  "lib/bin.js",
);
const mcpProcess = {
  command: process.execPath,
  args: [mcpBin],
};

const result = await runAutoMovieBenchmark({
  taskId: "short/austerlitz-teaser",
  lane: "deterministic",
  campaign: "redesign-cycle-1",
  repositoryRoot: process.cwd(),
  runRoot: process.env.AUTOMOVIE_BENCHMARK_ROOT!,
  identity: {
    repository: packagedRepositoryReceipt,
    client: fixedCodexIdentity,
    runtime: captureRuntimeIdentity,
  },
  mcpTarget: createProcessAutoMovieBenchmarkMcpTarget({
    surface: "five-tool",
    provenance: "@automovie/mcp@0.1.0",
    ...mcpProcess,
    timeoutMs: 30_000,
  }),
  agent: createCodexAutoMovieBenchmarkAgent({
    command: process.platform === "win32" ? "codex.cmd" : "codex",
    mcp: mcpProcess,
    timeoutMs: 60 * 60 * 1_000,
  }),
  collect: collectCurrentAutoMovieReceipts,
});
```

`createClaudeCodeAutoMovieBenchmarkAgent` provides the same one-shot path for
Claude Code. Both concrete adapters pass the registered brief on stdin and
configure the selected MCP server themselves; no custom wrapper or
candidate-authored submission JSON is required.

Every demo milestone supports the zero-config `deterministic` lane. The
one-minute, five-minute, and twenty-minute milestones also register the
optional `repaint` lane. Supply a structured
`repaintRuntime: { protocolVersion, provider, model, version, execution }`; a
nominal capability string is insufficient. The trusted collector must return verified
shot receipt/output/source-review/rendition-review digests and the exact final
feature digest. Without a host runtime the runner records
`repaint-adapter-unavailable` and publishes `infra-excluded`; with a runtime but
without the evidence chain, the judge refuses the completed lane.
