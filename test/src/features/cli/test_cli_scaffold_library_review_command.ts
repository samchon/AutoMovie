import {
  readAutoMovieProductionEvidence,
  type IAutoMovieEvidenceConfigProps,
  type IAutoMovieProductionEvidence,
} from "@automovie/evidence";
import type { IAutoMovieDiagnostic } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
} from "../production/productionFixtures";

const command = require(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/library-review.ts",
  ),
) as {
  runLibraryReviewCommand: (props: {
    argv: readonly string[];
    root: string;
    productionId: string;
    evidence: IAutoMovieEvidenceConfigProps;
  }) => unknown;
};

const branches = [
  "instances",
  "materials",
  "motions",
  "spaces",
  "systems",
] as const;

const configuration = (root: string): IAutoMovieEvidenceConfigProps => ({
  location: root,
  kind: "library",
  populationScope: { mode: "complete-production" },
  settings: "review",
  research: "disabled",
  maps: "disabled",
  models: "disabled",
  spaces: "review",
  materials: "review",
  instances: "review",
  motions: "review",
  systems: "review",
  treatments: "disabled",
  scripts: "disabled",
  screenplays: "disabled",
  briefs: "disabled",
  mapSources: "disabled",
  modelSources: "disabled",
  spaceSources: "review",
  materialSources: "review",
  instanceSources: "review",
  motionSources: "review",
  systemSources: "review",
  shots: "disabled",
  productionSources: "disabled",
  filmSources: "disabled",
  claims: [],
});

const writeLibraryOwners = (root: string): void => {
  for (const branch of branches) {
    const document = path.join(root, "docs", branch, "owner.md");
    const source = path.join(root, "src", branch, "owner.ts");
    fs.mkdirSync(path.dirname(document), { recursive: true });
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(
      document,
      `# ${branch} owner\n\n## Delivery {#${branch}-delivery}\n\nThe current ${branch} delivery and its finite neutral observation.\n`,
      "utf8",
    );
    fs.writeFileSync(
      source,
      `export const ${branch}LibraryOwner = ${JSON.stringify(branch)};\n`,
      "utf8",
    );
  }
  const residue = path.join(root, "docs", "models", "disabled-residue.md");
  fs.mkdirSync(path.dirname(residue), { recursive: true });
  fs.writeFileSync(
    residue,
    "# Disabled model residue\n\n## Residue {#disabled-model-residue}\n\nNot selected for delivery.\n",
    "utf8",
  );
  fs.mkdirSync(path.join(root, "observations"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "observations", "space.svg"),
    '<svg><path d="M0 0h10v10z"/></svg>\n',
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "observations", "material.txt"),
    "baseColor=#886644 roughness=0.65 scale=1m\n",
    "utf8",
  );
  for (const branch of ["instances", "motions", "systems"])
    fs.writeFileSync(
      path.join(root, "observations", `${branch}.json`),
      `${JSON.stringify({ branch, observed: true, samples: [0, 0.5, 1] })}\n`,
      "utf8",
    );
};

const ownerAddress = (
  authoring: IAutoMovieProductionEvidence,
  branch: string,
): string => {
  const owner = authoring.designOwners.find(
    (entry) => entry.branch === branch,
  )!;
  return `${owner.path}#${owner.units[0]!.anchor}`;
};

const libraryDiagnostics = (props: {
  root: string;
  authoring: IAutoMovieProductionEvidence;
}): IAutoMovieDiagnostic[] =>
  new AutoMovieProductionCompiler(
    AutoMovieProductionProject.openReadOnly(props.root),
    props.authoring,
  )
    .lint({ scope: "review" })
    .diagnostics.filter((entry) => entry.target.startsWith("library:"));

/**
 * A generated library can create and pay branch-specific review plans without
 * inventing a shot, and the shipped compiler consumes the same authoring truth.
 *
 * Scenarios:
 *
 * 1. The shipped `plan` command accepts exact space, material, instance,
 *    motion, and system H2/source owners while disabled model residue stays out.
 * 2. Review fails at every exact owner before any receipt is recorded.
 * 3. Project artifacts pay building space/material observations and canonical
 *    structured facts pay instance, motion, and nonvisual system observations.
 * 4. After all current receipts are recorded the library diagnostic population
 *    is empty even though the project has no library dummy shot.
 * 5. A motion source change makes only current receipts stale and review fails
 *    again until the observation is reproduced.
 */
export const test_cli_scaffold_library_review_command = (): void => {
  const fixture = productionFixture();
  try {
    writeLibraryOwners(fixture.root);
    const evidence = configuration(fixture.root);
    const authoring = readAutoMovieProductionEvidence({
      root: fixture.root,
      productionEvidence: evidence,
    });
    const planResults = branches.map((branch) =>
      command.runLibraryReviewCommand({
        argv: [
          "plan",
          "--owner",
          ownerAddress(authoring, branch),
          "--source",
          `src/${branch}/owner.ts`,
          "--observation",
          `${branch}-neutral:${
            branch === "spaces" || branch === "materials" ? "artifact" : "facts"
          }`,
        ],
        root: fixture.root,
        productionId: "fixture-film",
        evidence,
      }),
    );
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    const negative = libraryDiagnostics({ root: fixture.root, authoring });

    for (const branch of branches) {
      const artifact =
        branch === "spaces"
          ? ["--artifact-project", "observations/space.svg"]
          : branch === "materials"
            ? ["--artifact-project", "observations/material.txt"]
            : ["--facts-file", `observations/${branch}.json`];
      command.runLibraryReviewCommand({
        argv: [
          "record",
          "--owner",
          ownerAddress(authoring, branch),
          "--observation",
          `${branch}-neutral`,
          "--runtime",
          "automovie-library-probe:v1",
          "--verdict",
          "passed",
          ...artifact,
        ],
        root: fixture.root,
        productionId: "fixture-film",
        evidence,
      });
    }
    const currentAuthoring = readAutoMovieProductionEvidence({
      root: fixture.root,
      productionEvidence: evidence,
    });
    const positive = libraryDiagnostics({
      root: fixture.root,
      authoring: currentAuthoring,
    });
    fs.writeFileSync(
      path.join(fixture.root, "src", "motions", "owner.ts"),
      'export const motionsLibraryOwner = "changed";\n',
      "utf8",
    );
    const changedAuthoring = readAutoMovieProductionEvidence({
      root: fixture.root,
      productionEvidence: evidence,
    });
    const stale = libraryDiagnostics({
      root: fixture.root,
      authoring: changedAuthoring,
    });

    TestValidator.equals(
      "generated library plans and receipts close the actual compiler consumer",
      namedFacts([
        [
          "exactPlansWritten",
          () =>
            planResults.length === branches.length &&
            branches.every((branch) =>
              fs.existsSync(
                path.join(fixture.root, "docs", branch, "owner.review.json"),
              ),
            ),
        ],
        [
          "disabledResidueExcluded",
          () =>
            authoring.designOwners.some(
              (entry) => entry.branch === "models",
            ) === false,
        ],
        [
          "sourceCompileCurrent",
          () => productionCompileSucceeded("library review fixture", compiled),
        ],
        [
          "unpaidOwnersRefused",
          () =>
            branches.every((branch) =>
              negative.some(
                (entry) =>
                  entry.target.includes(branch) &&
                  entry.message.includes("has no"),
              ),
            ),
        ],
        [
          "allBuildingMotionAndSystemReceiptsCurrent",
          () => positive.length === 0,
        ],
        [
          "motionSourceChangeStalesReceipt",
          () =>
            stale.some(
              (entry) =>
                entry.target.includes("motions") &&
                entry.message.includes("stale"),
            ),
        ],
      ]),
      {
        exactPlansWritten: true,
        disabledResidueExcluded: true,
        sourceCompileCurrent: true,
        unpaidOwnersRefused: true,
        allBuildingMotionAndSystemReceiptsCurrent: true,
        motionSourceChangeStalesReceipt: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
