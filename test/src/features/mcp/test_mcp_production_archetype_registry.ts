import { IAutoMovieModelRecipe } from "@automovie/interface";
import {
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
  IAutoMovieModelArchetype,
  IAutoMovieProductionDesignGraph,
  createAutoMovieArchetypeRegistry,
  materializeCompiledFormation,
  materializeProductionModels,
  validateAutoMovieProductionGraph,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import { formationDesign, modelRecipe } from "./productionFixtures";

/** One definition a production supplies, registered like any other. */
const REGISTERED_SHELL: IAutoMovieModelArchetype = {
  id: "registered-shell",
  capabilities: ["signal"],
  bones: [],
  parameters: { radius: { kind: "number", minimum: 0.1, maximum: 4 } },
  plan: () => ({ required: ["radius"], accepted: null, refusals: [] }),
  projectionRadius: (parameters) => Number(parameters.radius),
  build: (input) => ({
    skeleton: null,
    parts: [
      {
        id: "shell",
        name: "shell",
        geometry: {
          type: "primitive",
          shape: { type: "sphere", radius: Number(input.parameters.radius) },
        },
        material: input.material,
        attachedBone: null,
        transform: null,
      },
    ],
  }),
};

const recipeOf = (
  id: string,
  archetype: string,
  parameters: IAutoMovieModelRecipe["parameters"],
): IAutoMovieModelRecipe => ({
  ...modelRecipe(),
  id,
  archetype,
  parameters,
  lod: [{ tier: "hero", maxDistance: null, recipe: id }],
});

const graphOf = (
  ...models: IAutoMovieModelRecipe[]
): IAutoMovieProductionDesignGraph => ({
  production: null,
  models: new Map(models.map((model) => [model.id, model])),
  world: null,
  formations: new Map(),
  shots: new Map(),
  acceptance: new Map(),
});

/**
 * The archetype catalogue is registered, never enumerated by the compiler.
 *
 * Scenarios:
 *
 * 1. A catalogue closes into one lookup per non-blank id, and refuses a blank
 *    or repeated one at registration rather than at the recipe that reached
 *    two builders.
 * 2. A recipe naming nothing registered is one design diagnostic that lists the
 *    registered names, and no parameter, capability, or attachment verdict is
 *    invented for a contract that does not exist.
 * 3. A production that registers its own definition compiles against it, while
 *    the definitions it did not register are refused for that production.
 * 4. Materialization builds through the registry, throws a diagnostic-shaped
 *    error rather than guessing when nothing answers, and lets compact
 *    selection fall back to its declared radius instead of a poisoned bound.
 */
export const test_mcp_production_archetype_registry = (): void => {
  TestValidator.equals(
    "a catalogue registers one definition per non-blank id",
    namedFacts([
      [
        "blankIdRefused",
        () =>
          throwsError(
            () =>
              createAutoMovieArchetypeRegistry([
                { ...REGISTERED_SHELL, id: "   " },
              ]),
            "non-whitespace text",
          ),
      ],
      [
        "duplicateIdRefused",
        () =>
          throwsError(
            () =>
              createAutoMovieArchetypeRegistry([
                REGISTERED_SHELL,
                REGISTERED_SHELL,
              ]),
            "registered twice",
          ),
      ],
      [
        "shippedCatalogueCloses",
        () =>
          createAutoMovieArchetypeRegistry(AUTOMOVIE_PRIMITIVE_ARCHETYPES)
            .size === AUTOMOVIE_PRIMITIVE_ARCHETYPES.length,
      ],
    ]),
    {
      blankIdRefused: true,
      duplicateIdRefused: true,
      shippedCatalogueCloses: true,
    },
  );

  const unregistered = recipeOf("unregistered", "no-such-archetype", {
    height: 1.8,
    headRadius: 0.16,
    limbRadius: 0.06,
  });
  const unregisteredDiagnostics = validateAutoMovieProductionGraph(
    graphOf(unregistered),
  );
  TestValidator.equals(
    "an unregistered archetype is one diagnostic naming the registered choices",
    namedFacts([
      [
        "oneUnregisteredDiagnostic",
        () =>
          unregisteredDiagnostics.filter(
            (diagnostic) => diagnostic.code === "model-archetype-unregistered",
          ).length === 1,
      ],
      [
        "namesRegisteredArchetypes",
        () =>
          unregisteredDiagnostics.some((diagnostic) =>
            diagnostic.message.includes("primitive-prop, stickman"),
          ),
      ],
      [
        "inventsNoParameterVerdict",
        () =>
          unregisteredDiagnostics.every(
            (diagnostic) =>
              diagnostic.code.startsWith("model-parameter-") === false &&
              diagnostic.code !== "design-capability-unsupported",
          ),
      ],
      [
        "emptyRegistrySaysSo",
        () =>
          validateAutoMovieProductionGraph(
            graphOf(unregistered),
            "fixture-film",
            new Map(),
          ).some((diagnostic) =>
            diagnostic.message.includes("none registered"),
          ),
      ],
    ]),
    {
      oneUnregisteredDiagnostic: true,
      namesRegisteredArchetypes: true,
      inventsNoParameterVerdict: true,
      emptyRegistrySaysSo: true,
    },
  );

  const registry = createAutoMovieArchetypeRegistry([REGISTERED_SHELL]);
  const shell = recipeOf("shell", REGISTERED_SHELL.id, { radius: 0.5 });
  const shipped = recipeOf("shipped", "stickman", {
    height: 1.8,
    headRadius: 0.16,
    limbRadius: 0.06,
  });
  const shellModel = materializeProductionModels(
    new Map([[shell.id, shell]]),
    new Map(),
    registry,
  ).get(shell.id);
  const compact = materializeCompiledFormation(
    { ...formationDesign(), id: "unregistered", modelRecipe: unregistered.id },
    new Map([[unregistered.id, unregistered]]),
  );
  TestValidator.equals(
    "a production builds through the catalogue it registered, and only that one",
    namedFacts([
      [
        "registeredRecipeAccepted",
        () =>
          validateAutoMovieProductionGraph(
            graphOf(shell),
            "fixture-film",
            registry,
          ).length === 0,
      ],
      [
        "unregisteredShippedRefused",
        () =>
          validateAutoMovieProductionGraph(
            graphOf(shipped),
            "fixture-film",
            registry,
          ).some(
            (diagnostic) => diagnostic.code === "model-archetype-unregistered",
          ),
      ],
      [
        "builtByItsOwnBuilder",
        () =>
          shellModel?.skeleton === null &&
          shellModel.parts.length === 1 &&
          shellModel.parts[0]?.geometry.type === "primitive",
      ],
      [
        "materializationRefusesToGuess",
        () =>
          throwsError(
            () =>
              materializeProductionModels(
                new Map([[unregistered.id, unregistered]]),
              ),
            "is not registered with this compiler",
          ),
      ],
      [
        "compactSelectionFallsBack",
        () => compact.projectionRadius === 0.5,
      ],
    ]),
    {
      registeredRecipeAccepted: true,
      unregisteredShippedRefused: true,
      builtByItsOwnBuilder: true,
      materializationRefusesToGuess: true,
      compactSelectionFallsBack: true,
    },
  );
};
