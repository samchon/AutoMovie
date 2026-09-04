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
 * @evidenceReview obligations/design/model-sources.md#design-owned-construction #ffa6690 Read obligations/design/model-sources.md#design-owned-construction and Soloist in src/units/soloist.ts; confirmed this citation after checking the claim that makes every visible constant answer to the cited model design.
 * @evidence obligations/design/model-sources.md#deterministic-build Maps the same
 *   explicit model and runtime inputs to the same recipe and contribution.
 * @evidenceReview obligations/design/model-sources.md#deterministic-build #27790fe Read obligations/design/model-sources.md#deterministic-build and Soloist in src/units/soloist.ts; confirmed this citation after checking the claim that maps the same explicit model and runtime inputs to the same recipe and contribution.
 * @evidence obligations/design/model-sources.md#unsupported-fidelity-is-explicit
 *   Refuses a missing compiled model or skeleton instead of degrading the
 *   reviewed articulated proxy.
 * @evidenceReview obligations/design/model-sources.md#unsupported-fidelity-is-explicit #15c03fa Read obligations/design/model-sources.md#unsupported-fidelity-is-explicit and Soloist in src/units/soloist.ts; confirmed this citation after checking the claim that refuses a missing compiled model or skeleton instead of degrading the reviewed articulated proxy.
 * @evidence principles/core/source-units.md#source-scope-preservation Soloist keeps responsibility for The one figure the camera follows in this declaration; the implementation fragment id, height, locomotionSpeed, design, cue, eyeHeight, skeleton, modelRef, render introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Soloist declaration and implementation with the reviewed SOLOIST model and articulation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion Soloist is a usable source artifact for The one figure the camera follows; it is implemented directly as id, height, locomotionSpeed, design, cue, eyeHeight, skeleton, modelRef, render rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Soloist signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Soloist tested the reviewed SOLOIST model and articulation decisions through The one figure the camera follows; the implementation fragment id, height, locomotionSpeed, design, cue, eyeHeight, skeleton, modelRef, render shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Soloist implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export class Soloist extends AutoMovieSubject<IAutoMovieModelRecipe> {
  /**
   * @evidence principles/core/source-units.md#source-scope-preservation Soloist.id keeps responsibility for the readonly id value materialized by its initializer in this declaration; the implementation fragment "soloist" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Soloist.id declaration and implementation with the reviewed SOLOIST model and articulation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Soloist.id is a usable source artifact for the readonly id value materialized by its initializer; it is implemented directly as "soloist" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Soloist.id signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Soloist.id tested the reviewed SOLOIST model and articulation decisions through the readonly id value materialized by its initializer; the implementation fragment "soloist" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Soloist.id implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
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
   * @evidence principles/core/source-units.md#source-scope-preservation Soloist.height keeps responsibility for The production's reference human scale, in metres in this declaration; the implementation fragment 1.8 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Soloist.height declaration and implementation with the reviewed SOLOIST model and articulation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Soloist.height is a usable source artifact for The production's reference human scale, in metres; it is implemented directly as 1.8 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Soloist.height signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Soloist.height tested the reviewed SOLOIST model and articulation decisions through The production's reference human scale, in metres; the implementation fragment 1.8 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Soloist.height implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Soloist.locomotionSpeed keeps responsibility for Positive actor-runtime locomotion rate, in metres per second in this declaration; the implementation fragment 1.2 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Soloist.locomotionSpeed declaration and implementation with the reviewed SOLOIST model and articulation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Soloist.locomotionSpeed is a usable source artifact for Positive actor-runtime locomotion rate, in metres per second; it is implemented directly as 1.2 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Soloist.locomotionSpeed signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Soloist.locomotionSpeed tested the reviewed SOLOIST model and articulation decisions through Positive actor-runtime locomotion rate, in metres per second; the implementation fragment 1.2 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Soloist.locomotionSpeed implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly locomotionSpeed: number = 1.2;

  /**
   * The measured recipe the production derives its design record from.
   *
   * @evidence models/010-soloist.md#soloist-blocking-representation Implements
   *   the reviewed recipe, dimensions, palette, and fidelity ceiling.
   * @evidenceReview models/010-soloist.md#soloist-blocking-representation #ed19f3e Read models/010-soloist.md#soloist-blocking-representation and design in src/units/soloist.ts; confirmed this citation after checking the claim that implements the reviewed recipe, dimensions, palette, signal capability, and fidelity ceiling.
   * @evidence principles/core/source-units.md#source-scope-preservation Soloist.design keeps responsibility for The measured recipe the production derives its design record from in this declaration; the implementation fragment { return { id: this.id, role: "performer", archetype: "stickman", parameters: { height: this.height, headRadius: 0.16, limbRadius: 0.06, }, palette: { body: "#d7b56d" }, lod introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Soloist.design declaration and implementation with the reviewed SOLOIST model and articulation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Soloist.design is a usable source artifact for The measured recipe the production derives its design record from; it is implemented directly as { return { id: this.id, role: "performer", archetype: "stickman", parameters: { height: this.height, headRadius: 0.16, limbRadius: 0.06, }, palette: { body: "#d7b56d" }, lod rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Soloist.design signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Soloist.design tested the reviewed SOLOIST model and articulation decisions through The measured recipe the production derives its design record from; the implementation fragment { return { id: this.id, role: "performer", archetype: "stickman", parameters: { height: this.height, headRadius: 0.16, limbRadius: 0.06, }, palette: { body: "#d7b56d" }, lod shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Soloist.design implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Soloist.cue keeps responsibility for Raise the cueing arm and hold it for the rest of the shot in this declaration; the implementation fragment { return createSoloistCueMotion({ id: context.contract.id, duration: context.contract.durationSeconds, skeleton: this.skeleton(context), from: props.from, }); } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Soloist.cue declaration and implementation with the reviewed SOLOIST model and articulation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Soloist.cue is a usable source artifact for Raise the cueing arm and hold it for the rest of the shot; it is implemented directly as { return createSoloistCueMotion({ id: context.contract.id, duration: context.contract.durationSeconds, skeleton: this.skeleton(context), from: props.from, }); } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Soloist.cue signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Soloist.cue tested the reviewed SOLOIST model and articulation decisions through Raise the cueing arm and hold it for the rest of the shot; the implementation fragment { return createSoloistCueMotion({ id: context.contract.id, duration: context.contract.durationSeconds, skeleton: this.skeleton(context), from: props.from, }); } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Soloist.cue implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Soloist.eyeHeight keeps responsibility for Eye height above the staged root, in metres in this declaration; the implementation fragment { return this.height * 0.9; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Soloist.eyeHeight declaration and implementation with the reviewed SOLOIST model and articulation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Soloist.eyeHeight is a usable source artifact for Eye height above the staged root, in metres; it is implemented directly as { return this.height * 0.9; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Soloist.eyeHeight signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Soloist.eyeHeight tested the reviewed SOLOIST model and articulation decisions through Eye height above the staged root, in metres; the implementation fragment { return this.height * 0.9; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Soloist.eyeHeight implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidenceReview obligations/design/model-sources.md#unsupported-fidelity-is-explicit #15c03fa Read obligations/design/model-sources.md#unsupported-fidelity-is-explicit and skeleton in src/units/soloist.ts; confirmed this citation after checking the claim that refuses when the reviewed articulated model has no skeleton.
   * @evidence principles/core/source-units.md#source-scope-preservation Soloist.skeleton keeps responsibility for The compiler-owned skeleton this figure performs on in this declaration; the implementation fragment { const model = context.runtimeModels[this.id]; if (model === undefined || model.skeleton === null) throw new Error( 'The compiler-owned "${this.id}" stickman model must introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Soloist.skeleton declaration and implementation with the reviewed SOLOIST model and articulation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Soloist.skeleton is a usable source artifact for The compiler-owned skeleton this figure performs on; it is implemented directly as { const model = context.runtimeModels[this.id]; if (model === undefined || model.skeleton === null) throw new Error( 'The compiler-owned "${this.id}" stickman model must rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Soloist.skeleton signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Soloist.skeleton tested the reviewed SOLOIST model and articulation decisions through The compiler-owned skeleton this figure performs on; the implementation fragment { const model = context.runtimeModels[this.id]; if (model === undefined || model.skeleton === null) throw new Error( 'The compiler-owned "${this.id}" stickman model must shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Soloist.skeleton implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Soloist.modelRef keeps responsibility for The compiler-owned runtime model id a staged node references in this declaration; the implementation fragment { const model = context.runtimeModels[this.id]; if (model === undefined) throw new Error( 'The compiler-owned "${this.id}" runtime model must be available.', ); return model.id; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Soloist.modelRef declaration and implementation with the reviewed SOLOIST model and articulation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Soloist.modelRef is a usable source artifact for The compiler-owned runtime model id a staged node references; it is implemented directly as { const model = context.runtimeModels[this.id]; if (model === undefined) throw new Error( 'The compiler-owned "${this.id}" runtime model must be available.', ); return model.id; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Soloist.modelRef signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Soloist.modelRef tested the reviewed SOLOIST model and articulation decisions through The compiler-owned runtime model id a staged node references; the implementation fragment { const model = context.runtimeModels[this.id]; if (model === undefined) throw new Error( 'The compiler-owned "${this.id}" runtime model must be available.', ); return model.id; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Soloist.modelRef implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Soloist.render keeps responsibility for Stage this figure and the clip it performs in this declaration; the implementation fragment { return { actors: [ { node: this.id, model: this.id, speed: this.locomotionSpeed, eyeHeight: this.eyeHeight(), }, ], clips: [this.cue(context, { from: props.from ?? 0 })], }; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Soloist.render declaration and implementation with the reviewed SOLOIST model and articulation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Soloist.render is a usable source artifact for Stage this figure and the clip it performs; it is implemented directly as { return { actors: [ { node: this.id, model: this.id, speed: this.locomotionSpeed, eyeHeight: this.eyeHeight(), }, ], clips: [this.cue(context, { from: props.from ?? 0 })], }; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Soloist.render signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Soloist.render tested the reviewed SOLOIST model and articulation decisions through Stage this figure and the clip it performs; the implementation fragment { return { actors: [ { node: this.id, model: this.id, speed: this.locomotionSpeed, eyeHeight: this.eyeHeight(), }, ], clips: [this.cue(context, { from: props.from ?? 0 })], }; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Soloist.render implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
 * @evidence principles/core/source-units.md#source-scope-preservation soloist keeps responsibility for the exported soloist source owner and its declared value or behavior in this declaration; the implementation fragment new Soloist() introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared this exported binding with the reviewed SOLOIST responsibility: it constructs `Soloist` once with no arguments and adds no articulation or scale decision of its own, so the only thing inside its scope is the identity of the single instance the production references, and nothing the class already owns is re-declared here.
 * @evidence principles/core/source-units.md#source-substantive-completion soloist is a usable source artifact for the exported soloist source owner and its declared value or behavior; it is implemented directly as new Soloist() rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced what a consumer actually receives from this binding: one fully constructed `Soloist` whose recipe, arm pivots, and 1.8 m scale are already fixed at the declaration, so an importer needs no factory call, no configuration step, and no second boundary to reach a usable figure.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing soloist tested the reviewed SOLOIST model and articulation decisions through the exported soloist source owner and its declared value or behavior; the implementation fragment new Soloist() shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared this binding with its reviewed parent: constructing one instance introduces no input, derived value, or boundary behavior the model design did not already settle, so the binding leaves the parent decision nothing to repair.
 */
export const soloist = new Soloist();
