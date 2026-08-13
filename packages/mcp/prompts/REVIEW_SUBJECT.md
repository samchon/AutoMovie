# Reviewing a compiled subject

Read this guide before `prepareReview` or `submitReview` with target kind `subject`. A subject review asks whether one authored thing is correct. It is independent from a shot, frame, sequence, or delivery review even though its compiled artifact is addressed through one shot.

## Name compiled truth

Use `{ kind: "subject", shot, subject }`, where `shot` selects the current compiled artifact and `subject` is a stable id returned by `describeAutoMovieSubjects`. Subject ids distinguish reusable prototypes from placements and include elements, parts, prototypes, instance sets, individual instances, and logical spaces. Do not reconstruct them from display names or id prefixes.

`prepareReview` resolves the target through `describeAutoMovieSubject`, binds the worksheet to the current compile revision, and reports a missing or stale target instead of substituting a frame that happens to contain it. Recompile and prepare again after the subject or any member in its compiled closure changes.

## Let the inspection own the viewpoint

A subject viewpoint belongs to inspection. Its plan names deterministic directions, distances, projection, pose, and state without inheriting an authored camera or film time. Quote only `subject-view` observations bound to the exact subject id, compiled revision, and required viewpoint id.

A normal frame receipt is delivery-facing evidence. It cannot satisfy subject coverage, and a subject-view receipt cannot satisfy a frame, range, shot, sequence, film, or delivery obligation. Keep both reviews when the subject appears in delivered pictures.

## Read coverage honestly

`foldAutoMovieSubjectReviewCoverage` separates planned, observed, missing, stale, unplanned, foreign, and duplicate records. An empty plan is `indeterminate`, no current observation is `not-run`, old-revision observations are `stale`, a partly observed plan is `partial`, and only a wholly current plan is `reviewed`.

The review target identifies one unit. Production-wide prototype population and final completeness policy are separate obligations; never infer that one reviewed subject completes all subject review.

## The four criteria

`prepareReview` returns these ids in this order, and `submitReview` demands every one of them once, in that order, each with its own observation and at least one current `subject` evidence item quoting a prepared pointer into the compiled description.

- `identity-and-composition` — is this the thing that was authored, made of the members it should be made of? Read `/id`, `/kind`, `/semanticKind`, `/prototype`, `/placement`, `/owner`, `/materials`, and `/members`. A window that compiled to one unit box and a rack that holds nothing both fail here, and both look correct in a wide shot.
- `placement-and-bounds` — read `/transform` and `/bounds`, and compare the declared extent with the measured content extent. A brace spanning three bays while rising a fraction of a metre is visible here as numbers before it is visible as pixels.
- `viewpoint-coverage` — were the required inspection viewpoints actually observed at this revision? Report the honest state from the coverage record; an unobserved plan is `not-run`, `partial`, `stale`, or `indeterminate`, never a pass.
- `subject-frame-separation` — state what this review does *not* discharge. The subject's appearance in delivered frames is not this verdict, and this verdict is not that one.

`identity-and-composition` and `viewpoint-coverage` are high-risk: a completed review must name both in its completion basis and neither may be marked `not-applicable`.

## Completion is refused until inspection can look

There is no inspection-owned viewpoint harness in this product yet, so subject-view coverage is always `indeterminate` and `submitReview` refuses `complete: true` with `review-subject-coverage-incomplete`. That refusal is the point: a subject that nothing has ever looked at must not be recorded as reviewed. Submit the honest incomplete worksheet, quote the structural evidence you did read, and carry a correction naming the viewpoints that remain unobserved.
