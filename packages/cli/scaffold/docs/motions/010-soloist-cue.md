<!--
@evidence principles/common.md#purpose-fit Defines the reproducible hand transition that makes SOLOIST's only articulated capability callable and reviewable.
@evidenceReview principles/common.md#purpose-fit #403e074 Compared principles/common.md#purpose-fit with "complete 010-soloist-cue.md document"; confirmed that defines the reproducible hand transition that makes SOLOIST's only articulated capability callable and reviewable.
@evidence principles/common.md#layer-boundary Owns endpoints, seconds, joint path, and input domain without redefining the figure, deciding a scene, or selecting a camera.
@evidenceReview principles/common.md#layer-boundary #cfb2a7f Compared principles/common.md#layer-boundary with "complete 010-soloist-cue.md document"; confirmed that owns endpoints, seconds, joint path, and input domain without redefining the figure, deciding a scene, or selecting a camera.
@evidence principles/common.md#declared-basis Labels 110 degrees, 25 degrees, and 2 seconds as chosen blocking parameters rather than measured performance data.
@evidenceReview principles/common.md#declared-basis #4a10eec Compared principles/common.md#declared-basis with "complete 010-soloist-cue.md document"; confirmed that labels 110 degrees, 25 degrees, and 2 seconds as chosen blocking parameters rather than measured performance data.
@evidence principles/motions.md#state-endpoints Names rest or a caller-supplied authorized abduction as entry and the raised-and-held joint pose as exit.
@evidenceReview principles/motions.md#state-endpoints #fe3ff71 Compared principles/motions.md#state-endpoints with "complete 010-soloist-cue.md document"; confirmed that names rest or a caller-supplied authorized abduction as entry and the raised-and-held joint pose as exit.
@evidence principles/motions.md#temporal-phases Defines one ease-in-out raise ending at 2 seconds followed by a linear hold through the supplied duration.
@evidenceReview principles/motions.md#temporal-phases #65f41d5 Compared principles/motions.md#temporal-phases with "complete 010-soloist-cue.md document"; confirmed that defines one ease-in-out raise ending at 2 seconds followed by a linear hold through the supplied duration.
@evidence principles/motions.md#spatial-relation Keeps the model root planted and expresses all joint change in the compiler skeleton's local joint frames.
@evidenceReview principles/motions.md#spatial-relation #d8786a8 Compared principles/motions.md#spatial-relation with "complete 010-soloist-cue.md document"; confirmed that keeps the model root planted and expresses all joint change in the compiler skeleton's local joint frames.
@evidence principles/motions.md#parameter-domain Defines finite duration and start-abduction bounds and rejects a duration too short to reach the authored endpoint.
@evidenceReview principles/motions.md#parameter-domain #d76f614 Compared principles/motions.md#parameter-domain with "complete 010-soloist-cue.md document"; confirmed that defines finite duration and start-abduction bounds and rejects a duration too short to reach the authored endpoint.
-->

# SOLOIST cue motion

## Raise and hold {#soloist-raise-hold}

<!--
@evidence settings/000-governing-aim.md#delivery-contract Uses seconds and the production's deterministic replay requirement.
@evidenceReview settings/000-governing-aim.md#delivery-contract #28c4cbc Compared settings/000-governing-aim.md#delivery-contract with "Raise and hold {#soloist-raise-hold}"; confirmed that uses seconds and the production's deterministic replay requirement.
@evidence settings/010-soloist.md#soloist-identity-scale Preserves the planted followed figure's scale and readable silhouette while changing only its arm pose.
@evidenceReview settings/010-soloist.md#soloist-identity-scale #5386f50 Compared settings/010-soloist.md#soloist-identity-scale with "Raise and hold {#soloist-raise-hold}"; confirmed that preserves the planted followed figure's scale and readable silhouette while changing only its arm pose.
@evidence settings/010-soloist.md#soloist-hand-capability Changes only the authorized raised-hand joints while the figure root and remaining body stay fixed.
@evidenceReview settings/010-soloist.md#soloist-hand-capability #92a349c Compared settings/010-soloist.md#soloist-hand-capability with "Raise and hold {#soloist-raise-hold}"; confirmed that changes only the authorized raised-hand joints while the figure root and remaining body stay fixed.
@evidence models/010-soloist.md#soloist-articulation-interface Drives the named upper- and lower-arm joints on the compiler-built skeleton instead of reconstructing geometry.
@evidenceReview models/010-soloist.md#soloist-articulation-interface #474016c Compared models/010-soloist.md#soloist-articulation-interface with "Raise and hold {#soloist-raise-hold}"; confirmed that drives the named upper- and lower-arm joints on the compiler-built skeleton instead of reconstructing geometry.
@evidenceExclude models/010-soloist.md#soloist-blocking-representation Recipe construction, including capability metadata and the inert actor locomotion rate, remains model-source-owned; this motion separately consumes the articulation interface.
@evidenceExcludeReview models/010-soloist.md#soloist-blocking-representation #057edb2 Compared models/010-soloist.md#soloist-blocking-representation with "Raise and hold {#soloist-raise-hold}" and the named owner; confirmed that recipe construction, capability metadata, and the inert actor locomotion rate remain model-source-owned while this motion separately consumes the articulation interface.
@evidenceExclude models/010-soloist.md#soloist-neutral-review-views Model construction owns neutral-view inspection; this motion owns the time samples taken in those views.
@evidenceExcludeReview models/010-soloist.md#soloist-neutral-review-views #2143508 Compared models/010-soloist.md#soloist-neutral-review-views with "Raise and hold {#soloist-raise-hold}" and the named owner; confirmed that model construction owns neutral-view inspection; this motion owns the time samples taken in those views.
@evidence obligations/motions.md#time-base Establishes a finite non-looping mapping from shot seconds to authored joint keyframes, clamped by the compiled motion runtime outside its duration.
@evidenceReview obligations/motions.md#time-base #7a08917 Compared obligations/motions.md#time-base with "Raise and hold {#soloist-raise-hold}"; confirmed that establishes a finite non-looping mapping from shot seconds to authored joint keyframes, clamped by the compiled motion runtime outside its duration.
@evidence obligations/motions.md#composition-interruption Defines continuation by passing the previous upper-arm abduction as `from`; an already raised hand produces a constant hold rather than a second raise.
@evidenceReview obligations/motions.md#composition-interruption #ca0e4d5 Compared obligations/motions.md#composition-interruption with "Raise and hold {#soloist-raise-hold}"; confirmed that defines continuation by passing the previous upper-arm abduction as `from`; an already raised hand produces a constant hold rather than a second raise.
-->

Given non-empty motion and skeleton ids, a finite duration of at least 2 seconds, and a finite `from` abduction from 0 through 110 degrees, emit a non-looping skeleton motion whose id appends `-cue` to the supplied motion id. When `from` is below 110, ease the left upper arm from `from` to 110 degrees with ease-in-out timing over seconds 0 through 2, keep the lower arm at 25 degrees flexion, and hold both linearly through the supplied duration. When `from` is 110, hold that exact pose linearly from first to last keyframe. The root and every other joint remain unchanged.

## Cue review samples {#soloist-cue-review-samples}

<!--
@evidence settings/050-art-direction.md#art-delivery-review-condition Judges the raised hand at the delivery raster after motion-level joint samples pass.
@evidenceReview settings/050-art-direction.md#art-delivery-review-condition #c9d7e44 Compared settings/050-art-direction.md#art-delivery-review-condition with "Cue review samples {#soloist-cue-review-samples}"; confirmed that judges the raised hand at the delivery raster after motion-level joint samples pass.
@evidence obligations/motions.md#motion-review-set Defines samples at 0, 1, 2, and final seconds, including root position and both authored joint channels.
@evidenceReview obligations/motions.md#motion-review-set #73dc11d Compared obligations/motions.md#motion-review-set with "Cue review samples {#soloist-cue-review-samples}"; confirmed that defines samples at 0, 1, 2, and final seconds, including root position and both authored joint channels.
@evidenceExclude settings/030-gate.md#gate-identity-placement The current motion catalogue contains no gate transition and grants this cue no prop ownership.
@evidenceExcludeReview settings/030-gate.md#gate-identity-placement #64a3d40 Compared settings/030-gate.md#gate-identity-placement with "Cue review samples {#soloist-cue-review-samples}" and the named owner; confirmed that the current motion catalogue contains no gate transition and grants this cue no prop ownership.
@evidenceExclude settings/030-gate.md#gate-hinge-capability The current motion catalogue deliberately leaves the authorized gate hinge without a motion because the film holds it shut.
@evidenceExcludeReview settings/030-gate.md#gate-hinge-capability #6e34234 Compared settings/030-gate.md#gate-hinge-capability with "Cue review samples {#soloist-cue-review-samples}" and the named owner; confirmed that the current motion catalogue deliberately leaves the authorized gate hinge without a motion because the film holds it shut.
@evidenceExclude settings/040-plaza.md#plaza-background-role Motion design changes state over time and leaves the fixed background role to model and shot composition.
@evidenceExcludeReview settings/040-plaza.md#plaza-background-role #992c6f4 Compared settings/040-plaza.md#plaza-background-role with "Cue review samples {#soloist-cue-review-samples}" and the named owner; confirmed that motion design changes state over time and leaves the fixed background role to model and shot composition.
@evidenceExclude settings/050-art-direction.md#art-palette-scale Motion design preserves but does not allocate the model palette or shared scale grammar.
@evidenceExcludeReview settings/050-art-direction.md#art-palette-scale #958a50f Compared settings/050-art-direction.md#art-palette-scale with "Cue review samples {#soloist-cue-review-samples}" and the named owner; confirmed that motion design preserves but does not allocate the model palette or shared scale grammar.
@evidenceExclude settings/050-art-direction.md#art-effects-audio-absence The current motions emit no effect or audio channel and leave the fixed haze and silence boundary to shot composition.
@evidenceExcludeReview settings/050-art-direction.md#art-effects-audio-absence #c799fa1 Compared settings/050-art-direction.md#art-effects-audio-absence with "Cue review samples {#soloist-cue-review-samples}" and the named owner; confirmed that the current motions emit no effect or audio channel and leave the fixed haze and silence boundary to shot composition.
-->

Inspect seconds 0, 1, 2, and the final time in front and three-quarter model views. Fail if progress is non-monotonic, the upper arm has not reached 110 degrees at 2 seconds, the final pose differs from the 2-second pose, the lower arm differs from 25 degrees, any unlisted joint changes, or the root moves.
