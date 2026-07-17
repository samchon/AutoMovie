# Review

Review normalizes a verdict for the re-perform loop. A `revise` verdict needs at least one note (an empty revise spins the loop forever); a `pass` needs none; every note files on the beat being judged.

## Reading Violations

- `error` violations are blocking facts: an out-of-ROM joint (a limit the rig physically cannot exceed), a broken reference, an impossible timing, a malformed annotation. The owning artifact must change.
- `warning` violations are physics advice, not gates — a foot skates while planted, a foot passes through the ground, two bodies interpenetrate or a limb self-intersects, a pose loses its balance, a stacked prop would topple, an unsupported body would fall. The run still succeeds; the warnings surface so you can decide. The line is plausibility versus possibility: an off-balance stunt or a grapple that clips is *implausible*, not *impossible*, so it is a suppressible warning; only a joint bent past its ROM is a hard error (D015).

## Handling a Physics Warning

Three honest responses, in order of preference:

1. **Accept the suggestion.** Collision warnings carry a suggested response (an impulse-derived, ROM-bounded recoil); topple warnings carry the pivot edge and fall direction; free-fall warnings carry the fall arc. Adopting the suggestion keeps the film physically plausible with no extra authoring.
2. **Restage.** If the implausibility is accidental — actors staged too close, a crate placed half off the table — fix the staging or the action parameters.
3. **Acknowledge.** If the implausibility is the point (a moonwalk that skates, a grapple that clips, wire-fu that defies balance, a levitating lantern, a superhuman blow), mark the action with `physicsIntent` (e.g. `"moonwalk"`, `"wire-fu"`, `"defies-gravity"`). The matching warnings are suppressed on later rounds; the interaction events still surface for downstream consumers. This is the industry default — physically plausible by default, artist override always available.

Never leave a warning unhandled round after round — that is the nagging loop the acknowledgment channel exists to prevent. And never fake a `pass` while errors stand: the verdict is a contract with the next stage, not a mood.

## Continuity Across Cuts — lintContinuity

Per-beat review judges one shot in isolation; `lintContinuity` judges the assembled film as a whole. It walks the committed cut and checks each shot against the prior beat's committed end-state — an actor that teleports between a beat's end and the next shot's opening, a prop that changes hands or vanishes across the seam, a velocity that reverses without cause. Run it after the beats are committed and assembled, before a final render: a shot can pass its own review yet still break continuity with its neighbor. It is resident-or-explicit like the commit tools; the surviving continuity faults file on the beat whose opening disagrees with the prior end.

## Locating the Correction on the Screenplay

When the committed script carries a refinement tree, `commitShot` stamps each violation with the screenplay `node` claiming the beat. Walk that node's ancestors nearest-first — beat, then its parents up toward the intent — and fix at the deepest level that owns the fault: a clipped elbow is the beat's own motion authoring; two actors colliding because the choreography packs them too tight may be the parent group's blocking; an impossible reach across the set is the scene's staging.

Match the tool to the level. One actor's take inside an otherwise good shot: `setActorPerformance`. A node staged in the wrong spot: `setPlacement` (it clears downstream like a scene re-commit — moved coordinates invalidate performed shots). A beat that must be redone from its plan: `eraseShot`, then re-`block`/`perform`/`commitShot`. Only a fault that lives in the script text itself warrants `commitScript`'s full downstream clear.
