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
 * @evidence models/040-plaza.md Defines the context-free contribution boundary
 *   shared by the reviewed ground, centre landmark, and haze pieces of PLAZA.
 * @evidenceReview models/040-plaza.md #87863be Read models/040-plaza.md and WorldPiece in src/world/plaza.ts; confirmed that the abstraction defines the context-free contribution boundary shared by the reviewed ground, centre landmark, and haze pieces, while its H2 citation delimits that common world-piece boundary.
 * @evidence models/040-plaza.md#plaza-world-composition Defines the common
 *   context-free contribution boundary for every reviewed world piece.
 * @evidenceReview models/040-plaza.md#plaza-world-composition #dc0afe8 Read models/040-plaza.md#plaza-world-composition and WorldPiece in src/world/plaza.ts; confirmed this citation after checking the claim that defines the common context-free contribution boundary for every reviewed world piece.
 * @evidence principles/model-sources.md#design-owned-construction Keeps world
 *   pieces as implementations of the cited model design.
 * @evidenceReview principles/model-sources.md#design-owned-construction #6cf1a71 Read principles/model-sources.md#design-owned-construction and WorldPiece in src/world/plaza.ts; confirmed this citation after checking the claim that keeps world pieces as implementations of the cited model design.
 * @evidence principles/model-sources.md#deterministic-build Returns the same
 *   placed contribution from the same piece state in every shot.
 * @evidenceReview principles/model-sources.md#deterministic-build #bf45408 Read principles/model-sources.md#deterministic-build and WorldPiece in src/world/plaza.ts; confirmed this citation after checking the claim that returns the same placed contribution from the same piece state in every shot.
 * @evidence principles/model-sources.md#unsupported-fidelity-is-explicit Makes
 *   unsupported enclosure and final atmosphere fidelity absent from the API.
 * @evidenceReview principles/model-sources.md#unsupported-fidelity-is-explicit #d7527d5 Read principles/model-sources.md#unsupported-fidelity-is-explicit and WorldPiece in src/world/plaza.ts; confirmed this citation after checking the claim that makes unsupported enclosure and final atmosphere fidelity absent from the API.
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
 * @evidence models/040-plaza.md Owns the one reviewed level square whose
 *   derived extent contains the formation and supplies both ground records.
 * @evidenceReview models/040-plaza.md #87863be Read models/040-plaza.md and PlazaGround in src/world/plaza.ts; confirmed that the class owns the one reviewed level square whose derived extent contains the formation and supplies both ground records, while its H2 citation delimits the ground subset it realizes.
 * @evidence models/040-plaza.md#plaza-world-composition Implements the one
 *   derived level square used by both world and rendered surface records.
 * @evidenceReview models/040-plaza.md#plaza-world-composition #dc0afe8 Read models/040-plaza.md#plaza-world-composition and PlazaGround in src/world/plaza.ts; confirmed this citation after checking the claim that implements the one derived level square used by both world and rendered surface records.
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
   * @evidence models/040-plaza.md#plaza-world-composition Reads the reviewed
   *   level-surface height through the engine's owning query.
   * @evidenceReview models/040-plaza.md#plaza-world-composition #dc0afe8 Read models/040-plaza.md#plaza-world-composition and heightAt in src/world/plaza.ts; confirmed this citation after checking the claim that reads the reviewed level-surface height through the engine's owning query.
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
   * @evidence models/040-plaza.md#plaza-world-composition Emits the same
   *   reviewed polygon for the floor a delivered scene draws.
   * @evidenceReview models/040-plaza.md#plaza-world-composition #dc0afe8 Read models/040-plaza.md#plaza-world-composition and patches in src/world/plaza.ts; confirmed this citation after checking the claim that emits the same reviewed polygon for the floor a delivered scene draws.
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
 * @evidence models/040-plaza.md Owns the reviewed ground-level origin marker
 *   that lets shots address `plaza-center` without copying its coordinates.
 * @evidenceReview models/040-plaza.md #87863be Read models/040-plaza.md and PlazaCenterMark in src/world/plaza.ts; confirmed that the class owns the reviewed ground-level origin marker used by shots as `plaza-center`, while its H2 citation delimits the landmark subset it realizes.
 * @evidence models/040-plaza.md#plaza-world-composition Implements the reviewed
 *   named origin and its deterministic landmark record.
 * @evidenceReview models/040-plaza.md#plaza-world-composition #dc0afe8 Read models/040-plaza.md#plaza-world-composition and PlazaCenterMark in src/world/plaza.ts; confirmed this citation after checking the claim that implements the reviewed named origin and its deterministic landmark record.
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
 * @evidence models/040-plaza.md Owns the reviewed seeded smoke recipe and the
 *   bounded low-contrast PLAZA region that activates it.
 * @evidenceReview models/040-plaza.md #87863be Read models/040-plaza.md and PlazaHaze in src/world/plaza.ts; confirmed that the class owns the reviewed seeded smoke recipe together with its bounded low-contrast PLAZA region, while its H2 citation delimits the atmosphere subset it realizes.
 * @evidence models/040-plaza.md#plaza-atmosphere-proxy Implements the one
 *   reviewed seeded smoke recipe and bounded low-contrast effect zone.
 * @evidenceReview models/040-plaza.md#plaza-atmosphere-proxy #bf7943e Read models/040-plaza.md#plaza-atmosphere-proxy and PlazaHaze in src/world/plaza.ts; confirmed this citation after checking the claim that implements the one reviewed seeded smoke recipe and bounded low-contrast effect zone.
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
 * @evidence models/040-plaza.md Owns the reviewed composition of level ground,
 *   centre landmark, bounded haze, and their shared world and surface records.
 * @evidenceReview models/040-plaza.md #87863be Read models/040-plaza.md and Plaza in src/world/plaza.ts; confirmed that the class owns the reviewed composition of level ground, centre landmark, bounded haze, and their shared world and surface records without answering another model file.
 * @evidence models/040-plaza.md#plaza-world-composition Composes exactly the
 *   reviewed ground, origin marker, and atmosphere pieces into one world.
 * @evidenceReview models/040-plaza.md#plaza-world-composition #dc0afe8 Read models/040-plaza.md#plaza-world-composition and Plaza in src/world/plaza.ts; confirmed this citation after checking the claim that composes exactly the reviewed ground, origin marker, and atmosphere pieces into one world.
 * @evidence models/040-plaza.md#plaza-neutral-review-views Exposes the shared
 *   surface, bounds, and piece identities the neutral review set compares.
 * @evidenceReview models/040-plaza.md#plaza-neutral-review-views #a5bb28d Read models/040-plaza.md#plaza-neutral-review-views and Plaza in src/world/plaza.ts; confirmed this citation after checking the claim that exposes the shared surface, bounds, and piece identities the neutral review set compares.
 * @evidence principles/model-sources.md#design-owned-construction Adds no world
 *   piece or spatial relation outside the cited design.
 * @evidenceReview principles/model-sources.md#design-owned-construction #6cf1a71 Read principles/model-sources.md#design-owned-construction and Plaza in src/world/plaza.ts; confirmed this citation after checking the claim that adds no world piece or spatial relation outside the cited design.
 * @evidence principles/model-sources.md#deterministic-build Merges the same
 *   ordered piece contributions into the same world record.
 * @evidenceReview principles/model-sources.md#deterministic-build #bf45408 Read principles/model-sources.md#deterministic-build and Plaza in src/world/plaza.ts; confirmed this citation after checking the claim that merges the same ordered piece contributions into the same world record.
 * @evidence principles/model-sources.md#unsupported-fidelity-is-explicit Keeps
 *   enclosure and physically based atmosphere outside this blocking model.
 * @evidenceReview principles/model-sources.md#unsupported-fidelity-is-explicit #d7527d5 Read principles/model-sources.md#unsupported-fidelity-is-explicit and Plaza in src/world/plaza.ts; confirmed this citation after checking the claim that keeps enclosure and physically based atmosphere outside this blocking model.
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
   * @evidence models/040-plaza.md#plaza-world-composition Composes the reviewed
   *   ground patches into the one staged space.
   * @evidenceReview models/040-plaza.md#plaza-world-composition #dc0afe8 Read models/040-plaza.md#plaza-world-composition and space in src/world/plaza.ts; confirmed this citation after checking the claim that composes the reviewed ground patches into the one staged space.
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
   * @evidence models/040-plaza.md#plaza-world-composition Composes the reviewed
   *   surface, landmark, instance, and effect records without transcribing them.
   * @evidenceReview models/040-plaza.md#plaza-world-composition #dc0afe8 Read models/040-plaza.md#plaza-world-composition and design in src/world/plaza.ts; confirmed this citation after checking the claim that composes the reviewed surface, landmark, instance, and effect records without transcribing them.
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
 * @evidence models/040-plaza.md#plaza-world-composition Instantiates the
 *   reviewed complete world once.
 * @evidenceReview models/040-plaza.md#plaza-world-composition #dc0afe8 Read models/040-plaza.md#plaza-world-composition and plaza in src/world/plaza.ts; confirmed this citation after checking the claim that instantiates the reviewed complete world once.
 */
export const plaza = new Plaza();
