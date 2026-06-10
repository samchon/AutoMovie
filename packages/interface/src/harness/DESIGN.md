# AutoFilm function-calling harness — first-pass design

> First-pass design + schemas for the LLM **function-calling harness**: the layer that lets a model author a film through tool calls, with the engine doing the heavy lifting and validators closing the loop. Pattern studied from AutoBe (`wrtnlabs/autobe-private`); adapted to the motion/film domain. This is a thought-experiment draft — names and shapes will move as the JSDoc/CoT is refined. Tracks issue #34 missions M1/M3/M13.

## The core decision: macro → micro pipeline **with** a thin motion schema the engine fattens

The question was: one giant schema that emits all motion at once, or a multi-stage macro→micro pipeline (à la AutoBe), or a very thin motion schema the engine underpins, or both. The answer here is **both, layered** — and that is the whole point:

- **Macro→micro stages** give CoT compliance and let each step be validated before the next (AutoBe's waterfall+spiral). A film is decomposed the way a real production is: script → staging → blocking → performance → review.
- **A thin motion schema at the micro level.** The model never hand-keys frames (error-prone, the recursive-union nightmare). It emits **high-level action verbs with parameters** — `walkTo`, `strike`, `lookAt`, `reactToImpact`, `attachTo` — and the **engine synthesises the dense per-frame motion** from its primitives (locomotion, IK, aim, ROM clamp, spring, projectile, impact). So the schema the LLM fills is small and legible; richness comes from the engine. This is the project's existing strength turned into the harness's leverage: "the LLM emits an AST, the deterministic engine renders it" becomes "the LLM emits *intent*, the engine renders *motion*."

Net: the LLM directs; the engine animates; validators (structural → physical/ROM → visual) converge the result. One calculation feeding both the model (as hint/feedback) and the deterministic render — the same "one calculation, two consumers" used for ROM and impact.

## Workflow nodes (the graph)

```
                prompt (+ optional refs)
                        │
                        ▼
   ┌─────────────────────────────────────────┐
   │ 1. SCRIPT      IAutoFilmScriptApplication │  macro: intent → theme → cast list → beat list (shots in words)
   └─────────────────────────────────────────┘
                        │  Slate.script
                        ▼
   ┌─────────────────────────────────────────┐
   │ 2. STAGING     IAutoFilmStagingApplication│  set up: pick/define characters, build the scene, place cameras + lights
   └─────────────────────────────────────────┘
                        │  Slate.scene, Slate.cast
                        ▼
        ┌──────── per beat (fan-out) ─────────┐
        ▼                                     │
   ┌─────────────────────────────────────────┐│
   │ 3. BLOCKING    IAutoFilmBlockingApplication│ meso: a ShotPlan — who does what, where, the camera move, timing, beats
   └─────────────────────────────────────────┘│
                        │  shot plan                │
                        ▼                            │
   ┌─────────────────────────────────────────┐│
   │ 4. PERFORMANCE IAutoFilmPerformanceApplication│ micro: action verbs + params → engine primitives → clips/motion
   └─────────────────────────────────────────┘│
                        │  IAutoFilmShot              │
                        ▼                            │
   ┌─────────────────────────────────────────┐│
   │ 5. REVIEW      IAutoFilmReviewApplication │  render (M2) + validate (ROM/physics/timing) → notes → loop ◄┐
   └─────────────────────────────────────────┘│                                                            │
                        │  pass? │ fail → notes ─────┘ (back to BLOCKING/PERFORMANCE with feedback)        │
                        ▼ pass                                                                              │
        └──────── all beats done ─────────────┘
                        │
                        ▼
   ┌─────────────────────────────────────────┐
   │ 6. ASSEMBLE    IAutoFilmAssembleApplication│  edit: order, trims, transitions, fps → IAutoFilmSequence (the film)
   └─────────────────────────────────────────┘
```

- **State** threads through an `IAutoFilmSlate` (the production state, AutoBe's `AutoBeState` analogue): the script, the cast, the scene, the shots built so far, and the review history. Each stage reads upstream Slate and writes its slice.
- **Spiral within a node:** PERFORMANCE↔REVIEW iterate (write → render → validate → correct) until the shot passes its gates or a retry budget runs out — exactly AutoBe's correct-loop.
- **Fan-out** across beats: each beat's BLOCKING→PERFORMANCE→REVIEW is independent (a pipeline), so shots can be built/verified in parallel and only ASSEMBLE waits for all.

## The CoT / schema convention (from AutoBe)

Every stage is a `typia.llm.application<IAutoFilm[Stage]Application>()`. The single method takes `IProps`, and **the schema enforces the reasoning**:

- `thinking` — a mandatory reasoning slot; its JSDoc tells the model *what to reason about here* (the JSDoc **is** the prompt).
- `request` — a discriminated union (`IWrite | IGet… | IComplete`) so context-loading requests can be exhausted/removed (AutoBe's preliminary trick), and a multi-call stage can signal completion.
- `IWrite` carries **procedure-as-slots**: `plan` → `draft` → `review` → `final`, plus `rationale`/`selfCritique` where there is no cheap deterministic verifier (issue #34 M13). Missing a slot fails validation; a skipped beat can't hide.

## Validation tiers (the convergence ladder, M3)

Feed each tier's failures back as field-located notes into the loop:

1. **Structural** — typia schema (well-formed call?).
2. **Physical/semantic** — `validatePose`/`validateMotion`/ROM (`clampPose` auto-fix), plus penetration / foot-skate / collision. "Legal motion?"
3. **Visual** — render-and-see (M2): "does it match the beat?" A multimodal note that drives the next REVIEW directive.

## Naming

- Per-stage tool schemas: **`IAutoFilm[Stage]Application`** — keeps the `typia.llm.application` convention (grep-able across the typia/AutoBe ecosystem; AutoBe uses `IAutoBe[Phase][Task]Application`). The film-domain flavour lives in the *stage* names (Script / Staging / Blocking / Performance / Review), not a renamed suffix.
- Production state: **`IAutoFilmSlate`** — the clapperboard that heads every take and carries the production's running context (a better-fitting domain name than a generic "State").
- The micro action vocabulary: **`IAutoFilmActionCall`** — the thin verbs the engine fattens.

(Alternative considered: renaming `Application` → `Direction`/`Slate`. Rejected for the schema interfaces to stay aligned with `typia.llm.application`; `Slate` is reused for state instead.)
