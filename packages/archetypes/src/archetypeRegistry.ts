import { IAutoMovieModelArchetype } from "./IAutoMovieModelArchetype";

/**
 * Every archetype one host may build, keyed by the id a recipe names.
 *
 * A read-only map is the whole seam: the production core looks an archetype up
 * and reports the recipe when nothing answers, while a host decides what it
 * registered.
 *
 * @author Samchon
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Keeps reusable archetype definitions distinct from the recipe occurrences that reference them.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Provides the shared prototype lookup without storing placement or instance state.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-logical-group The archetype registry indexes definitions; authored group membership belongs to production instances.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-compression-individuality The registry neither stores nor renders repeated instances, so compression identity belongs downstream.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-instance-override-provenance Recipe and instance overrides are production facts, not archetype registration facts.
 * @evidenceExclude requirements/asset-authoring/identity-and-instances.md#asset-variant-inheritance Archetype registration is a flat id map and does not define asset variant inheritance.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-variant-inheritance Registered archetypes do not carry variant parents, revisions, or override graphs.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-instance-override-resolution The registry resolves a prototype id only; instance override precedence belongs to the production model.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality The registry has no group or member population to preserve.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-deterministic-instance-generation Archetype builders create one requested model and do not assign seeded instance identities.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-external-adoption-alternatives External scene adoption modes are handled before a native archetype is registered.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-alternative-selection-output This registry performs exact id lookup, not shot-purpose representation selection.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-alternative-failure-compatibility Replacement compatibility belongs to asset selection, while this registry only rejects blank or duplicate ids.
 */
export type AutoMovieModelArchetypeRegistry = ReadonlyMap<
  string,
  IAutoMovieModelArchetype
>;

/**
 * Register one closed catalogue of archetypes for a host to build from.
 *
 * Registration is where a duplicate or blank id has to fail, because after it
 * the map answers one definition per id and nobody can tell which of two
 * builders a recipe reached.
 *
 * @author Samchon
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Registers one unambiguous shared definition for recipe occurrences to reference.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Refuses ambiguous prototype registration before an occurrence can bind to it.
 */
export const createAutoMovieArchetypeRegistry = (
  archetypes: Iterable<IAutoMovieModelArchetype>,
): AutoMovieModelArchetypeRegistry => {
  const registry = new Map<string, IAutoMovieModelArchetype>();
  for (const archetype of archetypes) {
    if (archetype.id.trim().length === 0)
      throw new Error(
        "A model archetype id must contain non-whitespace text. Give every registered archetype the exact id its recipes name.",
      );
    if (registry.has(archetype.id))
      throw new Error(
        `Model archetype "${archetype.id}" is registered twice. Register one definition per id so a recipe cannot reach two builders.`,
      );
    registry.set(archetype.id, archetype);
  }
  return registry;
};
