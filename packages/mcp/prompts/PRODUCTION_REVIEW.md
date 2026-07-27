# Production Review

The external coding agent reviews; AutoMovie verifies evidence and freshness. The server never calls an LLM and never stores hidden chain-of-thought.

1. Call `prepareReview` for exactly one design, source, shot, or film target.
2. Inspect the returned required criteria and current selectors.
3. For visual targets, actually open the returned PNG frames. Capture missing passes with `previewFrame`.
4. Write criterion-specific observations and quote current design pointer, source line, frame digest/region, or diagnostic.
5. List actionable corrections before setting `complete`.
6. Submit. Fix rejected selectors or contradictions and repeat.

Every required criterion appears exactly once in canonical order. Evidence-free pass, copied observation/evidence, blank quote, stale digest, out-of-bounds region, revise-with-complete, and corrections-with-complete are refused. `not-applicable` still needs concrete current evidence and a reason.

Mutation never deletes old reviews. Their fingerprints stop matching and `inspectProject` reports `stale`, preserving the audit trail while making review/final compile fail until the target is re-examined.
