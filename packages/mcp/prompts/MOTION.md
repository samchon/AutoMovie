# Motion Handbook

Motion communicates intention through timing, weight, trajectory, pose, contact, gaze, and expression. Author a playable verb and its state change, not a bag of keyframes.

## Define the action

Write one active phrase: braces against recoil, notices and turns, advances while preserving line, reaches then withdraws. Specify subject, object or target, initial state, decisive event, final state, duration, and continuity obligations.

Break it into functional phases:

1. preparation or anticipation;
2. initiation;
3. acceleration and travel;
4. contact, impact, or decision;
5. follow-through;
6. settle or resumable end state.

Not every action needs an exaggerated anticipation, but every forceful change needs a readable cause. Preserve the exact semantic-event time used by shot and sound contracts.

## Pose construction

Start from pelvis or mechanical root, then support, torso, head/gaze, limbs, and secondary parts. Build a clear line of action and asymmetric intent while preserving balance. Plant contacts in world space when the story says they are fixed. Keep center of mass plausible over the support region unless falling, jumping, or external force explains otherwise.

For locomotion, coordinate root travel with step length, cadence, foot phase, and heading. Sliding feet indicate disagreement between the clip and root path. For a formation, derive repeated motion from formation state and hero exceptions rather than keyframing every unit independently.

## Timing and spacing

Key important changes, then choose interpolation. Ease when force ramps; use sharper timing for impact or mechanical stops. Arcs should follow anatomy or mechanism. Heavier objects accelerate and settle differently from light ones. Holds are active choices: preserve breath, gaze, tension, and small secondary motion without corrupting required contacts.

Sample the exact production frame grid. Very short actions can disappear between frames; very dense keys can create noise without adding control. Verify angular velocity, reach, distance, contact, and bounds through deterministic engine functions.

External motion remains an explicit adoption decision. The user or delegated authoring agent chooses the registered source asset, exact take, direct or humanoid-retarget mode, target actor, bone mapping, root policy, contact policy, trim, and layering. AutoMovie validates and applies that record without choosing a motion library, provider, take, target, or fallback mapping. If the chosen source cannot satisfy its declared channels, rig, contacts, or rights, keep the refusal and ask the decision owner to revise the record; do not substitute a similar clip or silently reinterpret the source.

## Face and gaze

Gaze leads attention, confirms target relation, and connects reaction to cause. Coordinate eyes, head, torso, and timing instead of rotating only one layer. Expressions transition from a neutral or prior state, peak around meaningful events, and settle deliberately. Use available expression channels; do not invent facial capability absent from the asset.

Dialogue mouth motion follows final decoded audio and its adopted alignment when available. The user or delegated authoring agent chooses any recorded or synthesized voice source and, when applicable, its provider, model, version, and voice; no guide supplies a provider default. Mouth motion stays on the speaker's emission interval even when propagation makes the listener hear the line later. Even spacing characters across a caption interval is not speech synchronization, and missing alignment remains `unsupported` or `not-run` rather than guessed visemes.

## Contact and reaction

At grip, footfall, collision, or impact, inspect both bodies and their relative velocity. Preserve hand-to-object, foot-to-ground, and weapon-to-shoulder contacts across interpolation. Engine collision and timing results are facts. Default reactions derived from them are hints; you may author a stronger or subtler reaction when story, training, surprise, or style warrants it, but declare the variation and keep physical causality legible.

## Continuity

The end state is part of the clip contract. Record pose, position, facing, held objects, gait phase, expression, and unresolved momentum needed by the next shot. Match-on-action requires compatible direction and phase across both source intervals, not identical clip names.

## Review

Watch at speed, half speed, and frame step. Look for foot slide, penetration, float, instant acceleration, broken arcs, joint flips, contact drift, eye pops, frozen holds, and mismatched settle. Then judge the dramatic verb: correct mechanics that communicate the wrong intention are still a failed motion.
