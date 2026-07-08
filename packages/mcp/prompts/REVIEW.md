# Review

Review normalizes a verdict for the re-perform loop. A `revise` verdict needs at least one note (an empty revise spins the loop forever); a `pass` needs none; every note files on the beat being judged.

## Reading Violations

- `error` violations are blocking facts: an out-of-ROM joint, a broken reference, an impossible timing. The owning artifact must change.
- `warning` violations are physics advice, not gates: two bodies interpenetrate, a stacked prop overhangs its support and would topple, an unsupported body would fall. The run still succeeds; the warnings surface so you can decide.

## Handling a Physics Warning

Three honest responses, in order of preference:

1. **Accept the suggestion.** Collision warnings carry a suggested response (an impulse-derived, ROM-bounded recoil); topple warnings carry the pivot edge and fall direction; free-fall warnings carry the fall arc. Adopting the suggestion keeps the film physically plausible with no extra authoring.
2. **Restage.** If the implausibility is accidental — actors staged too close, a crate placed half off the table — fix the staging or the action parameters.
3. **Acknowledge.** If the implausibility is the point (wire-fu, a levitating lantern, a superhuman blow), mark the action with `physicsIntent` (e.g. `"defies-gravity"`). The matching warnings are suppressed on later rounds; the interaction events still surface for downstream consumers.

Never leave a warning unhandled round after round — that is the nagging loop the acknowledgment channel exists to prevent. And never fake a `pass` while errors stand: the verdict is a contract with the next stage, not a mood.

## Locating the Correction on the Screenplay

When the committed script carries a refinement tree, `commitShot` stamps each violation with the screenplay `node` claiming the beat. Walk that node's ancestors nearest-first — beat, then its parents up toward the intent — and fix at the deepest level that owns the fault: a clipped elbow is the beat's own motion authoring; two actors colliding because the choreography packs them too tight may be the parent group's blocking; an impossible reach across the set is the scene's staging.

Match the tool to the level. One actor's take inside an otherwise good shot: `setActorPerformance`. A node staged in the wrong spot: `setPlacement` (it clears downstream like a scene re-commit — moved coordinates invalidate performed shots). A beat that must be redone from its plan: `eraseShot`, then re-`block`/`perform`/`commitShot`. Only a fault that lives in the script text itself warrants `commitScript`'s full downstream clear.
