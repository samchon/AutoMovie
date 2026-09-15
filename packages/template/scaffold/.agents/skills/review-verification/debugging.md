# Debugging

Start at the first authoritative disagreement among authored decisions, typed source, engine result, viewer state, and actual output. A visual symptom can originate upstream of the renderer.

## Triage

1. Read the complete diagnostic and its input, target, phase, and observed values.
2. Identify the semantic owner and real consuming function.
3. Reproduce the disagreement with the smallest current typed input.
4. Trace the same cause through every affected consumer and boundary case.
5. Correct the earliest owner, rerun its consumers, and repeat the affected observations.

Do not widen a tolerance, add a cast, swallow a refusal, or change several unrelated inputs to make a symptom disappear. A source viewer reports current compilation errors; a previous frame is not evidence that the new source works.

## Geometry and motion

Inspect coordinate basis, transform chains, local and world space, bounds, placement, pose, reach, contact, event time, and camera projection through the owning engine queries. Test the exact failing state and its neighbors. A broad bounding box is not triangle collision, and a compressed population sample is not every member.

Compare outgoing and incoming position, facing, pose, gaze, held objects, gait phase, event completion, sound tail, and source-time offset for continuity. Return an impossible motion or spatial condition to the design owner instead of compensating with a camera.

Use [Inspection](inspection.md) to identify a subject and its actual content before framing it. Use [Live viewing](live-viewing.md) to inspect the production's own source. A free camera can pass through geometry and an inspection section removes surfaces, so neither proves physical clearance or an audience shot.

## Runtime and media

Check actual source and input revision, renderer and graphics identity, camera, raster, frame clock, frame count, runtime, color, and audio conditions. Separate a failed host operation from invalid production content. Inspect actual media rather than labels or remembered results.

A repaint changes appearance, not deterministic structural authority. First establish geometry, motion, contact, camera, timing, and the required control views. Then inspect provider identity, fixed request parameters, references, and output without treating repeated rerolls as a diagnosis.

## Escalation

When a public package cannot express the requested behavior or contradicts its contract, preserve the exact revision, minimal typed input, expected and observed result, diagnostic, affected owner, and attempted supported path. Report that boundary rather than inventing a JSON store, monkey patch, or generated-output repair.

[Capture](capture.md) owns observation identity and [Production review](review.md) owns acceptance and downstream invalidation.
