# Shot Review Contract

Read this guide before `prepareReview` or `submitReview` with target kind `shot` or `rendition`. Shot review is the deterministic frame-and-motion surface; rendition review is the separate receipt-bound appearance surface. They are two worksheets over one shot, and each one refuses evidence the other lives on.

## Prepare the shot worksheet

Call `prepareReview` with `kind:"shot"` first. Its fingerprint binds deterministic contract, source, dependencies, compiler identity, render manifests, and acceptance outcomes; repaint output does not stale this source judgment. Complete that review before calling `repaintShot`.

The pixels this worksheet demands are decided by the shot contract, not by the reviewer. Every entry in the shot's `reviewFrames` names a time and a set of passes, and each frame-and-pass pair in that product must already exist as a current verified PNG before submission. Each one missing is its own `review-evidence-missing` naming the exact production, shot, time, and pass to capture, so declaring one review frame with four passes is declaring four `captureFrame` calls. A frame captured with a width or height override, or against a different production frame rate, is downgraded with `render-frame-invalid` and discharges nothing.

The worksheet's quotable selectors are the non-blank lines of the shot's own source module, on the same first-512 cap a source review gets. Its acceptance outcomes are the compiler-derived results for the required scenarios addressing this shot. Only `acceptance-scenarios` may carry scenario ids at all, on any submission. Completing the review additionally demands that the check list exactly the current required ids and cite, per scenario, the exact current contract plus either the named frame at its named pass or the passing compiler outcome. An acceptance threshold is not a measured result, and adjacency in the edit is not evidence that two events share a moment.

A compiler outcome refusal names its owner, and the owners do not overlap. `review-outcome-artifact-missing` means the current manifest-owned publication is absent; compile the same current input. `review-outcome-artifact-malformed` means its bytes, digest, UTF-8, or JSON are damaged; remove only the damaged compiler publication and compile again. `review-outcome-contract-mismatch` means valid JSON disagrees with the exact reader contract or current identity, which is an internal writer-reader defect: report the diagnostic artifact path and validator paths, and do not edit author source or retry an unchanged compile as a supposed fix. Each state blocks completion while independently readable outcomes remain in the worksheet. This family reaches the shot worksheet because a shot reads acceptance outcomes; a rendition worksheet reads none and never returns one.

The canonical criteria are:

- `beat-fidelity`: the shot communicates the authored dramatic beat rather than merely containing named objects.
- `staging-readability`: subject hierarchy, look direction, occlusion, depth, and action geography are legible at intended raster.
- `performance-credibility`: weight, timing, anticipation, contact, pose, gaze, and expression form one intentional action.
- `style-intent-justification`: continuity-rule violations are named in style intent and serve a higher dramatic priority.
- `representability`: the registered assets, profiles, formations, effects, and deterministic engine can actually produce the authored claim.
- `acceptance-scenarios`: every required current frame, event, and metric predicate passes.

Measure the contact before judging it. `performance-credibility` turns on whether feet stay planted, whether a body could hold the pose it holds, and whether two bodies pass through each other, and `MOTION` names the engine checks that answer each of those over the same compiled clip this worksheet judges. A foot sliding eleven centimetres through its plant is a number, not an impression. The measurement is not worksheet evidence and discharges no frame: it tells you which frame to capture and what your observation is about.

Watch the full interval, not only hero stills. Compare adjacent shots when the shot establishes or pays off eyeline, screen direction, pose, action, lighting, or sound continuity.

## Prepare the rendition worksheet

For repainted delivery, call `prepareReview` again with `kind:"rendition"` after repaint. That worksheet binds the completed source-review fingerprint and one current immutable repaint receipt, and it returns a blocking `review-rendition-source-unapproved` error while the deterministic shot review for the same id is missing, stale, or incomplete.

Its criteria are visual fidelity to deterministic truth, temporal coherence, anatomy and artifact integrity, and fixed-reference consistency, and the gate matches their ids as exact strings: `visual-fidelity-to-source`, `temporal-coherence`, `anatomy-and-artifact-integrity`, and `reference-consistency`. Prose naming the same ideas is refused, so cover every id the prepared worksheet returned, spelled the way it returned it.

A rendition worksheet returns no quotable selectors, no frames, and no acceptance outcomes. Its evidence is the `kind:"rendition"` entries it returned, matched whole against the current byte- and receipt-verified inventory, plus `diagnostic` entries from the same prepare snapshot. Watch the committed MP4 before writing an observation about it; nothing in this worksheet decodes it for you. Completion additionally requires one cited rendition for the addressed shot. Rerolling stales this worksheet but not the source-shot review.

## Submit

`REVIEW` owns the submission discipline. What is particular here is what a shot and a rendition each owe.

Quote exact selectors and frame, outcome, or rendition identities supplied by `prepareReview`. The high-risk criterion ids are `beat-fidelity` and `representability` for a shot, and `visual-fidelity-to-source` and `anatomy-and-artifact-integrity` for a rendition.

Design and source dependency targets currently exposed by the schema use `REVIEW_DEPENDENCY`, not this visual checklist.
