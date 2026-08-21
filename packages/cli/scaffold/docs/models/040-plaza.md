<!--
@evidence principles/common.md#purpose-fit Specifies the deterministic world pieces that realize level ground, the shared landmark, and the deliberately authored low-contrast atmosphere.
@evidenceReview principles/common.md#purpose-fit #403e074 Compared principles/common.md#purpose-fit with "complete 040-plaza.md document"; confirmed that specifies the deterministic world pieces that realize level ground, the shared landmark, and the deliberately authored low-contrast atmosphere.
@evidence principles/common.md#layer-boundary Owns world surfaces, landmark records, effect region, and derived extent while leaving narrative blocking and dramatic camera or light choices downstream.
@evidenceReview principles/common.md#layer-boundary #cfb2a7f Compared principles/common.md#layer-boundary with "complete 040-plaza.md document"; confirmed that owns world surfaces, landmark records, effect region, and derived extent while leaving narrative blocking and dramatic camera or light choices downstream.
@evidence principles/common.md#declared-basis Marks the one-metre ground margin, landmark radius, effect seeds, bounds, and particle parameters as chosen blocking values and derives extent from formation reach.
@evidenceReview principles/common.md#declared-basis #4a10eec Compared principles/common.md#declared-basis with "complete 040-plaza.md document"; confirmed that marks the one-metre ground margin, landmark radius, effect seeds, bounds, and particle parameters as chosen blocking values and derives extent from formation reach.
@evidence principles/models.md#representation-contract Declares ground, landmark, and haze as composable world pieces and states that haze is an effect proxy rather than physical architecture.
@evidenceReview principles/models.md#representation-contract #b6d1be6 Compared principles/models.md#representation-contract with "complete 040-plaza.md document"; confirmed that declares ground, landmark, and haze as composable world pieces and states that haze is an effect proxy rather than physical architecture.
@evidence principles/models.md#spatial-convention Fixes the world origin, level surface height, square extent derivation, landmark radius, and effect bounds in metres.
@evidenceReview principles/models.md#spatial-convention #276a4af Compared principles/models.md#spatial-convention with "complete 040-plaza.md document"; confirmed that fixes the world origin, level surface height, square extent derivation, landmark radius, and effect bounds in metres without claiming a motion-writable interface.
@evidence principles/models.md#reviewable-structure Names ground containment, origin alignment, silhouette-safe haze, and absent enclosure as the neutral world checks.
@evidenceReview principles/models.md#reviewable-structure #0cda6e1 Compared principles/models.md#reviewable-structure with "complete 040-plaza.md document"; confirmed that names ground containment, origin alignment, silhouette-safe haze, and absent enclosure as the neutral world checks.
-->

# PLAZA model

## World composition {#plaza-world-composition}

<!--
@evidence settings/000-governing-aim.md#delivery-contract Uses the shared right-handed metre convention, positive Y up, and `plaza-center` origin for every world piece.
@evidenceReview settings/000-governing-aim.md#delivery-contract #28c4cbc Compared settings/000-governing-aim.md#delivery-contract with "World composition {#plaza-world-composition}"; confirmed that uses the shared right-handed metre convention, positive Y up, and `plaza-center` origin for every world piece.
@evidence settings/040-plaza.md#plaza-ground-landmark Builds one level square surface and one landmark record at the chosen world origin, with extent derived from chorus reach plus one metre of margin.
@evidenceReview settings/040-plaza.md#plaza-ground-landmark #196da0d Compared settings/040-plaza.md#plaza-ground-landmark with "World composition {#plaza-world-composition}"; confirmed that builds one level square surface and one landmark record at the chosen world origin, with extent derived from chorus reach plus one metre of margin.
@evidence obligations/models.md#reference-scale Sizes containment and landmark readability against the formation and shared 1.8 m human reference rather than pixels.
@evidenceReview obligations/models.md#reference-scale #d2b4b4b Compared obligations/models.md#reference-scale with "World composition {#plaza-world-composition}"; confirmed that sizes containment and landmark readability against the formation and shared 1.8 m human reference rather than pixels.
-->

Compose `starter-world` from a level walkable square `ground`, the `plaza-center` landmark at `{0, 0, 0}` with a chosen 3 m readable radius, and the authored haze effect region. Ground half-extent is the chorus formation reach plus a chosen 1 m margin; the same derived polygon supplies world design and rendered floor patches so the two surfaces cannot drift.

## Atmosphere proxy {#plaza-atmosphere-proxy}

<!--
@evidence settings/040-plaza.md#plaza-background-role Keeps the only atmospheric feature low contrast and behind the subjects so open ground continues to function as an uninterrupted silhouette field.
@evidenceReview settings/040-plaza.md#plaza-background-role #992c6f4 Compared settings/040-plaza.md#plaza-background-role with "Atmosphere proxy {#plaza-atmosphere-proxy}"; confirmed that keeps the only atmospheric feature low contrast and behind the subjects so open ground continues to function as an uninterrupted silhouette field.
@evidence settings/050-art-direction.md#art-palette-scale Uses exactly the neutral `#89918a` haze swatch and introduces no ground material swatch.
@evidenceReview settings/050-art-direction.md#art-palette-scale #958a50f Compared settings/050-art-direction.md#art-palette-scale with "Atmosphere proxy {#plaza-atmosphere-proxy}"; confirmed that the haze recipe uses exactly `#89918a` and the ground design publishes no authored material swatch.
@evidence settings/050-art-direction.md#art-effects-audio-absence Implements the starter's one declared effect with fixed recipes and seeds while retaining the explicit absence of audio.
@evidenceReview settings/050-art-direction.md#art-effects-audio-absence #c799fa1 Compared settings/050-art-direction.md#art-effects-audio-absence with "Atmosphere proxy {#plaza-atmosphere-proxy}"; confirmed that implements the starter's one declared effect with fixed recipes and seeds while retaining the explicit absence of audio.
@evidence obligations/models.md#representation-ceiling Classifies haze as a deterministic effect-zone proxy that may prove occupancy and contrast but not physically based atmosphere.
@evidenceReview obligations/models.md#representation-ceiling #b317608 Compared obligations/models.md#representation-ceiling with "Atmosphere proxy {#plaza-atmosphere-proxy}"; confirmed that classifies haze as a deterministic effect-zone proxy that may prove occupancy and contrast but not physically based atmosphere.
-->

Represent haze through smoke recipe `plaza-haze-smoke` with seed 1416 and effect zone `plaza-haze` with seed 7, not through geometry. The zone spans `{-4, 0.05, -8}` through `{4, 1.2, -2}` metres. Emit 40 particles per second with burst 64 for 4 seconds; use lifetime 2–4 seconds, size 0.25–0.8 m, color `#89918a`, opacity 0.12–0.38, wind `{0.18, 0, -0.08}`, rise 0.2, turbulence 0.15, alpha blending, a 256-particle ceiling, and 25 m LOD distance. These fixed low-contrast particles may prove deterministic atmosphere placement and contrast only; they do not claim weather simulation or volumetric fidelity.

## Neutral review views {#plaza-neutral-review-views}

<!--
@evidence settings/050-art-direction.md#art-delivery-review-condition Uses the delivery raster for silhouette checks while model inspection also verifies world bounds from neutral top and side views.
@evidenceReview settings/050-art-direction.md#art-delivery-review-condition #c9d7e44 Compared settings/050-art-direction.md#art-delivery-review-condition with "Neutral review views {#plaza-neutral-review-views}"; confirmed that uses the delivery raster for silhouette checks while model inspection also verifies world bounds from neutral top and side views.
@evidence obligations/models.md#model-review-set Completes the shared set with top, side, origin-marker, formation-bounds, and haze-bounds views of the world.
@evidenceReview obligations/models.md#model-review-set #9da18ef Compared obligations/models.md#model-review-set with "Neutral review views {#plaza-neutral-review-views}"; confirmed that completes the shared set with top, side, origin-marker, formation-bounds, and haze-bounds views of the world.
-->

Inspect a top view with ground and formation bounds, a side view proving zero-height contact, an origin-marker view, and a neutral delivery-raster view with haze active. Fail if the formation reaches the ground edge, world and render surfaces disagree, the landmark leaves the origin, haze crosses the subject silhouette threshold, or an enclosure appears.
