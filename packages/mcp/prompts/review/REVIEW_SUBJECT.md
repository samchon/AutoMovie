# Reviewing a compiled subject

Read this guide before `prepareReview` or `submitReview` with target kind `subject`. A subject review asks whether one authored thing is correct. It is independent from a shot, frame, sequence, or delivery review, even though its compiled artifact is addressed through one shot.

Read `SUBJECT_INSPECTION` first. It owns the queries that enumerate ids and measure bounds and members, and it owns `inspectSubject`, which is how you actually look at the thing you are about to judge. This guide assumes you arrive holding an id those produced and, where the host can draw, having seen it.

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

Each of those states is something the product now produces, and each has one cause. `indeterminate` means nothing has ever inspected this subject, so there is no denominator to measure against. `not-run` means a sweep was refused before it drew anything, leaving a plan with nothing behind it. `partial` means some viewpoints answer and others do not, which is what a replaced or deleted picture produces, because a receipt counts as an observation only while the artifact it names still hashes to the digest it recorded. `stale` means the compile moved, so the receipts name a revision this subject no longer has. `reviewed` means every planned viewpoint was observed at this unit's own revision.

Report the state you were given. An unobserved plan is never a pass, and a structural reading of the compiled description is not a substitute for having looked.

The review target identifies one unit. Production-wide prototype population and final completeness policy are separate obligations; never infer that one reviewed subject completes all subject review.

## The required criteria

`REVIEW` owns what a submission has to satisfy for every target, including these ids arriving in this order and each needing its own observation and evidence. What is particular to a subject is the coverage below.

- `identity-and-composition`: is this the thing that was authored, made of the members it should be made of? Read `/id`, `/kind`, `/semanticKind`, `/prototype`, `/placement`, `/owner`, `/materials`, and `/members`, counting `/members/total` rather than the length of the bounded `/members/items` sample. A window that compiled to one unit box and a rack that holds nothing both fail here, and both look correct in a wide shot.
- `placement-and-bounds`: read `/transform` and `/bounds`, and compare the declared extent with the measured content extent under the `/bounds/coordinateSpace` each was measured in. A brace spanning three bays while rising a fraction of a metre is visible here as numbers long before it is visible as pixels.
- `viewpoint-coverage`: were the required inspection viewpoints actually observed at this revision? Report the honest state from the coverage record; an unobserved plan is `not-run`, `partial`, `stale`, or `indeterminate`, never a pass.
- `subject-frame-separation`: state what this review does not discharge. The subject's appearance in delivered frames is not this verdict, and this verdict is not that one.

Structural evidence is a `subject` item, `{ kind: "subject", target, pointer, exactValue }`. The `target` must equal the prepared target exactly, the `pointer` must resolve in the compiled description that was prepared, and `exactValue` must equal the value currently at that pointer. Read the value out of the returned description rather than retyping it from memory; a mismatch is refused as `review-evidence-stale`, and a pointer that does not resolve is refused as `review-evidence-selector-invalid`. The `quotable` list is a bounded listing of pointers, so a deep record may not have every one of its own pointers listed there.

`identity-and-composition` and `placement-and-bounds` are answered by those pointers. `viewpoint-coverage` is read from the coverage record, which the prepare output carries but which has no citable pointer of its own: `quotable` lists pointers into the compiled description, and coverage is not part of that description. So the coverage reading belongs in that criterion's observation, in your own words, naming the state and the viewpoint ids.

What you attach to it depends on what the run left you. While a subject-coverage diagnostic is present, cite it as `{ kind: "diagnostic", code, path, actual }`, copying `actual` from the message `prepareReview` returned rather than from this guide, because the service appends its own correction-safety sentence and `actual` must equal the current message exactly. When coverage reads `reviewed` there is no such diagnostic to cite, so quote a `subject` pointer instead. Nothing ties a criterion to a particular evidence kind; what makes the criterion its own is the observation you wrote, which must not repeat another criterion's observation and evidence pair.

`identity-and-composition` and `viewpoint-coverage` are high-risk. A completed review must have each passing, must name each verbatim in its completion basis, and can discharge neither as `not-applicable`.

## Completion needs a current sweep

`inspectSubject` publishes what it saw under `.automovie/inspections/`, and this surface reads it: the published plan is the denominator, and each viewpoint's receipt is an observation only while the picture it names still hashes to the digest that receipt recorded. `SUBJECT_INSPECTION` owns that tool. So `complete: true` is reachable, on exactly one condition, which is that coverage reads `reviewed`.

Anything short of that is refused as `review-subject-coverage-incomplete`, and the refusal carries its measurement: the state, how many of the planned viewpoints were observed, and the unobserved and stale ids by name. Read those ids instead of sweeping again blind, because they say which look is missing.

The order that works is compile, inspect, prepare, judge. Inspecting against a stale compile is refused by the tool, and recompiling after a sweep moves the revision that every receipt names, which turns a `reviewed` subject `stale` in one step. Prepare again after inspecting, so the worksheet reads the sweep that now exists.

`prepareReview` returns `review-subject-viewpoint-unsupported` only while coverage is `indeterminate`, and that now means one thing: nothing has inspected this subject yet. It is a warning, it blocks nothing, and once a plan is published it stops appearing, because `not-run`, `partial` and `stale` are reported through coverage, which says the same thing more precisely. **The one case where it is not a prompt to go and look is a subject the inspection cannot frame, refused under that same code; for that one the viewpoint range is permanently unobservable, and it belongs in the worksheet as exactly that rather than as work you owe.**

A look you took is a reason to write an honest observation, never a viewpoint you may report as covered. The coverage record, not your memory of the pictures, decides what was observed.

While coverage is short, submit the honest incomplete worksheet: quote the structural evidence you did read, describe what the sweep showed you in the observations, set `complete: false`, and carry either a `revise` verdict or a correction naming the viewpoints that remain unobserved. A worksheet that explains no next round is refused as `review-self-contradiction`.

Progress between two revisions is a separate question with a separate answer. `VISUAL_CHANGE_REPORT` tells you which rendered views actually moved, and `SUBJECT_INSPECTION` tells you which compiled subjects did. Neither is a verdict, and neither belongs in this worksheet as evidence.
