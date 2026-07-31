# Production Review

The external coding agent reviews; AutoMovie verifies evidence and freshness. The server never calls an LLM and never stores hidden chain-of-thought.

1. Call `prepareReview` for exactly one asset, shot, sequence, film, legacy design, or legacy source target.
2. Inspect the returned required criteria, current selectors, frames, and compiler-derived outcomes.
3. For visual targets, actually open the returned PNG frames. Required evidence must be captured at the exact production width, height, FPS, and review time; smaller thumbnails help iteration but cannot discharge review. Asset preparation names the mandatory isolated views: rest-pose beauty at 0/90/180/270 degrees, a 65-degree top outline, and a rigged model's ROM-extremes beauty view. Use the exact asset target printed by each missing-evidence diagnostic. Formation and fog/smoke/dust claims need current beauty plus the structural pass named by the criterion, not an oracle summary alone. Capture missing passes with `captureFrame`.
4. Write criterion-specific observations and quote current design pointer, source line, frame digest/region, diagnostic, or exact outcome.
5. List actionable corrections before setting `complete`.
6. Submit. Fix rejected selectors or contradictions and repeat.

Every required criterion appears exactly once in canonical order. Evidence-free pass, copied observation/evidence, blank quote, stale digest, out-of-bounds region, failed or missing event/metric outcome, revise-with-complete, and corrections-with-complete are refused. `not-applicable` still needs concrete current evidence and a reason.

The four human surfaces use failure-specific axes. Asset review covers silhouette/proportion, rig convention and ROM, outline/material legibility, and required turntable coverage. Shot review covers beat fidelity, staging, performance, justified style intent, representability, and acceptance. Sequence review covers cross-shot continuity, intended rhythm, spatial-model maintenance, coverage, and acceptance. Film review covers narrative completion, tone consistency, delivery readiness, and acceptance. Geometry rules that the engine can prove do not become subjective checklist axes.

Only compiled shots that consume a model activate its asset-review obligation. A missing, stale, revise, or incomplete consumed-asset review blocks review lint at `asset-review-*`; unused scratch models remain free. Review paths and fingerprints include the active production, so two productions may independently review the same shared model revision.

Design and source checks must cite a distinct current selector for each criterion; repeating one convenient line or JSON value across the checklist is refused. The source checklist covers binding, determinism, engine enforcement, and boundary behavior. Repository test execution remains the coding agent and CI's job. Corrections describe the next edit; correction feedback never authorizes deleting the artifact.

Mutation never deletes old reviews. Their fingerprints stop matching and `inspectAutoMovieProduction` reports `stale`, preserving the audit trail while making review/final compile fail until the target is re-examined.
