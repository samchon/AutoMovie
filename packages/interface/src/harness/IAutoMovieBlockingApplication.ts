import { IAutoMovieContextRequest } from "./IAutoMovieContextRequest";
import { IAutoMovieNodeTarget } from "./IAutoMovieNodeTarget";
import { IAutoMoviePointTarget } from "./IAutoMoviePointTarget";
import { IAutoMovieTimingAnchor } from "./IAutoMovieTimingAnchor";

/**
 * Stage 3: **BLOCKING** (meso, per beat). Turn one beat's prose into a
 * structured **shot plan**: what each actor is trying to do, the camera's
 * coverage, and the timing, but still as _intent_, not motion. The performance
 * stage turns the intent into engine action calls.
 *
 * Run once per beat (fan-out). The CoT slots (`analysis` → `rationale` →
 * `blocking`) force the model to justify its staging before committing it.
 *
 * @author Samchon
 */
export interface IAutoMovieBlockingApplication {
  process(props: IAutoMovieBlockingApplication.IProps): void;
}
export namespace IAutoMovieBlockingApplication {
  export interface IProps {
    /**
     * Think before you act. Read the beat against the staged geometry: who is
     * where, what must change by the end of the beat, what the camera must
     * catch (the strike landing, the fall). Resolve timing conflicts. If this
     * is a **revise pass** (the shot came back from review), pull `getNotes`
     * first and make every open note a concrete change to the blocking; never
     * re-block blind to the correction.
     */
    thinking: string;

    /** Block the beat, or pull context (the scene/script/a sibling shot) first. */
    request: IWrite | IAutoMovieContextRequest;
  }

  export interface IWrite {
    /**
     * Discriminator against {@link IDecline}. **Optional**: every parameter that
     * takes this type takes only this arm, so the signature already fixes the
     * value. Omitting it is legal, and supplying `"write"` is equally legal;
     * only a wrong literal is refused (#1347).
     */
    type?: "write";

    /** Which beat (id from the script) this blocks. */
    beat: string;

    /**
     * What this beat is _for_ dramatically and what the viewer must read from
     * it: the yardstick the visual review will judge against.
     */
    analysis: string;

    /**
     * Why this blocking serves the beat: why these actor intents, this camera
     * choice, this timing. (The slot that catches retrofit: a plan with no
     * rationale is suspect.)
     */
    rationale: string;

    /** Each actor's intent during the beat, on the shot-local timeline. */
    actors: IActorIntent[];

    /** How the camera covers the beat. */
    camera: ICameraIntent;

    /**
     * The ADDITIONAL staged cameras covering the beat (#1187): one entry per
     * extra angle (a side camera on the duel while the hero holds the close
     * framing). The hero take stays the singular `camera` above; each coverage
     * intent names its own staged camera so the performance stage can frame
     * that angle too, the compiled alternates riding the shot's `coverage` as
     * guide metadata. Omit for a single-camera beat.
     */
    coverage?: ICoverageIntent[];

    /** Beat length in seconds. */
    duration: number;
  }

  /** One actor's intent: prose the performance stage compiles to action calls. */
  export interface IActorIntent {
    /** Scene node id. */
    node: string;

    /**
     * What this actor does over the beat, in order, in words ("flees on the
     * gallop, then twists back and looses an arrow at the pursuer"). The
     * performance stage maps this to {@link IAutoMovieActionCall}s.
     */
    beats: string;

    /**
     * Optional sparse {@link IAutoMovieTimingAnchor}s pinning this actor's key
     * moments on the beat timeline: the temporal skeleton the performance stage
     * aligns its verbs to (and the order that fixes causality). Pin only the
     * moments that matter (the loose, the connect, the landing); leave the fill
     * to the engine. Omit for a beat with no critical timing.
     */
    anchors?: IAutoMovieTimingAnchor[];
  }

  /** Camera coverage for the beat (compiled to a camera move in performance). */
  export interface ICameraIntent {
    /** Framing of the action. */
    framing: "wide" | "full" | "medium" | "close";

    /** How the camera behaves. */
    move: "static" | "follow" | "orbit" | "push-in" | "whip";

    /** What it favours (a node id or a point). */
    on: IAutoMovieNodeTarget | IAutoMoviePointTarget;
  }

  /**
   * One additional camera's coverage of the beat (#1187): an ordinary camera
   * intent plus the staged camera that plays the angle. The hero intent needs
   * no id (performance elects it from the frame actions); a coverage intent
   * must name its camera so several angles never blur into one election.
   */
  export interface ICoverageIntent extends ICameraIntent {
    /** Id of the staged camera this angle plays on. */
    camera: string;
  }
}
