import {
  AutoMovieSubject,
  type IAutoMovieSubjectContribution,
  placementChildNode,
} from "@automovie/engine";
import type {
  IAutoMovieModel,
  IAutoMovieNode,
  IAutoMoviePropSpec,
  IAutoMovieShotBuildContext,
  IAutoMovieStageSetPiece,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { soloist } from "../units/soloist";

/** A transform that only moves something, which is all this object needs. */
const at = (position: IAutoMovieVector3): IAutoMovieTransform => ({
  translation: position,
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** `#6f746e` converted once through the standard sRGB transfer function. */
const GATE_FINISH_LINEAR = Object.freeze({
  r: 0.1589608350608804,
  g: 0.17464740365558504,
  b: 0.1559264637078274,
  a: 1,
  hex: "#6f746e",
});

/**
 * The one thing on this plaza with a moving part.
 *
 * An object is a subject like a figure or a place: it owns what it is, what it
 * can do, and what it puts into a shot. What makes it a different KIND of
 * subject is that its record is a prop specification rather than a model
 * recipe, so the engine forges it and holds it to two contracts at once. The
 * model contract says it is a skeleton-less thing whose id is its staged node;
 * the articulation contract says its moving part is a declared joint under a
 * declared limit, and the compiler refuses a joint that drives nothing or a
 * travel a shot exceeds.
 *
 * The geometry is two boxes and is meant to be replaced. Every measurement
 * below answers to `docs/models/030-gate.md`; the boxes are the declared
 * blocking proxy rather than an accidental final asset.
 *
 * The answer shot stages both halves at once, because the compiler joins them
 * on this node id: a registry entry with no placement is a prop nothing stands
 * anywhere, and a placement with no registry entry is a box the engine never
 * forges.
 *
 * ```ts
 * const fixture = gate.render(context);
 * return {
 *   props: [...(fixture.props ?? [])],
 *   stage: { ..., set: [...(fixture.set ?? [])] },
 *   ...
 * };
 * ```
 *
 * @evidence models/030-gate.md Owns the reviewed post and leaf geometry,
 *   finish, far-edge placement, hinge node, and zero-to-100-degree limit.
 * @evidenceReview models/030-gate.md #b623038 Read models/030-gate.md and PlazaGate in src/objects/gate.ts; confirmed that the class owns the reviewed post and leaf geometry, finish, far-edge placement, hinge node, and zero-to-100-degree limit without answering another model file.
 * @evidence models/030-gate.md#gate-blocking-representation Implements the
 *   declared two-box proxy, finish, visual-scale dimensions, and placement.
 * @evidenceReview models/030-gate.md#gate-blocking-representation #a7078bf Read models/030-gate.md#gate-blocking-representation and PlazaGate in src/objects/gate.ts; confirmed this citation after checking the claim that implements the declared two-box proxy, finish, visual-scale dimensions without functional-clearance authority, and staged placement.
 * @evidence models/030-gate.md#gate-hinge-interface Implements the one named
 *   moving leaf, fixed frame, hinge node, and quaternion bound.
 * @evidenceReview models/030-gate.md#gate-hinge-interface #e490241 Read models/030-gate.md#gate-hinge-interface and PlazaGate in src/objects/gate.ts; confirmed this citation after checking the claim that implements the one named moving leaf, fixed frame, hinge node, and quaternion bound.
 * @evidence models/030-gate.md#gate-neutral-review-views Exposes finish,
 *   height, placement, hinge identity, and endpoints to the neutral review set.
 * @evidenceReview models/030-gate.md#gate-neutral-review-views #87a11c5 Read models/030-gate.md#gate-neutral-review-views and PlazaGate in src/objects/gate.ts; confirmed this citation after checking the claim that exposes finish, height, placement, hinge identity, and endpoints to the neutral review set.
 * @evidence obligations/design/model-sources.md#design-owned-construction Keeps every
 *   visible dimension and structural split owned by the cited model design.
 * @evidenceReview obligations/design/model-sources.md#design-owned-construction #ffa6690 Read obligations/design/model-sources.md#design-owned-construction and PlazaGate in src/objects/gate.ts; confirmed this citation after checking the claim that keeps every visible dimension and structural split owned by the cited model design.
 * @evidence obligations/design/model-sources.md#deterministic-build Produces the same
 *   prop, articulation, and placement from the same world context.
 * @evidenceReview obligations/design/model-sources.md#deterministic-build #27790fe Read obligations/design/model-sources.md#deterministic-build and PlazaGate in src/objects/gate.ts; confirmed this citation after checking the claim that produces the same prop, articulation, and placement from the same world context.
 * @evidence obligations/design/model-sources.md#unsupported-fidelity-is-explicit Keeps
 *   the two-box form visibly documented as a blocking proxy.
 * @evidenceReview obligations/design/model-sources.md#unsupported-fidelity-is-explicit #15c03fa Read obligations/design/model-sources.md#unsupported-fidelity-is-explicit and PlazaGate in src/objects/gate.ts; confirmed this citation after checking the claim that keeps the two-box form visibly documented as a blocking proxy.
 * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate keeps responsibility for The one thing on this plaza with a moving part in this declaration; the implementation fragment id, leaf, hinge, width, silhouetteMargin, thickness, post, finish, color, metallic, roughness, openDeg, height, farEdgeZ, positiveEdgeX, position, hingeNode, model, design introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate is a usable source artifact for The one thing on this plaza with a moving part; it is implemented directly as id, leaf, hinge, width, silhouetteMargin, thickness, post, finish, color, metallic, roughness, openDeg, height, farEdgeZ, positiveEdgeX, position, hingeNode, model, design rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate tested the reviewed GATE structure, hinge, and placement decisions through The one thing on this plaza with a moving part; the implementation fragment id, leaf, hinge, width, silhouetteMargin, thickness, post, finish, color, metallic, roughness, openDeg, height, farEdgeZ, positiveEdgeX, position, hingeNode, model, design shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export class PlazaGate extends AutoMovieSubject<IAutoMoviePropSpec> {
  /**
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.id keeps responsibility for the readonly id value materialized by its initializer in this declaration; the implementation fragment "plaza-gate" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.id declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.id is a usable source artifact for the readonly id value materialized by its initializer; it is implemented directly as "plaza-gate" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.id signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.id tested the reviewed GATE structure, hinge, and placement decisions through the readonly id value materialized by its initializer; the implementation fragment "plaza-gate" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.id implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly id = "plaza-gate";

  /**
   * Part id of the piece that turns, and the joint that turns it.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.leaf keeps responsibility for Part id of the piece that turns, and the joint that turns it in this declaration; the implementation fragment "leaf" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.leaf declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.leaf is a usable source artifact for Part id of the piece that turns, and the joint that turns it; it is implemented directly as "leaf" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.leaf signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.leaf tested the reviewed GATE structure, hinge, and placement decisions through Part id of the piece that turns, and the joint that turns it; the implementation fragment "leaf" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.leaf implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly leaf = "leaf";

  /**
   * Joint id of the single hinge, before the placement prefix.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.hinge keeps responsibility for Joint id of the single hinge, before the placement prefix in this declaration; the implementation fragment "hinge" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.hinge declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.hinge is a usable source artifact for Joint id of the single hinge, before the placement prefix; it is implemented directly as "hinge" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.hinge signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.hinge tested the reviewed GATE structure, hinge, and placement decisions through Joint id of the single hinge, before the placement prefix; the implementation fragment "hinge" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.hinge implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly hinge = "hinge";

  /**
   * Authored visual width of the leaf, in metres.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.width keeps responsibility for Authored visual width of the leaf, in metres in this declaration; the implementation fragment 0.9 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.width declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.width is a usable source artifact for Authored visual width of the leaf, in metres; it is implemented directly as 0.9 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.width signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.width tested the reviewed GATE structure, hinge, and placement decisions through Authored visual width of the leaf, in metres; the implementation fragment 0.9 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.width implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly width: number = 0.9;

  /**
   * Visual height margin above the standing SOLOIST reference, in metres.
   *
   * This maintains the reviewed silhouette proportion and does not claim a
   * passage, user, carried-load, mobility-aid, or equipment clearance.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.silhouetteMargin keeps responsibility for Visual height margin above the standing SOLOIST reference, in metres in this declaration; the implementation fragment 0.3 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.silhouetteMargin declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.silhouetteMargin is a usable source artifact for Visual height margin above the standing SOLOIST reference, in metres; it is implemented directly as 0.3 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.silhouetteMargin signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.silhouetteMargin tested the reviewed GATE structure, hinge, and placement decisions through Visual height margin above the standing SOLOIST reference, in metres; the implementation fragment 0.3 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.silhouetteMargin implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly silhouetteMargin: number = 0.3;

  /**
   * Thickness of the leaf, in metres.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.thickness keeps responsibility for Thickness of the leaf, in metres in this declaration; the implementation fragment 0.06 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.thickness declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.thickness is a usable source artifact for Thickness of the leaf, in metres; it is implemented directly as 0.06 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.thickness signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.thickness tested the reviewed GATE structure, hinge, and placement decisions through Thickness of the leaf, in metres; the implementation fragment 0.06 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.thickness implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly thickness: number = 0.06;

  /**
   * Width and depth of the square post the leaf hangs on, in metres.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.post keeps responsibility for Width and depth of the square post the leaf hangs on, in metres in this declaration; the implementation fragment 0.12 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.post declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.post is a usable source artifact for Width and depth of the square post the leaf hangs on, in metres; it is implemented directly as 0.12 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.post signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.post tested the reviewed GATE structure, hinge, and placement decisions through Width and depth of the square post the leaf hangs on, in metres; the implementation fragment 0.12 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.post implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly post: number = 0.12;

  /**
   * One finish shared by the fixed post and moving leaf.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.finish keeps responsibility for One finish shared by the fixed post and moving leaf in this declaration; the implementation fragment "gate-finish" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.finish declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.finish is a usable source artifact for One finish shared by the fixed post and moving leaf; it is implemented directly as "gate-finish" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.finish signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.finish tested the reviewed GATE structure, hinge, and placement decisions through One finish shared by the fixed post and moving leaf; the implementation fragment "gate-finish" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.finish implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly finish: string = "gate-finish";

  /**
   * Desaturated sRGB swatch reserved for this supporting object.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.color keeps responsibility for Desaturated sRGB swatch reserved for this supporting object in this declaration; the implementation fragment "#6f746e" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.color declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.color is a usable source artifact for Desaturated sRGB swatch reserved for this supporting object; it is implemented directly as "#6f746e" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.color signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.color tested the reviewed GATE structure, hinge, and placement decisions through Desaturated sRGB swatch reserved for this supporting object; the implementation fragment "#6f746e" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.color implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly color: string = "#6f746e";

  /**
   * Dielectric surface: the blocking proxy makes no metal claim.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.metallic keeps responsibility for Dielectric surface: the blocking proxy makes no metal claim in this declaration; the implementation fragment 0 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.metallic declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.metallic is a usable source artifact for Dielectric surface: the blocking proxy makes no metal claim; it is implemented directly as 0 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.metallic signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.metallic tested the reviewed GATE structure, hinge, and placement decisions through Dielectric surface: the blocking proxy makes no metal claim; the implementation fragment 0 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.metallic implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly metallic: number = 0;

  /**
   * Broad, non-mirror response that keeps the proxy silhouette readable.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.roughness keeps responsibility for Broad, non-mirror response that keeps the proxy silhouette readable in this declaration; the implementation fragment 0.82 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.roughness declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.roughness is a usable source artifact for Broad, non-mirror response that keeps the proxy silhouette readable; it is implemented directly as 0.82 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.roughness signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.roughness tested the reviewed GATE structure, hinge, and placement decisions through Broad, non-mirror response that keeps the proxy silhouette readable; the implementation fragment 0.82 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.roughness implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly roughness: number = 0.82;

  /**
   * Widest swing the hinge permits, in degrees about +Y.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.openDeg keeps responsibility for Widest swing the hinge permits, in degrees about +Y in this declaration; the implementation fragment 100 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.openDeg declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.openDeg is a usable source artifact for Widest swing the hinge permits, in degrees about +Y; it is implemented directly as 100 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.openDeg signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.openDeg tested the reviewed GATE structure, hinge, and placement decisions through Widest swing the hinge permits, in degrees about +Y; the implementation fragment 100 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.openDeg implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly openDeg: number = 100;

  /**
   * How tall the leaf stands, in metres.
   *
   * @evidence models/030-gate.md#gate-blocking-representation Derives the
   *   reviewed silhouette proportion from the standing SOLOIST reference.
   * @evidenceReview models/030-gate.md#gate-blocking-representation #a7078bf Read models/030-gate.md#gate-blocking-representation and height in src/objects/gate.ts; confirmed this citation after checking the claim that derives only the reviewed silhouette proportion, not functional clearance, from the standing SOLOIST reference.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.height keeps responsibility for How tall the leaf stands, in metres in this declaration; the implementation fragment { return soloist.height + this.silhouetteMargin; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.height declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.height is a usable source artifact for How tall the leaf stands, in metres; it is implemented directly as { return soloist.height + this.silhouetteMargin; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.height signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.height tested the reviewed GATE structure, hinge, and placement decisions through How tall the leaf stands, in metres; the implementation fragment { return soloist.height + this.silhouetteMargin; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.height implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public height(): number {
    return soloist.height + this.silhouetteMargin;
  }

  /**
   * How far away the ground ends, on the side away from the camera.
   *
   * Read off the world the shot actually stages rather than off a coordinate
   * copied once. The plaza sizes itself from the group standing on it, so a
   * larger chorus moves the edge; a gate carrying its own number would stay
   * where the old edge used to be, standing in open ground with nothing behind
   * it. A world with no ground under it is refused here rather than placing the
   * gate at the origin, which is a gate standing on top of the soloist.
   *
   * @evidence models/030-gate.md#gate-blocking-representation Reads the reviewed
   *   edge relation from the staged ground itself.
   * @evidenceReview models/030-gate.md#gate-blocking-representation #a7078bf Read models/030-gate.md#gate-blocking-representation and farEdgeZ in src/objects/gate.ts; confirmed this citation after checking the claim that reads the reviewed edge relation from the staged ground itself.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.farEdgeZ keeps responsibility for How far away the ground ends, on the side away from the camera in this declaration; the implementation fragment { // Folded rather than spread into 'Math.min', because a world may carry more // vertices than an argument list holds and a ground large enough to matter // is exactly the one introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.farEdgeZ declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.farEdgeZ is a usable source artifact for How far away the ground ends, on the side away from the camera; it is implemented directly as { // Folded rather than spread into 'Math.min', because a world may carry more // vertices than an argument list holds and a ground large enough to matter // is exactly the one rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.farEdgeZ signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.farEdgeZ tested the reviewed GATE structure, hinge, and placement decisions through How far away the ground ends, on the side away from the camera; the implementation fragment { // Folded rather than spread into 'Math.min', because a world may carry more // vertices than an argument list holds and a ground large enough to matter // is exactly the one shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.farEdgeZ implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public farEdgeZ(context: IAutoMovieShotBuildContext): number {
    // Folded rather than spread into `Math.min`, because a world may carry more
    // vertices than an argument list holds and a ground large enough to matter
    // is exactly the one this would fail on.
    let edge: number | null = null;
    for (const surface of context.world.surfaces)
      for (const vertex of surface.polygon)
        edge = edge === null ? vertex.z : Math.min(edge, vertex.z);
    if (edge === null)
      throw new Error(
        `The "${this.id}" gate needs staged ground to stand at the edge of.`,
      );
    return edge;
  }

  /**
   * How far the staged ground reaches toward positive x, in world metres.
   *
   * This is read independently of z because the production contract relates
   * the gate to both extents of the ground; treating a square's far-z value as
   * its x extent would silently move the gate when the ground becomes
   * rectangular. A world wholly at non-positive x has no positive half extent
   * on which to place this screen-right landmark, so it is refused.
   *
   * @evidence models/030-gate.md#gate-blocking-representation Reads the reviewed
   *   positive-half-extent relation from the staged ground itself.
   * @evidenceReview models/030-gate.md#gate-blocking-representation #a7078bf Read models/030-gate.md#gate-blocking-representation and positiveEdgeX in src/objects/gate.ts; confirmed this citation after checking the claim that reads the reviewed positive-half-extent relation from the staged ground itself.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.positiveEdgeX keeps responsibility for How far the staged ground reaches toward positive x, in world metres in this declaration; the implementation fragment { let edge: number | null = null; for (const surface of context.world.surfaces) for (const vertex of surface.polygon) edge = edge === null ? vertex.x : Math.max(edge introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.positiveEdgeX declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.positiveEdgeX is a usable source artifact for How far the staged ground reaches toward positive x, in world metres; it is implemented directly as { let edge: number | null = null; for (const surface of context.world.surfaces) for (const vertex of surface.polygon) edge = edge === null ? vertex.x : Math.max(edge rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.positiveEdgeX signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.positiveEdgeX tested the reviewed GATE structure, hinge, and placement decisions through How far the staged ground reaches toward positive x, in world metres; the implementation fragment { let edge: number | null = null; for (const surface of context.world.surfaces) for (const vertex of surface.polygon) edge = edge === null ? vertex.x : Math.max(edge shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.positiveEdgeX implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public positiveEdgeX(context: IAutoMovieShotBuildContext): number {
    let edge: number | null = null;
    for (const surface of context.world.surfaces)
      for (const vertex of surface.polygon)
        edge = edge === null ? vertex.x : Math.max(edge, vertex.x);
    if (edge === null)
      throw new Error(
        `The "${this.id}" gate needs staged ground to derive its positive-x edge from.`,
      );
    if (edge <= 0)
      throw new Error(
        `The "${this.id}" gate needs staged ground with a positive-x edge, but its greatest x coordinate is ${edge}.`,
      );
    return edge;
  }

  /**
   * Where the gate stands, in world metres.
   *
   * The far-edge z coordinate owns the boundary. Half the ground's positive-x
   * extent places the gate midway from that edge's centre to its positive-x
   * corner, which leaves a clear sightline beside the formation without
   * copying the plaza's current forty-metre half extent into this subject.
   *
   * @evidence models/030-gate.md#gate-blocking-representation Places the proxy
   *   at its reviewed far-edge relation on level ground.
   * @evidenceReview models/030-gate.md#gate-blocking-representation #a7078bf Read models/030-gate.md#gate-blocking-representation and position in src/objects/gate.ts; confirmed this citation after checking the claim that places the proxy at its reviewed far-edge relation on level ground.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.position keeps responsibility for Where the gate stands, in world metres in this declaration; the implementation fragment { return { x: this.positiveEdgeX(context) / 2, y: 0, z: this.farEdgeZ(context), }; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.position declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.position is a usable source artifact for Where the gate stands, in world metres; it is implemented directly as { return { x: this.positiveEdgeX(context) / 2, y: 0, z: this.farEdgeZ(context), }; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.position signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.position tested the reviewed GATE structure, hinge, and placement decisions through Where the gate stands, in world metres; the implementation fragment { return { x: this.positiveEdgeX(context) / 2, y: 0, z: this.farEdgeZ(context), }; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.position implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public position(context: IAutoMovieShotBuildContext): IAutoMovieVector3 {
    return {
      x: this.positiveEdgeX(context) / 2,
      y: 0,
      z: this.farEdgeZ(context),
    };
  }

  /**
   * The scene-graph id of the hinge once the gate is staged.
   *
   * A shot that swings this leaf addresses this node and nothing else, so the
   * id comes from the engine's own lowering rather than from a template literal
   * written here. A second spelling of the placement prefix agrees with the
   * first until one of them is edited, and a clip that addresses nothing is a
   * shot that renders a gate nobody opened.
   *
   * @evidence models/030-gate.md#gate-hinge-interface Resolves the one reviewed
   *   motion-writable hinge node.
   * @evidenceReview models/030-gate.md#gate-hinge-interface #e490241 Read models/030-gate.md#gate-hinge-interface and hingeNode in src/objects/gate.ts; confirmed this citation after checking the claim that resolves the one reviewed motion-writable hinge node.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.hingeNode keeps responsibility for The scene-graph id of the hinge once the gate is staged in this declaration; the implementation fragment { return placementChildNode(this.id, this.hinge); } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.hingeNode declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.hingeNode is a usable source artifact for The scene-graph id of the hinge once the gate is staged; it is implemented directly as { return placementChildNode(this.id, this.hinge); } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.hingeNode signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.hingeNode tested the reviewed GATE structure, hinge, and placement decisions through The scene-graph id of the hinge once the gate is staged; the implementation fragment { return placementChildNode(this.id, this.hinge); } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.hingeNode implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public hingeNode(): string {
    return placementChildNode(this.id, this.hinge);
  }

  /**
   * The two placeholder boxes, and which of them rides the hinge.
   *
   * Replace the geometry; keep the split. The post is the piece that never
   * moves and the leaf is the piece that does, and the articulation names the
   * leaf so that turning the hinge turns something the audience can see.
   */
  private model(): IAutoMovieModel {
    const height = this.height();
    return {
      id: this.id,
      name: null,
      origin: "generated",
      skeleton: null,
      affordances: [],
      materials: [
        {
          id: this.finish,
          name: "desaturated gate blocking finish",
          baseColor: { ...GATE_FINISH_LINEAR },
          metallic: this.metallic,
          roughness: this.roughness,
          emissive: null,
          opacity: 1,
          baseColorTexture: null,
        },
      ],
      parts: [
        {
          id: "post",
          name: null,
          geometry: {
            type: "primitive",
            shape: {
              type: "box",
              width: this.post,
              height,
              depth: this.post,
            },
          },
          material: this.finish,
          attachedBone: null,
          // Model-local: the post stands beside the leaf's hanging edge.
          transform: at({
            x: -this.width / 2 - this.post / 2,
            y: height / 2,
            z: 0,
          }),
        },
        {
          id: this.leaf,
          name: null,
          geometry: {
            type: "primitive",
            shape: {
              type: "box",
              width: this.width,
              height,
              depth: this.thickness,
            },
          },
          material: this.finish,
          attachedBone: null,
          // Model-local like every other part, because that is the frame the
          // engine measures a prop's volume in. Riding the hinge changes what
          // carries the leaf, never where the record says it stands.
          transform: at({ x: 0, y: height / 2, z: 0 }),
        },
      ],
      asset: null,
      body: null,
    };
  }

  /**
   * The prop specification the compiler forges and stages.
   *
   * @evidence models/030-gate.md#gate-hinge-interface Implements the reviewed
   *   leaf binding and zero-to-100-degree quaternion limit.
   * @evidenceReview models/030-gate.md#gate-hinge-interface #e490241 Read models/030-gate.md#gate-hinge-interface and design in src/objects/gate.ts; confirmed this citation after checking the claim that implements the reviewed leaf binding and zero-to-100-degree quaternion limit.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.design keeps responsibility for The prop specification the compiler forges and stages in this declaration; the implementation fragment { const half = (this.openDeg * Math.PI) / 360; const hinge: IAutoMovieNode = { id: this.hinge, name: null, parent: null, kind: "group", // The hanging edge, in the prop's own introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.design declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.design is a usable source artifact for The prop specification the compiler forges and stages; it is implemented directly as { const half = (this.openDeg * Math.PI) / 360; const hinge: IAutoMovieNode = { id: this.hinge, name: null, parent: null, kind: "group", // The hanging edge, in the prop's own rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.design signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.design tested the reviewed GATE structure, hinge, and placement decisions through The prop specification the compiler forges and stages; the implementation fragment { const half = (this.openDeg * Math.PI) / 360; const hinge: IAutoMovieNode = { id: this.hinge, name: null, parent: null, kind: "group", // The hanging edge, in the prop's own shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.design implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public design(): IAutoMoviePropSpec {
    const half = (this.openDeg * Math.PI) / 360;
    const hinge: IAutoMovieNode = {
      id: this.hinge,
      name: null,
      parent: null,
      kind: "group",
      // The hanging edge, in the prop's own frame.
      transform: at({ x: -this.width / 2, y: 0, z: 0 }),
      mesh: this.leaf,
      camera: null,
      light: null,
      skin: null,
    };
    return {
      node: this.id,
      model: this.model(),
      articulation: {
        nodes: [hinge],
        profile: {
          id: `${this.id}-hinge`,
          name: "hinge",
          controls: [],
          drivers: [],
          limits: [
            {
              // Shut at the identity turn, open at `openDeg` about +Y. The
              // bound is stated as the quaternion the engine clamps, so the
              // travel a shot may ask for is the travel this document fixed.
              channel: { kind: "node", node: "swing", path: "rotation" },
              min: [0, 0, 0, Math.cos(half)],
              max: [0, Math.sin(half), 0, 1],
            },
          ],
        },
        binding: {
          profile: `${this.id}-hinge`,
          root: this.hinge,
          instanceName: null,
          boneMap: { swing: this.hinge },
        },
      },
    };
  }

  /**
   * Where the staged scene puts it.
   *
   * Spec and placement are one decision. The relations a prop states are only
   * true at the transform it is staged with, so a subject that owned the first
   * and left the second to whichever shot happened to stage it would be a gate
   * that claims the plaza's edge from the middle of the ground.
   *
   * @evidence models/030-gate.md#gate-blocking-representation Stages the reviewed
   *   proxy square to level ground at its derived edge.
   * @evidenceReview models/030-gate.md#gate-blocking-representation #a7078bf Read models/030-gate.md#gate-blocking-representation and stage in src/objects/gate.ts; confirmed this citation after checking the claim that stages the reviewed proxy square to level ground at its derived edge.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.stage keeps responsibility for Where the staged scene puts it in this declaration; the implementation fragment { return { node: this.id, model: this.id, position: this.position(context), facingDeg: 0, }; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.stage declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.stage is a usable source artifact for Where the staged scene puts it; it is implemented directly as { return { node: this.id, model: this.id, position: this.position(context), facingDeg: 0, }; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.stage signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.stage tested the reviewed GATE structure, hinge, and placement decisions through Where the staged scene puts it; the implementation fragment { return { node: this.id, model: this.id, position: this.position(context), facingDeg: 0, }; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.stage implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public stage(context: IAutoMovieShotBuildContext): IAutoMovieStageSetPiece {
    return {
      node: this.id,
      model: this.id,
      position: this.position(context),
      facingDeg: 0,
    };
  }

  /**
   * What this object puts into a shot.
   *
   * The registry entry and the placement travel together, because the compiler
   * joins them on this one node id: a specification with no placement is a prop
   * nothing stages, and a placement with no specification is a box with no
   * moving part.
   *
   * @evidence models/030-gate.md#gate-blocking-representation Contributes both
   *   reviewed prop specification and placement under one node identity.
   * @evidenceReview models/030-gate.md#gate-blocking-representation #a7078bf Read models/030-gate.md#gate-blocking-representation and render in src/objects/gate.ts; confirmed this citation after checking the claim that contributes both reviewed prop specification and placement under one node identity.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGate.render keeps responsibility for What this object puts into a shot in this declaration; the implementation fragment { return { props: [this.design()], set: [this.stage(context)] }; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGate.render declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGate.render is a usable source artifact for What this object puts into a shot; it is implemented directly as { return { props: [this.design()], set: [this.stage(context)] }; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGate.render signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGate.render tested the reviewed GATE structure, hinge, and placement decisions through What this object puts into a shot; the implementation fragment { return { props: [this.design()], set: [this.stage(context)] }; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGate.render implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public render(
    context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return { props: [this.design()], set: [this.stage(context)] };
  }
}

/**
 * The production's one gate.
 *
 * The class owns the exact model file; this exported instance separately
 * answers for constructing that reviewed prop once.
 *
 * @evidence models/030-gate.md#gate-blocking-representation Instantiates the
 *   reviewed gate owner once for the production.
 * @evidenceReview models/030-gate.md#gate-blocking-representation #a7078bf Read models/030-gate.md#gate-blocking-representation and gate in src/objects/gate.ts; confirmed this citation after checking the claim that instantiates the reviewed gate owner once for the production.
 * @evidence principles/core/source-units.md#source-scope-preservation gate keeps responsibility for the exported gate source owner and its declared value or behavior in this declaration; the implementation fragment new PlazaGate() introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete gate declaration and implementation with the reviewed GATE structure, hinge, and placement decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion gate is a usable source artifact for the exported gate source owner and its declared value or behavior; it is implemented directly as new PlazaGate() rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable gate signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing gate tested the reviewed GATE structure, hinge, and placement decisions through the exported gate source owner and its declared value or behavior; the implementation fragment new PlazaGate() shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete gate implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export const gate = new PlazaGate();
