<!--
@evidence principles/common.md#purpose-fit Defines the deterministic translated formation hold needed after the opening advance and throughout the answer.
@evidenceReview principles/common.md#purpose-fit #403e074 Compared principles/common.md#purpose-fit with "complete 025-chorus-hold.md document"; confirmed that defines the deterministic translated formation hold needed after the opening advance and throughout the answer.
@evidence principles/common.md#layer-boundary Owns the constant formation state over supplied seconds without redefining the group, deciding its dramatic meaning, or selecting a camera.
@evidenceReview principles/common.md#layer-boundary #cfb2a7f Compared principles/common.md#layer-boundary with "complete 025-chorus-hold.md document"; confirmed that owns the constant formation state over supplied seconds without redefining the group, deciding its dramatic meaning, or selecting a camera.
@evidence principles/common.md#declared-basis Inherits the 2 m endpoint from the reviewed advance and labels the hold as an authored motion record rather than missing animation.
@evidenceReview principles/common.md#declared-basis #4a10eec Compared principles/common.md#declared-basis with "complete 025-chorus-hold.md document"; confirmed that inherits the 2 m endpoint from the reviewed advance and labels the hold as an authored motion record rather than missing animation.
@evidence principles/motions.md#state-endpoints Uses identical entry and exit states at the advance endpoint with unit spacing and unchanged facing.
@evidenceReview principles/motions.md#state-endpoints #fe3ff71 Compared principles/motions.md#state-endpoints with "complete 025-chorus-hold.md document"; confirmed that uses identical entry and exit states at the advance endpoint with unit spacing and unchanged facing.
@evidence principles/motions.md#temporal-phases Defines one linear constant phase from finite ordered start through end seconds.
@evidenceReview principles/motions.md#temporal-phases #65f41d5 Compared principles/motions.md#temporal-phases with "complete 025-chorus-hold.md document"; confirmed that defines one linear constant phase from finite ordered start through end seconds.
@evidence principles/motions.md#spatial-relation Holds the formation root 2 m forward on its own Z axis, at ground height, without changing interval channels.
@evidenceReview principles/motions.md#spatial-relation #d8786a8 Compared principles/motions.md#spatial-relation with "complete 025-chorus-hold.md document"; confirmed that holds the formation root 2 m forward on its own Z axis, at ground height, without changing interval channels.
@evidence principles/motions.md#parameter-domain Requires non-empty identities and finite `start < end`; position, facing, and spacing are not caller-variable.
@evidenceReview principles/motions.md#parameter-domain #d76f614 Compared principles/motions.md#parameter-domain with "complete 025-chorus-hold.md document"; confirmed that requires non-empty identities and finite `start < end`; position, facing, and spacing are not caller-variable.
-->

# CHORUS translated hold motion

## Advanced formation hold {#chorus-advanced-hold}

<!--
@evidence settings/000-governing-aim.md#delivery-contract Uses seconds and the shared formation frame across the continuous scene boundary.
@evidenceReview settings/000-governing-aim.md#delivery-contract #28c4cbc Compared settings/000-governing-aim.md#delivery-contract with "Advanced formation hold {#chorus-advanced-hold}"; confirmed that uses seconds and the shared formation frame across the continuous scene boundary.
@evidence settings/020-chorus.md#chorus-hold-capability Preserves the ordered group without drift at the completed 2 m advance.
@evidenceReview settings/020-chorus.md#chorus-hold-capability #3a5ff68 Compared settings/020-chorus.md#chorus-hold-capability with "Advanced formation hold {#chorus-advanced-hold}"; confirmed that preserves the ordered group without drift at the completed 2 m advance.
@evidence models/020-chorus.md#chorus-formation-representation Drives only the reviewed formation state channels and preserves member layout.
@evidenceReview models/020-chorus.md#chorus-formation-representation #fa5f1f2 Compared models/020-chorus.md#chorus-formation-representation with "Advanced formation hold {#chorus-advanced-hold}"; confirmed that drives only the reviewed formation state channels and preserves member layout.
@evidence models/020-chorus.md#chorus-member-tier-representation Selects the reviewed `walk` take explicitly; zero traveled ground freezes its current per-slot phase within this shot instead of advancing another cycle.
@evidenceReview models/020-chorus.md#chorus-member-tier-representation #8993be3 Compared models/020-chorus.md#chorus-member-tier-representation with "Advanced formation hold {#chorus-advanced-hold}"; confirmed that selects the only gait in every tier's reviewed walk profile and advances no per-slot cadence while ground distance remains zero.
@evidence obligations/motions.md#time-base Uses finite ordered seconds and a constant linear mapping across the hold.
@evidenceReview obligations/motions.md#time-base #7a08917 Compared obligations/motions.md#time-base with "Advanced formation hold {#chorus-advanced-hold}"; confirmed that uses finite ordered seconds and a constant linear mapping across the hold.
@evidence obligations/motions.md#composition-interruption Accepts the exact endpoint emitted by the advance in the same or preceding shot and hands the same state to delivery end; concurrent channel writers are unsupported.
@evidenceReview obligations/motions.md#composition-interruption #ca0e4d5 Compared obligations/motions.md#composition-interruption with "Advanced formation hold {#chorus-advanced-hold}"; confirmed that accepts the exact endpoint emitted by the advance in the same or preceding shot and hands the same state to delivery end; concurrent channel writers are unsupported.
-->

Given non-empty motion and formation ids and finite `start < end`, emit a linear formation motion whose entry and exit are both translation `{0, 0, -2}`, facing offset zero, and lateral and depth spacing scales one. Select `walk` explicitly as the reviewed member take; because the formation covers zero ground, its cadence does not advance within the hold. The repeated endpoint makes every authored held interval explicit, whether it follows the advance in one shot or carries that endpoint through the next. Per-member gait phase is seeded independently when a new shot starts and is not claimed as a transported formation channel.

## Hold review samples {#chorus-hold-review-samples}

<!--
@evidence settings/040-plaza.md#plaza-ground-landmark Keeps every member at the completed contained position on the level surface.
@evidenceReview settings/040-plaza.md#plaza-ground-landmark #196da0d Compared settings/040-plaza.md#plaza-ground-landmark with "Hold review samples {#chorus-hold-review-samples}"; confirmed that keeps every member at the completed contained position on the level surface.
@evidence settings/050-art-direction.md#art-delivery-review-condition Judges the sustained formation position and intervals at the delivered widest view.
@evidenceReview settings/050-art-direction.md#art-delivery-review-condition #c9d7e44 Compared settings/050-art-direction.md#art-delivery-review-condition with "Hold review samples {#chorus-hold-review-samples}"; confirmed that judges the sustained formation position and intervals at the delivered widest view.
@evidence obligations/motions.md#contact-policy Keeps the formation Y channel at zero and member gait ground relation unchanged throughout.
@evidenceReview obligations/motions.md#contact-policy #629e255 Compared obligations/motions.md#contact-policy with "Hold review samples {#chorus-hold-review-samples}"; confirmed that keeps the formation Y channel at zero and member gait ground relation unchanged throughout.
@evidence obligations/motions.md#motion-review-set Defines first, midpoint, final, and repeated-final samples of translation, facing, spacing, and footprint bounds.
@evidenceReview obligations/motions.md#motion-review-set #73dc11d Compared obligations/motions.md#motion-review-set with "Hold review samples {#chorus-hold-review-samples}"; confirmed that defines first, midpoint, final, and repeated-final samples of translation, facing, spacing, and footprint bounds.
-->

Inspect first, midpoint, final, and repeated-final samples in front, side, and elevated views. Fail if any sampled channel changes, the translated endpoint differs from the advance endpoint, formation bounds leave the ground, or the final replay differs.
