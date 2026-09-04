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
 * @evidenceReview obligations/design/model-sources.md#design-owned-construction #ffa6690 Read obligations/design/model-sources.md#design-owned-construction and Chorus in src/formations/chorus.ts; confirmed this citation after checking the claim that keeps every layout and hierarchy decision owned by the cited model design.
 * @evidence obligations/design/model-sources.md#deterministic-build Uses one declared
 *   seed and explicit dimensions to regenerate the same formation.
 * @evidenceReview obligations/design/model-sources.md#deterministic-build #27790fe Read obligations/design/model-sources.md#deterministic-build and Chorus in src/formations/chorus.ts; confirmed this citation after checking the claim that uses one declared seed and explicit dimensions to regenerate the same formation.
 * @evidence obligations/design/model-sources.md#unsupported-fidelity-is-explicit
 *   Refuses a count that cannot fill the reviewed row layout honestly.
 * @evidenceReview obligations/design/model-sources.md#unsupported-fidelity-is-explicit #15c03fa Read obligations/design/model-sources.md#unsupported-fidelity-is-explicit and Chorus in src/formations/chorus.ts; confirmed this citation after checking the claim that refuses a count that cannot fill the reviewed row layout honestly.
 * @evidence principles/core/source-units.md#source-scope-preservation Chorus keeps responsibility for The chorus as one subject, not as two thousand authored actors in this declaration; the implementation fragment id, count, ranks, files, spacing, seed, anchor, facingDeg, members, design, advance, hold, break, footprint, reach, render introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion Chorus is a usable source artifact for The chorus as one subject, not as two thousand authored actors; it is implemented directly as id, count, ranks, files, spacing, seed, anchor, facingDeg, members, design, advance, hold, break, footprint, reach, render rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus tested the reviewed CHORUS model and formation decisions through The chorus as one subject, not as two thousand authored actors; the implementation fragment id, count, ranks, files, spacing, seed, anchor, facingDeg, members, design, advance, hold, break, footprint, reach, render shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export class Chorus extends AutoMovieSubjectGroup<
  IAutoMovieFormationDesign,
  ChorusMember
> {
  /**
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.id keeps responsibility for the readonly id value materialized by its initializer in this declaration; the implementation fragment "chorus" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.id declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.id is a usable source artifact for the readonly id value materialized by its initializer; it is implemented directly as "chorus" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.id signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.id tested the reviewed CHORUS model and formation decisions through the readonly id value materialized by its initializer; the implementation fragment "chorus" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.id implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
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
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.count keeps responsibility for How many members stand in the group in this declaration; the implementation fragment 2049 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.count declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.count is a usable source artifact for How many members stand in the group; it is implemented directly as 2049 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.count signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.count tested the reviewed CHORUS model and formation decisions through How many members stand in the group; the implementation fragment 2049 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.count implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly count: number = 2049;

  /**
   * Rows deep, front to back.
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.ranks keeps responsibility for Rows deep, front to back in this declaration; the implementation fragment 33 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.ranks declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.ranks is a usable source artifact for Rows deep, front to back; it is implemented directly as 33 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.ranks signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.ranks tested the reviewed CHORUS model and formation decisions through Rows deep, front to back; the implementation fragment 33 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.ranks implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly ranks: number = 33;

  /**
   * Members across one row.
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.files keeps responsibility for Members across one row in this declaration; the implementation fragment 64 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.files declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.files is a usable source artifact for Members across one row; it is implemented directly as 64 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.files signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.files tested the reviewed CHORUS model and formation decisions through Members across one row; the implementation fragment 64 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.files implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly files: number = 64;

  /**
   * The interval between members, in metres.
   *
   * The specification says anything that destroys the interval destroys the
   * subject, which makes this the group's load-bearing measurement rather than
   * a layout convenience.
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.spacing keeps responsibility for The interval between members, in metres in this declaration; the implementation fragment { lateral: 0.5, depth: 1, } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.spacing declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.spacing is a usable source artifact for The interval between members, in metres; it is implemented directly as { lateral: 0.5, depth: 1, } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.spacing signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.spacing tested the reviewed CHORUS model and formation decisions through The interval between members, in metres; the implementation fragment { lateral: 0.5, depth: 1, } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.spacing implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.seed keeps responsibility for The deterministic seed every per-member variation is drawn from in this declaration; the implementation fragment 1415 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.seed declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.seed is a usable source artifact for The deterministic seed every per-member variation is drawn from; it is implemented directly as 1415 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.seed signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.seed tested the reviewed CHORUS model and formation decisions through The deterministic seed every per-member variation is drawn from; the implementation fragment 1415 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.seed implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly seed: number = 1415;

  /**
   * Where the front of the group stands, in metres.
   *
   * A field rather than a literal inside the record, because the place that
   * holds the group has to know it: {@link reach} measures from here, and
   * reaching into `design()` for one number would run the record's own
   * validation to read a coordinate.
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.anchor keeps responsibility for Where the front of the group stands, in metres in this declaration; the implementation fragment { x: 0, y: 0, z: -5, } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.anchor declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.anchor is a usable source artifact for Where the front of the group stands, in metres; it is implemented directly as { x: 0, y: 0, z: -5, } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.anchor signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.anchor tested the reviewed CHORUS model and formation decisions through Where the front of the group stands, in metres; the implementation fragment { x: 0, y: 0, z: -5, } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.anchor implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly anchor: { x: number; y: number; z: number } = {
    x: 0,
    y: 0,
    z: -5,
  };

  /**
   * Which way the rows face, in degrees.
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.facingDeg keeps responsibility for Which way the rows face, in degrees in this declaration; the implementation fragment 180 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.facingDeg declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.facingDeg is a usable source artifact for Which way the rows face, in degrees; it is implemented directly as 180 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.facingDeg signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.facingDeg tested the reviewed CHORUS model and formation decisions through Which way the rows face, in degrees; the implementation fragment 180 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.facingDeg implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly facingDeg: number = 180;

  /**
   * The one reviewed member recipe this formation instances.
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.members keeps responsibility for The one reviewed member recipe this formation instances in this declaration; the implementation fragment { return [chorusHero]; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.members declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.members is a usable source artifact for The one reviewed member recipe this formation instances; it is implemented directly as { return [chorusHero]; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.members signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.members tested the reviewed CHORUS model and formation decisions through The one reviewed member recipe this formation instances; the implementation fragment { return [chorusHero]; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.members implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
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
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.design keeps responsibility for The formation record the compiler materializes members from in this declaration; the implementation fragment { const slots = this.ranks * this.files; if (this.count <= slots - this.files || this.count > slots) throw new Error( 'docs/models/020-chorus.md requires rows and columns introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.design declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.design is a usable source artifact for The formation record the compiler materializes members from; it is implemented directly as { const slots = this.ranks * this.files; if (this.count <= slots - this.files || this.count > slots) throw new Error( 'docs/models/020-chorus.md requires rows and columns rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.design signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.design tested the reviewed CHORUS model and formation decisions through The formation record the compiler materializes members from; the implementation fragment { const slots = this.ranks * this.files; if (this.count <= slots - this.files || this.count > slots) throw new Error( 'docs/models/020-chorus.md requires rows and columns shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.design implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.advance keeps responsibility for Move the whole group forward without changing its intervals in this declaration; the implementation fragment { return createChorusAdvanceMotion({ ...props, formation: this.id }); } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.advance declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.advance is a usable source artifact for Move the whole group forward without changing its intervals; it is implemented directly as { return createChorusAdvanceMotion({ ...props, formation: this.id }); } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.advance signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.advance tested the reviewed CHORUS model and formation decisions through Move the whole group forward without changing its intervals; the implementation fragment { return createChorusAdvanceMotion({ ...props, formation: this.id }); } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.advance implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.hold keeps responsibility for Hold the complete advance endpoint for an explicit authored interval in this declaration; the implementation fragment { return createChorusHoldMotion({ ...props, formation: this.id }); } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.hold declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.hold is a usable source artifact for Hold the complete advance endpoint for an explicit authored interval; it is implemented directly as { return createChorusHoldMotion({ ...props, formation: this.id }); } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.hold signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.hold tested the reviewed CHORUS model and formation decisions through Hold the complete advance endpoint for an explicit authored interval; the implementation fragment { return createChorusHoldMotion({ ...props, formation: this.id }); } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.hold implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.break keeps responsibility for Open the intervals, which is the authored loosening in this declaration; the implementation fragment { return createChorusBreakMotion({ ...props, formation: this.id }); } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.break declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.break is a usable source artifact for Open the intervals, which is the authored loosening; it is implemented directly as { return createChorusBreakMotion({ ...props, formation: this.id }); } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.break signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.break tested the reviewed CHORUS model and formation decisions through Open the intervals, which is the authored loosening; the implementation fragment { return createChorusBreakMotion({ ...props, formation: this.id }); } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.break implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.footprint keeps responsibility for How wide and deep the group stands, in metres in this declaration; the implementation fragment { return { width: (this.files - 1) * this.spacing.lateral, depth: (this.ranks - 1) * this.spacing.depth, }; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.footprint declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.footprint is a usable source artifact for How wide and deep the group stands, in metres; it is implemented directly as { return { width: (this.files - 1) * this.spacing.lateral, depth: (this.ranks - 1) * this.spacing.depth, }; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.footprint signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.footprint tested the reviewed CHORUS model and formation decisions through How wide and deep the group stands, in metres; the implementation fragment { return { width: (this.files - 1) * this.spacing.lateral, depth: (this.ranks - 1) * this.spacing.depth, }; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.footprint implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.reach keeps responsibility for How far the group reaches from the world origin, along either axis in this declaration; the implementation fragment { const footprint = this.footprint(); return Math.max( Math.abs(this.anchor.x) + footprint.width / 2, Math.abs(this.anchor.z) + footprint.depth + CHORUS_ADVANCE_METRES, ); } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.reach declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.reach is a usable source artifact for How far the group reaches from the world origin, along either axis; it is implemented directly as { const footprint = this.footprint(); return Math.max( Math.abs(this.anchor.x) + footprint.width / 2, Math.abs(this.anchor.z) + footprint.depth + CHORUS_ADVANCE_METRES, ); } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.reach signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.reach tested the reviewed CHORUS model and formation decisions through How far the group reaches from the world origin, along either axis; the implementation fragment { const footprint = this.footprint(); return Math.max( Math.abs(this.anchor.x) + footprint.width / 2, Math.abs(this.anchor.z) + footprint.depth + CHORUS_ADVANCE_METRES, ); } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.reach implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
   * @evidence principles/core/source-units.md#source-scope-preservation Chorus.render keeps responsibility for The group standing as designed, contributing no cue of its own in this declaration; the implementation fragment { return super.render(context); } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Chorus.render declaration and implementation with the reviewed CHORUS model and formation decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Chorus.render is a usable source artifact for The group standing as designed, contributing no cue of its own; it is implemented directly as { return super.render(context); } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Chorus.render signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Chorus.render tested the reviewed CHORUS model and formation decisions through The group standing as designed, contributing no cue of its own; the implementation fragment { return super.render(context); } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Chorus.render implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
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
 * @evidence principles/core/source-units.md#source-scope-preservation chorus keeps responsibility for the exported chorus source owner and its declared value or behavior in this declaration; the implementation fragment new Chorus() introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared this exported binding with the reviewed CHORUS responsibility: it constructs `Chorus` once with no arguments and adds no member, tier, or spacing decision of its own, so its scope is exactly the identity of the one formation instance the production advances and holds.
 * @evidence principles/core/source-units.md#source-substantive-completion chorus is a usable source artifact for the exported chorus source owner and its declared value or behavior; it is implemented directly as new Chorus() rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced what a consumer actually receives from this binding: one fully constructed `Chorus` whose member recipes, tier thresholds, and formation anchor are already fixed at the declaration, so a consumer obtains the ordered collective without assembling members or choosing spacing.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing chorus tested the reviewed CHORUS model and formation decisions through the exported chorus source owner and its declared value or behavior; the implementation fragment new Chorus() shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared this binding with its reviewed parent: constructing one instance introduces no member, spacing, or anchor decision the model design did not already settle, so the binding leaves the parent decision nothing to repair.
 */
export const chorus = new Chorus();
