# Blocking

`block` gates one beat's shot plan: who does what, where, with which camera, on what timing. It is the meso layer between the staged scene and the compiled performance.

## Contract

- The beat must exist in the committed script, and the shot duration must be positive.
- The camera node must be staged.
- **Timing anchors are the causal order.** Every anchor sits within `[0, duration]` and the list is non-decreasing: the arrow looses before it hits, the push lands before the fall. The engine checks the arithmetic; you own the causality.

## Continuity Across Beats

`getShotEndState` derives a resumable end-state from the beat's performed shot — end pose, folded world transform, root velocity, gait phase, and mounts — and `commitBeatEnd` persists it, so continuity is engine-derived, never hand-authored. Read the previous beat's end state with `getBeatEnd` and author the next beat to continue from it: start actors where they ended, keep a walking character mid-stride instead of resetting the cycle, keep a rider mounted. Continuity is data, not vibes.

## Coherence

When the performance is compiled with the blocking attached, every timing anchor must actually be performed — a planned-but-missing action violates. Plan only what the performance will deliver, and deliver everything you planned.
