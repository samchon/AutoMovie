import {
  AutoMovieSubject,
  AutoMovieSubjectGroup,
  type IAutoMovieSubjectContribution,
  mergeAutoMovieSubjectContributions,
  worldSurfaceHeight,
} from "@automovie/engine";
import type {
  IAutoMovieShotBuildContext,
  IAutoMovieSpace,
  IAutoMovieSurface,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import { chorus } from "../formations/chorus";

/**
 * A piece of the world: a surface, a landmark, a region where something
 * happens.
 *
 * A place is made of things the same way a group is made of members, and each
 * of those things is a subject. Its geometry does not depend on the shot it
 * appears in, so a piece states it through {@link place} and its `render` simply
 * hands the same answer to whichever shot asks. That split is the point:
 * geometry is context-free and performance is not, and a class that pretended
 * otherwise would need a shot before it could say where it is.
 *
 * @evidence docs/world/plaza.md Every piece the one specified place is made of
 *   enters the world through this class, and the geometry-before-performance
 *   split it fixes is what lets that place state its extent and its named point
 *   without waiting for a shot to ask.
 */
export abstract class WorldPiece extends AutoMovieSubject<IAutoMovieSubjectContribution> {
  /** What this piece puts into the world, independent of any shot. */
  public abstract place(): IAutoMovieSubjectContribution;

  /**
   * The standable patches this piece contributes to a staged scene, if any.
   *
   * A world surface and a scene surface are two readings of one piece of
   * ground: the first answers where the terrain is, the second is what the
   * engine stands feet on and what the viewer draws. A piece that is ground
   * answers both from the same measurement; a landmark or an effect region is
   * neither and answers with nothing.
   */
  public patches(): readonly IAutoMovieSurface[] {
    return [];
  }

  public design(): IAutoMovieSubjectContribution {
    return this.place();
  }

  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return this.place();
  }
}

/**
 * The level ground everything stands on.
 *
 * Its extent is one number rather than four corners, because the shape the
 * specification asks for is a square of open ground and a polygon spelled out
 * corner by corner is four chances to disagree with itself.
 *
 * @evidence docs/world/plaza.md Answers the specification's Extent section: the
 *   open level ground the rows must end inside is this class and nothing else,
 *   and the half-extent it derives is the number that claim resolves to.
 */
export class PlazaGround extends WorldPiece {
  public readonly id = "ground";

  /** Clear ground kept beyond the farthest member, in metres. */
  public readonly margin: number = 1;

  /**
   * Half-extent of the square plaza, in metres.
   *
   * Derived from the group that stands on it rather than authored beside it.
   * The specification states its requirement as a relation, that the rows must
   * end inside the place, and two independently authored numbers is how this
   * plaza came to be a third the size of its own chorus. Deriving makes the
   * relation true by construction, so a change to the group carries the ground
   * with it.
   */
  public halfExtent(): number {
    return chorus.reach() + this.margin;
  }

  public place(): IAutoMovieSubjectContribution {
    const half = this.halfExtent();
    return {
      surfaces: [
        {
          id: this.id,
          polygon: [
            { x: -half, z: -half },
            { x: half, z: -half },
            { x: half, z: half },
            { x: -half, z: half },
          ],
          height: { kind: "constant", value: 0 },
          walkable: true,
        },
      ],
    };
  }

  /**
   * How high this ground is where something stands on it, in metres.
   *
   * The question is asked of the record this piece emits, through the engine
   * function that owns the answer. A class that read `height.value` itself
   * would be right for a level plaza and wrong the day the piece slopes, and a
   * second answer that agrees until it does not is the failure the whole
   * one-owner rule exists to prevent.
   *
   * @evidence docs/world/plaza.md Requires one level open place, which is the
   *   height this returns everywhere inside it.
   */
  public heightAt(point: { x: number; z: number }): number {
    return worldSurfaceHeight(this.place().surfaces![0]!, point);
  }

  /**
   * The same square, as the patch a scene stands on and the viewer draws.
   *
   * Measured once. A shot that spelled these corners out again would be a
   * second ground beside this one, and the second is the one that decides
   * pixels: the scene keeps the space a shot staged, and the viewer builds its
   * meshes from it. That is how a plaza corrected in the design record went on
   * drawing a floor a third the size of the group standing on it.
   *
   * @evidence docs/world/plaza.md Requires the rows to end inside the place,
   *   which is a claim about the ground the audience sees.
   */
  public patches(): readonly IAutoMovieSurface[] {
    const half = this.halfExtent();
    return [
      {
        id: this.id,
        kind: "floor",
        // Only `x` and `z` are read; the height comes from the anchor.
        polygon: [
          { x: -half, y: 0, z: -half },
          { x: half, y: 0, z: -half },
          { x: half, y: 0, z: half },
          { x: -half, y: 0, z: half },
        ],
        anchor: { x: 0, y: 0, z: 0 },
        rampTo: null,
      },
    ];
  }
}

/**
 * The named point the soloist steps to.
 *
 * A landmark exists so a shot contract can say where the gesture happened
 * without restating a coordinate, which is exactly why it is a subject with an
 * id rather than three numbers inside a shot.
 *
 * @evidence docs/world/plaza.md Answers the specification's Landmarks section:
 *   `plaza-center` is named there precisely so a contract can point at the
 *   gesture without a coordinate, and this class is where that id exists.
 */
export class PlazaCenterMark extends WorldPiece {
  public readonly id = "plaza-center";

  /** Readable radius around the marked point, in metres. */
  public readonly radius: number = 3;

  public place(): IAutoMovieSubjectContribution {
    return {
      landmarks: [
        {
          id: this.id,
          position: { x: 0, y: 0, z: 0 },
          radius: this.radius,
          meaning: "The readable center of the starter frame.",
        },
      ],
    };
  }
}

/**
 * Drifting haze, and the region it drifts in.
 *
 * The recipe and the zone travel together because neither means anything alone:
 * a recipe nothing activates is dead configuration, and a zone with no recipe
 * has nothing to emit.
 *
 * @evidence docs/world/plaza.md Held to the specification's opening rule that
 *   the place carries no feature competing with a silhouette: this is the one
 *   piece that could, so its bounds and opacity are declared here where that
 *   rule can be read against them rather than tuned inside a shot.
 */
export class PlazaHaze extends WorldPiece {
  public readonly id = "plaza-haze";

  /** Recipe identity the zone activates. */
  public readonly recipe = "plaza-haze-smoke";

  /** Deterministic seed for the emission, declared rather than drawn. */
  public readonly seed: number = 1416;

  public place(): IAutoMovieSubjectContribution {
    return {
      effectRecipes: [
        {
          id: this.recipe,
          kind: "smoke",
          seed: this.seed,
          emission: { rate: 40, burst: 64, duration: 4 },
          particle: {
            lifetime: { min: 2, max: 4 },
            size: { min: 0.25, max: 0.8 },
            color: "#89918a",
            opacity: { min: 0.12, max: 0.38 },
          },
          motion: {
            wind: { x: 0.18, y: 0, z: -0.08 },
            rise: 0.2,
            turbulence: 0.15,
          },
          budget: { maxParticles: 256, lodDistance: 25 },
          blend: "alpha",
        },
      ],
      effectZones: [
        {
          id: this.id,
          recipe: this.recipe,
          bounds: {
            min: { x: -4, y: 0.05, z: -8 },
            max: { x: 4, y: 1.2, z: -2 },
          },
          seed: 7,
        },
      ],
    };
  }
}

/**
 * The plaza, as the one world this production stages on.
 *
 * The world is a group like any other: it holds pieces and is composed from
 * them. Its record is the merge of what its pieces place, so adding a step
 * means adding a piece rather than editing an array in the middle of a blob.
 *
 * @evidence docs/world/plaza.md Is the whole of PLAZA rather than a part of it:
 *   the specification describes one place, and this is the single subject a
 *   shot names when it stages that place.
 */
export class Plaza extends AutoMovieSubjectGroup<
  IAutoMovieWorldDesign,
  WorldPiece
> {
  public readonly id = "starter-world";

  /** The ground, its named point, and the haze that drifts over it. */
  public readonly ground = new PlazaGround();
  public readonly mark = new PlazaCenterMark();
  public readonly haze = new PlazaHaze();

  public members(): readonly WorldPiece[] {
    return [this.ground, this.mark, this.haze];
  }

  /**
   * The space a shot stages, composed from the pieces that are ground.
   *
   * A shot names the world and stands on it rather than restating its corners.
   * Everything a piece calls a patch is walkable here, because this world has
   * no standable-but-forbidden top; a world that grows one states it where the
   * piece is defined rather than here.
   *
   * @evidence docs/world/plaza.md Requires one open level place, which is what
   *   a shot stands its figures on.
   */
  public space(): IAutoMovieSpace {
    const surfaces = this.members().flatMap((piece) => [...piece.patches()]);
    return {
      id: `${this.id}-space`,
      surfaces,
      walkable: surfaces.map((surface) => surface.id),
    };
  }

  /**
   * The world record, assembled from what its pieces place.
   *
   * @evidence docs/world/plaza.md Requires one place carrying the named point
   *   and the extent, which this composes rather than transcribes.
   */
  public design(): IAutoMovieWorldDesign {
    const placed = mergeAutoMovieSubjectContributions(
      this.members().map((piece) => piece.place()),
    );
    return {
      id: this.id,
      units: "meter",
      landmarks: [...(placed.landmarks ?? [])],
      surfaces: [...(placed.surfaces ?? [])],
      routes: [...(placed.routes ?? [])],
      effectRecipes: [...(placed.effectRecipes ?? [])],
      effectZones: [...(placed.effectZones ?? [])],
      // A piece that places a population (a row of planters, a set of markers)
      // must reach the record. Omitting the key would drop what the piece
      // placed without saying so, which is worse than refusing it.
      ...(placed.instanceSets === undefined
        ? {}
        : { instanceSets: [...placed.instanceSets] }),
    };
  }
}

/**
 * The production's one world.
 *
 * Carries the citation for the plaza and every piece standing on it, until a
 * class can carry its own (samchon/ttsc#1121).
 *
 * @evidence docs/world/plaza.md Implements the open level ground, the named
 *   ground point, and the extent that specification requires.
 */
export const plaza = new Plaza();
