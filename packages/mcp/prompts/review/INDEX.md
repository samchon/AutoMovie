# Review

Every review, whatever it judges, is the same two calls and the same discipline. This document owns that discipline, and both review tools are gated on it. The guide for your exact target owns what that target is, what its worksheet carries, and which criteria it must answer.

Read the discipline below once, then the one target guide summarized under it.

## [`REVIEW_ASSET`](REVIEW_ASSET.md)

Target kind `asset`: one registry model recipe, judged from the fixed turntable set rather than from an authored camera that happened to point at it. Owns the six required views, the silhouette, rig, material, and provenance criteria, and the rule that a worksheet may cite only design pointers, its own frames, and its own diagnostics.

## [`REVIEW_SUBJECT`](REVIEW_SUBJECT.md)

Target kind `subject`: one compiled thing judged on its own, independent of any shot that stages it. Owns the inspection-owned viewpoint plan, the coverage states that plan produces, and the rule that completion needs a current sweep rather than a frame.

## [`REVIEW_SHOT`](REVIEW_SHOT.md)

Target kinds `shot` and `rendition`: the staged moment, and the optional diffusion rendition derived from it. Owns both worksheets, the composition, performance, continuity, and acceptance criteria, and the separation that keeps an accepted shot from accepting its own repaint.

## [`REVIEW_SEQUENCE`](REVIEW_SEQUENCE.md)

Target kind `sequence`: an ordered run of current shots, judged as authored treatment intent rather than as arithmetic over its members. Owns cross-shot continuity, rhythm against intent, spatial-model maintenance, and coverage sufficiency.

## [`REVIEW_FILM`](REVIEW_FILM.md)

Target kind `film`: the whole assembly, judged for narrative completion, tone, and delivery readiness. Owns the terminal consistency the deliverable is gated on, and the rule that every rerender, remix, recut, reroll, and receipt change stales it.

## [`REVIEW_DEPENDENCY`](REVIEW_DEPENDENCY.md)

Target kinds `design` and `source`: the records and modules a visual surface stands on. Owns their criteria, the stricter rule that every criterion owes its own distinct evidence, and the boundary that a dependency completion never claims anything looks correct.

## Prepare, then judge what came back

Call `prepareReview` for the exact target. What it returns is the authority, not your memory of the target: the criteria you must answer, the selectors you may quote, and the current evidence that target's own kind carries.

A kind that carries no frame or outcome returns an empty inventory rather than a stand-in. That is the worksheet telling you the truth about what exists, and it is never a licence to cite something else.

Inspect every returned evidence item yourself. A digest you did not open is a digest, not an observation.

## What the server checks, and what it never checks

The server never reads your prose and never decides whether the thing is good. It checks identity, freshness, and self-consistency:

- the submitted fingerprint is the one `prepareReview` just returned, so a target that moved underneath you stores nothing;
- every criterion the worksheet named appears exactly once, in the order it was returned;
- each check carries its own observation and at least one evidence item;
- each evidence item resolves through a selector the worksheet supplied and against current bytes;
- no two checks share one observation and evidence set, which is refused as `review-observation-copied`;
- corrections name an observable problem and an observable corrected state.

An invented selector, a stale digest, a duplicated check, or a contradictory verdict is refused, and a refused submission stores nothing at all.

## Completion is a claim, and it is checked

Put corrections and the completion basis before the final boolean. The order is deliberate: state what you saw and what you fixed, then decide.

`complete: true` requires every criterion to pass. A `not-applicable` verdict never discharges a required criterion, and a completion basis must carry its target's high-risk criterion ids verbatim, because the gate matches those exact strings and prose naming the same idea is refused. Each target guide names its own.

`complete: false` is refused unless at least one criterion says revise or at least one correction states what the next round changes. A draft submission still has to name the defect.

## What may be cited

Only evidence the worksheet returned. In particular:

- a `captured:false` capture is a refusal, not a frame;
- an inspection observation carries `deliveryEvidence: false` and discharges no delivery review, whatever it shows;
- a review of one surface never stands in for another: an accepted design does not make a shot look right, and an accepted shot does not accept the rendition derived from it.

## Staleness is the normal state

Any change to the target or to what it derives from stales its review. A recompile, a source edit, a recapture, a repaint reroll, a recut, a remix, or a receipt change all mean the same thing: prepare again, look again, submit again.

That is not friction. It is what keeps a completion from being a claim about a state that no longer exists.
