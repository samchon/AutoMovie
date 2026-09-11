import {
  IAutoMovieCompiledInstanceSet,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import { autoMovieRenderDigest } from "../render/renderDigest";
import { canonicalizeAutoMovieJson } from "../text/canonicalizeAutoMovieJson";
import { AUTOMOVIE_INSTANCE_CHUNK_SIZE } from "./AUTOMOVIE_INSTANCE_CHUNK_SIZE";
import { IAutoMovieInstanceSetPlacement } from "./IAutoMovieInstanceSetPlacement";
import { compiledPopulationRepresentation } from "./compiledPopulationRepresentation";
import { instanceSlot } from "./instanceSlot";
import { summarizeCompiledSlotRange } from "./summarizeCompiledSlotRange";

/**
 * Compile one world instance set into its compact runtime without expanding it.
 *
 * The record keeps the placement and variation laws, the route snapshot a
 * route layout follows, one bounds and centroid per chunk of
 * {@link AUTOMOVIE_INSTANCE_CHUNK_SIZE} slots, the representation tiers and
 * conservative radius of the base recipe and of every declared prototype, and
 * a digest of every other field. A declared prototype table is compiled with
 * the base recipe's default first, which is the choice list every member is
 * regenerated against afterwards.
 *
 * Bounds are measured by regenerating each slot through {@link instanceSlot},
 * so a member whose seeded variation is non-finite, or whose route is missing
 * or has no length, refuses compilation instead of producing a set no consumer
 * can regenerate. Member radii come from the host as a table, as they do for a
 * formation. The digest is SHA-256 over canonical JSON v2 computed without a
 * Node built-in, equal to the Node builder's digest of the same canonical
 * bytes.
 *
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-compression-individuality Stores a large set as laws, seed, and bounded chunk summaries from which each member's identity is still regenerated.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality Compresses the population by count, index, seed, and prototype while keeping one conservative radius over every selectable prototype.
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Compiles the reusable prototypes, the base recipe's default included once, apart from the occurrences that select them.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Records each prototype's tiers and radius as the shared definition every slot occurrence refers to.
 * @evidence requirements/product/prototype-quality.md#product-authored-variation-determinism Rebuilds the same compiled set, including its seeded variation law, from the same design, routes, recipes, and radii.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-deterministic-input-identity Digests the canonical record so identical declared inputs and seed yield the identical runtime identity.
 */
export const materializeCompiledInstanceSet = (props: {
  /** Instance set design to compile. */
  instanceSet: IAutoMovieInstanceSetDesign;
  /** World routes a route layout resolves its route from. */
  world: Pick<IAutoMovieWorldDesign, "routes">;
  /** Model recipes keyed by id; empty when none are declared. */
  recipes?: ReadonlyMap<string, IAutoMovieModelRecipe>;
  /**
   * Conservative member radius in metres keyed by recipe id; an id without one
   * borrows its prototype's base recipe radius and then half a metre.
   */
  projectionRadii?: ReadonlyMap<string, number>;
}): IAutoMovieCompiledInstanceSet => {
  const instanceSet = props.instanceSet;
  const layout = instanceSet.layout;
  const recipes = props.recipes ?? new Map<string, IAutoMovieModelRecipe>();
  const projectionRadii = props.projectionRadii ?? new Map<string, number>();
  const route =
    layout.kind === "along-route"
      ? (props.world.routes.find(
          (candidate) => candidate.id === layout.route,
        ) ?? null)
      : null;
  const placement: IAutoMovieInstanceSetPlacement = {
    id: instanceSet.id,
    count: instanceSet.count,
    modelRecipe: instanceSet.modelRecipe,
    layout,
    route,
    anchor: instanceSet.anchor,
    facingDeg: instanceSet.facingDeg,
    seed: instanceSet.seed,
    variation: instanceSet.variation,
    ...(instanceSet.prototypes === undefined
      ? {}
      : {
          prototypes: [
            { id: "default", modelRecipe: instanceSet.modelRecipe, weight: 1 },
            ...instanceSet.prototypes,
          ],
        }),
  };
  const position = (slot: number) => instanceSlot(placement, slot).position;
  const chunks = Array.from(
    {
      length: Math.ceil(instanceSet.count / AUTOMOVIE_INSTANCE_CHUNK_SIZE),
    },
    (_, index) => {
      const start = index * AUTOMOVIE_INSTANCE_CHUNK_SIZE;
      const count = Math.min(
        AUTOMOVIE_INSTANCE_CHUNK_SIZE,
        instanceSet.count - start,
      );
      return {
        index,
        start,
        count,
        ...summarizeCompiledSlotRange(start, count, position),
      };
    },
  );
  const summary = summarizeCompiledSlotRange(0, instanceSet.count, position);
  const compilePrototype = (prototype: {
    id: string;
    modelRecipe: string;
    weight: number;
  }) => {
    const representation = compiledPopulationRepresentation({
      modelRecipe: prototype.modelRecipe,
      tiers: recipes.get(prototype.modelRecipe)?.lod ?? [],
      recipes,
      projectionRadii,
    });
    return {
      ...prototype,
      lod: representation.lod,
      projectionRadius: representation.projectionRadius,
    };
  };
  const defaultPrototype = compilePrototype({
    id: "default",
    modelRecipe: instanceSet.modelRecipe,
    weight: 1,
  });
  const prototypes =
    instanceSet.prototypes === undefined
      ? undefined
      : [defaultPrototype, ...instanceSet.prototypes.map(compilePrototype)];
  const core = {
    version: 1 as const,
    id: instanceSet.id,
    count: instanceSet.count,
    modelRecipe: instanceSet.modelRecipe,
    ...(prototypes === undefined ? {} : { prototypes }),
    layout: structuredClone(layout),
    route: route === null ? null : structuredClone(route),
    anchor: structuredClone(instanceSet.anchor),
    facingDeg: instanceSet.facingDeg,
    seed: instanceSet.seed,
    variation: structuredClone(instanceSet.variation),
    ...summary,
    projectionRadius:
      prototypes === undefined
        ? defaultPrototype.projectionRadius
        : Math.max(
            ...prototypes.map((prototype) => prototype.projectionRadius),
          ),
    chunks,
    lod: defaultPrototype.lod,
  };
  return {
    ...core,
    digest: autoMovieRenderDigest(canonicalizeAutoMovieJson(core)),
  };
};
