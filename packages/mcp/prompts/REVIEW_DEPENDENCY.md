# Design and Source Dependency Review Contract

The current review schema still exposes `design` and `source` dependency worksheets. They support compiler and visual-review provenance; they are not additional human visual surfaces. Read this guide before `prepareReview` or `submitReview` for either target.

For design, inspect exact identity and references, ownership, constraints and ranges, downstream consumability, and acceptance coverage. For source, inspect export binding, determinism, engine enforcement, and error and boundary paths. Use only selectors and compiler outcomes returned by the prepared worksheet; no frame is required unless a downstream visual target owns that judgment.

Call `prepareReview`, resolve every diagnostic, then call `submitReview` with the same fingerprint and every returned criterion exactly once. Do not use a dependency completion to claim that an asset, shot, sequence, or film looks correct. Those four surfaces require their own guide, current visual evidence, and submission.
