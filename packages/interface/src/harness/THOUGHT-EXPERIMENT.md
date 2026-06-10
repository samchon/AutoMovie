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
