import type { IAutoMovieSubjectContribution } from "@automovie/engine";
import { AutoMovieSubjectGroup } from "@automovie/engine";
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
 *
 * @evidence docs/characters/army.md Implements the ranks-and-files silhouette
 *   and the cohesion that specification requires while the signal is given.
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
   * @evidence docs/characters/army.md Requires the unit to read by its edges
   *   and its intervals.
   */
  public readonly count = 2049;

  /** Rows deep, front to back. */
  public readonly ranks = 33;

  /** Members across one rank. */
  public readonly files = 64;

  /**
   * The interval between members, in metres.
   *
   * The specification says anything that destroys the interval destroys the
   * subject, which makes this the unit's load-bearing measurement rather than a
   * layout convenience.
   *
   * @evidence docs/characters/army.md States the unit reads by its edges and
   *   its intervals.
   */
  public readonly spacing = { lateral: 0.5, depth: 1 };

  /**
   * The deterministic seed every per-member variation is drawn from.
   *
   * @evidence docs/characters/army.md Requires that any loosening be authored
   *   rather than left to chance, which a declared seed is what enforces.
   */
  public readonly seed = 1415;

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
   * @evidence docs/characters/army.md States the ranks stay ordered and that
   *   any loosening must be authored as a dramatic event.
   */
  public design(): IAutoMovieFormationDesign {
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
      anchor: { x: 0, y: 0, z: -5 },
      facingDeg: 180,
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
   * @evidence docs/characters/army.md States the ranks remain ordered while
   *   the signal is given and after it.
   */
  public advance(props: {
    id: string;
    start: number;
    end: number;
    metres: number;
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
        translation: { x: 0, y: 0, z: props.metres },
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

/** The production's one army. */
export const army = new Army();
