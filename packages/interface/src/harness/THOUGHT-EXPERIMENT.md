# Harness thought-experiment — tracing two films through the schema

> Review of the first-pass harness (PR #39) by hand-tracing concrete films through the stages, to find gaps before the schema is used for mass / parallel generation. Each finding → a concrete refinement applied to the schemas + JSDoc. The aim: closed option-sets and prescriptive CoT prompts so many parallel runs converge (the function-calling-harness principle — closed schema + verifiable steps beat free prose).

## Film A — "a shy girl waves, then hurries off to the left" (~6 s, 2 beats)

- **SCRIPT** — logline "a timid hello and a quick exit"; theme "shy, hesitant"; cast `[{ node:"girl", character:"a shy young woman" }]`; beats `[{b1 "the wave"}, {b2 "the exit"}]`. ✔ fits.
- **STAGING** — place `girl` at origin facing the camera; a camera in front (medium); a key light. ✗ **the first-pass Staging only emits actor + camera placements** — no scene id, no lights, no set/props. The shot references a `scene` id with `nodes/cameras/lights`; staging must actually *produce that scene*.
- **BLOCKING b1** — girl: "small nervous wave at camera, weight shifting"; camera: medium, static, on girl. ✔
- **PERFORMANCE b1** — girl: `emote(shy)`, `gesture(wave)`, `lookAt(camera)`. ✗ **`gesture.name` is a free string** ("wave") — fine for one run, but across many parallel runs free strings drift ("wave"/"waving"/"hand wave"). A **closed set** of gesture families + a `custom` escape converges better.
- **PERFORMANCE b2** — girl: `locomote(walk, **to the left**)`. ✗ **"off to the left" has no target** — only `node` or absolute `point`. The model should not have to invent world coordinates for "exit left". Need a **relative direction / offscreen** target.
- **REVIEW** — does the wave read *nervous* (small, hesitant), does she exit cleanly? ✔ (visual tier).

## Film B — "the archery chase" (the built scene, ~9 s, 3 beats)

- **SCRIPT** — cast `[archer (bow), pursuer (lance)]`; beats `[the chase, the shot, the fall]`. ✔
- **STAGING** — two horses + two riders; **each rider rides its horse** (a persistent coupling), archer leading by a gap, camera tracking. ✗ **no way to declare a persistent attachment** (rider → horse saddle) at setup. Expressing it as a per-shot `attachTo` action repeats it in every beat; a mount is a *staging relationship*. Placement needs an optional `attach`.
- **BLOCKING "the shot"** — archer twists back and looses at the pursuer; camera **follows, then holds on the impact**. ✔ but note the camera *changes behaviour mid-shot*.
- **PERFORMANCE "the shot"** — archer: `gesture(draw-bow)`, `launch(arrow → pursuer)`. pursuer keeps galloping; **then is hit and unhorsed**. ✗✗ **two coupled problems:**
  1. The **hit time is computed by the engine** (`projectileSphereHit`, leading a moving target), so the model *cannot* time the pursuer's `react` to coincide with the launch. The reaction must be **triggered by the detected hit**, not hand-timed. → `launch` needs an `onHit` reaction the engine schedules on the target at the detected time (the reactive event, M7).
  2. The camera's "**follow then hold**" cannot be one camera move. → the camera is an **actor with a timeline of camera actions** (follow @0, static @impact), so it needs a first-class camera action verb — there is none in the first pass.

## Findings → refinements applied

1. **Staging produces a real scene.** `IWrite` now emits `actors` (placement + optional persistent `attach` to a parent bone), `cameras`, and `lights`, under a named `scene` — enough for the orchestrator to build an `IAutoFilmScene`. (Film B mounts, Film A key light.)
2. **Closed gesture set.** `IAutoFilmGestureAction.kind` is an enum of gesture families (`strike|kick|guard|wave|bow|nod|point|crouch|jump|stagger|draw|throw|celebrate|custom`) with a `note` for nuance/the `custom` escape — closed options converge across parallel runs. (Film A.)
3. **Direction / offscreen targets.** `IAutoFilmActionTarget` gains `direction` (a heading in degrees, relative to the actor) and `offscreen` (exit a frame edge) so "walk off left" needs no invented coordinates. (Film A.)
4. **Reactive launch.** `IAutoFilmLaunchAction.onHit` carries the reaction (`force`, `unbalance`) the engine applies to whatever it *detects* the projectile striking — the model says "shoot him off his horse"; the engine times the fall to the computed contact. (Film B.)
5. **Camera as an actor.** A first-class `IAutoFilmCameraAction` (`frame` verb: framing + move + on), placed on the timeline like any action, so a camera can follow then hold within one shot. (Film B.)
6. **Context-loading request.** Each stage's `request` union gains a `getContext` member (AutoBe's preliminary pattern) so a model can pull the script / staged scene / a sibling shot it needs, instead of guessing — and a `complete` where a stage may take several calls.
7. **Prescriptive CoT prompts.** Every `thinking` / `plan` / `review` / `rationale` JSDoc now names *what to check and the common failure modes to avoid* (strikes landing at real range, reactions firing only after their cause, no foot-skating, durations summing to the beat, stable id reuse) — the comments are the prompt, tuned for parallel reliability.

These are first-pass refinements; the next trace (a multi-actor crowd, a dialogue two-shot) will surface more. Keep tracing → revising; the schema matures empirically (the "backtest the schema against cases" idea).

---

## Round 2 — contrasting cases: a dialogue two-shot, and a synchronised dance

Tracing cases that stress *different* parts than the action set-pieces of round 1.

### Film C — "a tense exchange" (two characters, one shot, no locomotion)

- **STAGING** — A and B face each other a conversational distance apart; a camera on **both** (a two-shot). ✗ **a camera `on` target is a single node/point** — a two-shot must frame *both*. Need to frame a **group** (or their midpoint).
- **BLOCKING / PERFORMANCE** — A: `lookAt(B)`, `emote(angry)`, `gesture(point at B)`; then B: `lookAt(A)`, `emote(afraid)`, `gesture(shake)`. Turn-taking is authored timing — ✔. Eye contact via `node` targets — ✔. Subtlety via `emote.intensity` — ✔. (No audio/lip-sync; performance carries the beat. Acceptable for now.)

### Film D — "four dancers, in unison, to a count" (multi-actor, rhythmic, repetitive)

- **STAGING** — four dancers in a line/diamond; placements cover it — ✔.
- **PERFORMANCE** — all four do the **same** step, **repeatedly**, **in time**. ✗✗ three pain points:
  1. **Unison** — authoring the identical action four times (once per actor) is wasteful and drifts across parallel runs. One verb should apply to **several actors**.
  2. **Repetition** — a step repeated on the count is many near-identical actions. A `repeat` count is cleaner than N copies.
  3. **Tempo** — placing beats by absolute seconds is fragile for music-synced motion; a beat grid (bpm) the actions snap to would be sturdier. (Noted as future — not implemented yet to avoid over-building before it is needed.)

## Round-2 findings → refinements applied

1. **Group framing.** `IAutoFilmActionTarget` gains `group` (frame/track several nodes — a two-shot, a crowd) and the camera frames their collective extent. (Film C.)
2. **Unison actors.** An action's `actor` is now `string | string[]` — one verb performed by several (a chorus line, a crowd, synchronised dancers), cutting tokens and drift across parallel runs. (Film D.)
3. **Repeat.** `IAutoFilmActionBase.repeat` (default 1) loops the action's motion within its span — a step on the count, an idle sway. (Film D.)
4. **Tempo grid** — deferred: a `bpm`/beat-snapped timing for music-synced shots, when a musical scene actually needs it (avoid speculative complexity).

The schema keeps maturing per traced case; the next round (a long multi-shot sequence, a vehicle, a transformation) will surface the next gaps.

---

## Round 3 — a multi-shot sequence (continuity, pacing, the cut-list)

### Film E — "the joust, cut together" (4 shots: establishing wide → the charge → the strike (close) → the aftermath)

- **SCRIPT / BLOCKING / PERFORMANCE** produce four shots — ✔ (round 1–2 cover the within-shot work).
- **ASSEMBLE** the four into one film: order, trims, transitions (a hard cut into the strike, a slow dissolve into the aftermath), and the rhythm (the strike shot short and sharp; the aftermath held). ✗✗ **there was no ASSEMBLE stage schema** — the design graph ends in "Assemble → IAutoFilmSequence" but no Application produced it. A genuine structural gap, found only by tracing past a single shot.
- **Continuity** across cuts: the charge shot must end where the strike shot begins (a match cut); energy must carry. The `getShot` context request lets the model pull a sibling shot's end; the assemble stage must *check* the flow.

## Round-3 findings → refinements applied

1. **Assemble stage.** Added `IAutoFilmAssembleApplication` — the editorial stage that emits the `IAutoFilmSequence` cut-list (ordered shots, trims, transitions, fps) with CoT slots for **pacing** (the rhythm rationale) and **continuity** (how the shots match across cuts). The pipeline now has a schema for every node in the design graph.

---

## Round 4 — the cases the prior rounds assumed away: a non-human lead, and the revise loop closing

Rounds 1–3 traced humanoid set-pieces and a multi-shot cut. Two assumptions went untested: that every actor is a humanoid, and that REVIEW's "fail → notes → loop" actually re-feeds the loop. The repo already animates horses and cats (on the humanoid bone rig, retargeted) and the design's headline feature is the correct-loop, so both deserve a trace.

### Film F — "the riderless horse" (a quadruped lead: rears, then bolts)

- **STAGING** — place one `horse`, a camera, a key light. The horse rig reuses {@link AutoFilmHumanoidBone} (spine = the saddle/barrel, the four legs retargeted onto the arm/leg bones), so its placement + any `attach` (a fallen rider's empty saddle) types fine. ✔ — the bone enum already spans creatures; no staging gap.
- **PERFORMANCE "the rear"** — horse: `gesture(rear)`, a `neigh`. ✗ **the gesture set is humanoid-only** (`wave|bow|nod|...`) — a horse's *rear*/*buck*, a cat's *paw* have no family and would each fall to `custom`, which is exactly the free-text drift the closed set exists to prevent (and the repo invests heavily in animal motion: `horseRear`, `catLeap`, `catProwl`, ...). A creature subset earns its place in the closed set.
- **PERFORMANCE "it bolts"** — horse: `locomote(sprint, offscreen)`. ✔ — gaits map onto the rig (sprint → gallop), but the JSDoc said "stride/biped" and never said so; a parallel run could wrongly think locomote is humanoid-only. Document the mapping.
- **A cat pawing a toy** — `reach(hand, toy)` is two-bone arm IK, wrong for a foreleg dab. The right abstraction is `gesture(paw, at: toy)`; `reach` is a humanoid-arm verb and should say so.

### Film G — "the loop actually loops" (REVIEW returns revise; what re-enters?)

- **REVIEW** returns `verdict: "revise"` with notes (`tier`, `beat`, `issue`, `suggestion`) — written to `Slate.notes`. The design graph says "fail → notes → back to BLOCKING/PERFORMANCE with feedback." ✗✗ **but no stage can *read* those notes** — the context-request union is `getScript | getScene | getShot`; there is no `getNotes`. On the revise pass the performance stage would rebuild **blind to the reviewer's correction**, re-committing the same fault. A genuine loop-closure gap: the backlog exists in state but is unreachable through the schema.

### Film H — "the ball on the trampoline" (an actorless physics body) — *deferred*

- A prop that just **falls under gravity and bounces** (`resolveImpact`, the built trampoline demo) has **no actor and no thrower** — `launch` needs an actor to loose it. Expressing a free physics body would need a new top-level concept (a non-cast prop with mass + restitution, dropped). Whether *films* (vs. demos) need passive bodies is unproven, so — like the tempo grid — **defer**, and reach for it when a scene actually calls for it rather than speculatively widening the action set.

## Round-4 findings → refinements applied

1. **Creature gestures.** `AutoFilmGestureKind` gains `rear | buck | paw` (grouped *humanoid / creature / escape*), and its JSDoc now states the set spans humanoid **and** quadruped rigs — the engine dispatches each kind to the actor's rig vocabulary. Idle creature poses (a cat's stretch/sit, a tail flick) stay `hold` + `emote` or `custom`. (Film F.)
2. **Rig-aware locomotion / reach.** `IAutoFilmLocomoteAction` documents the gait→rig mapping (sprint → gallop, sneak → stalk); `IAutoFilmReachAction` states it is a humanoid-arm verb and points a pawing quadruped to `gesture(paw)`. (Film F.)
3. **Loop closure — `getNotes`.** `IAutoFilmContextRequest` gains `{ type: "getNotes"; beat? }` so a revise pass pulls the open correction backlog and fixes *what the reviewer flagged* instead of rebuilding blind. The review→revise loop the design promised is now reachable through the schema. (Film G.)
4. **Free physics body** — deferred (Film H): a non-cast prop dropped under gravity that bounces, added only when a real scene needs it.

Four rounds in, the schema covers humanoid + creature leads, the within-shot set-pieces, the multi-shot cut, and a closed correction loop. The next pressure will come not from another traced film but from **backtesting the schema against a live model** — the AutoBe lesson that the shape matures empirically once real generations run through it.
