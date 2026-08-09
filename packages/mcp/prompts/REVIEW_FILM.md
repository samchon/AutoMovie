# Film Review Contract

Read this guide before `prepareReview` or `submitReview` with target kind `film`. Film review is the terminal human-judgment surface. Passing compilation, individual assets, shots, and sequences is necessary but does not prove a coherent finished film.

## Prepare and inspect

Call `prepareReview` for the exact film id after current sequences, audio, captions, rendition policy, and delivery artifacts exist. Inspect the whole work without skipping repeated or quiet passages, then revisit diagnostic points and high-risk transitions. When visual delivery is repainted, open every shot MP4 returned in `renditions` and cite at least one current `kind:"rendition"` entry per shot. The server rechecks output bytes, receipt identity, deterministic source, references, adapter, parameters, and media facts; missing, stale, or uncited rendition evidence blocks terminal review.

The canonical criteria are:

- `narrative-completion`: setup, development, causality, character state, climax, and resolution fulfill the screenplay ladder.
- `tone-consistency`: performance, image, edit, sound, and any intentional rupture form a legible tonal design.
- `delivery-readiness`: visual delivery matches the declared deterministic or repainted policy; media, captions, audio, provenance, receipts, and required reviews are current.
- `acceptance-scenarios`: every terminal frame, event, metric, and delivery predicate passes.

Judge start and end, pacing over the entire runtime, audiovisual synchronization, dialogue intelligibility, caption timing, black/silent accidents, and whether sequence boundaries preserve story state.

## Submit

Call `submitReview` with the exact prepared fingerprint and every criterion once. A true completion basis carries the criterion ids `narrative-completion` and `delivery-readiness` verbatim, because the gate looks for those exact strings and prose naming the same ideas is refused, with current evidence for each. Any rerender, remix, recut, source edit, repaint reroll, or receipt change requires a fresh worksheet.
