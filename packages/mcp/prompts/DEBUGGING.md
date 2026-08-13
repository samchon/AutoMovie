# Debugging Handbook

Debug from the first authoritative disagreement, not from the final unattractive frame. AutoMovie has distinct owners and gates; a symptom at review can originate in prose, design, source, compiler, engine, capture host, repaint adapter, renderer, media, or stale evidence.

## Triage order

1. Read the exact diagnostic code, target, phase, path, message, and returned data.
2. Identify the owner named by the diagnostic.
3. Reproduce with the smallest current input at that boundary.
4. Compare declared identity and actual bytes or values.
5. Correct the owner, then rebuild only the documented downstream chain.
6. Prepare fresh evidence; never reuse a stale receipt or worksheet.

Do not begin by deleting generated state, widening tolerances, adding casts, rerolling diffusion, or changing several layers at once. Those actions destroy evidence about cause.

## Ownership failures

If a generated digest, registry path, id, or fingerprint disagrees, stop consuming the output. Never edit compiler-owned files. Correct tracked design or source and run atomic compilation. If the project-state reader reports `project-state-changed`, wait only long enough to stop concurrent writers, then retry the read; do not treat either snapshot as current.

If a target is missing from the evidence registry, verify source binding, named export, design id, compile success, and production namespace. A plausible id in prose does not register an artifact.

## Geometry and motion failures

Reduce the question to engine facts: coordinate basis, transform chain, pose sample, reach, distance, formation slot, camera projection, contact, event time, or bounds. Inspect units and local/world conversion. Test the exact failing time and neighboring frames. Correct the earliest bad transform or contract, not the downstream pixel.

For continuity, compare outgoing and incoming state: position, facing, pose, gaze, held objects, gait phase, event completion, sound tail, and edit source offset.

When the authored camera is the reason you cannot see the fault, stop reasoning about the frame and go and look. The starter's `viewer/inspect.html?shot=<id>` opens the same compiled shot with the camera in your hands — fly with the arrow keys or W A S D, rise and descend with Space and C, click for pointer-lock mouse look — and prints the eye's position and lens on screen, so anything odd is reported by coordinate rather than by adjective. That is what makes it a debugging instrument: a staging fault hidden behind the shot camera, geometry that only reads wrong from an angle nobody authored, and a placement you believed rather than measured all become one observation. It installs no capture hook, writes nothing, holds the shot's opening second, and shows the level of detail your own distance selects, so it proves nothing on its own. Review evidence still comes from `npm run preview` and `npm run render`, and a coordinate you read there is a hypothesis to confirm against the engine query that owns it.

## Capture and render failures

Run the scaffold’s configured doctor or verify path. Check current compile identity, registered target, host runtime identity, decoded PNG/media facts, raster, frame rate, frame count, duration, and atomic manifest. `captured:false` means no evidence exists.

`generated-stale` is not one of these failures and no doctor or verify command clears it. `captureFrame`, `repaintShot`, and review all read compile status through a read-only lint that is built never to repair what it reports, so the tools can only keep refusing while the generated tree lags current design and source. Run the ordinary scaffold compile command, then capture again.

If a renderer produces bytes but the receipt gate rejects them, the bytes are not deliverable. Preserve the diagnostic, correct runtime or configuration, and regenerate.

## Repaint failures

First confirm that deterministic source and full beauty/control grid are correct. Then check reference authorization and digest, adapter identity, fixed parameters, output media facts, and input-race diagnostics. A reroll changes identity and requires review; repeated rerolls are not debugging unless one controlled variable and a falsifiable hypothesis are recorded.

## Review failures

Prepare again and use only returned current selectors, frames, outcomes, fingerprint, and criteria order. Resolve error diagnostics before composing prose. Distinguish a correction from an observation, and never set the final boolean true while a correction remains.

## Escalation record

When the root cause is a product boundary rather than authored content, record minimal input, exact current commit, production and target ids, expected and observed values, diagnostic, ownership trace, and why existing correction paths cannot resolve it. That evidence is suitable for a new issue; a screenshot and intuition are not.
