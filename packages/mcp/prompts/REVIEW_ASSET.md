# Asset Review Contract

Read this guide before `prepareReview` or `submitReview` with target kind `asset`. Asset review judges one registry model recipe from turntable evidence the review service owns, rather than from an authored camera that happened to point at it.

## What an asset target addresses

The asset population is the model recipes the compiled shots actually consume, plus every recipe reached through a consumed recipe's LOD chain. A recipe nothing consumes is never queued, and nothing else is an asset target. An assembled building, a logical space, a placed element, or one member of a compact instance set is a compiled subject, and `REVIEW_SUBJECT` owns it. A code-first building therefore reaches this surface as the part recipes it places, one review per distinct recipe rather than per placement, never as the assembly.

The scaffold's isolated asset route frames each model to its own bounding sphere, so absolute size does not change how much of the frame the model fills: a door pull and a thirty-metre facade panel arrive equally framed. What changes with size is what the frame can settle. Proportion, silhouette, material grouping, and outline legibility are decided here. Whether the part sits where the building needs it, reads at its installed distance, or lines up with its neighbours is decided by the shot or subject that stages it.

## Prepare

Call `prepareReview` for the exact registry model id. Treat its fingerprint as the worksheet identity. Resolve every error diagnostic before submission. Inspect the supplied rest and range-of-motion views across required angles and passes; a single front beauty frame cannot prove the back, silhouette, joint pivots, or deformation.

The worksheet reads no view at all until generated output is a clean compile of current design and source, and until the compiler-owned model for this id is present and schema-valid. Both failures arrive as `review-evidence-stale` with an empty view list, which is a compile instruction rather than a judgment about the model.

The required views are fixed by the service, not chosen by the reviewer. `turntable-front`, `turntable-right`, `turntable-back`, and `turntable-left` are rest-pose beauty frames at azimuth 0, 90, 180, and 270 degrees, each at 15 degrees elevation. `top-outline` is a rest-pose outline frame at azimuth 0 and 65 degrees elevation. `rig-rom-extremes` is a beauty frame at the front angle in the `rom-extremes` pose, and it joins the required set only when the compiled model carries a skeleton: a rigless prop, panel, or building part owes the rest-pose views alone, and asking `captureFrame` for its extremes is refused. That is the whole set; `prepareReview` returns exactly the views this model owes, and the worksheet is the authority on which of them are still missing.

Capture them with `angleDeg` in `[0, 360)` and `elevationDeg` in `[-85, 85]`, at production raster with no width or height override. A turntable's time is `angleDeg / 30` on a fixed twelve-second clock, so each required azimuth is one exact frame index rather than a nearby one. A view captured at a smaller raster, or against a different production frame rate, is downgraded with a `render-frame-invalid` warning and can never discharge a required view.

The canonical criteria are:

- `silhouette-and-proportion`: the identity reads at thumbnail size and all views preserve intended mass, scale, negative space, and profile.
- `rig-convention-and-rom`: axes, hierarchy, pivots, rest pose, limits, and extreme poses behave without implausible collapse or inversion.
- `material-and-outline-legibility`: value grouping, material separation, outline, and small features survive production lighting and target raster.
- `turntable-coverage`: every mandatory angle, pose, and pass is current and receipt-backed.

`rig-convention-and-rom` is required and high-risk for every asset, including one that has no skeleton and therefore no extreme-pose view to inspect. Not-applicable cannot discharge it. On a rigless model, judge the axes, hierarchy, pivot placement, and rest transform the compiled recipe does carry, decide from the rest views, and record in the observation that no extreme pose exists rather than leaving the criterion unaddressed.

Also verify provenance and consumer permission when the asset came from outside the repository.

## Submit

Call `submitReview` with the exact prepared fingerprint. Include every required criterion once, in returned order. Each check needs its own observation and at least one evidence item. Corrections describe an observable problem and an observable corrected state.

An asset worksheet accepts `design` JSON pointers into the current model recipe, `frame` entries it returned, and `diagnostic` entries from the same prepare snapshot. It returns no acceptance outcomes, no source selectors, and no renditions, so citing one of those is refused as stale evidence instead of read as a differing opinion, and no check may carry acceptance scenario ids.

A completed review must cite the digest of every required current view, so a missing or superseded turntable frame refuses completion by name. A true completion basis carries the criterion ids `silhouette-and-proportion` and `rig-convention-and-rom` verbatim, because the gate looks for those exact strings and prose naming the same ideas is refused.

Set `complete:true` only when every criterion passes and no correction remains. `complete:false` is refused unless at least one criterion says revise or at least one correction states what the next round changes, so a draft submission still has to name the defect. A stale fingerprint, missing view, duplicate check, invented evidence selector, or contradictory verdict is refused without storing false completion.
