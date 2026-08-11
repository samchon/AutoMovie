# Agent orchestration

## Authorability refusal {#authorability-refusal}

<!-- @evidence requirements/00-charter.md#authorability-threshold Refuses production claims that the coding agent cannot express and the deterministic pipeline cannot verify. -->

`@automovie/mcp` exposes compiler and review knowledge in the terms a coding agent can act on. Unsupported fidelity remains an explicit limitation instead of becoming a hidden service heuristic.

## Separated production authorities {#separated-production-authorities}

<!-- @evidence requirements/01-actors.md#separated-authorities Keeps repository authorship, compiler truth, host capture, and human judgment in distinct state transitions. -->

The production project loads coding-agent-owned files, the compiler derives canonical state, the host supplies capture bytes, and review binds a human verdict to current receipts. MCP coordinates those transitions without taking ownership of their files or judgments.

## Evidence-first review service {#evidence-first-review-service}

<!-- @evidence requirements/04-evidence-and-review.md#evidence-before-verdict Requires current host evidence and target fingerprints before a review verdict can become complete. -->

Prepare and submit operations address stable targets, retain fingerprints, and reject missing, stale, incomplete, or revise states through one review queue. Structural compile success never substitutes for a visual receipt.

## Five-tool surface {#five-tool-surface}

<!-- @evidence requirements/06-agent-boundary.md#five-tool-knowledge-boundary Keeps MCP as a small knowledge and evidence boundary instead of a second authoring system. -->

The server exposes guide delivery, host frame capture, optional repaint, review preparation, and review submission. Compilation and project mutation remain package and repository operations available to the coding agent outside the tool surface.

## Diagnostic guidance {#diagnostic-guidance}

<!-- @evidence requirements/11-diagnostics-and-knowledge.md#named-behavioral-refusals Delivers the behavioral invariant and concrete correction attached to a stable diagnostic code. -->

Compiler, repaint, capture, and review diagnostics retain their stable identity through DTOs and tool responses. Guide documents explain the invariant in user language without changing severity or fabricating a correction.
