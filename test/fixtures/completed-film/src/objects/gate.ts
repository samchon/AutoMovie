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
 * @evidenceReview obligations/design/model-sources.md#design-owned-construction #41ffc4f Read obligations/design/model-sources.md#design-owned-construction and PlazaGate in src/objects/gate.ts; confirmed this citation after checking the claim that keeps every visible dimension and structural split owned by the cited model design.
 * @evidence obligations/design/model-sources.md#deterministic-build Produces the same
 *   prop, articulation, and placement from the same world context.
 * @evidenceReview obligations/design/model-sources.md#deterministic-build #288cbb3 Read obligations/design/model-sources.md#deterministic-build and PlazaGate in src/objects/gate.ts; confirmed this citation after checking the claim that produces the same prop, articulation, and placement from the same world context.
 * @evidence obligations/design/model-sources.md#unsupported-fidelity-is-explicit Keeps
 *   the two-box form visibly documented as a blocking proxy.
 * @evidenceReview obligations/design/model-sources.md#unsupported-fidelity-is-explicit #35050b3 Read obligations/design/model-sources.md#unsupported-fidelity-is-explicit and PlazaGate in src/objects/gate.ts; confirmed this citation after checking the claim that keeps the two-box form visibly documented as a blocking proxy.
 */
export class PlazaGate extends AutoMovieSubject<IAutoMoviePropSpec> {
  public readonly id = "plaza-gate";

  /** Part id of the piece that turns, and the joint that turns it. */
  public readonly leaf = "leaf";

  /** Joint id of the single hinge, before the placement prefix. */
  public readonly hinge = "hinge";

  /** Authored visual width of the leaf, in metres. */
  public readonly width: number = 0.9;

  /**
   * Visual height margin above the standing SOLOIST reference, in metres.
   *
   * This maintains the reviewed silhouette proportion and does not claim a
   * passage, user, carried-load, mobility-aid, or equipment clearance.
   */
  public readonly silhouetteMargin: number = 0.3;

  /** Thickness of the leaf, in metres. */
  public readonly thickness: number = 0.06;

  /** Width and depth of the square post the leaf hangs on, in metres. */
  public readonly post: number = 0.12;

  /** One finish shared by the fixed post and moving leaf. */
  public readonly finish: string = "gate-finish";

  /** Desaturated sRGB swatch reserved for this supporting object. */
  public readonly color: string = "#6f746e";

  /** Dielectric surface: the blocking proxy makes no metal claim. */
  public readonly metallic: number = 0;

  /** Broad, non-mirror response that keeps the proxy silhouette readable. */
  public readonly roughness: number = 0.82;

  /** Widest swing the hinge permits, in degrees about +Y. */
  public readonly openDeg: number = 100;

  /**
   * How tall the leaf stands, in metres.
   *
   * @evidence models/030-gate.md#gate-blocking-representation Derives the
   *   reviewed silhouette proportion from the standing SOLOIST reference.
   * @evidenceReview models/030-gate.md#gate-blocking-representation #a7078bf Read models/030-gate.md#gate-blocking-representation and height in src/objects/gate.ts; confirmed this citation after checking the claim that derives only the reviewed silhouette proportion, not functional clearance, from the standing SOLOIST reference.
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
 */
export const gate = new PlazaGate();
