import type { IAutoMovieSubjectContribution } from "@automovie/engine";
import { AutoMovieSubject } from "@automovie/engine";
import type {
  IAutoMovieModelRecipe,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";

import { sentinel } from "./sentinel";

/**
 * One member of the army, at hero detail, with its two coarser tiers.
 *
 * A member never appears alone: the film asks the audience to read the mass,
 * not an individual inside it. So this subject renders nothing on its own and
 * the formation that holds it is what a shot stages. What it owns is the
 * member's measured facts and the LOD ladder those facts imply.
 */
export class ArmyMember extends AutoMovieSubject<IAutoMovieModelRecipe> {
  public readonly id = "army-hero";

  /**
   * A head, in metres, at this production's human scale.
   *
   * The one place the phrase "a head shorter" becomes a number.
   */
  public static readonly HEAD = 0.1;

  /**
   * Member height in metres, stated against the production's reference scale.
   *
   * "A head shorter than the sentinel" is the specification's own phrasing, so
   * it is derived from the sentinel rather than restated as a second number
   * that could drift from it.
   */
  public readonly height = sentinel.height - ArmyMember.HEAD;

  /**
   * The measured recipe, with the tier ladder the unit is seen through.
   *
   * The ladder exists because the unit is seen at every distance from a close
   * rank to the far edge of the field; a single tier would either cost too much
   * at the back or lose the interval at the front.
   *
   * @evidence docs/characters/army.md Requires ranks and files to stay legible
   *   at every distance, which is what the tier ladder answers for.
   */
  public design(): IAutoMovieModelRecipe {
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
        { tier: "hero", maxDistance: 5, recipe: "army-hero" },
        { tier: "near", maxDistance: 12, recipe: "army-near" },
        { tier: "far", maxDistance: null, recipe: "army-far" },
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
   * @evidence docs/characters/army.md States the unit is one subject and the
   *   film never asks the audience to follow an individual inside it.
   */
  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return {};
  }
}

/**
 * The production's one army-member recipe.
 *
 * Carries the subject's citation until a class can carry its own
 * (samchon/ttsc#1121).
 *
 * @evidence docs/characters/army.md Implements the member scale and the
 *   rank-and-file readability that specification requires at every distance.
 */
export const armyHero = new ArmyMember();
