# Blocking

`block` gates one beat's shot plan: who does what, where, with which camera, on what timing. It is the meso layer between the staged scene and the compiled performance.

## Contract

- **Resident-or-explicit:** omit `script` AND `staged` together and the beat blocks against the resident project's committed script and scene, a long production stops re-sending the staged scene every beat. Passing one without the other is refused (which scene would the beat block over?). The explicit pair stays a pure transform.
- The beat must exist in the committed script, and the shot duration must be positive.
- The camera node must be staged, and what a camera intent favours (`camera.on`, `coverage[].on`) must be a staged placement: an actor, a set piece, or another camera. That is the same table the performance stage resolves a frame subject against, so a plan `block` accepts is a plan `perform` can realize.
- **Timing anchors are the causal order.** Every anchor sits within `[0, duration]` and the list is non-decreasing: the arrow looses before it hits, the push lands before the fall. The engine checks the arithmetic; you own the causality.

## Camera Coverage

`camera` is the beat's hero angle, and the performance elects exactly one live camera per shot. To cover the same beat from more angles, stage those cameras first and name them in `coverage`: each entry is an ordinary camera intent (framing, move, `on`) plus the staged camera that plays it. A coverage camera must be staged, must appear once, and must not be the camera the performance elects as live. `perform` compiles every coverage intent into an alternate take on the shot's `coverage`, each playing its angle across the whole beat, so a render host can cut between angles of one performed beat without performing it again. Omit `coverage` for a single-camera beat.

## Continuity Across Beats

`getShotEndState` derives a resumable end-state from the beat's performed shot, end pose, folded world transform, root velocity, gait phase, and mounts, and `commitBeatEnd` persists it, so continuity is engine-derived, never hand-authored. Read the previous beat's end state with `getBeatEnd` and pass it as `block`'s `previous`: the engine gates that every carried actor is a staged node and surfaces the validated state on the success, so the next beat blocks as a continuation, start actors where they ended, keep a walking character mid-stride instead of resetting the cycle, keep a rider mounted. Omit `previous` only for the first beat or an intentional hard reset. Continuity is data, not vibes.

## Coherence

When the performance is compiled with the blocking attached, every timing anchor must actually be performed, a planned-but-missing action violates. Plan only what the performance will deliver, and deliver everything you planned.
