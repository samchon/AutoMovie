import {
  AutoMovieSubject,
  type IAutoMovieSubjectContribution,
} from "@automovie/engine";
import type {
  IAutoMovieModelRecipe,
  IAutoMovieMotion,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";

import { createSoloistCueMotion } from "../motions/soloistCue";

/**
 * The one figure the camera follows.
 *
 * A subject is a class so that what it is, what it can do, and what it puts
 * into a shot answer to one owner. The measured facts are fields, because a
 * field can cite the line of the specification that fixes it; the capability is
 * a method, because a capability nobody can call is a string that claims work
 * the source never did.
 *
 * @evidence models/010-soloist.md Owns the reviewed 1.8 m stickman recipe,
 *   planted contribution, signal articulation, and neutral pose observations.
 * @evidenceReview models/010-soloist.md #1e83b28 Read models/010-soloist.md and Soloist in src/units/soloist.ts; confirmed that the class owns the reviewed 1.8 m stickman recipe, planted contribution, signal articulation, and neutral pose observations without answering another model file.
 * @evidence models/010-soloist.md#soloist-blocking-representation Owns the
 *   recipe, dimensions, accent, signal id, and inert actor speed field.
 * @evidenceReview models/010-soloist.md#soloist-blocking-representation #ed19f3e Read models/010-soloist.md#soloist-blocking-representation and Soloist in src/units/soloist.ts; confirmed this citation after checking the claim that owns the recipe, dimensions, accent, signal id, and inert actor speed field.
 * @evidence models/010-soloist.md#soloist-articulation-interface Resolves the
 *   compiler-built skeleton and delegates its only pose change to motion.
 * @evidenceReview models/010-soloist.md#soloist-articulation-interface #f553537 Read models/010-soloist.md#soloist-articulation-interface and Soloist in src/units/soloist.ts; confirmed this citation after checking the claim that resolves the compiler-built skeleton and delegates its only pose change to motion.
 * @evidence models/010-soloist.md#soloist-neutral-review-views Exposes stable
 *   occupied height and pose states the neutral review set compares.
 * @evidenceReview models/010-soloist.md#soloist-neutral-review-views #ada235a Read models/010-soloist.md#soloist-neutral-review-views and Soloist in src/units/soloist.ts; confirmed this citation after checking the claim that exposes stable occupied height and pose states the neutral review set compares.
 * @evidence obligations/design/model-sources.md#design-owned-construction Makes every
 *   visible constant answer to the cited model design.
 * @evidenceReview obligations/design/model-sources.md#design-owned-construction #41ffc4f Read obligations/design/model-sources.md#design-owned-construction and Soloist in src/units/soloist.ts; confirmed this citation after checking the claim that makes every visible constant answer to the cited model design.
 * @evidence obligations/design/model-sources.md#deterministic-build Maps the same
 *   explicit model and runtime inputs to the same recipe and contribution.
 * @evidenceReview obligations/design/model-sources.md#deterministic-build #288cbb3 Read obligations/design/model-sources.md#deterministic-build and Soloist in src/units/soloist.ts; confirmed this citation after checking the claim that maps the same explicit model and runtime inputs to the same recipe and contribution.
 * @evidence obligations/design/model-sources.md#unsupported-fidelity-is-explicit
 *   Refuses a missing compiled model or skeleton instead of degrading the
 *   reviewed articulated proxy.
 * @evidenceReview obligations/design/model-sources.md#unsupported-fidelity-is-explicit #35050b3 Read obligations/design/model-sources.md#unsupported-fidelity-is-explicit and Soloist in src/units/soloist.ts; confirmed this citation after checking the claim that refuses a missing compiled model or skeleton instead of degrading the reviewed articulated proxy.
 */
export class Soloist extends AutoMovieSubject<IAutoMovieModelRecipe> {
  public readonly id = "soloist";

  /**
   * The production's reference human scale, in metres.
   *
   * Every other subject states its size against this number rather than against
   * a second opinion, which is why it is public: a subject that needs human
   * scale reads it from here instead of restating 1.8.
   * @evidence models/010-soloist.md#soloist-blocking-representation Holds the
   *   reviewed occupied height as one public source of scale.
   * @evidenceReview models/010-soloist.md#soloist-blocking-representation #ed19f3e Read models/010-soloist.md#soloist-blocking-representation and height in src/units/soloist.ts; confirmed this citation after checking the claim that holds the reviewed occupied height as one public source of scale.
   */
  public readonly height: number = 1.8;

  /**
   * Positive actor-runtime locomotion rate, in metres per second.
   *
   * The runtime schema requires the field even though this model exposes no
   * walking action. Keeping it named and model-owned makes that inert value
   * reviewable instead of hiding a source-only performance decision.
   *
   * @evidence models/010-soloist.md#soloist-blocking-representation Carries
   *   the reviewed required-but-inert actor locomotion rate.
   * @evidenceReview models/010-soloist.md#soloist-blocking-representation #ed19f3e Read models/010-soloist.md#soloist-blocking-representation and locomotionSpeed in src/units/soloist.ts; confirmed this citation after checking the claim that carries the reviewed required-but-inert actor locomotion rate.
   */
  public readonly locomotionSpeed: number = 1.2;

  /**
   * The measured recipe the production derives its design record from.
   *
   * @evidence models/010-soloist.md#soloist-blocking-representation Implements
   *   the reviewed recipe, dimensions, palette, and fidelity ceiling.
   * @evidenceReview models/010-soloist.md#soloist-blocking-representation #ed19f3e Read models/010-soloist.md#soloist-blocking-representation and design in src/units/soloist.ts; confirmed this citation after checking the claim that implements the reviewed recipe, dimensions, palette, signal capability, and fidelity ceiling.
   */
  public design(): IAutoMovieModelRecipe {
    return {
      id: this.id,
      role: "performer",
      archetype: "stickman",
      parameters: {
        height: this.height,
        headRadius: 0.16,
        limbRadius: 0.06,
      },
      palette: { body: "#d7b56d" },
      lod: [{ tier: "hero", maxDistance: null, recipe: this.id }],
      capabilities: ["signal"],
      attachments: [],
    };
  }

  /**
   * Raise the cueing arm and hold it for the rest of the shot.
   *
   * The hold is the point: the specification dramatizes a cue that stays
   * legible, so the hand arrives and stops rather than returning. Passing the
   * opening abduction lets a following shot begin where the previous one ended,
   * which is what an untrimmed edit boundary between two shots requires.
   *
   * @evidence models/010-soloist.md#soloist-articulation-interface Resolves
   *   the reviewed skeleton interface, while `src/motions` owns the path.
   * @evidenceReview models/010-soloist.md#soloist-articulation-interface #f553537 Read models/010-soloist.md#soloist-articulation-interface and cue in src/units/soloist.ts; confirmed this citation after checking the claim that resolves the reviewed skeleton interface, while `src/motions` owns the path.
   */
  public cue(
    context: IAutoMovieShotBuildContext,
    props: { from: number } = { from: 0 },
  ): IAutoMovieMotion {
    return createSoloistCueMotion({
      id: context.contract.id,
      duration: context.contract.durationSeconds,
      skeleton: this.skeleton(context),
      from: props.from,
    });
  }

  /**
   * Eye height above the staged root, in metres.
   *
   * Derived from {@link height} rather than stated a second time, so a change to
   * the figure's scale cannot leave the camera aiming where the head used to
   * be. The 90-percent ratio is the model document's chosen blocking reference,
   * not an anthropometric claim.
   *
   * @evidence models/010-soloist.md#soloist-blocking-representation Derives the
   *   eye from the model's one reviewed occupied-height field.
   * @evidenceReview models/010-soloist.md#soloist-blocking-representation #ed19f3e Read models/010-soloist.md#soloist-blocking-representation and eyeHeight in src/units/soloist.ts; confirmed this citation after checking the claim that derives the eye from the model's one reviewed occupied-height field.
   */
  public eyeHeight(): number {
    return this.height * 0.9;
  }

  /**
   * The compiler-owned skeleton this figure performs on.
   *
   * A utility rather than a field, because the answer comes from the compile
   * context rather than from the design: the source states scale and
   * capability, and the compiler owns the rig that realizes them. Refusing
   * loudly here keeps every motion from having to re-check it.
   *
   * @evidence models/010-soloist.md#soloist-articulation-interface Resolves the
   *   stable compiler skeleton the motion design is allowed to drive.
   * @evidenceReview models/010-soloist.md#soloist-articulation-interface #f553537 Read models/010-soloist.md#soloist-articulation-interface and skeleton in src/units/soloist.ts; confirmed this citation after checking the claim that resolves the stable compiler skeleton the motion design is allowed to drive.
   * @evidence obligations/design/model-sources.md#unsupported-fidelity-is-explicit
   *   Refuses when the reviewed articulated model has no skeleton.
   * @evidenceReview obligations/design/model-sources.md#unsupported-fidelity-is-explicit #35050b3 Read obligations/design/model-sources.md#unsupported-fidelity-is-explicit and skeleton in src/units/soloist.ts; confirmed this citation after checking the claim that refuses when the reviewed articulated model has no skeleton.
   */
  public skeleton(context: IAutoMovieShotBuildContext): string {
    const model = context.runtimeModels[this.id];
    if (model === undefined || model.skeleton === null)
      throw new Error(
        `The compiler-owned "${this.id}" stickman model must provide a skeleton.`,
      );
    return model.skeleton.id;
  }

  /**
   * The compiler-owned runtime model id a staged node references.
   *
   * Not the same string as {@link id}: the design id names the recipe this
   * source authors, and the runtime id names what the compiler built from it. A
   * cast entry that echoed the design id would reference a model the scene has
   * no node for.
   *
   * @evidence models/010-soloist.md#soloist-blocking-representation Resolves
   *   the runtime instance built from the one reviewed recipe.
   * @evidenceReview models/010-soloist.md#soloist-blocking-representation #ed19f3e Read models/010-soloist.md#soloist-blocking-representation and modelRef in src/units/soloist.ts; confirmed this citation after checking the claim that resolves the runtime instance built from the one reviewed recipe.
   */
  public modelRef(context: IAutoMovieShotBuildContext): string {
    const model = context.runtimeModels[this.id];
    if (model === undefined)
      throw new Error(
        `The compiler-owned "${this.id}" runtime model must be available.`,
      );
    return model.id;
  }

  /**
   * Stage this figure and the clip it performs.
   *
   * @evidence models/010-soloist.md#soloist-blocking-representation Contributes
   *   the one reviewed model instance without reconstructing it in a shot.
   * @evidenceReview models/010-soloist.md#soloist-blocking-representation #ed19f3e Read models/010-soloist.md#soloist-blocking-representation and render in src/units/soloist.ts; confirmed this citation after checking the claim that contributes the one reviewed model instance and inert actor rate without reconstructing either in a shot.
   */
  public render(
    context: IAutoMovieShotBuildContext,
    props: { from?: number } = {},
  ): IAutoMovieSubjectContribution {
    return {
      actors: [
        {
          node: this.id,
          model: this.id,
          speed: this.locomotionSpeed,
          eyeHeight: this.eyeHeight(),
        },
      ],
      clips: [this.cue(context, { from: props.from ?? 0 })],
    };
  }
}

/**
 * The production's one soloist.
 *
 * The class owns the exact model file; this exported instance separately
 * answers for constructing that reviewed figure once.
 *
 * @evidence models/010-soloist.md#soloist-blocking-representation Instantiates
 *   the reviewed SOLOIST model owner once for the production.
 * @evidenceReview models/010-soloist.md#soloist-blocking-representation #ed19f3e Read models/010-soloist.md#soloist-blocking-representation and soloist in src/units/soloist.ts; confirmed this citation after checking the claim that instantiates the reviewed SOLOIST model owner once for the production.
 */
export const soloist = new Soloist();
