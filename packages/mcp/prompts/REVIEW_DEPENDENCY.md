# Design and Source Dependency Review Contract

The current review schema still exposes `design` and `source` dependency worksheets. They support compiler and visual-review provenance; they are not additional human visual surfaces. Read this guide before `prepareReview` or `submitReview` for either target.

For design, inspect exact identity and references, ownership, constraints and ranges, downstream consumability, and acceptance coverage. For source, inspect export binding, determinism, engine enforcement, and error and boundary paths. Use only selectors and compiler outcomes returned by the prepared worksheet; no frame is required unless a downstream visual target owns that judgment.

The gate matches criterion ids as exact strings, so a submission that names the same idea in different words is refused. A design worksheet returns `identity-and-references`, `scope-and-ownership`, `constraints-and-ranges`, `downstream-consumability`, and `acceptance-coverage`. A source worksheet returns `binding-and-exports`, `determinism`, `engine-enforcement`, and `error-and-boundary-paths`. Cover every id the prepared worksheet returned, spelled the way it returned it.

Call `prepareReview`, resolve every diagnostic, then call `submitReview` with the same fingerprint and every returned criterion exactly once. Do not use a dependency completion to claim that an asset, shot, sequence, or film looks correct. Those four surfaces require their own guide, current visual evidence, and submission.
