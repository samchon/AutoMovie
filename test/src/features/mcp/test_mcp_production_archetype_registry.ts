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
 * 1. A catalogue closes into one lookup per non-blank id, and refuses a blank or
 *    repeated one at registration rather than at the recipe that reached two
 *    builders.
 * 2. A recipe naming nothing registered is one design diagnostic that lists the
 *    registered names, and no parameter, capability, or attachment verdict is
 *    invented for a contract that does not exist.
 * 3. A production that registers its own definition compiles against it, while the
 *    definitions it did not register are refused for that production.
 * 4. Materialization builds through the registry, throws a diagnostic-shaped error
 *    rather than guessing when nothing answers, and lets compact selection fall
 *    back to its declared radius instead of a poisoned bound.
 */
export const test_mcp_production_archetype_registry = (): void => {
  const shipped = createAutoMovieArchetypeRegistry(
    AUTOMOVIE_PRIMITIVE_ARCHETYPES,
  );
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
      // A size compared with a length can never read false here: the
      // constructor throws on a repeat, so a catalogue that had collapsed two
      // entries into one would have thrown rather than come back short. What
      // the shipped catalogue owes is that each entry's own id is the key it
      // answers to, which is asked by looking one up and by handing the
      // catalogue back a definition it already holds.
      [
        "shippedCatalogueAnswersEachId",
        () =>
          AUTOMOVIE_PRIMITIVE_ARCHETYPES.every(
            (archetype) => shipped.get(archetype.id) === archetype,
          ),
      ],
      [
        "shippedCatalogueCloses",
        () =>
          AUTOMOVIE_PRIMITIVE_ARCHETYPES.every((archetype) =>
            throwsError(
              () =>
                createAutoMovieArchetypeRegistry([
                  ...AUTOMOVIE_PRIMITIVE_ARCHETYPES,
                  archetype,
                ]),
              `"${archetype.id}" is registered twice`,
            ),
          ),
      ],
    ]),
    {
      blankIdRefused: true,
      duplicateIdRefused: true,
      shippedCatalogueAnswersEachId: true,
      shippedCatalogueCloses: true,
    },
  );

  // Capabilities and an attachment ride along so the gate is asked for every
  // verdict the archetype would have owned, not only the parameter one.
  const unregistered: IAutoMovieModelRecipe = {
    ...recipeOf("unregistered", "no-such-archetype", {
      height: 1.8,
      headRadius: 0.16,
      limbRadius: 0.06,
    }),
    capabilities: ["signal"],
    attachments: [{ id: "socket", bone: "hips" }],
  };
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
        "inventsNoContractVerdict",
        () =>
          unregisteredDiagnostics.every(
            (diagnostic) =>
              diagnostic.code.startsWith("model-parameter-") === false &&
              diagnostic.code !== "design-capability-unsupported" &&
              diagnostic.code !== "design-attachment-unsupported",
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
      inventsNoContractVerdict: true,
      emptyRegistrySaysSo: true,
    },
  );

  const registry = createAutoMovieArchetypeRegistry([REGISTERED_SHELL]);
  const shell = recipeOf("shell", REGISTERED_SHELL.id, { radius: 0.5 });
  const shippedRecipe = recipeOf("shipped", "stickman", {
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
            graphOf(shippedRecipe),
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
      ["compactSelectionFallsBack", () => compact.projectionRadius === 0.5],
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
