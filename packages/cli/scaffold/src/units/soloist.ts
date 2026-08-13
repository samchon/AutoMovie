import {
  AutoMovieSubject,
  type IAutoMovieSubjectContribution,
} from "@automovie/engine";
import type {
  IAutoMovieModelRecipe,
  IAutoMovieMotion,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";

/**
 * The one figure the camera follows.
 *
 * A subject is a class so that what it is, what it can do, and what it puts
 * into a shot answer to one owner. The measured facts are fields, because a
 * field can cite the line of the specification that fixes it; the capability is
 * a method, because a capability nobody can call is a string that claims work
 * the source never did.
 *
 * @evidence docs/characters/soloist.md Is SOLOIST entire: the one upright
 *   figure that document describes, carrying its stated scale and the single
 *   raised-hand capability it permits and nothing beyond it.
 */
export class Soloist extends AutoMovieSubject<IAutoMovieModelRecipe> {
  public readonly id = "soloist";

  /**
   * The production's reference human scale, in metres.
   *
   * Every other subject states its size against this number rather than against
   * a second opinion, which is why it is public: a subject that needs human
   * scale reads it from here instead of restating 1.8.
   */
  public readonly height: number = 1.8;

  /**
   * How far the cueing arm travels from rest, in degrees of abduction.
   *
   * The specification says the hand is raised and held; this is what "raised"
   * measures, kept here so a shot that wants a partly raised hand scales one
   * declared extent rather than inventing an angle.
   */
  public readonly cueAbduction: number = 110;

  /**
   * When the raised hand arrives, in seconds from the start of the shot.
   *
   * The gesture has to be complete while the event that measures it is sampled,
   * so this is the subject's own claim about its timing rather than a number
   * each shot rediscovers.
   */
  public readonly arrivalSeconds: number = 2;

  /**
   * The measured recipe the production derives its design record from.
   *
   * @evidence docs/characters/soloist.md Implements the upright single
   *   silhouette and the one claimed capability, at the stated scale.
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
   * which is what an untrimmed cut between two shots requires.
   *
   * @evidence docs/characters/soloist.md Implements the raise-and-hold this
   *   specification claims as the figure's only capability.
   */
  public cue(
    context: IAutoMovieShotBuildContext,
    props: { from: number } = { from: 0 },
  ): IAutoMovieMotion {
    const skeleton = this.skeleton(context);
    const pose = (abduction: number) => ({
      skeleton,
      root: null,
      joints: [
        {
          bone: "leftUpperArm" as const,
          flexion: null,
          abduction,
          twist: null,
        },
        {
          bone: "leftLowerArm" as const,
          flexion: 25,
          abduction: null,
          twist: null,
        },
      ],
    });
    const duration = context.contract.durationSeconds;
    const key = (
      time: number,
      abduction: number,
      easing: "linear" | "easeInOut",
    ) => ({
      time,
      pose: pose(abduction),
      expression: null,
      easing,
      bezier: null,
    });
    return {
      id: `${context.contract.id}-cue`,
      skeleton,
      duration,
      loop: false,
      // Already raised: hold, so a shot that continues the previous one opens
      // on the state that one closed with. Otherwise arrive at
      // `arrivalSeconds` and hold, because the raise has to be complete while
      // the event that measures it is sampled, not still travelling.
      keyframes:
        props.from >= this.cueAbduction
          ? [key(0, props.from, "linear"), key(duration, props.from, "linear")]
          : [
              key(0, props.from, "easeInOut"),
              key(this.arrivalSeconds, this.cueAbduction, "linear"),
              key(duration, this.cueAbduction, "linear"),
            ],
      gaitCycle: null,
    };
  }

  /**
   * Eye height above the staged root, in metres.
   *
   * Derived from {@link height} rather than stated a second time, so a change to
   * the figure's scale cannot leave the camera aiming where the head used to
   * be. The ratio is the anthropometric one; only the scale is authored.
   *
   * @evidence docs/characters/soloist.md Fixes the scale this measurement is
   *   derived from, and this value states nothing that specification does not.
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
   * @evidence docs/characters/soloist.md Requires an articulated figure that
   *   raises a hand, which is a claim on a rig this source does not own.
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
   * @evidence docs/characters/soloist.md Specifies the figure whose built
   *   model this resolves, and nothing about how the compiler names it.
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
   * @evidence docs/characters/soloist.md Stages the single separated figure
   *   this specification requires the camera to be able to follow.
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
          speed: 1.2,
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
 * The subject's citation lives on the instance rather than on {@link Soloist}
 * itself, because `@ttsc/evidence` does not yet select a class as a unit
 * (samchon/ttsc#1121). Its measured facts cannot cite at all for the same
 * reason, so this one tag answers for the whole subject until they can.
 *
 * @evidence docs/characters/soloist.md Implements the silhouette, the scale,
 *   and the single capability that specification states, and claims nothing it
 *   does not.
 */
export const soloist = new Soloist();
