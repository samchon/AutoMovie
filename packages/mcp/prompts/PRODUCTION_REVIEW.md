# Production Review

The external coding agent reviews; AutoMovie verifies evidence and freshness. The server never calls an LLM and never stores hidden chain-of-thought.

1. Call `prepareReview` for exactly one design, source, shot, or film target.
2. Inspect the returned required criteria, current selectors, frames, and compiler-derived outcomes.
3. For visual targets, actually open the returned PNG frames. Required evidence must be captured at the exact production width, height, FPS, and review time; smaller thumbnails help iteration but cannot discharge review. Capture missing passes with `previewFrame`.
4. Write criterion-specific observations and quote current design pointer, source line, frame digest/region, diagnostic, or exact outcome.
5. List actionable corrections before setting `complete`.
6. Submit. Fix rejected selectors or contradictions and repeat.

Every required criterion appears exactly once in canonical order. Evidence-free pass, copied observation/evidence, blank quote, stale digest, out-of-bounds region, failed or missing event/metric outcome, revise-with-complete, and corrections-with-complete are refused. `not-applicable` still needs concrete current evidence and a reason.

Design and source checks must cite a distinct current selector for each criterion; repeating one convenient line or JSON value across the checklist is refused. The source checklist covers binding, determinism, engine enforcement, and boundary behavior. Repository test execution remains the coding agent and CI's job. Film review covers current narrative, continuity, visual scale, rhythm, and required acceptance evidence; audio parsing and deliverable completeness belong to the later `final` compile gate until synchronized playback evidence exists.

Mutation never deletes old reviews. Their fingerprints stop matching and `inspectProject` reports `stale`, preserving the audit trail while making review/final compile fail until the target is re-examined.
