import {
  type IAutoMovieEvidenceConfigProps,
  type IAutoMovieProductionEvidence,
  readAutoMovieProductionEvidence,
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

const commandPath = path.resolve(
  __dirname,
  "../../../../packages/template/scaffold/scripts/library-review.ts",
);
const productionEvidencePath = path.resolve(
  __dirname,
  "../../../../packages/template/scaffold/productionEvidence.ts",
);
const configurationPath = path.resolve(
  __dirname,
  "../../../../packages/template/scaffold/automovie.config.ts",
);
const command = require(commandPath) as {
  runLibraryReviewCommand: (props: {
    argv: readonly string[];
    root?: string;
    productionId?: string;
    evidence?: IAutoMovieEvidenceConfigProps;
    output?: (value: unknown) => void;
  }) => unknown;
};

const branches = [
  "instances",
  "maps",
  "materials",
  "motions",
  "spaces",
  "systems",
] as const;

const resetLibraryHosts = (root: string): void => {
  for (const branch of [
    "research",
    "maps",
    "models",
    "spaces",
    "materials",
    "instances",
    "motions",
    "systems",
    "treatments",
    "scripts",
    "screenplays",
    "briefs",
  ])
    fs.rmSync(path.join(root, "docs", branch), {
      force: true,
      recursive: true,
    });
  for (const branch of [
    "maps",
    "models",
    "spaces",
    "materials",
    "instances",
    "motions",
    "systems",
    "shots",
  ])
    fs.rmSync(path.join(root, "src", branch), {
      force: true,
      recursive: true,
    });
  for (const file of ["film.ts", "production.ts"])
    fs.rmSync(path.join(root, "src", file), { force: true });
};

const configuration = (root: string): IAutoMovieEvidenceConfigProps => ({
  location: root,
  kind: "library",
  populationScope: { mode: "complete-production" },
  settings: "review",
  research: "disabled",
  maps: "review",
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
  mapSources: "review",
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
  fs.mkdirSync(path.join(root, "docs", "contracts"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs", "contracts", "index.md"),
    "<!-- @evidenceExclude discovery/core/common.md#shared-local-boundary The complete library fixture audit found no independent work-specific rule beyond the selected shared targets and its exact design owners. -->\n\n# Work-specific contract audit\n",
    "utf8",
  );
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
  fs.writeFileSync(
    path.join(root, "observations", "maps.json"),
    `${JSON.stringify({
      extent: { min: [-20, 0, -15], max: [20, 8, 15] },
      coordinate: { unit: "meter", up: "+Y", forward: "+Z" },
      views: ["plan", "section", "elevation"],
      traversal: { from: "west-entry", to: "site", reachable: true },
      terrainWaterNetworkSiteInterfaces: "checked",
    })}\n`,
    "utf8",
  );
};

const observationId = (branch: (typeof branches)[number]): string =>
  branch === "maps"
    ? "map-plan-section-elevation-traversal-extent"
    : `${branch}-neutral`;

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

const commandRefuses = (props: {
  argv: readonly string[];
  root: string;
  evidence: IAutoMovieEvidenceConfigProps;
  message: string;
}): boolean => {
  try {
    command.runLibraryReviewCommand({
      argv: props.argv,
      root: props.root,
      productionId: "fixture-film",
      evidence: props.evidence,
    });
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(props.message);
  }
};

/**
 * A generated library can create and pay branch-specific review plans without
 * inventing a shot, and the shipped compiler consumes the same authoring truth.
 *
 * Scenarios:
 *
 * 1. The shipped `plan` command accepts exact map, space, material, instance,
 *    motion, and system H2/source owners while disabled model residue stays out.
 * 2. Review fails at every exact owner before any receipt is recorded.
 * 3. Structured map extent/view/traversal facts, building space/material
 *    artifacts, and instance, motion, and nonvisual system facts pay their
 *    distinct finite observations.
 * 4. After all current receipts are recorded the library diagnostic population
 *    is empty even though the project has no library dummy shot.
 * 5. A motion source change makes only current receipts stale and review fails
 *    again until the observation is reproduced.
 */
export const test_cli_scaffold_library_review_command = (): void => {
  const fixture = productionFixture();
  try {
    const modelSource = fs.readFileSync(
      path.join(fixture.root, "src", "models", "soloist.ts"),
      "utf8",
    );
    resetLibraryHosts(fixture.root);
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
          `${observationId(branch)}:${
            branch === "spaces" || branch === "materials" ? "artifact" : "facts"
          }`,
        ],
        root: fixture.root,
        productionId: "fixture-film",
        evidence,
      }),
    );
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiled = new AutoMovieProductionCompiler(
      project,
      authoring,
    ).compile({
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
          observationId(branch),
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
    const singleton = require(productionEvidencePath) as {
      productionEvidence: IAutoMovieEvidenceConfigProps;
    };
    const configured = require(configurationPath) as {
      default: { productionId: string };
    };
    const originalEvidence = { ...singleton.productionEvidence };
    const originalProductionId = configured.default.productionId;
    const originalDirectory = process.cwd();
    let defaultSingletonInspect = false;
    try {
      Object.assign(singleton.productionEvidence, evidence);
      configured.default.productionId = "fixture-film";
      process.chdir(fixture.root);
      defaultSingletonInspect =
        (
          command.runLibraryReviewCommand({ argv: [] }) as {
            owners: unknown[];
          }
        ).owners.length === branches.length;
    } finally {
      process.chdir(originalDirectory);
      Object.assign(singleton.productionEvidence, originalEvidence);
      configured.default.productionId = originalProductionId;
    }
    let outputCount = 0;
    command.runLibraryReviewCommand({
      argv: ["inspect"],
      root: fixture.root,
      productionId: "fixture-film",
      evidence,
      output: () => {
        outputCount += 1;
      },
    });
    const spaceOwner = ownerAddress(authoring, "spaces");
    const refusals: Array<readonly [readonly string[], string]> = [
      [["unknown"], 'must be "inspect", "plan", or "record"'],
      [["inspect", "positional"], "unknown or positional"],
      [["inspect", "--typo", "value"], "unknown or positional"],
      [
        [
          "plan",
          "--owner",
          spaceOwner,
          "--source",
          "src/spaces/owner.ts",
          "--observation",
          "space:artifact",
          "--typo",
          "value",
        ],
        "unknown or positional",
      ],
      [["plan", "--owner", "--source", "bad"], "requires one value"],
      [["plan", "--owner", spaceOwner, "--owner", spaceOwner], "exactly once"],
      [["plan", "--owner", "invalid"], "must be one exact"],
      [
        ["plan", "--owner", "docs/spaces/owner.md#absent"],
        "outside the exact active",
      ],
      [["plan", "--owner", spaceOwner], "nonempty unique subset"],
      [
        [
          "plan",
          "--owner",
          spaceOwner,
          "--source",
          "src/spaces/owner.ts",
          "--source",
          "src/spaces/owner.ts",
        ],
        "nonempty unique subset",
      ],
      [
        ["plan", "--owner", spaceOwner, "--source", "src/other.ts"],
        "nonempty unique subset",
      ],
      [
        ["plan", "--owner", spaceOwner, "--source", "src/spaces/owner.ts"],
        "one or more uniquely named",
      ],
      [
        [
          "plan",
          "--owner",
          spaceOwner,
          "--source",
          "src/spaces/owner.ts",
          "--observation",
          "same:artifact",
          "--observation",
          "same:facts",
        ],
        "uniquely named",
      ],
      ...[
        " :artifact",
        "bad:unknown",
        "bad:artifact:model",
        "bad:turntable",
        "bad:turntable: model",
        "bad:turntable:model:extra",
      ].map(
        (observation) =>
          [
            [
              "plan",
              "--owner",
              spaceOwner,
              "--source",
              "src/spaces/owner.ts",
              "--observation",
              observation,
            ],
            observation === "bad:turntable" ||
            observation === "bad:turntable: model"
              ? "needs a model"
              : observation.includes("artifact:model")
                ? "only for turntable"
                : "must be id:artifact",
          ] as const,
      ),
      [
        [
          "plan",
          "--owner",
          spaceOwner,
          "--source",
          "src/spaces/owner.ts",
          "--observation",
          "fake:turntable:chair",
        ],
        "not a model turntable",
      ],
      [["record"], "--owner is required"],
      [
        [
          "record",
          "--owner",
          spaceOwner,
          "--observation",
          "spaces-neutral",
          "--runtime",
          " ",
          "--verdict",
          "passed",
        ],
        "canonical nonblank",
      ],
      [
        [
          "record",
          "--owner",
          spaceOwner,
          "--observation",
          "spaces-neutral",
          "--runtime",
          "probe:v1",
          "--verdict",
          "maybe",
        ],
        "Unsupported terminal verdict",
      ],
      [
        [
          "record",
          "--owner",
          spaceOwner,
          "--observation",
          "absent",
          "--runtime",
          "probe:v1",
          "--verdict",
          "passed",
        ],
        "outside current owner",
      ],
      [
        [
          "record",
          "--owner",
          spaceOwner,
          "--observation",
          "spaces-neutral",
          "--runtime",
          "probe:v1",
          "--verdict",
          "passed",
        ],
        "Record exactly one",
      ],
      [
        [
          "record",
          "--owner",
          spaceOwner,
          "--observation",
          "spaces-neutral",
          "--runtime",
          "probe:v1",
          "--verdict",
          "passed",
          "--artifact-project",
          "absent.txt",
        ],
        "absent or unsafe",
      ],
      [
        [
          "record",
          "--owner",
          spaceOwner,
          "--observation",
          "spaces-neutral",
          "--runtime",
          "probe:v1",
          "--verdict",
          "passed",
          "--artifact-project",
          "observations/space.svg",
          "--facts-file",
          "observations/spaces.json",
        ],
        "Record exactly one",
      ],
      [
        [
          "record",
          "--owner",
          spaceOwner,
          "--observation",
          "spaces-neutral",
          "--runtime",
          "probe:v1",
          "--verdict",
          "passed",
          "--turntable",
          "chair",
        ],
        "requires artifact, not turntable",
      ],
      [
        [
          "record",
          "--owner",
          spaceOwner,
          "--observation",
          "spaces-neutral",
          "--runtime",
          "probe:v1",
          "--verdict",
          "passed",
          "--artifact-project",
          "observations/space.svg",
          "--typo",
          "value",
        ],
        "unknown or positional",
      ],
    ];
    const refusalCoverage = refusals.every(([argv, message]) =>
      commandRefuses({ argv, root: fixture.root, evidence, message }),
    );
    const renderArtifact = path.join(
      fixture.root,
      "renders",
      "fixture-film",
      "observations",
      "space.png",
    );
    fs.mkdirSync(path.dirname(renderArtifact), { recursive: true });
    fs.writeFileSync(renderArtifact, "rendered space", "utf8");
    command.runLibraryReviewCommand({
      argv: [
        "record",
        "--owner",
        spaceOwner,
        "--observation",
        "spaces-neutral",
        "--runtime",
        "automovie-library-probe:v1",
        "--verdict",
        "passed",
        "--artifact-render",
        "observations/space.png",
      ],
      root: fixture.root,
      productionId: "fixture-film",
      evidence,
      output: () => {
        outputCount += 1;
      },
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
    fs.writeFileSync(
      path.join(fixture.root, "src", "maps", "owner.ts"),
      'export const mapsLibraryOwner = "changed";\n',
      "utf8",
    );
    const mapChangedAuthoring = readAutoMovieProductionEvidence({
      root: fixture.root,
      productionEvidence: evidence,
    });
    const mapStale = libraryDiagnostics({
      root: fixture.root,
      authoring: mapChangedAuthoring,
    });
    command.runLibraryReviewCommand({
      argv: [
        "record",
        "--owner",
        ownerAddress(mapChangedAuthoring, "motions"),
        "--observation",
        observationId("motions"),
        "--runtime",
        "automovie-library-probe:v2",
        "--verdict",
        "passed",
        "--facts-file",
        "observations/motions.json",
      ],
      root: fixture.root,
      productionId: "fixture-film",
      evidence,
    });
    const motionReceipts = (
      JSON.parse(
        fs.readFileSync(
          path.join(fixture.root, "docs", "motions", "owner.review.json"),
          "utf8",
        ),
      ) as { units: Array<{ receipts: unknown[] }> }
    ).units[0]!.receipts.length;

    const spacePlanPath = path.join(
      fixture.root,
      "docs",
      "spaces",
      "owner.review.json",
    );
    const currentSpacePlan = fs.readFileSync(spacePlanPath, "utf8");
    const malformedSpacePlan = `${JSON.stringify(
      {
        ...(JSON.parse(currentSpacePlan) as object),
        unexpected: true,
      },
      null,
      2,
    )}\n`;
    fs.writeFileSync(spacePlanPath, malformedSpacePlan, "utf8");
    const malformedPlanRefused = commandRefuses({
      argv: [
        "plan",
        "--owner",
        spaceOwner,
        "--source",
        "src/spaces/owner.ts",
        "--observation",
        "spaces-neutral:artifact",
      ],
      root: fixture.root,
      evidence,
      message: "expected undefined",
    });
    const malformedPlanUnchanged =
      fs.readFileSync(spacePlanPath, "utf8") === malformedSpacePlan;
    fs.writeFileSync(spacePlanPath, currentSpacePlan, "utf8");

    fs.mkdirSync(path.join(fixture.root, "docs", "models"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(fixture.root, "src", "models"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(fixture.root, "docs", "models", "owner.md"),
      "# models owner\n\n## Delivery {#models-delivery}\n\nThe current whole-model turntable delivery.\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(fixture.root, "src", "models", "soloist.ts"),
      modelSource,
      "utf8",
    );
    const modelEvidence: IAutoMovieEvidenceConfigProps = {
      ...evidence,
      models: "review",
      modelSources: "review",
    };
    const modelAuthoring = readAutoMovieProductionEvidence({
      root: fixture.root,
      productionEvidence: modelEvidence,
    });
    const modelOwner = ownerAddress(modelAuthoring, "models");
    const modelSourcePath = modelAuthoring.designOwners
      .find((entry) => entry.branch === "models")!
      .sourceBinding!.paths.find((entry) => entry.endsWith("/soloist.ts"))!;
    command.runLibraryReviewCommand({
      argv: [
        "plan",
        "--owner",
        modelOwner,
        "--source",
        modelSourcePath,
        "--observation",
        "whole-model:turntable:soloist",
      ],
      root: fixture.root,
      productionId: "fixture-film",
      evidence: modelEvidence,
    });
    const modelPlanPath = path.join(
      fixture.root,
      "docs",
      "models",
      "owner.review.json",
    );
    const currentModelPlan = fs.readFileSync(modelPlanPath, "utf8");
    const mismatchedTurntableRefused = commandRefuses({
      argv: [
        "record",
        "--owner",
        modelOwner,
        "--observation",
        "whole-model",
        "--runtime",
        "automovie-library-probe:v1",
        "--verdict",
        "passed",
        "--turntable",
        "another-model",
      ],
      root: fixture.root,
      evidence: modelEvidence,
      message: "requires planned model",
    });
    const mismatchedTurntableUnchanged =
      fs.readFileSync(modelPlanPath, "utf8") === currentModelPlan;

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
          "allMapBuildingMotionAndSystemReceiptsCurrent",
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
        [
          "mapSourceChangeStalesFiniteEvidence",
          () =>
            mapStale.some(
              (entry) =>
                entry.target.includes("maps") &&
                entry.message.includes("stale"),
            ),
        ],
        ["commandRefusalMatrix", () => refusalCoverage],
        ["defaultSingletonInspect", () => defaultSingletonInspect],
        ["staleReceiptRetainedAlongsideCurrent", () => motionReceipts === 2],
        [
          "malformedPlanRefusedWithoutMutation",
          () => malformedPlanRefused && malformedPlanUnchanged,
        ],
        [
          "mismatchedTurntableRefusedWithoutMutation",
          () => mismatchedTurntableRefused && mismatchedTurntableUnchanged,
        ],
        ["inspectAndRecordEmitResults", () => outputCount === 2],
      ]),
      {
        exactPlansWritten: true,
        disabledResidueExcluded: true,
        sourceCompileCurrent: true,
        unpaidOwnersRefused: true,
        allMapBuildingMotionAndSystemReceiptsCurrent: true,
        motionSourceChangeStalesReceipt: true,
        mapSourceChangeStalesFiniteEvidence: true,
        commandRefusalMatrix: true,
        defaultSingletonInspect: true,
        staleReceiptRetainedAlongsideCurrent: true,
        malformedPlanRefusedWithoutMutation: true,
        mismatchedTurntableRefusedWithoutMutation: true,
        inspectAndRecordEmitResults: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
