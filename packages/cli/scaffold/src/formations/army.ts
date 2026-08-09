import {
  AutoMovieSubjectGroup,
  type IAutoMovieSubjectContribution,
} from "@automovie/engine";
import type {
  IAutoMovieFormationDesign,
  IAutoMovieFormationMotion,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";

import { ArmyMember, armyHero } from "../units/armyHero";

/**
 * The army as one subject, not as two thousand authored actors.
 *
 * A group is where arrangement lives. The members it holds state what one of
 * them is; this states how many there are, how they stand, and what the whole
 * can do. Count, layout, anchor, facing and seed derive every member, so the
 * compiler stores bounded chunks instead of scene nodes and the ranks
 * regenerate from index and seed alone.
 *
 * The seed is declared here rather than chosen in source, so the same design
 * always materializes the same army.
 */
export class Army extends AutoMovieSubjectGroup<
  IAutoMovieFormationDesign,
  ArmyMember
> {
  public readonly id = "army";

  /**
   * How many members stand in the unit.
   *
   * Authored rather than derived from ranks times files, because the last rank
   * is deliberately short: a unit whose every rank is exactly full reads as a
   * lattice, and the silhouette this specification asks for is a real edge.
   *
   * Typed `number` rather than left to infer `2049`. A measurement is not the
   * one value it currently holds, and a literal type says a specialisation of
   * this unit may never state a different one, which is the composition the
   * class layer exists for.
   */
  public readonly count: number = 2049;

  /** Rows deep, front to back. */
  public readonly ranks: number = 33;

  /** Members across one rank. */
  public readonly files: number = 64;

  /**
   * The interval between members, in metres.
   *
   * The specification says anything that destroys the interval destroys the
   * subject, which makes this the unit's load-bearing measurement rather than a
   * layout convenience.
   */
  public readonly spacing: { lateral: number; depth: number } = {
    lateral: 0.5,
    depth: 1,
  };

  /** The deterministic seed every per-member variation is drawn from. */
  public readonly seed: number = 1415;

  /**
   * Where the front of the unit stands, in metres.
   *
   * A field rather than a literal inside the record, because the place that
   * holds the unit has to know it: {@link reach} measures from here, and
   * reaching into `design()` for one number would run the record's own
   * validation to read a coordinate.
   */
  public readonly anchor: { x: number; y: number; z: number } = {
    x: 0,
    y: 0,
    z: -5,
  };

  /** Which way the ranks face, in degrees. */
  public readonly facingDeg: number = 180;

  /**
   * How far the unit advances when a shot puts it in motion, in metres.
   *
   * The unit owns the distance rather than each shot choosing one, because the
   * place it stands on has to be large enough to hold the advance and a field
   * sized to a number no shot agreed to is a field the unit walks off.
   *
   * Like every measured fact here it carries no citation of its own, because
   * `@ttsc/evidence` does not yet select a class field as a unit
   * (samchon/ttsc#1121). The instance's tag answers for it until then.
   */
  public readonly advanceMetres: number = 2;

  public members(): readonly ArmyMember[] {
    return [armyHero];
  }

  /**
   * The formation record the compiler materializes members from.
   *
   * No `dressing` tolerance is declared. This unit is specified as ordered
   * while the signal is given and still ordered after it, so a deviation here
   * would be a dramatic event nobody authored.
   *
   * The constraint is checked here rather than in a constructor. A subclass
   * that overrides a measurement sets its own fields after the base constructor
   * has already run, so a constructor would validate numbers the subject no
   * longer has. `design()` is where the record leaves the class, which makes it
   * the one place every construction has to pass through.
   *
   * @evidence docs/characters/army.md States the ranks stay ordered and that
   *   any loosening must be authored as a dramatic event.
   */
  public design(): IAutoMovieFormationDesign {
    const slots = this.ranks * this.files;
    if (this.count <= slots - this.files || this.count > slots)
      throw new Error(
        `docs/characters/army.md requires ranks and files legible as ranks and files, so a count of ${this.count} cannot stand in ${this.ranks} ranks of ${this.files}: that leaves ${this.count > slots ? `${this.count - slots} with no slot` : "the last rank empty"}. Choose a count above ${slots - this.files} and at most ${slots}.`,
      );
    return {
      id: this.id,
      modelRecipe: armyHero.id,
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
      capabilities: ["advance", "break"],
      heroOverrides: [
        { slot: 31, actor: "captain" },
        { slot: 1055, actor: "lieutenant" },
      ],
    };
  }

  /**
   * Move the whole unit forward without changing its intervals.
   *
   * Advancing is the one motion that must not loosen the unit, so the spacing
   * scale is held at one on both ends rather than left to whatever the caller
   * passes.
   *
   * The distance is the unit's own {@link advanceMetres} rather than a caller's
   * choice, because the place it stands on is sized to hold it. A shot free to
   * pick a farther one would walk the ranks off ground nobody widened.
   *
   * @evidence docs/characters/army.md States the ranks remain ordered while
   *   the signal is given and after it.
   */
  public advance(props: {
    id: string;
    start: number;
    end: number;
  }): IAutoMovieFormationMotion {
    const held = { lateral: 1, depth: 1 };
    return {
      id: props.id,
      formation: this.id,
      action: "advance",
      start: props.start,
      end: props.end,
      from: {
        translation: { x: 0, y: 0, z: 0 },
        facingOffsetDeg: 0,
        spacingScale: held,
      },
      to: {
        translation: { x: 0, y: 0, z: -this.advanceMetres },
        facingOffsetDeg: 0,
        spacingScale: held,
      },
      easing: "easeInOut",
    };
  }

  /**
   * Open the intervals, which is the authored loosening.
   *
   * The specification permits this only as a dramatic event, so it is a
   * separate method with an explicit scale rather than an option on
   * {@link advance}: a caller has to say it meant to break the unit.
   *
   * Unlike {@link advanceMetres}, the scale is the caller's, so the place is not
   * sized for it in advance: a field cannot pre-hold every loosening a story
   * might author. A break that pushes the ranks past the ground the shot staged
   * is refused at compile time, naming the corner, and widening the place is
   * the answer.
   *
   * @evidence docs/characters/army.md States any loosening is a dramatic event
   *   and must be authored as one, never left to chance.
   */
  public break(props: {
    id: string;
    start: number;
    end: number;
    scale: number;
  }): IAutoMovieFormationMotion {
    return {
      id: props.id,
      formation: this.id,
      action: "break",
      start: props.start,
      end: props.end,
      from: {
        translation: { x: 0, y: 0, z: 0 },
        facingOffsetDeg: 0,
        spacingScale: { lateral: 1, depth: 1 },
      },
      to: {
        translation: { x: 0, y: 0, z: 0 },
        facingOffsetDeg: 0,
        spacingScale: { lateral: props.scale, depth: props.scale },
      },
      easing: "easeOut",
    };
  }

  /**
   * How wide and deep the unit stands, in metres.
   *
   * A utility the camera needs and the record does not state: framing the whole
   * unit means knowing its footprint, and computing it at each call site is how
   * two shots end up disagreeing about where the edge is.
   *
   * @evidence docs/characters/army.md States the unit reads by its edges,
   *   which is the measurement this returns.
   */
  public footprint(): { width: number; depth: number } {
    return {
      width: (this.files - 1) * this.spacing.lateral,
      depth: (this.ranks - 1) * this.spacing.depth,
    };
  }

  /**
   * How far the unit reaches from the world origin, along either axis.
   *
   * The footprint says how big the unit is; this says where it ends, which is
   * the question a place has to answer. Depth is measured from the anchor
   * outward rather than centred, because a line forms up behind its anchor
   * rather than around it, and the sign of the facing cannot make it reach less
   * far, and it carries {@link advanceMetres} because a place has to hold the
   * unit where it goes rather than only where it forms up.
   *
   * @evidence docs/characters/army.md States the unit reads by its edges,
   *   which is what this measures against the ground it stands on.
   */
  public reach(): number {
    const footprint = this.footprint();
    return Math.max(
      Math.abs(this.anchor.x) + footprint.width / 2,
      Math.abs(this.anchor.z) + footprint.depth + this.advanceMetres,
    );
  }

  /**
   * The unit standing as designed, contributing no cue of its own.
   *
   * A shot that wants the unit to move calls {@link advance} or {@link break} and
   * merges the cue; standing still is the default because the specification
   * treats motion as an event rather than a state.
   *
   * @evidence docs/characters/army.md States the ranks are ordered while the
   *   signal is given, which is a unit that holds rather than moves.
   */
  public render(
    context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return super.render(context);
  }
}

/**
 * The production's one army.
 *
 * Carries the subject's citation until a class can carry its own
 * (samchon/ttsc#1121).
 *
 * @evidence docs/characters/army.md Implements the ranks-and-files silhouette
 *   and the cohesion that specification requires while the signal is given.
 */
export const army = new Army();
