import { HUMANOID_GAITS } from "@automovie/archetypes";
import {
  AutoMovieSubject,
  type IAutoMovieSubjectContribution,
} from "@automovie/engine";
import type {
  IAutoMovieModelRecipe,
  IAutoMovieProfile,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";

import { soloist } from "./soloist";

/**
 * One member of the chorus, at hero detail, with its two coarser tiers.
 *
 * A member never appears alone: the film asks the audience to read the group,
 * not an individual inside it. So this subject renders nothing on its own and
 * the formation that holds it is what a shot stages. What it owns is the
 * member's measured facts and the LOD ladder those facts imply.
 *
 * @evidence docs/characters/chorus.md Answers the Scale section for one member:
 *   the document states 1.7 m and "a head shorter than the soloist" at once,
 *   and this class is where both readings are held against each other.
 */
export class ChorusMember extends AutoMovieSubject<IAutoMovieModelRecipe> {
  public readonly id = "chorus-hero";

  /**
   * A head, in metres, at this production's human scale.
   *
   * The one place the phrase "a head shorter" becomes a number.
   */
  public static readonly HEAD: number = 0.1;

  /**
   * The height the specification states, in metres.
   *
   * Kept beside the derivation so the two can be compared. The document says
   * both things at once, that a member is 1.7 m and that it is a head shorter
   * than the soloist, and a subject that only derived would go on being
   * internally consistent while drifting away from the number the film was
   * written around.
   */
  public static readonly SPECIFIED_HEIGHT: number = 1.7;

  /**
   * How far a derived scale may land from the stated one, in metres.
   *
   * A nanometre. Small enough that no scale a document could state slips
   * through, large enough that a subtraction of two authored metres is not
   * mistaken for one.
   */
  public static readonly SCALE_TOLERANCE: number = 1e-9;

  /**
   * Member height in metres, stated against the production's reference scale.
   *
   * "A head shorter than the soloist" is the specification's own phrasing, so
   * it is derived from the soloist rather than restated as a second number that
   * could drift from it. {@link design} is what checks the derivation still
   * lands on {@link SPECIFIED_HEIGHT}.
   */
  public readonly height = soloist.height - ChorusMember.HEAD;

  /**
   * Head radius in metres, at hero detail.
   *
   * A field rather than a literal inside the record, because the coarser tiers
   * state themselves against it: {@link ChorusTier} exists to keep this figure
   * readable further away, and a tier that could not see the number it is
   * coarsening would be a second opinion about the same head.
   */
  public readonly headRadius: number = 0.14;

  /** Limb radius in metres, at hero detail. */
  public readonly limbRadius: number = 0.05;

  /**
   * The one body colour, worn at every tier.
   *
   * Shared rather than authored per tier on purpose. A member changes tier as
   * the camera moves, and a tier that also changed colour would make the
   * boundary itself visible: the audience would read a costume change where the
   * renderer only swapped a mesh.
   */
  public readonly bodyColor: string = "#8f9d74";

  /**
   * The measured recipe, with the tier ladder the group is seen through.
   *
   * The ladder exists because the group is seen at every distance from a close
   * row to the far edge of the plaza; a single tier would either cost too much
   * at the back or lose the interval at the front.
   *
   * The scale is checked here rather than in a constructor. A subclass that
   * overrides a measurement sets its own fields after the base constructor has
   * already run, so a constructor would validate numbers the subject no longer
   * has. `design()` is where the record leaves the class, which makes it the
   * one place every construction has to pass through.
   *
   * @evidence docs/characters/chorus.md Requires rows and columns to stay
   *   legible at every distance, which is what the tier ladder answers for.
   */
  public design(): IAutoMovieModelRecipe {
    // Compared within a tolerance, not exactly. The height is a difference of
    // two authored metres, and a subtraction that lands a billionth away is the
    // float representation rather than a scale the document did not state:
    // refusing 1.75 less 0.05 would be refusing arithmetic.
    if (
      Math.abs(this.height - ChorusMember.SPECIFIED_HEIGHT) >
      ChorusMember.SCALE_TOLERANCE
    )
      throw new Error(
        `docs/characters/chorus.md states a member is ${ChorusMember.SPECIFIED_HEIGHT} m, a head shorter than the soloist, but this one is ${this.height} m. Correct the reference scale or the head, not this record.`,
      );
    return {
      id: this.id,
      role: "performer",
      archetype: "stickman",
      parameters: {
        height: this.height,
        headRadius: this.headRadius,
        limbRadius: this.limbRadius,
      },
      palette: { body: this.bodyColor },
      lod: [
        { tier: "hero", maxDistance: 5, recipe: "chorus-hero" },
        { tier: "near", maxDistance: 12, recipe: "chorus-near" },
        { tier: "far", maxDistance: null, recipe: "chorus-far" },
      ],
      capabilities: ["signal"],
      attachments: [],
    };
  }

  /**
   * Nothing, because a member is never staged by itself.
   *
   * The formation materializes its members from count, layout, anchor, facing
   * and seed, so staging one here would put a second answer beside the
   * engine's. A member that did render individually would also be the first
   * step toward two thousand scene nodes.
   *
   * @evidence docs/characters/chorus.md States the group is one subject and the
   *   film never asks the audience to follow an individual inside it.
   */
  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return {};
  }
}

/**
 * The production's one chorus-member recipe.
 *
 * Carries the subject's citation until a class can carry its own
 * (samchon/ttsc#1121).
 *
 * @evidence docs/characters/chorus.md Implements the member scale and the
 *   row-and-column readability that specification requires at every distance.
 */
export const chorusHero = new ChorusMember();

/**
 * The same member, coarsened for one of the distances the group is seen from.
 *
 * A tier is not a second character. It is one figure further away, so the
 * measurement the specification fixes, the height, is taken from
 * {@link chorusHero} rather than restated, and only the coarseness a distance
 * asks for is authored here.
 *
 * It stays an articulated figure on purpose, which is the whole reason this
 * class exists rather than a cheaper box. An anonymous member is never posed:
 * it is an instance matrix and a phase, and what lets it walk anyway is a cycle
 * baked once per tier from the first gait of the first profile on that tier's
 * built model. A tier with no skeleton and no profile bakes nothing, so a box
 * tier is a row standing frozen behind rows that walk, which is the one thing
 * the group must never look like.
 *
 * @evidence docs/characters/chorus.md Answers the Life section at distance:
 *   that section holds "at every distance the group is seen from", so the
 *   coarse rungs are still articulated figures with a baked stride rather than
 *   boxes, which is the only reading of it that survives the far tier.
 */
export class ChorusTier extends AutoMovieSubject<IAutoMovieModelRecipe> {
  public constructor(
    /** Recipe id the ladder in {@link ChorusMember.design} names. */
    public readonly id: string,
    /** Which rung of that ladder this recipe answers for. */
    public readonly tier: "near" | "far",
    /**
     * Head radius in metres at this distance.
     *
     * Authored rather than derived, because it answers a question about pixels
     * rather than about the body: the head has to survive being small, and how
     * small it gets is what the tier is for. The height it sits on is the
     * member's, so no tier can quietly restate the scale.
     */
    public readonly headRadius: number,
    /**
     * Limb radius in metres at this distance.
     *
     * Thickening is the only cheapening this catalogue offers. Its one
     * articulated archetype builds a fixed set of parts from `height`, so a
     * coarser tier cannot have fewer of them; what it can do is stop a limb
     * from thinning below what a distant frame resolves, which is what keeps
     * the stride legible at the back of the group.
     */
    public readonly limbRadius: number,
  ) {
    super();
  }

  /**
   * The stride every member of this tier walks, each at its own point in it.
   *
   * One declared gait, not the catalogue's whole locomotion vocabulary. The
   * bake takes the first gait of the first profile and never asks for a second,
   * so shipping four more would be four tables of intent nothing reads.
   *
   * The gait is the catalogue's own walk rather than a table transcribed here.
   * Phase, duty and amplitude per limb are facts about a humanoid body, and a
   * production that retyped them would own a second humanoid that drifts from
   * the first.
   *
   * @evidence docs/characters/chorus.md States every member walks the same
   *   stride, each at its own point in it, which is the one cycle this declares.
   */
  public profile(): IAutoMovieProfile {
    return {
      id: `${this.id}-stride`,
      name: "stride",
      controls: [],
      drivers: [],
      limits: [],
      gaits: [HUMANOID_GAITS.walk],
    };
  }

  /**
   * The measured recipe for this rung of the ladder.
   *
   * No capability is claimed. A capability is a motion some source can author
   * for a named performer, and nothing can author one for a member that has no
   * node: this tier moves because its cycle is baked, not because a shot asked
   * it to.
   *
   * The refusal is checked here rather than in the constructor, for the reason
   * {@link ChorusMember.design} gives: a subclass sets its own fields after the
   * base constructor has run, and `design()` is the one gate every construction
   * passes through.
   *
   * @evidence docs/characters/chorus.md States a member too distant to be posed
   *   is still a member, so the walk has to hold at every distance the group is
   *   seen from.
   */
  public design(): IAutoMovieModelRecipe {
    if (
      this.headRadius < chorusHero.headRadius ||
      this.limbRadius < chorusHero.limbRadius
    )
      throw new Error(
        `docs/characters/chorus.md requires the walk to read at every distance, so the "${this.id}" tier cannot be finer than the hero tier it stands behind: ${this.headRadius} m head and ${this.limbRadius} m limbs against ${chorusHero.headRadius} m and ${chorusHero.limbRadius} m. Coarsen this tier or refine the hero.`,
      );
    return {
      id: this.id,
      role: "performer",
      archetype: "stickman",
      parameters: {
        height: chorusHero.height,
        headRadius: this.headRadius,
        limbRadius: this.limbRadius,
      },
      palette: { body: chorusHero.bodyColor },
      lod: [{ tier: this.tier, maxDistance: null, recipe: this.id }],
      capabilities: [],
      attachments: [],
      profiles: [this.profile()],
    };
  }

  /**
   * Nothing, for the same reason {@link ChorusMember.render} stages nothing.
   *
   * A tier is even further from being staged than a member is: it is the body
   * the formation instances at a distance, and it has no individual existence
   * for a shot to place.
   *
   * @evidence docs/characters/chorus.md States the group is one subject and the
   *   film never asks the audience to follow an individual inside it.
   */
  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return {};
  }
}

/**
 * The tier the middle of the group is seen at.
 *
 * Carries the subject's citation until a class can carry its own
 * (samchon/ttsc#1121).
 *
 * @evidence docs/characters/chorus.md Implements the walking member the
 *   specification requires, at the distance where the interval still reads.
 */
export const chorusNear = new ChorusTier("chorus-near", "near", 0.15, 0.065);

/**
 * The tier the back of the group is seen at.
 *
 * Carries the subject's citation until a class can carry its own
 * (samchon/ttsc#1121).
 *
 * @evidence docs/characters/chorus.md Implements the walking member at the
 *   distance the specification still calls a member rather than a texture.
 */
export const chorusFar = new ChorusTier("chorus-far", "far", 0.17, 0.085);
