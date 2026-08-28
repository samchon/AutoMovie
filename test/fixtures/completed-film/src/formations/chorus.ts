import {
  AutoMovieSubjectGroup,
  type IAutoMovieSubjectContribution,
} from "@automovie/engine";
import type {
  IAutoMovieFormationDesign,
  IAutoMovieFormationMotion,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";

import {
  CHORUS_ADVANCE_METRES,
  createChorusAdvanceMotion,
} from "../motions/chorusAdvance";
import { createChorusBreakMotion } from "../motions/chorusBreak";
import { createChorusHoldMotion } from "../motions/chorusHold";
import { ChorusMember, chorusHero } from "../units/chorusHero";

/**
 * The chorus as one subject, not as two thousand authored actors.
 *
 * A group is where arrangement lives. The members it holds state what one of
 * them is; this states how many there are, how they stand, and what the whole
 * can do. Count, layout, anchor, facing and seed derive every member, so the
 * compiler stores bounded chunks instead of scene nodes and the rows regenerate
 * from index and seed alone.
 *
 * The seed is declared in the model design rather than invented by a caller,
 * so the same design always materializes the same chorus.
 *
 * @evidence models/020-chorus.md Owns the reviewed 2,049-member layout,
 *   anchor, facing, spacing, seed, and formation channels as one CHORUS model.
 * @evidenceReview models/020-chorus.md #3e77761 Read models/020-chorus.md and Chorus in src/formations/chorus.ts; confirmed that this class alone owns the reviewed 2,049-member layout, anchor, facing, spacing, seed, and formation channels, while its H2 citations delimit the formation subset it realizes.
 * @evidence models/020-chorus.md#chorus-formation-representation Implements
 *   count, layout, anchor, facing, spacing, seed, and motion channels.
 * @evidenceReview models/020-chorus.md#chorus-formation-representation #b75fb56 Read models/020-chorus.md#chorus-formation-representation and Chorus in src/formations/chorus.ts; confirmed this citation after checking the claim that implements count, layout, anchor, facing, spacing, seed, and motion channels.
 * @evidence models/020-chorus.md#chorus-neutral-review-views Exposes stable
 *   formation bounds and deterministic tier placement for inspection.
 * @evidenceReview models/020-chorus.md#chorus-neutral-review-views #b58f6fc Read models/020-chorus.md#chorus-neutral-review-views and Chorus in src/formations/chorus.ts; confirmed this citation after checking the claim that exposes stable formation bounds and deterministic tier placement for inspection.
 * @evidence obligations/design/model-sources.md#design-owned-construction Keeps every
 *   layout and hierarchy decision owned by the cited model design.
 * @evidenceReview obligations/design/model-sources.md#design-owned-construction #41ffc4f Read obligations/design/model-sources.md#design-owned-construction and Chorus in src/formations/chorus.ts; confirmed this citation after checking the claim that keeps every layout and hierarchy decision owned by the cited model design.
 * @evidence obligations/design/model-sources.md#deterministic-build Uses one declared
 *   seed and explicit dimensions to regenerate the same formation.
 * @evidenceReview obligations/design/model-sources.md#deterministic-build #288cbb3 Read obligations/design/model-sources.md#deterministic-build and Chorus in src/formations/chorus.ts; confirmed this citation after checking the claim that uses one declared seed and explicit dimensions to regenerate the same formation.
 * @evidence obligations/design/model-sources.md#unsupported-fidelity-is-explicit
 *   Refuses a count that cannot fill the reviewed row layout honestly.
 * @evidenceReview obligations/design/model-sources.md#unsupported-fidelity-is-explicit #35050b3 Read obligations/design/model-sources.md#unsupported-fidelity-is-explicit and Chorus in src/formations/chorus.ts; confirmed this citation after checking the claim that refuses a count that cannot fill the reviewed row layout honestly.
 */
export class Chorus extends AutoMovieSubjectGroup<
  IAutoMovieFormationDesign,
  ChorusMember
> {
  public readonly id = "chorus";

  /**
   * How many members stand in the group.
   *
   * Authored rather than derived from rows times columns, because the last row
   * is deliberately short: a group whose every row is exactly full reads as a
   * lattice, and the silhouette this specification asks for is a real edge.
   *
   * Typed `number` rather than left to infer `2049`. A measurement is not the
   * one value it currently holds, and a literal type says a specialisation of
   * this group may never state a different one, which is the composition the
   * class layer exists for.
   */
  public readonly count: number = 2049;

  /** Rows deep, front to back. */
  public readonly ranks: number = 33;

  /** Members across one row. */
  public readonly files: number = 64;

  /**
   * The interval between members, in metres.
   *
   * The specification says anything that destroys the interval destroys the
   * subject, which makes this the group's load-bearing measurement rather than
   * a layout convenience.
   */
  public readonly spacing: { lateral: number; depth: number } = {
    lateral: 0.5,
    depth: 1,
  };

  /**
   * The deterministic seed every per-member variation is drawn from.
   *
   * @evidence models/020-chorus.md#chorus-formation-representation Draws every
   *   per-member variation from the reviewed declared seed.
   * @evidenceReview models/020-chorus.md#chorus-formation-representation #b75fb56 Read models/020-chorus.md#chorus-formation-representation and seed in src/formations/chorus.ts; confirmed this citation after checking the claim that draws every per-member variation from the reviewed declared seed.
   */
  public readonly seed: number = 1415;

  /**
   * Where the front of the group stands, in metres.
   *
   * A field rather than a literal inside the record, because the place that
   * holds the group has to know it: {@link reach} measures from here, and
   * reaching into `design()` for one number would run the record's own
   * validation to read a coordinate.
   */
  public readonly anchor: { x: number; y: number; z: number } = {
    x: 0,
    y: 0,
    z: -5,
  };

  /** Which way the rows face, in degrees. */
  public readonly facingDeg: number = 180;

  /** The one reviewed member recipe this formation instances. */
  public members(): readonly ChorusMember[] {
    return [chorusHero];
  }

  /**
   * The formation record the compiler materializes members from.
   *
   * No `dressing` tolerance is declared. This group is specified as in order
   * while the cue is given and still in order after it, so a deviation here
   * would be a dramatic event nobody authored.
   *
   * The constraint is checked here rather than in a constructor. A subclass
   * that overrides a measurement sets its own fields after the base constructor
   * has already run, so a constructor would validate numbers the subject no
   * longer has. `design()` is where the record leaves the class, which makes it
   * the one place every construction has to pass through.
   *
   * @evidence models/020-chorus.md#chorus-formation-representation Emits the
   *   reviewed rows, columns, spacing, anchor, seed, and capabilities.
   * @evidenceReview models/020-chorus.md#chorus-formation-representation #b75fb56 Read models/020-chorus.md#chorus-formation-representation and design in src/formations/chorus.ts; confirmed this citation after checking the claim that emits the reviewed rows, columns, spacing, anchor, seed, and capabilities.
   */
  public design(): IAutoMovieFormationDesign {
    const slots = this.ranks * this.files;
    if (this.count <= slots - this.files || this.count > slots)
      throw new Error(
        `docs/models/020-chorus.md requires rows and columns legible as rows and columns, so a count of ${this.count} cannot stand in ${this.ranks} rows of ${this.files}: that leaves ${this.count > slots ? `${this.count - slots} with no slot` : "the last row empty"}. Choose a count above ${slots - this.files} and at most ${slots}.`,
      );
    return {
      id: this.id,
      modelRecipe: chorusHero.id,
      count: this.count,
      layout: {
        kind: "line",
        ranks: this.ranks,
        files: this.files,
        spacing: this.spacing,
      },
      anchor: this.anchor,
      facingDeg: this.facingDeg,
      seed: this.seed,
      capabilities: ["hold", "advance", "break"],
      heroOverrides: [
        { slot: 31, actor: "lead" },
        { slot: 1055, actor: "second" },
      ],
    };
  }

  /**
   * Move the whole group forward without changing its intervals.
   *
   * Advancing is the one motion that must not loosen the group, so the spacing
   * scale is held at one on both ends rather than left to whatever the caller
   * passes.
   *
   * The distance is the motion design's {@link CHORUS_ADVANCE_METRES} rather
   * than a caller's choice, because the place it stands on is sized to hold it.
   * A shot free to pick a farther one would walk the rows off ground nobody
   * widened.
   *
   * @evidence models/020-chorus.md#chorus-formation-representation Delegates
   *   the reviewed translation to the motion owner and preserves intervals.
   * @evidenceReview models/020-chorus.md#chorus-formation-representation #b75fb56 Read models/020-chorus.md#chorus-formation-representation and advance in src/formations/chorus.ts; confirmed this citation after checking the claim that delegates the reviewed translation to the motion owner and preserves intervals.
   */
  public advance(props: {
    id: string;
    start: number;
    end: number;
  }): IAutoMovieFormationMotion {
    return createChorusAdvanceMotion({ ...props, formation: this.id });
  }

  /**
   * Hold the complete advance endpoint for an explicit authored interval.
   *
   * @evidence models/020-chorus.md#chorus-formation-representation Delegates
   *   the reviewed translation and spacing channels to the hold motion owner.
   * @evidenceReview models/020-chorus.md#chorus-formation-representation #b75fb56 Read models/020-chorus.md#chorus-formation-representation and hold in src/formations/chorus.ts; confirmed this citation after checking the claim that delegates the reviewed translation and spacing channels to the hold motion owner.
   */
  public hold(props: {
    id: string;
    start: number;
    end: number;
  }): IAutoMovieFormationMotion {
    return createChorusHoldMotion({ ...props, formation: this.id });
  }

  /**
   * Open the intervals, which is the authored loosening.
   *
   * The specification permits this only as a dramatic event, so it is a
   * separate method with an explicit scale rather than an option on
   * {@link advance}: a caller has to say it meant to break the group.
   *
   * Unlike {@link CHORUS_ADVANCE_METRES}, the scale is the caller's, so the
   * place is not sized for it in advance: a plaza cannot pre-hold every
   * loosening a story might author. A break that pushes the rows past the
   * ground the shot staged is refused at compile time, naming the corner, and
   * widening the place is the answer.
   *
   * @evidence models/020-chorus.md#chorus-formation-representation Delegates
   *   only the reviewed uniform spacing channels to the motion owner.
   * @evidenceReview models/020-chorus.md#chorus-formation-representation #b75fb56 Read models/020-chorus.md#chorus-formation-representation and break in src/formations/chorus.ts; confirmed this citation after checking the claim that delegates only the reviewed uniform spacing channels to the motion owner.
   */
  public break(props: {
    id: string;
    start: number;
    end: number;
    scale: number;
  }): IAutoMovieFormationMotion {
    return createChorusBreakMotion({ ...props, formation: this.id });
  }

  /**
   * How wide and deep the group stands, in metres.
   *
   * A utility the camera needs and the record does not state: framing the whole
   * group means knowing its footprint, and computing it at each call site is
   * how two shots end up disagreeing about where the edge is.
   *
   * @evidence models/020-chorus.md#chorus-neutral-review-views Computes the
   *   reviewed group footprint used by neutral bounds inspection.
   * @evidenceReview models/020-chorus.md#chorus-neutral-review-views #b58f6fc Read models/020-chorus.md#chorus-neutral-review-views and footprint in src/formations/chorus.ts; confirmed this citation after checking the claim that computes the reviewed group footprint used by neutral bounds inspection.
   */
  public footprint(): { width: number; depth: number } {
    return {
      width: (this.files - 1) * this.spacing.lateral,
      depth: (this.ranks - 1) * this.spacing.depth,
    };
  }

  /**
   * How far the group reaches from the world origin, along either axis.
   *
   * The footprint says how big the group is; this says where it ends, which is
   * the question a place has to answer. Depth is measured from the anchor
   * outward rather than centred, because a row forms up behind its anchor
   * rather than around it, and the sign of the facing cannot make it reach less
   * far, and it carries {@link CHORUS_ADVANCE_METRES} because a place has to
   * hold the group where it goes rather than only where it forms up.
   *
   * @evidence models/020-chorus.md#chorus-neutral-review-views Extends the
   *   reviewed footprint through its full authored advance for containment.
   * @evidenceReview models/020-chorus.md#chorus-neutral-review-views #b58f6fc Read models/020-chorus.md#chorus-neutral-review-views and reach in src/formations/chorus.ts; confirmed this citation after checking the claim that extends the reviewed footprint through its full authored advance for containment.
   */
  public reach(): number {
    const footprint = this.footprint();
    return Math.max(
      Math.abs(this.anchor.x) + footprint.width / 2,
      Math.abs(this.anchor.z) + footprint.depth + CHORUS_ADVANCE_METRES,
    );
  }

  /**
   * The group standing as designed, contributing no cue of its own.
   *
   * A shot that wants the group to move calls {@link advance} or {@link break}
   * and merges the cue; standing still is the default because the specification
   * treats motion as an event rather than a state.
   *
   * @evidence models/020-chorus.md#chorus-formation-representation Contributes
   *   the reviewed standing formation while separate motion sources move it.
   * @evidenceReview models/020-chorus.md#chorus-formation-representation #b75fb56 Read models/020-chorus.md#chorus-formation-representation and render in src/formations/chorus.ts; confirmed this citation after checking the claim that contributes the reviewed standing formation while separate motion sources move it.
   */
  public render(
    context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return super.render(context);
  }
}

/**
 * The production's one chorus.
 *
 * The class owns the exact model file; this exported instance separately
 * answers for constructing that reviewed formation once.
 *
 * @evidence models/020-chorus.md#chorus-formation-representation Instantiates
 *   the reviewed complete formation once.
 * @evidenceReview models/020-chorus.md#chorus-formation-representation #b75fb56 Read models/020-chorus.md#chorus-formation-representation and chorus in src/formations/chorus.ts; confirmed this citation after checking the claim that instantiates the reviewed complete formation once.
 */
export const chorus = new Chorus();
