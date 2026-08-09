import {
  AutoMovieSubject,
  type IAutoMovieSubjectContribution,
} from "@automovie/engine";
import type {
  IAutoMovieModelRecipe,
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
        headRadius: 0.14,
        limbRadius: 0.05,
      },
      palette: { body: "#8f9d74" },
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
