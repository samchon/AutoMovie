# Sequence Review Contract

Read this guide before `prepareReview` or `submitReview` with target kind `sequence`. Sequence review judges authored treatment intent across an ordered run of current shots; it is not the arithmetic sum of completed shot reviews.

## Prepare and inspect

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
