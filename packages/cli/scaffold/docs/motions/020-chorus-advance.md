<!--
@evidence principles/common.md#purpose-fit Defines the deterministic formation translation that makes the chorus visibly answer without losing its ordered identity.
@evidenceReview principles/common.md#purpose-fit #403e074 Compared principles/common.md#purpose-fit with "complete 020-chorus-advance.md document"; confirmed that defines the deterministic formation translation that makes the chorus visibly answer without losing its ordered identity.
@evidence principles/common.md#layer-boundary Owns the path, seconds, easing, and preserved channels without redefining spacing, deciding when a scene invokes it, or framing the result.
@evidenceReview principles/common.md#layer-boundary #cfb2a7f Compared principles/common.md#layer-boundary with "complete 020-chorus-advance.md document"; confirmed that owns the path, seconds, easing, and preserved channels without redefining spacing, deciding when a scene invokes it, or framing the result.
@evidence principles/common.md#declared-basis Takes the 2 m displacement from settings and labels ease-in-out timing as the chosen blocking interpolation.
@evidenceReview principles/common.md#declared-basis #4a10eec Compared principles/common.md#declared-basis with "complete 020-chorus-advance.md document"; confirmed that takes the 2 m displacement from settings and labels ease-in-out timing as the chosen blocking interpolation.
@evidence principles/motions.md#state-endpoints Starts at zero formation translation and unit spacing and ends 2 m forward with the same facing and spacing.
@evidenceReview principles/motions.md#state-endpoints #fe3ff71 Compared principles/motions.md#state-endpoints with "complete 020-chorus-advance.md document"; confirmed that starts at zero formation translation and unit spacing and ends 2 m forward with the same facing and spacing.
@evidence principles/motions.md#temporal-phases Maps the explicit start and end seconds through one ease-in-out phase with no hidden pre-roll or hold.
@evidenceReview principles/motions.md#temporal-phases #65f41d5 Compared principles/motions.md#temporal-phases with "complete 020-chorus-advance.md document"; confirmed that maps the explicit start and end seconds through one ease-in-out phase with no hidden pre-roll or hold.
@evidence principles/motions.md#spatial-relation Moves on the formation's forward axis while preserving ground height, facing, lateral spacing, and depth spacing.
@evidenceReview principles/motions.md#spatial-relation #d8786a8 Compared principles/motions.md#spatial-relation with "complete 020-chorus-advance.md document"; confirmed that moves on the formation's forward axis while preserving ground height, facing, lateral spacing, and depth spacing.
@evidence principles/motions.md#parameter-domain Requires a non-empty id and finite ordered start and end seconds; distance is design-owned and not caller-variable.
@evidenceReview principles/motions.md#parameter-domain #d76f614 Compared principles/motions.md#parameter-domain with "complete 020-chorus-advance.md document"; confirmed that requires a non-empty id and finite ordered start and end seconds; distance is design-owned and not caller-variable.
-->

# CHORUS advance motion

## Ordered advance {#chorus-ordered-advance}

<!--
@evidence settings/000-governing-aim.md#delivery-contract Uses seconds and the shared right-handed world convention.
@evidenceReview settings/000-governing-aim.md#delivery-contract #28c4cbc Compared settings/000-governing-aim.md#delivery-contract with "Ordered advance {#chorus-ordered-advance}"; confirmed that uses seconds and the shared right-handed world convention.
@evidence settings/020-chorus.md#chorus-group-identity Preserves one ordered group with readable rows, columns, and edges throughout translation.
@evidenceReview settings/020-chorus.md#chorus-group-identity #cfc06d1 Compared settings/020-chorus.md#chorus-group-identity with "Ordered advance {#chorus-ordered-advance}"; confirmed that preserves one ordered group with readable rows, columns, and edges throughout translation.
@evidence settings/020-chorus.md#chorus-advance-capability Implements the chosen 2 m whole-formation advance without altering rows, columns, member independence, or facing.
@evidenceReview settings/020-chorus.md#chorus-advance-capability #ea566f7 Compared settings/020-chorus.md#chorus-advance-capability with "Ordered advance {#chorus-ordered-advance}"; confirmed that implements the chosen 2 m whole-formation advance without altering rows, columns, member independence, or facing.
@evidence settings/040-plaza.md#plaza-ground-landmark Keeps translation on level PLAZA ground and inside the extent derived to contain it.
@evidenceReview settings/040-plaza.md#plaza-ground-landmark #196da0d Compared settings/040-plaza.md#plaza-ground-landmark with "Ordered advance {#chorus-ordered-advance}"; confirmed that keeps translation on level PLAZA ground and inside the extent derived to contain it.
@evidence models/020-chorus.md#chorus-formation-representation Drives only the formation root translation while holding both spacing-scale channels at one.
@evidenceReview models/020-chorus.md#chorus-formation-representation #fa5f1f2 Compared models/020-chorus.md#chorus-formation-representation with "Ordered advance {#chorus-ordered-advance}"; confirmed that drives only the formation root translation while holding both spacing-scale channels at one.
@evidence models/040-plaza.md#plaza-world-composition Uses the reviewed level ground and derived containment boundary as the transition's contact and bounds frame.
@evidenceReview models/040-plaza.md#plaza-world-composition #dc0afe8 Compared models/040-plaza.md#plaza-world-composition with "Ordered advance {#chorus-ordered-advance}"; confirmed that uses the reviewed level ground and derived containment boundary as the transition's contact and bounds frame.
@evidence models/020-chorus.md#chorus-member-tier-representation Selects the tier ladder's reviewed `walk` gait explicitly so member cadence follows traveled ground rather than export order.
@evidenceReview models/020-chorus.md#chorus-member-tier-representation #8993be3 Compared models/020-chorus.md#chorus-member-tier-representation with "Ordered advance {#chorus-ordered-advance}"; confirmed that selects the only gait in every tier's reviewed walk profile explicitly so member cadence follows traveled ground rather than export order.
@evidenceExclude models/020-chorus.md#chorus-neutral-review-views Model review owns static tier and layout views; this motion adds its own temporal samples.
@evidenceExcludeReview models/020-chorus.md#chorus-neutral-review-views #a9f6f94 Compared models/020-chorus.md#chorus-neutral-review-views with "Ordered advance {#chorus-ordered-advance}" and the named owner; confirmed that model review owns static tier and layout views; this motion adds its own temporal samples.
@evidence obligations/motions.md#time-base Uses finite start and end seconds with normalized ease-in-out progress over their positive interval.
@evidenceReview obligations/motions.md#time-base #7a08917 Compared obligations/motions.md#time-base with "Ordered advance {#chorus-ordered-advance}"; confirmed that uses finite start and end seconds with normalized ease-in-out progress over their positive interval.
@evidence obligations/motions.md#contact-policy Preserves formation Y at zero throughout so every member remains related to the level ground supplied by its model and gait.
@evidenceReview obligations/motions.md#contact-policy #629e255 Compared obligations/motions.md#contact-policy with "Ordered advance {#chorus-ordered-advance}"; confirmed that preserves formation Y at zero throughout so every member remains related to the level ground supplied by its model and gait.
-->

Given non-empty motion and formation ids and finite `start < end`, emit one ease-in-out formation motion from translation `{0, 0, 0}` to `{0, 0, -2}` in the formation frame. Select the reviewed `walk` gait explicitly; its cadence advances only from the two metres actually traveled. Facing offset remains zero and lateral and depth spacing scales remain one at both endpoints. The caller cannot override distance, gait, facing, or spacing through this motion.

## Advance review samples {#chorus-advance-review-samples}

<!--
@evidence settings/050-art-direction.md#art-delivery-review-condition Judges formation edges and the visible 2 m difference at the delivered widest view after numeric motion samples pass.
@evidenceReview settings/050-art-direction.md#art-delivery-review-condition #c9d7e44 Compared settings/050-art-direction.md#art-delivery-review-condition with "Advance review samples {#chorus-advance-review-samples}"; confirmed that judges formation edges and the visible 2 m difference at the delivered widest view after numeric motion samples pass.
@evidence obligations/motions.md#motion-review-set Defines start, midpoint, end, and one repeated end sample with root, facing, and spacing channels recorded.
@evidenceReview obligations/motions.md#motion-review-set #73dc11d Compared obligations/motions.md#motion-review-set with "Advance review samples {#chorus-advance-review-samples}"; confirmed that defines start, midpoint, end, and one repeated end sample with root, facing, and spacing channels recorded.
@evidence obligations/motions.md#composition-interruption Hands the exact final translation and unit spacing to a following hold; concurrent writes to those channels are unsupported by this starter.
@evidenceReview obligations/motions.md#composition-interruption #ca0e4d5 Compared obligations/motions.md#composition-interruption with "Advance review samples {#chorus-advance-review-samples}"; confirmed that hands the exact final translation and unit spacing to a following hold; concurrent writes to those channels are unsupported by this starter.
@evidenceExclude models/040-plaza.md#plaza-atmosphere-proxy The formation transition neither creates nor changes the fixed atmosphere proxy.
@evidenceExcludeReview models/040-plaza.md#plaza-atmosphere-proxy #bf7943e Compared models/040-plaza.md#plaza-atmosphere-proxy with "Advance review samples {#chorus-advance-review-samples}" and the named owner; confirmed that the formation transition neither creates nor changes the fixed atmosphere proxy.
@evidenceExclude models/040-plaza.md#plaza-neutral-review-views World construction owns static bounds and haze views; this motion reviews its path against the resulting bounds.
@evidenceExcludeReview models/040-plaza.md#plaza-neutral-review-views #a5bb28d Compared models/040-plaza.md#plaza-neutral-review-views with "Advance review samples {#chorus-advance-review-samples}" and the named owner; confirmed that world construction owns static bounds and haze views; this motion reviews its path against the resulting bounds.
-->

Inspect start, midpoint, end, and a repeated end sample from front, side, and elevated formation views. Fail if Z progress reverses, total displacement differs from 2 m, X or Y changes, facing changes, either spacing scale differs from one, ground contact drifts, or the repeated end sample differs.
