import { IAutoFilmVector3 } from "../geometry/IAutoFilmVector3";
import { IAutoFilmContextRequest } from "./IAutoFilmContextRequest";

/**
 * A **timing anchor** — a key moment pinned on the beat's local timeline. A
 * sparse list of these is the coarse temporal skeleton (in-betweening's stage
 * one) the performance stage aligns its verbs to, so the dense action timing
 * follows a committed structure instead of being invented per-verb. Anchors are
 * also where **causality** is fixed: the "looses the arrow" anchor must precede
 * the "is struck" anchor, and the performance stage honours that order.
 *
 * @author Samchon
 */
export interface IAutoFilmTimingAnchor {
  /** Seconds into the beat this moment lands. */
  t: number;

  /**
   * What happens at this instant, in a few words ("twists back in the saddle",
   * "looses the arrow", "the fist connects", "weight lands on the front
   * foot").
   */
  cue: string;
}

/**
 * Stage 3 — **BLOCKING** (meso, per beat). Turn one beat's prose into a
 * structured **shot plan**: what each actor is trying to do, the camera's
 * coverage, and the timing — but still as _intent_, not motion. The performance
 * stage turns the intent into engine action calls.
 *
 * Run once per beat (fan-out). The CoT slots (`analysis` → `rationale` →
 * `blocking`) force the model to justify its staging before committing it.
 *
 * @author Samchon
 */
export interface IAutoFilmBlockingApplication {
  process(props: IAutoFilmBlockingApplication.IProps): void;
}
export namespace IAutoFilmBlockingApplication {
  export interface IProps {
    /**
     * Think before you act. Read the beat against the staged geometry: who is
     * where, what must change by the end of the beat, what the camera must
     * catch (the strike landing, the fall). Resolve timing conflicts. If this
     * is a **revise pass** (the shot came back from review), pull `getNotes`
     * first and make every open note a concrete change to the blocking — never
     * re-block blind to the correction.
     */
    thinking: string;

    /** Block the beat, or pull context (the scene/script/a sibling shot) first. */
    request: IWrite | IAutoFilmContextRequest;
  }

  export interface IWrite {
    type: "write";

    /** Which beat (id from the script) this blocks. */
    beat: string;

    /**
     * What this beat is _for_ dramatically and what the viewer must read from
     * it — the yardstick the visual review will judge against.
     */
    analysis: string;

    /**
     * Why this blocking serves the beat: why these actor intents, this camera
     * choice, this timing. (The slot that catches retrofit — a plan with no
     * rationale is suspect.)
     */
    rationale: string;

    /** Each actor's intent during the beat, on the shot-local timeline. */
    actors: IActorIntent[];

    /** How the camera covers the beat. */
    camera: ICameraIntent;

    /** Beat length in seconds. */
    duration: number;
  }

  /** One actor's intent — prose the performance stage compiles to action calls. */
  export interface IActorIntent {
    /** Scene node id. */
    node: string;

    /**
     * What this actor does over the beat, in order, in words ("flees on the
     * gallop, then twists back and looses an arrow at the pursuer"). The
     * performance stage maps this to {@link IAutoFilmActionCall}s.
     */
    beats: string;

    /**
     * Optional sparse {@link IAutoFilmTimingAnchor}s pinning this actor's key
     * moments on the beat timeline — the temporal skeleton the performance
     * stage aligns its verbs to (and the order that fixes causality). Pin only
     * the moments that matter (the loose, the connect, the landing); leave the
     * fill to the engine. Omit for a beat with no critical timing.
     */
    anchors?: IAutoFilmTimingAnchor[];
  }

  /** Camera coverage for the beat (compiled to a camera move in performance). */
  export interface ICameraIntent {
    /** Framing of the action. */
    framing: "wide" | "full" | "medium" | "close";

    /** How the camera behaves. */
    move: "static" | "follow" | "orbit" | "push-in" | "whip";

    /** What it favours (a node id or a point). */
    on:
      | { kind: "node"; node: string }
      | { kind: "point"; point: IAutoFilmVector3 };
  }
}
