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

Dialogue mouth motion follows final decoded audio and its adopted alignment when available. The user or delegated authoring agent chooses any recorded or synthesized voice source and, when applicable, its provider, model, version, and voice; nothing here supplies a provider default. Mouth motion stays on the speaker's emission interval even when propagation makes the listener hear the line later. Even spacing characters across a caption interval is not speech synchronization, and missing alignment remains `unsupported` or `not-run` rather than guessed visemes.

## Contact and reaction

At grip, footfall, collision, or impact, inspect both bodies and their relative velocity. Preserve hand-to-object, foot-to-ground, and weapon-to-shoulder contacts across interpolation. Engine collision and timing results are facts. Default reactions derived from them are hints; you may author a stronger or subtler reaction when story, training, surprise, or style warrants it, but declare the variation and keep physical causality legible.

## Measure the contact you claimed

Foot slide, penetration, float, and a body that could not hold the pose it holds are measurable, and the engine measures them. Nothing measures them for you. Each check needs the contact semantics only the action knows, so a clip nobody annotated is a clip nobody checked, and a check that never ran looks exactly like a check that passed.

Declare what the action asserts, then ask the engine whether the clip keeps it.

- `validateGroundContact` sweeps feet, and whole-body capsule proxies when you give them, against a flat ground plane or a height source that answers a `y` for each `(x, z)`, so a hip through a ramp is found and not only a foot through a floor.
- `validateFootSkate` reads the time spans you declare a foot planted and reports the horizontal speed of a foot that was supposed to be still.
- `validateBalanceSupport` projects the segment-mass weighted centre of mass onto the support polygon your declared contact bones span, which is the check for a lean, a reach, or a one-foot balance. It derives that centre from the resolved pose itself, and `bodyCenterOfMass` is the same question asked of a model rather than a performer: the body's declared centre when it states one, the volume-weighted centroid of its primitives when it does not.
- `validateSelfIntersection` tests the capsule pairs you name as parts that may not meet, and pairing is explicit because adjacent limbs share joints and overlap legally.
- `detectBodyCollision` measures two actors against each other from their rigs, clips, capsules, and bodies, and returns the contact events and a suggested response at the deepest penetration alongside the warnings.

Every one of them is a warning tier, not a gate. A film may be deliberately unphysical, so a phasing ghost, a moonwalk, or a wire-fu freeze sets `physicsIntent` on the check and the matching warnings are suppressed, while malformed input (an unknown bone, a detached bone, a non-positive radius, an inverted window) stays an error.

Read the result accordingly. A physical implausibility rides `warnings` on a validation whose `success` is `true`, so code that branches on `success` alone reports a clean run over a clip whose planted foot travels half a metre.

Feed them from the record rather than from a constant. `spaceGround` adapts a space into the ground source the contact checks read, so a clip over a ramp or a platform is judged against the surfaces the production authored instead of a flat plane at zero, and `groundFunction` is the one place a scalar and a height callback become the same thing. `bodyCenterOfMass` answers a model's centre for the object-side of the same question `validateBalanceSupport` asks of a performer.

Two of the answers come with a correction, and neither applies itself. `plantStanceFeet` is the pass that removes skate: it detects stance, solves the leg back onto the pinned contact, and clamps the result into the rig's own range of motion, so a residual it cannot hold stays a warning rather than a silent edit. `detectBodyCollision` returns the response `suggestCollisionResponse` computes at the deepest contact, bounded by joint range of motion into a flinch. Both are hints; the authored reaction stays yours, and this document's contact section already says why a stronger or subtler one can be right.

These calls run in a project script under `scripts/`, never in shot source. They read a compiled clip, and a build function is the thing that produces one.

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";
import { validateFootSkate, validateGroundContact } from "@automovie/engine";
import type { IAutoMovieValidation } from "@automovie/interface";

/** Physical-plausibility feedback, whether the run succeeded or failed. */
const findings = (
  validation: IAutoMovieValidation,
): IAutoMovieValidation.IFailure["violations"] =>
  validation.success ? (validation.warnings ?? []) : validation.violations;

const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({ root: process.cwd() }),
);
const compiled = state.generated.shots.get("approach");
if (compiled === undefined) throw new Error('shot "approach" is not compiled');
for (const motion of compiled.motions) {
  const rigged = [...state.generated.models.values()].find(
    (model) => model.skeleton !== null && model.skeleton.id === motion.skeleton,
  );
  if (rigged === undefined || rigged.skeleton === null) continue;
  const checks = [
    validateGroundContact({ motion, skeleton: rigged.skeleton }),
    validateFootSkate({
      motion,
      skeleton: rigged.skeleton,
      contacts: [{ bone: "leftFoot", start: 0, end: 0.4 }],
    }),
  ];
  for (const violation of checks.flatMap(findings))
    console.log(motion.id, violation.severity, violation.path, violation.expected);
}
```

Sampling decides what can be seen. Each check samples on its own clock rather than on your keyframes, so a contact shorter than one sample interval falls between samples, and a rate far above the delivery frame rate buys precision the frame never shows.

## Continuity

The end state is part of the clip contract. Record pose, position, facing, held objects, gait phase, expression, and unresolved momentum needed by the next shot. Match-on-action requires compatible direction and phase across both source intervals, not identical clip names.

## Review

Watch at speed, half speed, and frame step. Look for foot slide, penetration, float, instant acceleration, broken arcs, joint flips, contact drift, eye pops, frozen holds, and mismatched settle. Then judge the dramatic verb: correct mechanics that communicate the wrong intention are still a failed motion.

## Look at the motion

Reading a clip's numbers is not watching it move. Capture the frames the fault would be on rather than the frames that happen to be convenient.

1. `captureProductionFrame` on the shot target at each contact, each extreme, and one frame either side of the moment the fault would appear. Foot slide, penetration, and contact drift are visible in adjacent frames and invisible in one.
2. `captureProductionFrame` with the `pose` structural pass when the question is skeletal rather than pictorial.
3. State what the motion actually did, in the evidence citation on the source that owns it. A verdict nobody can trace to a frame is not one.

A shot contract's declared review times are the floor, not the whole answer. Add the times this motion makes decisive.
