# Reviewing a compiled subject

Read this guide before `prepareReview` or `submitReview` with target kind `subject`. A subject review asks whether one authored thing is correct. It is independent from a shot, frame, sequence, or delivery review, even though its compiled artifact is addressed through one shot.

Read `SUBJECT_INSPECTION` first when you do not yet know which subjects exist. It owns the queries that enumerate ids and measure bounds and members, and this guide assumes you arrive holding an id it produced.

## Name compiled truth

Use `{ kind: "subject", shot, subject }`, where `shot` selects the current compiled artifact and `subject` is a stable id. Most ids are ones `describeAutoMovieSubjects` returned or `describeAutoMovieSubject` resolved: prototypes, prototype parts, elements, placed parts, instance sets, individual instances, and logical spaces. Do not rebuild one from a display name or an id prefix.

`formation:<id>` is also a valid target, and it is the one id the subject description queries cannot answer at all: the review surface reads a formation from the compiled artifact's own formation records instead. Its description is a different shape from the rest: it carries `/revision`, `/id`, `/kind`, `/formation`, and `/members`, and none of the placement fields the other kinds expose. Quote pointers that exist in the description you were actually handed.

`prepareReview` resolves the target, binds the worksheet to the exact compiled shot bytes it read, and returns the resolved unit and its coverage under `subjectReview`. Anything it cannot read, validate, or resolve becomes `review-target-missing` rather than a substituted frame that happens to contain the subject. Submit with the exact fingerprint it returned. Recompile and prepare again after the subject or any member of its compiled closure changes; a worksheet submitted against a superseded fingerprint is refused as `review-worksheet-stale`.

The revision on that description is minted by the review surface from the compiled shot file. It is not the revision string you passed to `describeAutoMovieSubjects` in a script, so join the two surfaces by subject id and never by comparing revision strings.

## Let the inspection own the viewpoint

A subject viewpoint belongs to inspection. Its plan names deterministic directions, distances, projection, pose, and state without inheriting an authored camera or film time. Only a `subject-view` observation bound to the exact subject id, compiled revision, and planned viewpoint id counts toward that plan.

A normal frame receipt is delivery-facing evidence. It cannot satisfy subject coverage, and a subject-view receipt cannot satisfy a frame, range, shot, sequence, film, or delivery obligation. `prepareReview` returns no frames at all for a subject target, so there is nothing frame-shaped here to cite even by accident. Keep both reviews open when the subject also appears in delivered pictures.

## Read coverage honestly

`foldAutoMovieSubjectReviewCoverage` separates planned, observed, missing, stale, unplanned, foreign, and duplicate records, and reports one state: an empty plan is `indeterminate`, no current observation is `not-run`, only old-revision observations are `stale`, a partly observed plan is `partial`, and a wholly current plan is `reviewed`.

The plan this surface folds is empty today, so the state it reports is `indeterminate` every time. Report that state as it stands. An unobserved plan is never a pass, and a structural reading of the compiled description is not a substitute for having looked.

The review target identifies one unit. Production-wide prototype population and final completeness policy are separate obligations; never infer that one reviewed subject completes all subject review.

## The required criteria

`prepareReview` returns these ids in this order, and `submitReview` demands every one of them exactly once in that order. Each needs its own observation and at least one current evidence item, and two criteria carrying the same observation text with the same evidence set are refused as a copy, so decide what each criterion independently establishes before writing it.

- `identity-and-composition`: is this the thing that was authored, made of the members it should be made of? Read `/id`, `/kind`, `/semanticKind`, `/prototype`, `/placement`, `/owner`, `/materials`, and `/members`, counting `/members/total` rather than the length of the bounded `/members/items` sample. A window that compiled to one unit box and a rack that holds nothing both fail here, and both look correct in a wide shot.
- `placement-and-bounds`: read `/transform` and `/bounds`, and compare the declared extent with the measured content extent under the `/bounds/coordinateSpace` each was measured in. A brace spanning three bays while rising a fraction of a metre is visible here as numbers long before it is visible as pixels.
- `viewpoint-coverage`: were the required inspection viewpoints actually observed at this revision? Report the honest state from the coverage record; an unobserved plan is `not-run`, `partial`, `stale`, or `indeterminate`, never a pass.
- `subject-frame-separation`: state what this review does not discharge. The subject's appearance in delivered frames is not this verdict, and this verdict is not that one.

Structural evidence is a `subject` item, `{ kind: "subject", target, pointer, exactValue }`. The `target` must equal the prepared target exactly, the `pointer` must resolve in the compiled description that was prepared, and `exactValue` must equal the value currently at that pointer. Read the value out of the returned description rather than retyping it from memory; a mismatch is refused as `review-evidence-stale`, and a pointer that does not resolve is refused as `review-evidence-selector-invalid`. The `quotable` list is a bounded listing of pointers, so a deep record may not have every one of its own pointers listed there.

`identity-and-composition` and `placement-and-bounds` are answered by those pointers. `viewpoint-coverage` is read from the coverage record and cited through the prepared diagnostic that explains it, as `{ kind: "diagnostic", code, path, actual }`. Copy `actual` from the message `prepareReview` returned rather than from this guide: the service appends its own correction-safety sentence to every diagnostic message, and `actual` must equal the current message exactly or the item is refused as stale.

`identity-and-composition` and `viewpoint-coverage` are high-risk. Were a subject review ever completable, each would have to pass and each would have to be named verbatim in the completion basis, and neither could be discharged as `not-applicable`. That rule binds only a completion, and a subject completion is currently refused outright.

## Completion is refused until inspection can look

This surface has no viewpoint plan source. `prepareReview` folds an empty plan against no observations, so `subjectReview.coverage.state` is structurally `indeterminate`, and `submitReview` refuses `complete: true` with `review-subject-coverage-incomplete` every time. The refusal is the point: a subject that nothing has ever looked at must not be recorded as reviewed.

Alongside it, `prepareReview` always returns the warning `review-subject-viewpoint-unsupported` for a subject target. It is a warning, it blocks nothing, and it is not a defect in your production; it names the same missing plan source. Do not spend a round trying to make it disappear.

The viewpoint computation lives in `@automovie/viewer`, and the starter's `viewer/subject.html` page drives it: it opens one subject by name, frames it from the subject's own content box, and turns a deterministic turntable around it. `SUBJECT_INSPECTION` routes you there, and looking through it before you write an observation is worth the minute it costs.

What that page does not do is write. It produces no receipt and no digest, so nothing turns its output into the `subject-view` observation record this surface accepts, and that is why the plan here is empty rather than merely unobserved. A look you took is a reason to write an honest observation, never a viewpoint you may report as covered.

So submit the honest incomplete worksheet. Quote the structural evidence you did read, set `complete: false`, and carry either a `revise` verdict or a correction naming the viewpoints that remain unobserved; an incomplete worksheet that explains no next round is refused as `review-self-contradiction`.

Progress between two revisions is a separate question with a separate answer. `VISUAL_CHANGE_REPORT` tells you which rendered views actually moved, and `SUBJECT_INSPECTION` tells you which compiled subjects did. Neither is a verdict, and neither belongs in this worksheet as evidence.
