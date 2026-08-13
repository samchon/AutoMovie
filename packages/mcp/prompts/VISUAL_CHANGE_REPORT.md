# Visual Change Report

Read this when the question is which rendered observations moved between two revisions. `compareAutoMovieVisualRevisions`, exported by `@automovie/mcp`, folds two digest catalogs into one exhaustive report. It runs in a project script under `scripts/` rather than in shot source, and it never opens pixels, renders a frame, or computes a digest of its own.

## Supply two snapshots of one catalog

Each snapshot names one `revision`, one `catalog`, and its `views`. Give every view entry a stable `subject` and a stable `view`; their ordered pair is the identity compared across revisions, and the `digest` beside it is one an existing render or inspection path already produced.

A view identity stands for one repeatable observation basis: the viewpoint, the time, the pass, and the presentation conditions. Keep that basis fixed behind one identity, and mint a different identity when the basis changes. A moved camera reported under the old name reads as production progress.

A delivery review-frame catalog and an inspection-harness catalog are different populations and need different catalog names. Two snapshots whose `catalog` strings differ are refused rather than folded together.

## Read the four states and the counts

The report carries its own provenance in `catalog`, `fromRevision`, and `toRevision`, so it stays readable away from the call that produced it. `counts` carries the exact totals for `changed`, `unchanged`, `new`, and `gone`. `views` carries every subject-view pair from either snapshot, in code-unit order by subject then view, each with its own `status` and its `before` and `after` digests; `before` is `null` on a `new` pair and `after` is `null` on a `gone` one.

`changed` means both revisions carry the pair and their exact image-byte digests differ. `unchanged` means both carry it and the digests are equal. `new` means only the later revision carries it. `gone` means only the earlier revision carries it.

Read `unchanged` as a result rather than as an omission. It is the exact set of views whose bytes did not move, which is what names the surfaces that received no work reaching an image since the earlier revision; it costs no frames to read, and a summary that drops it has thrown away the half of this report that says where the production still is.

## Use it against a progress claim

Run this before you write or accept a checkpoint. Editing source and moving output bytes are different facts, and only the second one is visible here: a report of new geometry whose covering views all come back `unchanged` describes an intention, not a result.

Run it on your own work first, for the same reason. "Revision 212, the gable is up" is a claim about source. `counts.changed` over the views that show the gable is the claim about output, and when that number is zero the first sentence is not yet true no matter how much source changed.

## Boundaries

Do not promote a status into a judgment. `changed` does not mean improved or regressed, and `unchanged` does not mean correct, current, complete, or reviewed. The report carries no receipt and no verdict and cannot satisfy `submitReview`; `REVIEW_SUBJECT` and the other review guides own that question.

A visual change and a structural change are independent facts. `SUBJECT_INSPECTION` owns `diffAutoMovieSubjects`, which answers which compiled subjects were added, removed, moved, or reshaped from the compiled artifact itself. Neither report is offered in place of the other, and a subject whose structure changed while its views did not is a real and reportable state.

## Feed it real digests

The catalog is an input, not a camera generator. This function creates no view and renders nothing, so the entries are yours to assemble. Never hash a PNG yourself, because the digest already exists: take a delivery entry's from the `digest` of a review evidence frame, whose time and pass belong in the view identity you mint for it, and take a directly captured entry's from the `outputDigest` of a `captureFrame` receipt. Build inspection entries from a subject observation harness once one produces digests; this API neither creates that harness nor merges its output into delivery evidence.

Ambiguous input is refused by a thrown `RangeError` rather than normalized, and there is no diagnostic payload to read. A `revision`, `catalog`, `subject`, or `view` that is blank or carries leading or trailing whitespace is refused. A digest must read `sha256:` followed by 64 lowercase hexadecimal digits. The same subject-view pair appearing twice in one snapshot is refused instead of letting the second entry silently win. Repair the producer that emitted the entry rather than patching the string on the way in.
