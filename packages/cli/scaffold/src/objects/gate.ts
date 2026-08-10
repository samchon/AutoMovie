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
 * below answers to `docs/objects/gate.md`; the boxes answer to nothing, which
 * is the difference between an object and a piece of scenery somebody typed.
 *
 * No shot in this starter stages it yet, which is the one thing to fix first
 * when you copy the shape. Staging it is one line in a shot's builder, and it
 * has to be both halves at once, because the compiler joins them on this node
 * id: a registry entry with no placement is a prop nothing stands anywhere, and
 * a placement with no registry entry is a box the engine never forges.
 *
 * ```ts
 * const fixture = gate.render(context);
 * return {
 *   props: [...(fixture.props ?? [])],
 *   stage: { ..., set: [...(fixture.set ?? [])] },
 *   ...
 * };
 * ```
 */
export class PlazaGate extends AutoMovieSubject<IAutoMoviePropSpec> {
  public readonly id = "plaza-gate";

  /** Part id of the piece that turns, and the joint that turns it. */
  public readonly leaf = "leaf";

  /** Joint id of the single hinge, before the placement prefix. */
  public readonly hinge = "hinge";

  /** Clear width of the leaf, in metres. */
  public readonly width: number = 0.9;

  /**
   * Clearance kept above the figure that walks through, in metres.
   *
   * The leaf's height is derived from this rather than authored beside it: the
   * specification fixes the opening against the production's human scale, and
   * two independently authored numbers is how an opening comes to be shorter
   * than the figure it is for.
   */
  public readonly headroom: number = 0.3;

  /** Thickness of the leaf, in metres. */
  public readonly thickness: number = 0.06;

  /** Width and depth of the square post the leaf hangs on, in metres. */
  public readonly post: number = 0.12;

  /** Widest swing the hinge permits, in degrees about +Y. */
  public readonly openDeg: number = 100;

  /**
   * How tall the leaf stands, in metres.
   *
   * @evidence docs/objects/gate.md Requires an opening a figure could walk
   *   through at the production's human scale, which is what this derives.
   */
  public height(): number {
    return soloist.height + this.headroom;
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
   * @evidence docs/objects/gate.md Requires the gate at the plaza's far edge,
   *   which is the edge this reads off the staged ground itself.
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
   * Where the gate stands, in world metres.
   *
   * @evidence docs/objects/gate.md Requires the gate at the plaza's far edge,
   *   square to the ground and facing the figures.
   */
  public position(context: IAutoMovieShotBuildContext): IAutoMovieVector3 {
    return { x: 0, y: 0, z: this.farEdgeZ(context) };
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
   * @evidence docs/objects/gate.md Requires one hinge and only one, which is
   *   the single channel this names.
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
      materials: [],
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
          material: null,
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
          material: null,
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
   * @evidence docs/objects/gate.md Implements the single hinge, the leaf that
   *   rides it, and the travel that specification bounds, and claims no room or
   *   wall because this production has no building to claim one in.
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
   * @evidence docs/objects/gate.md Requires the gate square to the ground at
   *   the far edge, facing the figures.
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
   * @evidence docs/objects/gate.md Stages the one changeable thing this
   *   specification puts on the ground.
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
 * The citation lives on the instance rather than on {@link PlazaGate} itself,
 * because `@ttsc/evidence` does not yet select a class as a unit
 * (samchon/ttsc#1121), and its measured facts cannot cite at all for the same
 * reason.
 *
 * @evidence docs/objects/gate.md Implements the scale, the single moving part,
 *   the travel, and the placement that specification states, and claims nothing
 *   it does not.
 */
export const gate = new PlazaGate();
