import {
  AutoMovieSubject,
  type IAutoMovieSubjectContribution,
} from "@automovie/engine";
import type {
  IAutoMovieModelRecipe,
  IAutoMovieShotBuildContext,
  IAutoMovieStageSetPiece,
  IAutoMovieVector3,
} from "@automovie/interface";

import { sentinel } from "../units/sentinel";

/**
 * The point on the ground, made visible.
 *
 * A prop is a subject like any other; what differs is what it owes. It has
 * measured facts and no capability, because the specification fixes where it
 * stands and nothing else. Keeping it a class rather than a literal inside a
 * shot is what lets a construction be refused the moment its dimensions stop
 * meaning what the document says they mean.
 *
 * @evidence docs/objects/marker-post.md Implements the single upright that
 *   specification fixes, at the stated scale, and claims nothing it does not.
 */
export class MarkerPost extends AutoMovieSubject<IAutoMovieModelRecipe> {
  /**
   * Stable identity the design record and every staged node cite.
   *
   * @evidence docs/objects/marker-post.md Specifies the one prop this identity
   *   names.
   */
  public readonly id = "marker-post";

  /**
   * How tall a mark may stand against the reference figure.
   *
   * "Waist height on the reference figure" is the specification's own phrasing;
   * a half is what that measures. Stated once here so the derivation below and
   * the refusal that checks it read the same number.
   *
   * @evidence docs/objects/marker-post.md States the post is half the
   *   production's reference human scale.
   */
  public static readonly HEIGHT_FRACTION: number = 0.5;

  /**
   * The height the specification states, in metres.
   *
   * Kept beside the derivation so the two can be compared. The document says
   * both things at once, that the post is 0.9 m and that it is half the
   * reference human scale, and a subject that only derived would go on being
   * internally consistent while drifting away from the number the production
   * was measured around.
   *
   * @evidence docs/objects/marker-post.md States the post is 0.9 m.
   */
  public static readonly SPECIFIED_HEIGHT: number = 0.9;

  /**
   * How wide the post may be across, as a fraction of its own height.
   *
   * The specification's legibility rule is a ratio rather than a width, because
   * a mark that grew taller and kept its thickness would go on satisfying a
   * width and stop satisfying the rule.
   *
   * @evidence docs/objects/marker-post.md States the post is no wider across
   *   than a tenth of its own height.
   */
  public static readonly MAX_DIAMETER_RATIO: number = 0.1;

  /**
   * How far a derived measurement may land from the stated one, in metres.
   *
   * A nanometre. Small enough that no dimension a document could state slips
   * through, large enough that a product of two authored metres is not mistaken
   * for one.
   *
   * @evidence docs/objects/marker-post.md States each dimension twice, as a
   *   metre value and as a relation, which is what makes a tolerance necessary.
   */
  public static readonly TOLERANCE: number = 1e-9;

  /**
   * Post height in metres, stated against the production's reference scale.
   *
   * Derived from the reference figure rather than restated as a second number
   * that could drift from it. {@link design} is what checks the derivation still
   * lands on {@link SPECIFIED_HEIGHT}.
   *
   * @evidence docs/objects/marker-post.md States the post is half the
   *   production's reference human scale.
   */
  public readonly height = sentinel.height * MarkerPost.HEIGHT_FRACTION;

  /**
   * Post radius in metres.
   *
   * Authored rather than derived, because the specification bounds the width
   * instead of fixing it: a mark thinner than the bound is still a mark, and
   * {@link design} refuses only the thickness that stops being one.
   *
   * @evidence docs/objects/marker-post.md States the post reads as one
   *   vertical, which is what this thickness keeps it.
   */
  public readonly radius: number = 0.04;

  /**
   * The measured recipe the production derives its design record from.
   *
   * The dimensions are checked here rather than in a constructor. A subclass
   * that overrides a measurement sets its own fields after the base constructor
   * has already run, so a constructor would validate numbers the subject no
   * longer has. `design()` is where the record leaves the class, which makes it
   * the one place every construction has to pass through.
   *
   * @evidence docs/objects/marker-post.md Implements the upright, the stated
   *   scale, and the single flat tone this specification fixes, with no
   *   capability beside them.
   */
  public design(): IAutoMovieModelRecipe {
    // Compared within a tolerance, not exactly. The height is a product of two
    // authored metres, and a multiplication that lands a billionth away is the
    // float representation rather than a scale the document did not state:
    // refusing 1.8 halved would be refusing arithmetic.
    if (
      Math.abs(this.height - MarkerPost.SPECIFIED_HEIGHT) > MarkerPost.TOLERANCE
    )
      throw new Error(
        `docs/objects/marker-post.md states the post is ${MarkerPost.SPECIFIED_HEIGHT} m, half the production's reference human scale, but this one is ${this.height} m. Correct the reference scale or the fraction, not this record.`,
      );
    // The same nanometre, for the same reason: a post authored at exactly the
    // permitted tenth must not be refused by the multiplication that measures
    // it.
    const widest = this.height * MarkerPost.MAX_DIAMETER_RATIO;
    if (this.radius * 2 > widest + MarkerPost.TOLERANCE)
      throw new Error(
        `docs/objects/marker-post.md keeps the post no wider across than a tenth of its height, so a ${this.height} m post admits ${widest} m, but this one is ${this.radius * 2} m across. Thin the post, or state a taller one and the reference scale that carries it.`,
      );
    return {
      id: this.id,
      role: "prop",
      archetype: "primitive-prop",
      parameters: {
        shape: "cylinder",
        radius: this.radius,
        height: this.height,
      },
      palette: { body: "#6d6455" },
      lod: [{ tier: "hero", maxDistance: null, recipe: this.id }],
      // Empty because the specification claims none. A prop that declared one
      // would be claiming work no source performs.
      capabilities: [],
      attachments: [],
    };
  }

  /**
   * This post as one piece of static set geometry, placed where a shot says.
   *
   * The position is the caller's because the specification says the post never
   * chooses where it stands; the model is the compiler's, resolved here so a
   * shot never guesses the built model's name. Refusing loudly is the point: a
   * post staged against a model the production has not materialized would
   * otherwise reach a frame as nothing at all.
   *
   * @evidence docs/objects/marker-post.md States a production places the post
   *   at the point it needs marked and gives it that point's coordinates.
   */
  public setPiece(
    context: IAutoMovieShotBuildContext,
    props: { position: IAutoMovieVector3 },
  ): IAutoMovieStageSetPiece {
    const model = context.runtimeModels[this.id];
    if (model === undefined)
      throw new Error(
        `The compiler-owned "${this.id}" runtime model must be available.`,
      );
    return {
      node: this.id,
      model: model.id,
      position: props.position,
    };
  }

  /**
   * Nothing, because a post performs nothing.
   *
   * A contribution is what a subject puts into a shot as performance: actors,
   * clips, cues. A prop reaches the frame as static set geometry instead, which
   * a shot places from {@link setPiece}, and a contribution carries no channel
   * for one. Returning an empty contribution says that plainly rather than
   * inventing an actor the specification refuses.
   *
   * @evidence docs/objects/marker-post.md States the post claims no capability
   *   and is never made to perform.
   */
  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return {};
  }
}

/**
 * The production's one marker post.
 *
 * One instance, because the specification makes two marked points two posts
 * rather than one post covering both.
 *
 * @evidence docs/objects/marker-post.md Implements the upright, the scale, and
 *   the single material colour that specification requires.
 */
export const markerPost = new MarkerPost();
