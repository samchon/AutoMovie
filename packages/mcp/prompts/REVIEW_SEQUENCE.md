# Sequence Review Contract

Read this guide before `prepareReview` or `submitReview` with target kind `sequence`. Sequence review judges authored treatment intent across an ordered run of current shots; it is not the arithmetic sum of completed shot reviews.

## Prepare and inspect

A compiler outcome refusal has three distinct owners. `review-outcome-artifact-missing` means the current manifest-owned publication is absent; compile the same current input. `review-outcome-artifact-malformed` means its bytes, digest, UTF-8, or JSON are damaged; remove only the damaged compiler publication and compile again. `review-outcome-contract-mismatch` means valid JSON disagrees with the exact reader contract or current identity, which is an internal writer-reader defect: report the diagnostic artifact path and validator paths, and do not edit author source or retry an unchanged compile as a supposed fix. Each state blocks completion while independently readable outcomes remain in the worksheet.

Call `prepareReview` for the exact treatment sequence id. Inspect current coverage and the temporal run, including incoming and outgoing transitions. Use the worksheet's exact source selectors, verified frames, and acceptance outcomes. For repainted delivery, also open every addressed MP4 in `renditions`, inspect both sides of each cut, and cite at least one current `kind:"rendition"` entry per shot; missing, stale, or uncited rendition receipts block completion.

The canonical criteria are:

- `cross-shot-continuity`: action, pose, gaze, eyeline, screen direction, props, light, ambience, and narrative state carry deliberately across cuts.
- `rhythm-against-intent`: shot duration, internal motion, dialogue, silence, and cut placement express the sequence’s escalation, release, or suspension.
- `spatial-model-maintenance`: the viewer can reconstruct or intentionally lose geography according to declared style intent.
- `coverage-sufficiency`: the cut has enough distinct, purposeful material to communicate every beat without redundant filler.
- `acceptance-scenarios`: all sequence-relevant deterministic predicates and evidence requirements pass.

Scrub every cut in both directions. A locally good outgoing frame can still make an incoherent edit when paired with the next incoming frame.

## Submit

Call `submitReview` with the unchanged prepared fingerprint. Cover each returned criterion once with current evidence. A true completion basis carries the criterion ids `cross-shot-continuity` and `spatial-model-maintenance` verbatim -- the gate looks for those exact strings, so prose naming the same ideas is refused -- explains any intentional discontinuity, and leaves no correction.
