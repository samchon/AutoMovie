import { IAutoFilmActionCall } from "./IAutoFilmActionCall";
import { IAutoFilmContextRequest } from "./IAutoFilmContextRequest";

/**
 * Stage 4 — **PERFORMANCE** (micro, per shot). Compile the blocked intent into
 * **action calls** — the thin verbs the engine fattens into motion. The model
 * does _not_ write keyframes; it emits `walkTo` / `gesture` / `lookAt` /
 * `react` and the engine synthesises the dense clips (locomotion, IK, aim, ROM
 * clamp, spring, projectile, impact) and assembles the {@link IAutoFilmShot}.
 *
 * The CoT is AutoBe's plan → draft → revise: rough the action list, write it,
 * then self-review it (timing overlaps, reach, whether the camera catches the
 * beat) and finalise. `final: null` means the draft needed no change.
 *
 * @author Samchon
 */
export interface IAutoFilmPerformanceApplication {
  process(props: IAutoFilmPerformanceApplication.IProps): void;
}
export namespace IAutoFilmPerformanceApplication {
  export interface IProps {
    /**
     * Think before you act. Which engine verbs realise each actor's intent?
     * What must be timed against what (the arrow leaves as the archer twists;
     * the target reacts only once the hit lands)? On a **revise pass**, pull
     * `getNotes` and treat each open note as a required fix to the action list
     * — re-performing without reading the correction repeats the fault.
     */
    thinking: string;

    /**
     * Perform the shot, or pull context (the scene/blocking/a sibling shot)
     * first.
     */
    request: IWrite | IAutoFilmContextRequest;
  }

  export interface IWrite {
    type: "write";

    /** Which beat/shot this performs. */
    beat: string;

    /**
     * The approach: how the intent decomposes into verbs and how they line up
     * on the timeline (the plan the draft must follow).
     */
    plan: string;

    /**
     * First full action list (every actor + the camera), placed on the shot
     * timeline.
     */
    draft: IAutoFilmActionCall[];

    /** Self-review and the finalised list. */
    revise: IRevise;

    /** Shot length in seconds. */
    duration: number;
  }

  export interface IRevise {
    /**
     * Critique the draft against the failure modes that recur in parallel runs,
     * and name a concrete fix for each that applies:
     *
     * - **Range:** does a strike's actor stand within reach of its target, so it
     *   _lands_ rather than mimes at air? (Stage distance from the rig, not
     *   hope.)
     * - **Causality:** does every `react` follow its cause — and is a projectile
     *   hit left to `launch.onHit` rather than hand-timed?
     * - **Continuity:** no foot-skating (locomotion distance matches the travel),
     *   no gaps the actor freezes through unintentionally. Concurrent actions
     *   on one actor must own **disjoint** `region`s (walk + wave + look-at is
     *   fine; two `upperBody` gestures at once is not) — set `region` so the
     *   composition is conflict-free by construction, not by hope.
     * - **Camera:** does the move frame the key moment (the landing, the fall)?
     * - **Timing:** do the actions fill the beat and sum to its `duration`?
     */
    review: string;

    /**
     * The corrected action list, or `null` if the draft already stands. Making
     * "no change" explicit keeps the decision auditable.
     */
    final: IAutoFilmActionCall[] | null;
  }
}
