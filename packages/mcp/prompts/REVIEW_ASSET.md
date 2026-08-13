# Asset Review Contract

Read this guide before `prepareReview` or `submitReview` with target kind `asset`. Asset review is one of four visual review surfaces and requires current turntable evidence.

## Prepare

A compiler outcome refusal has three distinct owners. `review-outcome-artifact-missing` means the current manifest-owned publication is absent; compile the same current input. `review-outcome-artifact-malformed` means its bytes, digest, UTF-8, or JSON are damaged; remove only the damaged compiler publication and compile again. `review-outcome-contract-mismatch` means valid JSON disagrees with the exact reader contract or current identity, which is an internal writer-reader defect: report the diagnostic artifact path and validator paths, and do not edit author source or retry an unchanged compile as a supposed fix. Each state blocks completion while independently readable outcomes remain in the worksheet.

Call `prepareReview` for the exact registry model id. Treat its fingerprint as the worksheet identity. Resolve every error diagnostic before submission. Inspect the supplied rest and range-of-motion views across required angles and passes; a single front beauty frame cannot prove the back, silhouette, joint pivots, or deformation.

The required views are fixed and there are six of them. `turntable-front`, `turntable-right`, `turntable-back`, and `turntable-left` are rest-pose beauty frames at azimuth 0, 90, 180, and 270 degrees, each at 15 degrees elevation. `top-outline` is a rest-pose outline frame at azimuth 0 and 65 degrees elevation. `rig-rom-extremes` is a beauty frame at the front angle in the `rom-extremes` pose, required whenever the compiled model carries a skeleton and unavailable when it does not. Capture them with `angleDeg` in `[0, 360)` and `elevationDeg` in `[-85, 85]`; a turntable's time is `angleDeg / 30` on a fixed twelve-second clock, so each required azimuth is one exact frame index rather than a nearby one.

The canonical criteria are:

- `silhouette-and-proportion`: the identity reads at thumbnail size and all views preserve intended mass, scale, negative space, and profile.
- `rig-convention-and-rom`: axes, hierarchy, pivots, rest pose, limits, and extreme poses behave without implausible collapse or inversion.
- `material-and-outline-legibility`: value grouping, material separation, outline, and small features survive production lighting and target raster.
- `turntable-coverage`: every mandatory angle, pose, and pass is current and receipt-backed.

Also verify provenance and consumer permission when the asset came from outside the repository.

## Submit

Call `submitReview` with the exact prepared fingerprint. Include every required criterion once, in returned order. Each check needs a distinct observation and at least one selector, frame, or outcome from the prepared worksheet. Corrections describe an observable problem and observable corrected state.

A true completion basis carries the criterion ids `silhouette-and-proportion` and `rig-convention-and-rom` verbatim, because the gate looks for those exact strings and prose naming the same ideas is refused. Set `complete:true` only when no correction remains. A stale fingerprint, missing view, duplicate check, invented evidence selector, or contradictory verdict is refused without storing false completion.
