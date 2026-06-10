import { IAutoFilmActionCall } from "./IAutoFilmActionCall";

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
     * the target reacts only once the hit lands)?
     */
    thinking: string;
    request: IWrite;
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
     * Critique the draft: do strikes land at real range, do reactions fire only
     * after their cause, does anything skate or overlap badly, does the camera
     * frame the key moment? Name concrete fixes.
     */
    review: string;
    /**
     * The corrected action list, or `null` if the draft already stands. Making
     * "no change" explicit keeps the decision auditable.
     */
    final: IAutoFilmActionCall[] | null;
  }
}
