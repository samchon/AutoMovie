import {
  type IAutoMovieFilmPopulationTransitionReceipt,
  type IValidateAutoMoviePopulationTransitionProps,
  createAutoMovieRetainedPilotHost,
  validateAutoMoviePopulationTransition,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { throwsError } from "../internal/predicates";

/**
 * A reset freezes the passed final pilot before complete-population rewriting.
 *
 * Scenarios:
 * 1. All four reviewed film branches authorize three construction drafts and disabled final.
 * 2. Missing, reordered, or absent reviewed branches and active final refuse the checkpoint.
 * 3. Every construction stage must reset together; retained bodies and tags stay exact.
 * 4. The one-pair library predecessor remains independent of the film final pass.
 */
export const test_evidence_film_reset_checkpoint = (): void => {
  const hosts = [
    {
      path: "docs/treatments/001-opening.md",
      source:
        "# Opening\n\n## Arrival {#arrival}\n\nThe visitor enters.\n<!--\n@evidence settings/world.md#entrance The visitor uses the established entrance.\n-->\n",
    },
  ];
  const receipt: IAutoMovieFilmPopulationTransitionReceipt = {
    version: 1,
    kind: "film",
    productionLocation: path.resolve("production"),
    owner: "pilot-author",
    pilotScope: { mode: "first-pilot", partitionGroup: "001-arrival" },
    reviewedBranches: [
      "treatments",
      "scripts",
      "screenplays",
      "screenplayNaturalness",
    ],
    retainedHosts: hosts.map(createAutoMovieRetainedPilotHost),
  };
  const props: IValidateAutoMoviePopulationTransitionProps = {
    kind: "film",
    productionLocation: receipt.productionLocation,
    owner: receipt.owner,
    receipt,
    stages: {
      treatments: "draft",
      scripts: "draft",
      screenplays: "draft",
      screenplayNaturalness: "disabled",
    },
    hosts,
  };
  validateAutoMoviePopulationTransition(props);
  for (const branches of [
    undefined,
    [],
    ["treatments", "scripts", "screenplays"],
    ["scripts", "treatments", "screenplays", "screenplayNaturalness"],
    ["treatments", "scripts", "screenplays", "screenplayNaturalness", "shots"],
  ])
    TestValidator.predicate(
      "the predecessor is the exact complete reviewed ladder",
      throwsError(() =>
        validateAutoMoviePopulationTransition({
          ...props,
          receipt: {
            ...receipt,
            reviewedBranches:
              branches as unknown as IAutoMovieFilmPopulationTransitionReceipt["reviewedBranches"],
          },
        }),
      ),
    );
  for (const stage of ["draft", "evidence", "review"])
    TestValidator.predicate(
      "final remains withdrawn throughout the reset checkpoint",
      throwsError(() =>
        validateAutoMoviePopulationTransition({
          ...props,
          stages: { ...props.stages, screenplayNaturalness: stage },
        }),
      ),
    );
  for (const branch of ["treatments", "scripts", "screenplays"])
    for (const stage of ["disabled", "evidence", "review"])
      TestValidator.predicate(
        "all construction branches reset to draft together",
        throwsError(() =>
          validateAutoMoviePopulationTransition({
            ...props,
            stages: { ...props.stages, [branch]: stage },
          }),
        ),
      );
  for (const source of [
    hosts[0].source.replace("visitor enters", "visitor leaves"),
    hosts[0].source.replace(
      "uses the established",
      "leaves through the established",
    ),
  ])
    TestValidator.predicate(
      "checkpoint forbids body or evidence rewriting",
      throwsError(() =>
        validateAutoMoviePopulationTransition({
          ...props,
          hosts: [{ ...hosts[0], source }],
        }),
      ),
    );
  validateAutoMoviePopulationTransition(props);
  const libraryHosts = [
    {
      path: "docs/models/asset.md",
      source: "## Asset {#asset}\n\nA bounded solid.\n",
    },
  ];
  validateAutoMoviePopulationTransition({
    ...props,
    kind: "library",
    receipt: {
      version: 1,
      kind: "library",
      productionLocation: receipt.productionLocation,
      owner: receipt.owner,
      pilotScope: { mode: "first-pilot" },
      reviewedPairs: [{ design: "models", source: "modelSources" }],
      retainedHosts: libraryHosts.map(createAutoMovieRetainedPilotHost),
    },
    stages: { models: "draft", modelSources: "draft" },
    hosts: libraryHosts,
  });
};
