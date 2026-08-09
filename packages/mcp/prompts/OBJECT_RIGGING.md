# Object and Rigging Handbook

Design the object as a readable form first, then as a hierarchy of controlled degrees of freedom. A technically valid skeleton cannot rescue an unrecognizable silhouette, and a beautiful static mesh cannot serve a shot if its required action has no representable articulation.

## Silhouette-first recipe

Collect front, side, three-quarter, and action references. Identify the few masses and negative spaces that survive at thumbnail size: torso-to-limb ratio, head shape, wheelbase, wing planform, handle opening, blade profile. Encode those before surface detail.

Establish real-world scale and a semantic local frame. Mark front, up, ground contact, center of mass, grip points, emission points, and interaction anchors. Test profiles from all required turntable angles. Thin parts need enough visual thickness and value contrast to survive target raster and outline treatment.

Use primitive recipes as bounded constructive geometry, not as an excuse for arbitrary piles of shapes. Each part should contribute identity, structure, articulation, collision, attachment, or material grouping.

## Hierarchy and pivots

Parent according to mechanical or anatomical motion. Put a pivot at the true hinge, axle, ball joint, or sliding axis. Freeze unintended transforms before binding. A door pivot belongs on the hinge line; a wheel axis passes through its hub; a human limb chain rotates about joint centers.

The classic arm-axis failure is a mesh modeled along one axis while the skeleton and rest-frame contract assume another. Never fix that with unexplained corrective rotations scattered through animation. Record the asset’s basis, retarget once, and verify named left/right chains in rest and extreme poses.

For humanoids, preserve a conventional hips-rooted hierarchy with stable left/right names and a documented T- or A-pose conversion. VRM 1.0 assets use meters, a right-handed Y-up coordinate system, and a normalized humanoid T-pose facing +Z; normalize external assets at ingest instead of leaking foreign conventions downstream.

## Profiles, traits, and controls

A skeleton names topology. A profile names semantic capability over that topology. A binding maps profile controls to actual nodes. Traits extend capability data for domain objects without placing executable behavior in the interface.

Expose controls an author can reason about: `doorOpen`, `wheelSteer`, `jawOpen`, not anonymous channel numbers. Define range, unit, neutral value, and driven relationships. Use constraints for physical limits and coupling. Use springs only where secondary motion is intended and bounded.

For handled objects, verify grip anchors, support-hand reach, sight line, and moving parts. For repeated objects, keep one asset identity and instance transforms; do not clone nearly identical geometry into separate semantic objects.

## Retargeting

Map semantic bone chains rather than assuming equal bone counts, names, orientations, or proportions. Establish the retarget pose explicitly. IK can preserve hand and foot contacts after proportional changes, but contact correction is a verification step, not an automatic guarantee.

Check:

- rest pose and local axes;
- parent-child continuity and nonzero bone lengths;
- left/right and front/back identity;
- joint limits across the required range of motion;
- hand, foot, wheel, and hinge contacts;
- skin collapse, twist distribution, and volume preservation;
- deterministic output under repeated sampling.

## Review recipe

Capture rest and range-of-motion turntables in beauty and relevant structural passes. Judge silhouette before detail, then hierarchy, pivots, limits, material separation, and every shot-required capability. A capability absent from the profile is not available just because a mesh visually suggests it.
