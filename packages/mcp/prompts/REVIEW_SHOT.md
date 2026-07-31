# Shot Review Contract

Read this guide before `prepareReview` or `submitReview` with target kind `shot`. Shot review is the frame-and-motion surface: inspect current receipt-backed frames at required review times together with source selectors and acceptance outcomes.

## Prepare

Call `prepareReview` for the exact compiled shot id. The worksheet fingerprint binds shot contract, source, dependencies, current compiler identity, render manifests, acceptance outcomes, and any current receipt-bound rendition. Any relevant edit or repaint reroll makes it stale. When production `visualDelivery` is `repainted`, open and watch the exact MP4 in `renditions`; preparation refuses completion until the shot has one current rendition, and submission must cite it as `kind:"rendition"` evidence in addition to deterministic frame truth.

The canonical criteria are:

- `beat-fidelity`: the shot communicates the authored dramatic beat rather than merely containing named objects.
- `staging-readability`: subject hierarchy, look direction, occlusion, depth, and action geography are legible at intended raster.
- `performance-credibility`: weight, timing, anticipation, contact, pose, gaze, and expression form one intentional action.
- `style-intent-justification`: continuity-rule violations are named in style intent and serve a higher dramatic priority.
- `representability`: the registered assets, profiles, formations, effects, and deterministic engine can actually produce the authored claim.
- `acceptance-scenarios`: every required current frame, event, and metric predicate passes.

Watch the full interval, not only hero stills. Compare adjacent shots when the shot establishes or pays off eyeline, screen direction, pose, action, lighting, or sound continuity.

## Submit

Call `submitReview` only from the fresh worksheet. Quote exact selectors and frame/outcome identities supplied by `prepareReview`. Cover every criterion exactly once and name beat fidelity and representability in a true completion basis. Put corrections before the final boolean; `complete:true` requires none.

Design and source dependency targets currently exposed by the schema use `REVIEW_DEPENDENCY`, not this visual checklist.
