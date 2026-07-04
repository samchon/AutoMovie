import { IAutoMovieModel } from "../model/IAutoMovieModel";

/**
 * Stage 1.5 — **FORGE** (the prop shop). Build a stick-figure stand-in rig for
 * every cast member the script left without a `modelRef`: a skeleton of
 * humanoid-named bones (reused metaphorically for creatures — a horse's hind
 * legs ride `leftUpperLeg`/`rightUpperLeg`, its saddle is `spine`) dressed in
 * primitive parts (capsule rods, sphere heads), with per-bone ROM overrides
 * where the creature's joints differ from the human default.
 *
 * The model does _not_ sculpt geometry — it composes primitives on bones, the
 * way `buildStickman`/`buildHorse` do by hand. Proportions are the whole craft:
 * a rig's reach and stride are what staging measures distances from, so a
 * forged arm that is too short makes every later strike mime at air.
 *
 * Exposed to the model as
 * `typia.llm.application<IAutoMovieForgeApplication>()`. The single `process`
 * method's `IProps` schema enforces the reasoning (the JSDoc on each field is
 * the prompt).
 *
 * @author Samchon
 */
export interface IAutoMovieForgeApplication {
  process(props: IAutoMovieForgeApplication.IProps): void;
}
export namespace IAutoMovieForgeApplication {
  export interface IProps {
    /**
     * Think before you build. For each stand-in: what silhouette reads as this
     * character (biped? quadruped? how tall at the shoulder)? Which humanoid
     * bones map to which body parts, and which joints need ROM overrides (a
     * horse's knee is not a human's)? What reach/stride will staging rely on?
     */
    thinking: string;

    request: IWrite;
  }

  export interface IWrite {
    type: "write";

    /**
     * One forged model per cast member whose `modelRef` is null — no more, no
     * fewer. Members with a `modelRef` are imported assets and must not be
     * forged.
     */
    entries: IEntry[];
  }

  /** One cast member's stand-in rig. */
  export interface IEntry {
    /** The cast `node` this model embodies (from the script). */
    node: string;

    /**
     * The stand-in: `origin: "generated"`, a skeleton (a performer without
     * bones cannot be posed), primitive parts attached to its bones, and the
     * model `id` equal to `node` — that id is how the staged scene finds it.
     */
    model: IAutoMovieModel;
  }
}
