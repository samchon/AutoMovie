import {
  AutoMovieSubject,
  AutoMovieSubjectGroup,
  type IAutoMovieSubjectContribution,
  mergeAutoMovieSubjectContributions,
} from "@automovie/engine";
import type {
  IAutoMovieShotBuildContext,
  IAutoMovieSpace,
  IAutoMovieSurface,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import { army } from "../formations/army";

/**
 * A piece of the world: a surface, a landmark, a region where something
 * happens.
 *
 * A place is made of things the same way a unit is made of members, and each of
 * those things is a subject. Its geometry does not depend on the shot it
 * appears in, so a piece states it through {@link place} and its `render` simply
 * hands the same answer to whichever shot asks. That split is the point:
 * geometry is context-free and performance is not, and a class that pretended
 * otherwise would need a shot before it could say where it is.
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
 */
export class SignalGround extends WorldPiece {
  public readonly id = "ground";

  /** Clear ground kept beyond the farthest member, in metres. */
  public readonly margin = 1;

  /**
   * Half-extent of the square field, in metres.
   *
   * Derived from the unit that stands on it rather than authored beside it. The
   * specification states its requirement as a relation, that the ranks must end
   * inside the place, and two independently authored numbers is how this field
   * came to be a third the size of its own army. Deriving makes the relation
   * true by construction, so a change to the unit carries the ground with it.
   */
  public halfExtent(): number {
    return army.reach() + this.margin;
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
   * The same square, as the patch a scene stands on and the viewer draws.
   *
   * Measured once. A shot that spelled these corners out again would be a
   * second ground beside this one, and the second is the one that decides
   * pixels: the scene keeps the space a shot staged, and the viewer builds its
   * meshes from it. That is how a field corrected in the design record went on
   * drawing a floor a third the size of the unit standing on it.
   *
   * @evidence docs/world/signal-field.md Requires the ranks to end inside the
   *   place, which is a claim about the ground the audience sees.
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
 * The named point the sentinel steps to.
 *
 * A landmark exists so a shot contract can say where the gesture happened
 * without restating a coordinate, which is exactly why it is a subject with an
 * id rather than three numbers inside a shot.
 */
export class SignalGroundMark extends WorldPiece {
  public readonly id = "signal-ground";

  /** Readable radius around the marked point, in metres. */
  public readonly radius = 3;

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
 * Drifting smoke, and the region it drifts in.
 *
 * The recipe and the zone travel together because neither means anything alone:
 * a recipe nothing activates is dead configuration, and a zone with no recipe
 * has nothing to emit.
 */
export class BattleSmoke extends WorldPiece {
  public readonly id = "signal-smoke";

  /** Recipe identity the zone activates. */
  public readonly recipe = "battle-smoke";

  /** Deterministic seed for the emission, declared rather than drawn. */
  public readonly seed = 1416;

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
 * The signal field, as the one world this production stages on.
 *
 * The world is a group like any other: it holds pieces and is composed from
 * them. Its record is the merge of what its pieces place, so adding a hill
 * means adding a piece rather than editing an array in the middle of a blob.
 */
export class SignalField extends AutoMovieSubjectGroup<
  IAutoMovieWorldDesign,
  WorldPiece
> {
  public readonly id = "starter-world";

  /** The ground, its named point, and the smoke that drifts over it. */
  public readonly ground = new SignalGround();
  public readonly mark = new SignalGroundMark();
  public readonly smoke = new BattleSmoke();

  public members(): readonly WorldPiece[] {
    return [this.ground, this.mark, this.smoke];
  }

  /**
   * The space a shot stages, composed from the pieces that are ground.
   *
   * A shot names the world and stands on it rather than restating its corners.
   * Everything a piece calls a patch is walkable here, because this world has
   * no standable-but-forbidden top; a world that grows one states it where the
   * piece is defined rather than here.
   *
   * @evidence docs/world/signal-field.md Requires one open level place, which
   *   is what a shot stands its figures on.
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
   * @evidence docs/world/signal-field.md Requires one place carrying the named
   *   point and the extent, which this composes rather than transcribes.
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
      // A piece that places a population (a forest, a field of rubble) must
      // reach the record. Omitting the key would drop what the piece placed
      // without saying so, which is worse than refusing it.
      ...(placed.instanceSets === undefined
        ? {}
        : { instanceSets: [...placed.instanceSets] }),
    };
  }
}

/**
 * The production's one world.
 *
 * Carries the citation for the field and every piece standing on it, until a
 * class can carry its own (samchon/ttsc#1121).
 *
 * @evidence docs/world/signal-field.md Implements the open level ground, the
 *   named ground point, and the extent that specification requires.
 */
export const signalField = new SignalField();
