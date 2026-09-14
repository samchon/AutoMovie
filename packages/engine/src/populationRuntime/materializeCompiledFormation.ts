import {
  IAutoMovieCompiledFormation,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieWorldSurface,
} from "@automovie/interface";

import {
  IAutoMovieFormationGrounding,
  formationSlotPosition,
} from "../formation";
import { Quaternion } from "../math/Quaternion";
import { mixSeed } from "../math/random";
import { autoMovieRenderDigest } from "../render/renderDigest";
import { canonicalizeAutoMovieJson } from "../text/canonicalizeAutoMovieJson";
import { AUTOMOVIE_FORMATION_CHUNK_SIZE } from "./AUTOMOVIE_FORMATION_CHUNK_SIZE";
import { compiledPopulationRepresentation } from "./compiledPopulationRepresentation";
import { summarizeCompiledSlotRange } from "./summarizeCompiledSlotRange";

/**
 * Compile one formation design into its compact, regenerable runtime record.
 *
 * The record stores what regenerates the members rather than the members: the
 * layout, anchor, heading and seed, one bounds and centroid per chunk of
 * {@link AUTOMOVIE_FORMATION_CHUNK_SIZE} slots with that chunk's anonymous
 * count once heroes are excluded, each hero's promoted base transform, the
 * anonymous representation tiers, a conservative member radius, a
 * domain-separated motion phase seed, and a digest of every other field.
 *
 * The terrain it snapshots is the part of the world that can be under a member:
 * the surfaces whose ground-plan extent reaches the footprint measured on level
 * ground, in declared order. Relief moves members up and down, never sideways,
 * so that footprint holds on any terrain, and a unit with nothing under it
 * reuses the level pass as its finished summary.
 *
 * Member radii come from the host as a table, because what measures a recipe,
 * a registered archetype or an adopted external proxy, is the host's
 * composition rather than this kernel's. The digest is SHA-256 over canonical
 * JSON v2 computed without a Node built-in, equal to the Node builder's digest
 * of the same canonical bytes.
 *
 * @evidence requirements/formations/scope-and-identity.md#formation-authoring-mode-selection Compiles a compact prototype-and-layout formation into a record whose resolved members stay reviewable without an explicit roster.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Preserves layout, seed, bounded chunks, hero exceptions, and the terrain snapshot instead of storing anonymous member nodes.
 * @evidence requirements/formations/heroes-variation-and-state.md#formation-hero-overrides Keeps each promoted hero at its slot's grounded base transform inside the unit while removing it from the anonymous count.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hero-variation-group-state Excludes each promoted slot from its chunk's anonymous batch exactly once and records its inherited base transform.
 * @evidence requirements/product/prototype-quality.md#product-authored-variation-determinism Rebuilds the same compiled formation, including its seeded motion phase law, from the same design, recipes, radii, and terrain.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-deterministic-input-identity Digests the canonical record so identical declared inputs and seed yield the identical runtime identity.
 */
export const materializeCompiledFormation = (props: {
  /** Formation design to compile. */
  formation: IAutoMovieFormationDesign;
  /** Model recipes keyed by id; empty when none are declared. */
  recipes?: ReadonlyMap<string, IAutoMovieModelRecipe>;
  /**
   * Conservative member radius in metres keyed by recipe id; an id without one
   * borrows the base recipe's radius and then half a metre.
   */
  projectionRadii?: ReadonlyMap<string, number>;
  /** World terrain in declared order; empty when the world has none. */
  surfaces?: readonly IAutoMovieWorldSurface[];
}): IAutoMovieCompiledFormation => {
  const formation = props.formation;
  const recipes = props.recipes ?? new Map<string, IAutoMovieModelRecipe>();
  const grounded = groundFormation(formation, props.surfaces ?? []);
  const position = (slot: number) =>
    formationSlotPosition(grounded.formation, slot);
  const heroes = new Set(formation.heroOverrides.map((hero) => hero.slot));
  const chunks = Array.from(
    {
      length: Math.ceil(formation.count / AUTOMOVIE_FORMATION_CHUNK_SIZE),
    },
    (_, index) => {
      const start = index * AUTOMOVIE_FORMATION_CHUNK_SIZE;
      const count = Math.min(
        AUTOMOVIE_FORMATION_CHUNK_SIZE,
        formation.count - start,
      );
      const summary = summarizeCompiledSlotRange(start, count, position);
      let anonymousCount = count;
      for (const slot of heroes)
        if (slot >= start && slot < start + count) --anonymousCount;
      return { index, start, count, anonymousCount, ...summary };
    },
  );
  const summary =
    grounded.footprint ??
    summarizeCompiledSlotRange(0, formation.count, position);
  const representation = compiledPopulationRepresentation({
    modelRecipe: formation.modelRecipe,
    tiers:
      recipes
        .get(formation.modelRecipe)
        ?.lod.filter((item) => item.tier !== "hero") ?? [],
    recipes,
    projectionRadii: props.projectionRadii ?? new Map<string, number>(),
  });
  const core = {
    version: 1 as const,
    id: formation.id,
    count: formation.count,
    anonymousCount: formation.count - formation.heroOverrides.length,
    modelRecipe: formation.modelRecipe,
    layout: structuredClone(formation.layout),
    anchor: structuredClone(formation.anchor),
    ground: structuredClone(grounded.ground),
    facingDeg: formation.facingDeg,
    seed: formation.seed,
    ...summary,
    projectionRadius: representation.projectionRadius,
    chunks,
    heroes: [...formation.heroOverrides]
      .sort((left, right) => left.slot - right.slot)
      .map((hero) => ({
        slot: hero.slot,
        actor: hero.actor,
        transform: {
          translation: position(hero.slot),
          rotation: Quaternion.fromAxisAngle(
            { x: 0, y: 1, z: 0 },
            formation.facingDeg,
          ),
          scale: { x: 1, y: 1, z: 1 },
        },
      })),
    lod: representation.lod,
    // Phase only. A cycle length compiled here would be a number nothing in the
    // unit produced: cadence is the ground a unit's cues cover, and a seeded
    // period made a halted crowd march in place and a marching one skate.
    phase: {
      seed: mixSeed(formation.seed, 0x70686173),
    },
  };
  return {
    ...core,
    digest: autoMovieRenderDigest(canonicalizeAutoMovieJson(core)),
  };
};

/**
 * Bind one formation to the terrain its members stand on.
 *
 * The snapshot is the surfaces whose extent reaches the formation's own
 * footprint, in declared order. Reaching is decided on the ground plan alone: a
 * surface whose XZ extent misses the footprint box cannot be under any member,
 * so dropping it is sound, and keeping the rest whole is what lets a consumer
 * answer heights from the compiled record without the world beside it.
 *
 * The footprint is measured with no terrain, which is exactly right: relief
 * moves members up and down, never sideways, so the ground plan is the same
 * before and after. That flat pass is also the finished summary whenever
 * nothing relieves it, so a production on level ground pays for no extra work.
 */
const groundFormation = (
  formation: IAutoMovieFormationDesign,
  surfaces: readonly IAutoMovieWorldSurface[],
): {
  formation: IAutoMovieFormationDesign & IAutoMovieFormationGrounding;
  ground: IAutoMovieWorldSurface[];
  /** The finished summary, or null when terrain still has to relieve it. */
  footprint: ReturnType<typeof summarizeCompiledSlotRange> | null;
} => {
  const flat = { ...formation, ground: [] };
  const footprint = summarizeCompiledSlotRange(0, formation.count, (slot) =>
    formationSlotPosition(flat, slot),
  );
  const ground = surfaces.filter((surface) =>
    reachesFootprint(surface.polygon, footprint.bounds),
  );
  return ground.length === 0
    ? { formation: flat, ground: [], footprint }
    : { formation: { ...formation, ground }, ground, footprint: null };
};

/** Does a surface footprint's XZ extent reach a formation's XZ extent? */
const reachesFootprint = (
  polygon: IAutoMovieWorldSurface["polygon"],
  bounds: IAutoMovieCompiledFormation["bounds"],
): boolean => {
  const xs = polygon.map((point) => point.x);
  const zs = polygon.map((point) => point.z);
  return (
    Math.min(...xs) <= bounds.max.x &&
    Math.max(...xs) >= bounds.min.x &&
    Math.min(...zs) <= bounds.max.z &&
    Math.max(...zs) >= bounds.min.z
  );
};
