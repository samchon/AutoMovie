import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * What an affordance point is **for** — the closed set of interaction semantics
 * an object can declare (D011: the geometry stays a crude proxy, the meaning is
 * rich data).
 *
 * The set is deliberately minimal, covering the interactions the pipeline
 * already computes with:
 *
 * - `"stack-top"` — a face another object can rest on (a crate lid, a table top).
 *   The only kind that carries an `extent`; its corners feed the #601
 *   support/topple judgment.
 * - `"handle"` — a grab point that seats a hand frame (a mug handle, a sword
 *   grip). Finger-level wrap IK is a later pass.
 * - `"socket"` — a receptacle another object's contact frame plugs into (a torch
 *   sconce, a peg hole, a bottle mouth).
 * - `"hook"` — a hanging point (a lantern ring, a coat peg).
 *
 * @author Samchon
 */
export type AutoMovieAffordanceKind =
  | "stack-top"
  | "handle"
  | "socket"
  | "hook";

/**
 * A semantic contact point an object declares in its **own model-local frame**
 * — where another body may rest, grab, plug, or hang, independent of any bone.
 *
 * This is the model-frame sibling of {@link IAutoMovieAttachment}: where that
 * couples a child to a **bone** of a posed skeleton (a rider on a horse), an
 * affordance marks a contact on the model itself (a crate's stackable top, a
 * mug's handle), so stacking and grabbing become authored data instead of
 * hand-tuned offsets. The engine's `resolveAffordanceSeat` aligns one model's
 * affordance frame onto another's; `affordanceSupportContacts` turns a
 * `stack-top` extent into the support contacts the topple judgment consumes.
 *
 * @author Samchon
 */
export interface IAutoMovieAffordance {
  /** Stable id, unique within the model; action targets cite it by this. */
  id: string;

  /** What the point is for. Drives which fields apply (see `extent`). */
  kind: AutoMovieAffordanceKind;

  /**
   * The contact frame in the model's local space: `translation` is where the
   * contact sits, `rotation` orients it (`+Y` out of a stack-top face, out of a
   * socket mouth). Seating aligns two of these frames coincident.
   */
  frame: IAutoMovieTransform;

  /**
   * The supporting face's footprint for a `"stack-top"`: a convex polygon in
   * the affordance frame's XZ plane, at least three non-collinear points, `y`
   * ignored (write `0`) — the same minimal parameterization as
   * {@link IAutoMovieSurface.polygon}. Its corners, transformed to world, become
   * #601 support contacts. **Must be `null` for point-like kinds** (`handle` /
   * `socket` / `hook`), which have no face to rest on.
   */
  extent: IAutoMovieVector3[] | null;
}
