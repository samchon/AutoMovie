import type { IAutoMovieLibraryContribution } from "@automovie/interface";
import { autoMovieLibraryContributionDiagnostics } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { analysisContext } from "../internal/analysisFixtures";
import { drawingBoxModel } from "../internal/drawingFixtures";
import { rectangularBuilding } from "../internal/envelopeFixtures";
import { namedFacts } from "../internal/predicates";

/**
 * Library completion accepts only a nonempty result owned by its branch.
 *
 * Scenarios:
 *
 * 1. Map, model, and space owners publish one result in their current semantic
 *    carrier without a diagnostic.
 * 2. Empty and cross-branch payloads fail before completion.
 * 3. Material, instance, motion, and system branches receive one explicit
 *    unsupported-carrier refusal rather than completing through nested data.
 */
export const test_production_library_contribution_contract = (): void => {
  const empty = (): IAutoMovieLibraryContribution => ({
    environments: [],
    models: [],
    contexts: [],
  });
  const map = empty();
  map.contexts = [analysisContext()];
  const model = empty();
  model.models = [
    drawingBoxModel({
      id: "bench",
      shape: { type: "box", width: 1, height: 1, depth: 1 },
      material: "wood",
    }),
  ];
  const space = empty();
  space.environments = [rectangularBuilding()];

  TestValidator.equals(
    "library contribution carrier follows its exact semantic owner",
    namedFacts([
      [
        "supportedBranchesAcceptTheirOwnCarrier",
        () =>
          autoMovieLibraryContributionDiagnostics("maps", map).length === 0 &&
          autoMovieLibraryContributionDiagnostics("models", model).length ===
            0 &&
          autoMovieLibraryContributionDiagnostics("spaces", space).length === 0,
      ],
      [
        "supportedBranchesRefuseEmptyCompletion",
        () =>
          ["maps", "models", "spaces"].every((branch) =>
            autoMovieLibraryContributionDiagnostics(branch, empty()).some(
              (message) => message.includes("returned no"),
            ),
          ),
      ],
      [
        "crossBranchPayloadsAreRefused",
        () =>
          autoMovieLibraryContributionDiagnostics("maps", {
            ...map,
            models: model.models,
          }).some((message) => message.includes("belongs to the models")) &&
          autoMovieLibraryContributionDiagnostics("models", {
            ...model,
            environments: space.environments,
          }).some((message) => message.includes("belongs to the spaces")) &&
          autoMovieLibraryContributionDiagnostics("spaces", {
            ...space,
            contexts: map.contexts,
          }).some((message) => message.includes("belongs to the maps")),
      ],
      [
        "unsupportedBranchesFailExplicitly",
        () =>
          ["materials", "instances", "motions", "systems"].every((branch) => {
            const diagnostics = autoMovieLibraryContributionDiagnostics(
              branch,
              space,
            );
            return (
              diagnostics.length === 1 &&
              diagnostics[0]!.includes("no supported standalone result carrier")
            );
          }),
      ],
      [
        "unknownBranchDoesNotBorrowAResultCarrier",
        () =>
          autoMovieLibraryContributionDiagnostics("unknown", map)[0]?.includes(
            "not a recognized design owner",
          ) === true,
      ],
      [
        "omittedContextsReadAsEmpty",
        () =>
          autoMovieLibraryContributionDiagnostics("maps", {
            environments: [],
            models: [],
          }).some((message) => message.includes("returned no contexts")),
      ],
    ]),
    {
      supportedBranchesAcceptTheirOwnCarrier: true,
      supportedBranchesRefuseEmptyCompletion: true,
      crossBranchPayloadsAreRefused: true,
      unsupportedBranchesFailExplicitly: true,
      unknownBranchDoesNotBorrowAResultCarrier: true,
      omittedContextsReadAsEmpty: true,
    },
  );
};
