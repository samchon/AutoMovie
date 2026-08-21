<!--
@evidence principles/common.md#purpose-fit Defines the one reusable but unused-in-this-film interval-opening capability already declared by the chorus settings and model interface.
@evidenceReview principles/common.md#purpose-fit #403e074 Compared principles/common.md#purpose-fit with "complete 030-chorus-break.md document"; confirmed that defines the one reusable but unused-in-this-film interval-opening capability already declared by the chorus settings and model interface.
@evidence principles/common.md#layer-boundary Owns spacing-scale transition and validation while leaving any dramatic authorization, chosen scene scale, and ground-sizing consequence upstream.
@evidenceReview principles/common.md#layer-boundary #cfb2a7f Compared principles/common.md#layer-boundary with "complete 030-chorus-break.md document"; confirmed that owns spacing-scale transition and validation while leaving any dramatic authorization, chosen scene scale, and ground-sizing consequence upstream.
@evidence principles/common.md#declared-basis Labels uniform scaling and ease-out interpolation as chosen reusable mechanics; the caller's scale remains an explicit production choice.
@evidenceReview principles/common.md#declared-basis #4a10eec Compared principles/common.md#declared-basis with "complete 030-chorus-break.md document"; confirmed that labels uniform scaling and ease-out interpolation as chosen reusable mechanics; the caller's scale remains an explicit production choice.
@evidence principles/motions.md#state-endpoints Starts with unit lateral and depth spacing and ends with both set to the same caller-supplied scale while translation and facing remain fixed.
@evidenceReview principles/motions.md#state-endpoints #fe3ff71 Compared principles/motions.md#state-endpoints with "complete 030-chorus-break.md document"; confirmed that starts with unit lateral and depth spacing and ends with both set to the same caller-supplied scale while translation and facing remain fixed.
@evidence principles/motions.md#temporal-phases Maps finite ordered start and end seconds through one ease-out phase.
@evidenceReview principles/motions.md#temporal-phases #65f41d5 Compared principles/motions.md#temporal-phases with "complete 030-chorus-break.md document"; confirmed that maps finite ordered start and end seconds through one ease-out phase.
@evidence principles/motions.md#spatial-relation Expands intervals about the formation anchor on its own lateral and depth axes and requires the caller to verify resulting bounds against staged ground.
@evidenceReview principles/motions.md#spatial-relation #d8786a8 Compared principles/motions.md#spatial-relation with "complete 030-chorus-break.md document"; confirmed that expands intervals about the formation anchor on its own lateral and depth axes and requires the caller to verify resulting bounds against staged ground.
@evidence principles/motions.md#parameter-domain Requires a non-empty id, finite ordered seconds, and a finite scale greater than one; no per-axis or member-level variation is accepted.
@evidenceReview principles/motions.md#parameter-domain #d76f614 Compared principles/motions.md#parameter-domain with "complete 030-chorus-break.md document"; confirmed that requires a non-empty id, finite ordered seconds, and a finite scale greater than one; no per-axis or member-level variation is accepted.
-->

# CHORUS break motion

## Uniform interval break {#chorus-uniform-break}

<!--
@evidence settings/000-governing-aim.md#delivery-contract Uses seconds and the shared spatial convention but is not selected by either starter screenplay scene.
@evidenceReview settings/000-governing-aim.md#delivery-contract #28c4cbc Compared settings/000-governing-aim.md#delivery-contract with "Uniform interval break {#chorus-uniform-break}"; confirmed that uses seconds and the shared spatial convention but is not selected by either starter screenplay scene.
@evidence settings/020-chorus.md#chorus-break-capability Implements the explicitly exposed uniform break while preserving the prohibitions on rerouting, unequal axis scales, and member-level exceptions.
@evidenceReview settings/020-chorus.md#chorus-break-capability #84105c2 Compared settings/020-chorus.md#chorus-break-capability with "Uniform interval break {#chorus-uniform-break}"; confirmed that implements the explicitly exposed uniform break while preserving the prohibitions on rerouting, unequal axis scales, and member-level exceptions.
@evidence models/020-chorus.md#chorus-formation-representation Drives only the formation's two spacing-scale channels and retains its root and facing.
@evidenceReview models/020-chorus.md#chorus-formation-representation #fa5f1f2 Compared models/020-chorus.md#chorus-formation-representation with "Uniform interval break {#chorus-uniform-break}"; confirmed that drives only the formation's two spacing-scale channels and retains its root and facing.
@evidence models/020-chorus.md#chorus-member-tier-representation Selects the reviewed `walk` take explicitly while acknowledging that spacing deformation contributes no root-travel cadence in the blocking renderer.
@evidenceReview models/020-chorus.md#chorus-member-tier-representation #8993be3 Compared models/020-chorus.md#chorus-member-tier-representation with "Uniform interval break {#chorus-uniform-break}"; confirmed that selects the only gait in every tier's reviewed walk profile while spacing deformation contributes no root-travel cadence.
@evidence obligations/motions.md#time-base Uses finite start and end seconds with normalized ease-out progress over their positive interval.
@evidenceReview obligations/motions.md#time-base #7a08917 Compared obligations/motions.md#time-base with "Uniform interval break {#chorus-uniform-break}"; confirmed that uses finite start and end seconds with normalized ease-out progress over their positive interval.
@evidence obligations/motions.md#composition-interruption Starts only from the authored unit-spacing state and must hand its final scale explicitly to any following motion; concurrent spacing writers are unsupported.
@evidenceReview obligations/motions.md#composition-interruption #ca0e4d5 Compared obligations/motions.md#composition-interruption with "Uniform interval break {#chorus-uniform-break}"; confirmed that starts only from the authored unit-spacing state and must hand its final scale explicitly to any following motion; concurrent spacing writers are unsupported.
@evidenceExclude models/030-gate.md#gate-blocking-representation The current motion catalogue contains no gate transition and therefore consumes none of its blocking geometry.
@evidenceExcludeReview models/030-gate.md#gate-blocking-representation #1e3238b Compared models/030-gate.md#gate-blocking-representation with "Uniform interval break {#chorus-uniform-break}" and the named owner; confirmed that the current motion catalogue contains no gate transition and therefore consumes none of its blocking geometry or finish.
@evidenceExclude models/030-gate.md#gate-hinge-interface The film deliberately holds the gate shut, so no authored motion claims its hinge interface.
@evidenceExcludeReview models/030-gate.md#gate-hinge-interface #2837adc Compared models/030-gate.md#gate-hinge-interface with "Uniform interval break {#chorus-uniform-break}" and the named owner; confirmed that the film deliberately holds the gate shut, so no authored motion claims its hinge interface.
@evidenceExclude models/030-gate.md#gate-neutral-review-views Gate review remains entirely model-owned while no gate motion exists.
@evidenceExcludeReview models/030-gate.md#gate-neutral-review-views #2abe499 Compared models/030-gate.md#gate-neutral-review-views with "Uniform interval break {#chorus-uniform-break}" and the named owner; confirmed that gate finish, articulation, and view review remain entirely model-owned while no gate motion exists.
-->

Given non-empty motion and formation ids, finite `start < end`, and a finite uniform scale greater than one, emit one ease-out formation motion from lateral and depth scales `{1, 1}` to `{scale, scale}`. Translation and facing remain zero and the cue selects `walk` explicitly. The current blocking renderer derives cadence from formation-root travel, so spacing deformation does not synthesize member foot travel; a consuming production must treat that visible slide as part of the prototype ceiling or author a different supported representation. Because the scale is selected by the consumer rather than this reusable design, its storyline and scenario or its direct brief must authorize the delivered event and prove the expanded footprint remains on staged ground.

## Break review samples {#chorus-break-review-samples}

<!--
@evidence settings/040-plaza.md#plaza-ground-landmark Uses the staged ground extent as the external containment oracle rather than pretending this reusable motion can pre-author every future scale.
@evidenceReview settings/040-plaza.md#plaza-ground-landmark #196da0d Compared settings/040-plaza.md#plaza-ground-landmark with "Break review samples {#chorus-break-review-samples}"; confirmed that uses the staged ground extent as the external containment oracle rather than pretending this reusable motion can pre-author every future scale.
@evidence settings/050-art-direction.md#art-delivery-review-condition Judges interval opening and preserved group identity at the delivery raster after numeric samples pass.
@evidenceReview settings/050-art-direction.md#art-delivery-review-condition #c9d7e44 Compared settings/050-art-direction.md#art-delivery-review-condition with "Break review samples {#chorus-break-review-samples}"; confirmed that judges interval opening and preserved group identity at the delivery raster after numeric samples pass.
@evidence obligations/motions.md#contact-policy Keeps member roots related to the same level surface while changing their plan positions; any out-of-bounds member fails the consuming production.
@evidenceReview obligations/motions.md#contact-policy #629e255 Compared obligations/motions.md#contact-policy with "Break review samples {#chorus-break-review-samples}"; confirmed that keeps member roots related to the same level surface while changing their plan positions; any out-of-bounds member fails the consuming production.
@evidence obligations/motions.md#motion-review-set Defines start, midpoint, end, footprint-bound, and repeated-end samples in top and elevated views.
@evidenceReview obligations/motions.md#motion-review-set #73dc11d Compared obligations/motions.md#motion-review-set with "Break review samples {#chorus-break-review-samples}"; confirmed that defines start, midpoint, end, footprint-bound, and repeated-end samples in top and elevated views.
-->

Inspect start, midpoint, end, and repeated end samples from top and elevated views, and compare the end footprint with the consuming ground bounds. Fail if scale reverses, lateral and depth scales diverge, translation or facing changes, any member leaves the surface, member-level order changes, or repeated end state differs.
