<!--
@evidence principles/common.md#purpose-fit Specifies the deterministic figure representation and articulation interface needed to show the one followed subject and its raised hand.
@evidenceReview principles/common.md#purpose-fit #403e074 Compared principles/common.md#purpose-fit with "complete 010-soloist.md document"; confirmed that specifies the deterministic figure representation and articulation interface needed to show the one followed subject and its raised hand.
@evidence principles/common.md#layer-boundary Chooses geometry, hierarchy, dimensions, palette zone, and review views without redefining SOLOIST's identity or timing the cue.
@evidenceReview principles/common.md#layer-boundary #cfb2a7f Compared principles/common.md#layer-boundary with "complete 010-soloist.md document"; confirmed that chooses geometry, hierarchy, dimensions, palette zone, and review views without redefining SOLOIST's identity or timing the cue.
@evidence principles/common.md#declared-basis Identifies stick-figure dimensions, joint selection, and the camera eye reference as chosen blocking parameters derived against the 1.8 m settings height.
@evidenceReview principles/common.md#declared-basis #4a10eec Compared principles/common.md#declared-basis with "complete 010-soloist.md document"; confirmed that identifies stick-figure dimensions, joint selection, and the camera eye reference as chosen blocking parameters derived against the 1.8 m settings height.
@evidence principles/models.md#representation-contract Declares one generated articulated stick-figure recipe as a blocking proxy, states which observations it supports, and assigns its one shared body response to one material zone rather than implying independent adjoining finishes.
@evidenceReview principles/models.md#representation-contract #ba53360 Compared principles/models.md#representation-contract with "complete 010-soloist.md document"; confirmed that declares one generated articulated stick-figure recipe as a blocking proxy, states which observations it supports, and needs no separately owned adjoining response beyond its one shared body material zone.
@evidence principles/models.md#spatial-convention Fixes origin, local axes, occupied height, radii, and shoulder pivot in metres.
@evidenceReview principles/models.md#spatial-convention #276a4af Compared principles/models.md#spatial-convention with "complete 010-soloist.md document"; confirmed that fixes origin, local axes, occupied height, radii, and shoulder pivot in metres without assigning motion ownership through this rule.
@evidence principles/models.md#reviewable-structure Names the upright silhouette, accent zone, hand separation, and neutral review views that must remain visible.
@evidenceReview principles/models.md#reviewable-structure #0cda6e1 Compared principles/models.md#reviewable-structure with "complete 010-soloist.md document"; confirmed that names the upright silhouette, accent zone, hand separation, and neutral review views that must remain visible.
-->

# SOLOIST model

## Blocking representation {#soloist-blocking-representation}

<!--
@evidence settings/010-soloist.md#soloist-identity-scale Represents the one 1.8 m upright figure whose full silhouette and hand must remain readable.
@evidenceReview settings/010-soloist.md#soloist-identity-scale #5386f50 Compared settings/010-soloist.md#soloist-identity-scale with "Blocking representation {#soloist-blocking-representation}"; confirmed that represents the one 1.8 m upright figure whose full silhouette and hand must remain readable.
@evidence settings/050-art-direction.md#art-palette-scale Uses exactly the production's reserved saturated `#d7b56d` SOLOIST accent while leaving every support swatch to its own model.
@evidenceReview settings/050-art-direction.md#art-palette-scale #958a50f Compared settings/050-art-direction.md#art-palette-scale with "Blocking representation {#soloist-blocking-representation}"; confirmed that uses exactly the reserved `#d7b56d` SOLOIST accent and introduces no support swatch.
@evidence obligations/models.md#representation-ceiling Defines the shared ceiling as generated blocking geometry that proves silhouette, scale, placement, and articulation but not anatomy, cloth, facial acting, or photoreal surface response.
@evidenceReview obligations/models.md#representation-ceiling #b317608 Compared obligations/models.md#representation-ceiling with "Blocking representation {#soloist-blocking-representation}"; confirmed that defines the shared ceiling as generated blocking geometry that proves silhouette, scale, placement, and articulation but not anatomy, cloth, facial acting, or photoreal surface response.
@evidence obligations/models.md#reference-scale Establishes SOLOIST's chosen 1.8 m occupied height as the reference against which chorus and gate dimensions are checked.
@evidenceReview obligations/models.md#reference-scale #d2b4b4b Compared obligations/models.md#reference-scale with "Blocking representation {#soloist-blocking-representation}"; confirmed that establishes SOLOIST's chosen 1.8 m occupied height as the reference against which chorus and gate dimensions are checked.
-->

Build one `stickman` model recipe named `soloist` with 1.8 m occupied height, 0.16 m head radius, 0.06 m limb radius, a camera eye reference at 90 percent of occupied height, a single body material zone colored `#d7b56d`, and the semantic capability id `signal`. Its staged actor contribution supplies the runtime's required positive locomotion-rate field as a chosen 1.2 m/s, but this production authors no `locomote` action and that inert field grants no walking capability. This representation is a deliberate blocking proxy: it may prove figure scale, upright silhouette, hand separation, and planted placement, but it does not claim anatomy, cloth, face, hair, or final materials.

## Articulation interface {#soloist-articulation-interface}

<!--
@evidence settings/010-soloist.md#soloist-hand-capability Exposes only the left upper-arm abduction and lower-arm flexion channels needed to raise and hold one hand while the root remains planted.
@evidenceReview settings/010-soloist.md#soloist-hand-capability #92a349c Compared settings/010-soloist.md#soloist-hand-capability with "Articulation interface {#soloist-articulation-interface}"; confirmed that exposes only the left upper-arm abduction and lower-arm flexion channels needed to raise and hold one hand while the root remains planted.
@evidence obligations/models.md#articulation-ownership Assigns the stable skeleton, `leftUpperArm`, and `leftLowerArm` joints to model construction so motion changes poses without rebuilding geometry.
@evidenceReview obligations/models.md#articulation-ownership #c4a2e99 Compared obligations/models.md#articulation-ownership with "Articulation interface {#soloist-articulation-interface}"; confirmed that assigns the stable skeleton, `leftUpperArm`, and `leftLowerArm` joints to model construction so motion changes poses without rebuilding geometry.
-->

The compiler-built skeleton is the stable motion interface. It exposes `leftUpperArm` abduction and `leftLowerArm` flexion as the only channels available to the hand capability; the reviewed motion owns their numeric states and path. The root, other limbs, and model scale remain unavailable to this capability. Model-local positive Y is up and the root is at ground contact beneath the body centre.

## Neutral review views {#soloist-neutral-review-views}

<!--
@evidence settings/050-art-direction.md#art-delivery-review-condition Uses the delivery raster and widest-used-view threshold for the final legibility check while keeping diagnostic model views composition-neutral.
@evidenceReview settings/050-art-direction.md#art-delivery-review-condition #c9d7e44 Compared settings/050-art-direction.md#art-delivery-review-condition with "Neutral review views {#soloist-neutral-review-views}"; confirmed that uses the delivery raster and widest-used-view threshold for the final legibility check while keeping diagnostic model views composition-neutral.
@evidence obligations/models.md#model-review-set Establishes front, side, rear, and three-quarter neutral views at hand-down and hand-raised states, plus a 1.8 m scale marker, as the repeated model inspection set.
@evidenceReview obligations/models.md#model-review-set #9da18ef Compared obligations/models.md#model-review-set with "Neutral review views {#soloist-neutral-review-views}"; confirmed that establishes front, side, rear, and three-quarter neutral views at hand-down and hand-raised states, plus a 1.8 m scale marker, as the repeated model inspection set.
-->

Inspect front, side, rear, and three-quarter views against a neutral ground and a 1.8 m scale marker, once with the hand down and once with the hand raised. Fail the model if the hand merges into the torso, the feet do not meet the ground, the accent changes across views, or occupied height differs from 1.8 m beyond numeric tolerance.
