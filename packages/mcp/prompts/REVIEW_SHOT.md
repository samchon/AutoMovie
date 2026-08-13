# Shot Review Contract

Read this guide before `prepareReview` or `submitReview` with target kind `shot` or `rendition`. Shot review is the deterministic frame-and-motion surface; rendition review is the separate receipt-bound appearance surface.

## Prepare

A compiler outcome refusal has three distinct owners. `review-outcome-artifact-missing` means the current manifest-owned publication is absent; compile the same current input. `review-outcome-artifact-malformed` means its bytes, digest, UTF-8, or JSON are damaged; remove only the damaged compiler publication and compile again. `review-outcome-contract-mismatch` means valid JSON disagrees with the exact reader contract or current identity, which is an internal writer-reader defect: report the diagnostic artifact path and validator paths, and do not edit author source or retry an unchanged compile as a supposed fix. Each state blocks completion while independently readable outcomes remain in the worksheet.

Call `prepareReview` with `kind:"shot"` first. Its fingerprint binds deterministic contract, source, dependencies, compiler identity, render manifests, and acceptance outcomes; repaint output does not stale this source judgment. Complete that review before calling `repaintShot`.

The canonical criteria are:

- `beat-fidelity`: the shot communicates the authored dramatic beat rather than merely containing named objects.
- `staging-readability`: subject hierarchy, look direction, occlusion, depth, and action geography are legible at intended raster.
- `performance-credibility`: weight, timing, anticipation, contact, pose, gaze, and expression form one intentional action.
- `style-intent-justification`: continuity-rule violations are named in style intent and serve a higher dramatic priority.
- `representability`: the registered assets, profiles, formations, effects, and deterministic engine can actually produce the authored claim.
- `acceptance-scenarios`: every required current frame, event, and metric predicate passes.

Watch the full interval, not only hero stills. Compare adjacent shots when the shot establishes or pays off eyeline, screen direction, pose, action, lighting, or sound continuity.

For repainted delivery, call `prepareReview` again with `kind:"rendition"` after repaint. That worksheet binds the completed source-review fingerprint and one current immutable repaint receipt. Its criteria are visual fidelity to deterministic truth, temporal coherence, anatomy/artifact integrity, and fixed-reference consistency, and the gate matches their ids as exact strings: `visual-fidelity-to-source`, `temporal-coherence`, `anatomy-and-artifact-integrity`, and `reference-consistency`. Prose naming the same ideas is refused, so cover every id the prepared worksheet returned, spelled the way it returned it. Inspect and cite the exact `kind:"rendition"` evidence; rerolling stales this worksheet but not the source-shot review.

## Submit

Call `submitReview` only from the fresh worksheet. Quote exact selectors and frame/outcome identities supplied by `prepareReview`. Cover every criterion exactly once, and carry the criterion ids `beat-fidelity` and `representability` verbatim in a true completion basis, because the gate looks for those exact strings and prose naming the same ideas is refused. Put corrections before the final boolean; `complete:true` requires none.

Design and source dependency targets currently exposed by the schema use `REVIEW_DEPENDENCY`, not this visual checklist.
