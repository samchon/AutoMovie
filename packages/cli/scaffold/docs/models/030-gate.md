<!--
@evidence principles/common.md#purpose-fit Specifies the fixed frame, moving leaf, hinge, bounds, and blocking proxy needed to make the shut gate and any later authorized opening observable.
@evidenceReview principles/common.md#purpose-fit #403e074 Compared principles/common.md#purpose-fit with "complete 030-gate.md document"; confirmed that specifies the fixed frame, moving leaf, hinge, bounds, and blocking proxy needed to make the shut gate and any later authorized opening observable.
@evidence principles/common.md#layer-boundary Owns gate geometry and articulation while leaving the setting's narrative role, any opening motion, and camera presentation elsewhere.
@evidenceReview principles/common.md#layer-boundary #cfb2a7f Compared principles/common.md#layer-boundary with "complete 030-gate.md document"; confirmed that owns gate geometry and articulation while leaving the setting's narrative role, any opening motion, and camera presentation elsewhere.
@evidence principles/common.md#declared-basis Labels box geometry, thickness, post dimension, and 100-degree joint limit as chosen blocking values derived from settings width and human scale.
@evidenceReview principles/common.md#declared-basis #4a10eec Compared principles/common.md#declared-basis with "complete 030-gate.md document"; confirmed that labels box geometry, thickness, post dimension, and 100-degree joint limit as chosen blocking values derived from settings width and human scale.
@evidence principles/models.md#representation-contract Declares two primitive boxes as an explicit proxy and preserves the fixed-frame versus moving-leaf split a replacement asset must keep.
@evidenceReview principles/models.md#representation-contract #b6d1be6 Compared principles/models.md#representation-contract with "complete 030-gate.md document"; confirmed that declares two primitive boxes as an explicit proxy and preserves the fixed-frame versus moving-leaf split a replacement asset must keep.
@evidence principles/models.md#spatial-convention Fixes the ground-contact origin, frame-local hinge, positive-Y rotation, width, clearance, and staged edge relation.
@evidenceReview principles/models.md#spatial-convention #276a4af Compared principles/models.md#spatial-convention with "complete 030-gate.md document"; confirmed that fixes the ground-contact origin, frame-local hinge location, positive-Y rotation, width, clearance, and staged edge relation while leaving writable-interface ownership to the obligation.
@evidence principles/models.md#reviewable-structure Names the leaf-frame separation, hinge attachment, shut reading, clearance, and open silhouette that neutral views must prove.
@evidenceReview principles/models.md#reviewable-structure #0cda6e1 Compared principles/models.md#reviewable-structure with "complete 030-gate.md document"; confirmed that names the leaf-frame separation, hinge attachment, shut reading, clearance, and open silhouette that neutral views must prove.
-->

# GATE model

## Blocking representation {#gate-blocking-representation}

<!--
@evidence settings/030-gate.md#gate-identity-placement Represents one fixed frame and one leaf at human-traversable scale on the far plaza edge, and claims no wall or room.
@evidenceReview settings/030-gate.md#gate-identity-placement #64a3d40 Compared settings/030-gate.md#gate-identity-placement with "Blocking representation {#gate-blocking-representation}"; confirmed that represents one fixed frame and one leaf at human-traversable scale on the far plaza edge, and claims no wall or room.
@evidence settings/050-art-direction.md#art-palette-scale Uses exactly the supporting `#6f746e` GATE swatch so it cannot spend SOLOIST's reserved accent.
@evidenceReview settings/050-art-direction.md#art-palette-scale #958a50f Compared settings/050-art-direction.md#art-palette-scale with "Blocking representation {#gate-blocking-representation}"; confirmed that post and leaf share exactly `#6f746e` and introduce no competing swatch.
@evidence obligations/models.md#representation-ceiling Makes the two-box form an explicit blocking proxy that proves scale, leaf identity, hinge travel, and placement but not joinery or final architecture.
@evidenceReview obligations/models.md#representation-ceiling #b317608 Compared obligations/models.md#representation-ceiling with "Blocking representation {#gate-blocking-representation}"; confirmed that makes the two-box form an explicit blocking proxy that proves scale, leaf identity, hinge travel, and placement but not joinery or final architecture.
-->

Build `plaza-gate` from a fixed `post` box and moving `leaf` box. The leaf is 0.9 m wide, 0.06 m thick, and 2.1 m tall: its height derives from the 1.8 m human reference plus a chosen 0.3 m blocking clearance. The square post is 0.12 m wide and deep and shares the leaf height. Both parts bind one opaque dielectric `gate-finish` with sRGB base swatch `#6f746e`, metallic 0, roughness 0.82, no emission, and no texture. Stage the root on the far-edge z coordinate and derive x as half that edge's positive half extent, preserving the setting's screen-right sightline relation without embedding the current plaza size. Replacing the boxes is expected, but any replacement must preserve part identity, dimensions, ground contact, placement relation, finish zone, and articulation binding.

## Hinge interface {#gate-hinge-interface}

<!--
@evidence settings/030-gate.md#gate-hinge-capability Binds only the leaf to a frame-local vertical hinge with a zero-to-100-degree one-direction limit while the frame stays fixed.
@evidenceReview settings/030-gate.md#gate-hinge-capability #6e34234 Compared settings/030-gate.md#gate-hinge-capability with "Hinge interface {#gate-hinge-interface}"; confirmed that binds only the leaf to a frame-local vertical hinge with a zero-to-100-degree one-direction limit while the frame stays fixed.
@evidence obligations/models.md#articulation-ownership Assigns the named `swing` node and rotation channel as the only motion-writable interface.
@evidenceReview obligations/models.md#articulation-ownership #c4a2e99 Compared obligations/models.md#articulation-ownership with "Hinge interface {#gate-hinge-interface}"; confirmed that assigns the named `swing` node and rotation channel as the only motion-writable interface.
-->

Place the leaf's pivot on its hanging edge, use positive Y as the hinge axis, bind the leaf mesh to the named `swing` node, and constrain its rotation from the identity quaternion through 100 degrees. The prop root and frame remain motion-invariant.

## Neutral review views {#gate-neutral-review-views}

<!--
@evidence settings/040-plaza.md#plaza-ground-landmark Reviews the staged prop against level ground and the far-edge relation without turning that placement into model-local geometry.
@evidenceReview settings/040-plaza.md#plaza-ground-landmark #196da0d Compared settings/040-plaza.md#plaza-ground-landmark with "Neutral review views {#gate-neutral-review-views}"; confirmed that reviews the staged prop against level ground and the far-edge relation without turning that placement into model-local geometry.
@evidence obligations/models.md#model-review-set Adds front, side, top, shut, half-open, and fully-open views with a 1.8 m scale figure to the shared inspection set.
@evidenceReview obligations/models.md#model-review-set #9da18ef Compared obligations/models.md#model-review-set with "Neutral review views {#gate-neutral-review-views}"; confirmed that adds front, side, top, shut, half-open, and fully-open views with a 1.8 m scale figure to the shared inspection set.
-->

Inspect front, side, and top views at zero, 50, and 100 degrees beside the 1.8 m scale reference. Confirm that post and leaf retain the single `#6f746e` finish without emission or texture. Fail if that finish diverges between parts, the leaf detaches from the hinge, the frame moves, geometry penetrates at the shut pose, clearance becomes implausible for the reference figure, or a proxy view implies a surrounding structure the settings do not contain.
