# Editing Handbook

Editing authors time and relation. The EDL is not a dump of every rendered shot; it is a deliberate selection of source intervals whose order, duration, transitions, and sound offsets create the film.

## Choose the cut

Start with the dramatic change. Cut when the outgoing image has delivered its value and the incoming image can redirect attention. Hold when anticipation, discomfort, observation, or performance needs duration. Remove time when no meaningful state changes.

Use Walter Murch's priority order when criteria conflict:

1. emotion;
2. story;
3. rhythm;
4. eye trace;
5. the two-dimensional screen plane;
6. three-dimensional spatial continuity.

Protect higher priorities first. This does not license arbitrary discontinuity: identify what a lower-rule break buys, ensure the viewer can still follow what matters, and declare it in style intent when the shot contract requires.

## Coverage selection

Choose the angle that best carries the current beat, not the angle that was hardest to produce. Alternate scale or point of view when it changes information or emotional access. Avoid cutting among near-duplicates that add no meaning.

Maintain action direction, pose phase, eyeline, prop state, light, and ambience across a continuous event. A cutaway can compress time or bridge a continuity gap only if it is narratively motivated and does not invent a contradictory state.

## Rhythm

Rhythm emerges from shot duration, internal movement, dialogue, sound envelope, and expectation. Fast cutting cannot rescue inert shots; a long take is not automatically contemplative. Shape acceleration and deceleration against the sequence's dramatic curve. Leave room before important information to focus attention and after it to register consequence.

Evaluate cuts at the exact reduced rational delivery frame rate and snap edits to that production frame grid. A decimal `fps` is only a display projection and must never be used to reconstruct a fractional clock. Map destination audio samples, WebVTT milliseconds, and MP4 ticks from the same integer frame boundaries with the shared nearest-half-up rule. Check source interval bounds, exact output frames, and transition overlap. A transition consumes time from both sides and must not erase the action or line it is meant to connect.

## EDL discipline

Each edit decision names the source shot, source offset, source duration, destination interval, transition, and audiovisual intent. Preserve source offsets for L-cuts, J-cuts, dialogue overlap, ambience continuity, and action matching. Do not retime a semantic event without updating acceptance and sound consequences.

Prefer a direct cut by default. Dissolve for relation, passage, memory, or tonal blend; fade for boundary or closure; motivated wipes or graphic matches only when their visible form serves the film. Transition variety is not a goal.

## Audio-led edits

Use a J-cut when incoming sound prepares or pulls the viewer into the next image. Use an L-cut when outgoing sound preserves reaction, continuity, or emotional residue. Keep dialogue intelligible and avoid phase or ambience jumps. Sound edits still obey source ownership and exact timeline offsets.

## Measure the boundary

Watching a cut tells you whether it reads. It does not tell you that the actor stands where the previous beat left them, because half a metre of drift at a wide angle is invisible and half a metre in the next close-up is the shot.

`validateFilmContinuity` walks a film's beats in playback order and compares each beat's opening state against the previous beat's end state, per actor: world position drift past `positionTolerance` metres, facing drift past `facingToleranceDeg` degrees, a persistent mount that was dropped or changed, and an actor missing entirely from the incoming opening. `validateContinuity` is the same comparison for one boundary you already hold both sides of.

Drift is advisory, never a gate. A hard cut may legitimately jump an actor to a new mark for a time skip or new blocking, so the finding names the actor, the offset, and the tolerance and leaves the decision with you. It rides `warnings` on a validation whose `success` is `true`, the same tier [Motion](motion.md) describes.

Order the beats by the timeline rather than by whatever order the compiled shots happen to enumerate in. A continuity check run over the wrong order reports drift between shots that never touch.

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";
import { validateFilmContinuity } from "@automovie/engine";

const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({ root: process.cwd() }),
);
const film = state.generated.film;
if (film === null) throw new Error("this production compiles no film timeline");
const validation = validateFilmContinuity({
  beats: film.segments.flatMap((segment) => {
    const compiled = state.generated.shots.get(segment.shot);
    return compiled === undefined
      ? []
      : [
          {
            beat: segment.shot,
            scene: compiled.scene,
            shot: compiled.shot,
            motions: compiled.motions,
          },
        ];
  }),
});
for (const violation of validation.success
  ? (validation.warnings ?? [])
  : validation.violations)
  console.log(violation.path, violation.expected);
```

## Review pass

Watch once without stopping for story and emotion, once with the frame ruler for continuity and event timing, and once listening without looking for dialogue, ambience, rhythm, and accidental silence. Inspect every boundary in both directions. Sequence review owns local cut logic; film review owns the accumulated pace and narrative completion.

## Look at the cut

An edit is judged across boundaries, so evidence is taken on both sides of each one.

1. `npm run preview` on the outgoing and incoming shots at the exact frames a cut joins, and one frame either side.
2. State what you saw of the local cut logic, and then of the whole assembly, in the evidence citations on the film source that claims the edit is realized.

Sequence review owns the boundary; film review owns the arc. Completing one never completes the other.
