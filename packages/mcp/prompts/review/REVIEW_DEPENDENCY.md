# Design and Source Dependency Review Contract

The current review schema still exposes `design` and `source` dependency worksheets. They support compiler and visual-review provenance; they are not additional human visual surfaces. Read this guide before `prepareReview` or `submitReview` for either target.

For design, inspect exact identity and references, ownership, constraints and ranges, downstream consumability, and acceptance coverage. For source, inspect export binding, determinism, engine enforcement, and error and boundary paths.

The gate matches criterion ids as exact strings, so a submission that names the same idea in different words is refused. A design worksheet returns `identity-and-references`, `scope-and-ownership`, `constraints-and-ranges`, `downstream-consumability`, and `acceptance-coverage`. A source worksheet returns `binding-and-exports`, `determinism`, `engine-enforcement`, and `error-and-boundary-paths`. Cover every id the prepared worksheet returned, spelled the way it returned it.

## What a dependency worksheet returns

Selectors and diagnostics, and nothing else. A design worksheet returns JSON pointers into the current design record. A source worksheet returns one selector per non-blank line of the module, capped at the first 512 with a `review-selector-truncated` warning past that, so a longer module has a tail no review can cite; `SOURCE_COMPOSITION` owns what to do about it.

Neither kind returns frames, acceptance outcomes, or renditions. Citing one is refused as stale evidence. `acceptance-coverage` is therefore judged from the prepared design record and the prepare-time diagnostics, not from a compiler-derived outcome: only the shot, sequence, and film surfaces receive those. No check may carry acceptance scenario ids either, on any criterion.

Source evidence must be one of the returned selectors and must still equal the current line after trimming. Design evidence must resolve in the current record and equal the exact value you quoted; the returned pointer list is truncated for a large record, but any pointer that resolves against the current value is accepted, so depth does not put a value out of reach.

A source worksheet also carries the compiler's own verdict on the module. Every current error diagnostic on that path, and every source or compile error on a shot bound to it, arrives in the prepared worksheet and blocks submission. An upstream design or model materialization error adds `review-source-compile-blocked`, which says the module never executed trustworthily: correct the upstream blocker and prepare again rather than reviewing what the compiler could not run.

## Submit

`REVIEW` owns the submission discipline. Two things are stricter here.

Design and source are the kinds where every criterion owes its own evidence. Reusing one pointer or one source line across two criteria is refused as `review-evidence-reused`. Inspect and cite a distinct current selector for each concern.

The high-risk criterion ids are `identity-and-references` for design, and `determinism` and `engine-enforcement` for source.

Do not use a dependency completion to claim that an asset, shot, rendition, sequence, or film looks correct. Each of those surfaces requires its own guide, current visual evidence, and submission.
