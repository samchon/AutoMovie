import type { IAutoMovieSubjectContribution } from "@automovie/engine";
import {
  AutoMovieSubject,
  AutoMovieSubjectGroup,
  mergeAutoMovieSubjectContributions,
} from "@automovie/engine";
import type {
  IAutoMovieShotBuildContext,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

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
 * @evidence docs/world/signal-field.md Implements the open level ground and
 *   the extent that specification requires the ranks to end inside.
 */
export class SignalGround extends WorldPiece {
  public readonly id = "ground";

  /**
   * Half-extent of the square field, in metres.
   *
   * Authored rather than derived from the unit's footprint. The specification
   * states the requirement as a relation — the ranks must end inside frame —
   * and `army.footprint()` now makes that relation checkable, which is a
   * separate question from what this starter ships.
   *
   * @evidence docs/world/signal-field.md States the extent must contain the
   *   army's ranks at the film's widest shot.
   */
  public readonly halfExtent = 10;

  public place(): IAutoMovieSubjectContribution {
    const half = this.halfExtent;
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
}

/**
 * The named point the sentinel steps to.
 *
 * A landmark exists so a shot contract can say where the gesture happened
 * without restating a coordinate, which is exactly why it is a subject with an
 * id rather than three numbers inside a shot.
 *
 * @evidence docs/world/signal-field.md Names `signal-ground` as the point a
 *   shot contract cites instead of restating a coordinate.
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
 *
 * @evidence docs/world/signal-field.md States the field carries no feature
 *   that competes with a silhouette, which is the budget this stays inside.
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
 *
 * @evidence docs/world/signal-field.md Implements the open level ground, the
 *   named ground point, and the extent that specification requires.
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
    };
  }
}

/** The production's one world. */
export const signalField = new SignalField();
