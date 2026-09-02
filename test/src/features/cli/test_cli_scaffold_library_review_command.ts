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
import { requireSourceModule } from "../internal/requireSourceModule";
import {
  productionCompileSucceeded,
  productionFixture,
} from "../production/productionFixtures";

const commandPath = path.resolve(
  __dirname,
  "../../../../packages/template/scaffold/scripts/library-review.ts",
);
const commandEntryPath = path.resolve(
  __dirname,
  "../../../../packages/template/scaffold/scripts/library-review-cli.ts",
);
const lintConfigPath = path.resolve(
  __dirname,
  "../../../../packages/template/scaffold/lint.config.ts",
);
type RunLibraryReviewCommand = (props: {
  argv: readonly string[];
  root: string;
  productionId: string;
  evidence: IAutoMovieEvidenceConfigProps;
  read: typeof readAutoMovieProductionEvidence;
  output?: (value: unknown) => void;
}) => unknown;

const command = requireSourceModule<{
  runLibraryReviewCommand: RunLibraryReviewCommand;
  runLibraryReviewCli: (props: {
    argv: readonly string[];
    evidence: IAutoMovieEvidenceConfigProps;
    productionId: string;
    read: typeof readAutoMovieProductionEvidence;
    root: string;
    run: RunLibraryReviewCommand;
    stderr: (value: string) => void;
    stdout: (value: string) => void;
  }) => number;
}>(commandPath, ["runLibraryReviewCommand", "runLibraryReviewCli"]);

const nonError = (message: string): Error => message as unknown as Error;

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

/**
 * One governed library source file that registers its own design owner.
 *
 * A library compile executes this population and refuses a reviewed H2 no
 * export realizes, so a fixture whose sources were bare constants would be a
 * library with design documents and nothing built behind them. `marker` moves
 * the source bytes without moving the registration, which is what the staleness
 * cases need: a changed owner, not a withdrawn one.
 */
const libraryOwnerSource = (branch: string, marker = "initial"): string =>
  `// ${marker}
export const ${branch}LibraryOwner = {
  design: "docs/${branch}/owner.md#${branch}-delivery",
  build: () => ({ environments: [], models: [] }),
};
`;

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
    fs.writeFileSync(source, libraryOwnerSource(branch), "utf8");
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
  read?: typeof readAutoMovieProductionEvidence;
}): boolean => {
  try {
    command.runLibraryReviewCommand({
      argv: props.argv,
      root: props.root,
      productionId: "fixture-film",
      evidence: props.evidence,
      read: props.read ?? readAutoMovieProductionEvidence,
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
    let planOutputCount = 0;
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
        read: readAutoMovieProductionEvidence,
        output: () => {
          planOutputCount += 1;
        },
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
        read: readAutoMovieProductionEvidence,
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
    const paidMapPlanPath = path.join(
      fixture.root,
      "docs",
      "maps",
      "owner.review.json",
    );
    const paidMapPlan = fs.readFileSync(paidMapPlanPath, "utf8");
    const incompleteMapPlan = JSON.parse(paidMapPlan);
    incompleteMapPlan.units = [];
    fs.writeFileSync(
      paidMapPlanPath,
      JSON.stringify(incompleteMapPlan),
      "utf8",
    );
    const structurallyIncompletePlanRefused = commandRefuses({
      argv: [
        "record",
        "--owner",
        ownerAddress(currentAuthoring, "spaces"),
        "--observation",
        observationId("spaces"),
        "--runtime",
        "automovie-library-probe:v1",
        "--verdict",
        "passed",
        "--artifact-project",
        "observations/space.svg",
      ],
      root: fixture.root,
      evidence,
      message: "Correct the library observation plan before recording",
    });
    fs.writeFileSync(paidMapPlanPath, paidMapPlan, "utf8");
    const singleton = require(lintConfigPath) as {
      productionEvidence: IAutoMovieEvidenceConfigProps;
    };
    const originalEvidence = { ...singleton.productionEvidence };
    const originalDirectory = process.cwd();
    const originalArguments = [...process.argv];
    const originalExitCode = process.exitCode;
    const originalStderr = process.stderr.write;
    const originalStdout = process.stdout.write;
    let cliOutput = "";
    let cliError = "";
    let cliSuccess = -1;
    let cliFailure = -1;
    let cliNonError = -1;
    let entrySuccess = false;
    try {
      Object.assign(singleton.productionEvidence, evidence);
      // The entry derives its production namespace from the project it runs in,
      // so the working directory is the whole selection: the fixture's own
      // package manifest names "fixture-film".
      process.chdir(fixture.root);
      cliSuccess = command.runLibraryReviewCli({
        argv: [],
        evidence,
        productionId: "fixture-film",
        read: readAutoMovieProductionEvidence,
        root: fixture.root,
        run: command.runLibraryReviewCommand,
        stderr: (value) => {
          cliError += value;
        },
        stdout: (value) => {
          cliOutput += value;
        },
      });
      cliFailure = command.runLibraryReviewCli({
        argv: ["unknown"],
        evidence,
        productionId: "fixture-film",
        read: readAutoMovieProductionEvidence,
        root: fixture.root,
        run: command.runLibraryReviewCommand,
        stderr: (value) => {
          cliError += value;
        },
        stdout: (value) => {
          cliOutput += value;
        },
      });
      cliNonError = command.runLibraryReviewCli({
        argv: [],
        evidence,
        productionId: "fixture-film",
        read: readAutoMovieProductionEvidence,
        root: fixture.root,
        run: () => {
          throw nonError("non-error command failure");
        },
        stderr: (value) => {
          cliError += value;
        },
        stdout: (value) => {
          cliOutput += value;
        },
      });
      process.stderr.write = ((value: string | Uint8Array): boolean => {
        cliError += value.toString();
        return true;
      }) as typeof process.stderr.write;
      process.stdout.write = ((value: string | Uint8Array): boolean => {
        cliOutput += value.toString();
        return true;
      }) as typeof process.stdout.write;
      process.argv = [process.execPath, commandEntryPath];
      delete require.cache[require.resolve(commandEntryPath)];
      require(commandEntryPath);
      entrySuccess = process.exitCode === 0;
    } finally {
      process.stderr.write = originalStderr;
      process.stdout.write = originalStdout;
      process.argv = originalArguments;
      process.exitCode = originalExitCode;
      process.chdir(originalDirectory);
      Object.assign(singleton.productionEvidence, originalEvidence);
    }
    let outputCount = 0;
    command.runLibraryReviewCommand({
      argv: ["inspect"],
      root: fixture.root,
      productionId: "fixture-film",
      evidence,
      read: readAutoMovieProductionEvidence,
      output: () => {
        outputCount += 1;
      },
    });
    const spaceOwner = ownerAddress(authoring, "spaces");
    const readWithUnboundSpace: typeof readAutoMovieProductionEvidence = (
      props,
    ) => {
      const snapshot = readAutoMovieProductionEvidence(props);
      return {
        ...snapshot,
        designOwners: snapshot.designOwners.map((entry) =>
          entry.branch === "spaces" ? { ...entry, sourceBinding: null } : entry,
        ),
      };
    };
    const readWithFilmManifest: typeof readAutoMovieProductionEvidence = (
      props,
    ) => {
      const snapshot = readAutoMovieProductionEvidence(props);
      return {
        ...snapshot,
        manifest: { ...snapshot.manifest, kind: "film" },
      };
    };
    const refusals: Array<
      readonly [
        argv: readonly string[],
        message: string,
        read?: typeof readAutoMovieProductionEvidence,
      ]
    > = [
      [["unknown"], 'must be "inspect", "plan", or "record"'],
      [["inspect"], 'require production kind "library"', readWithFilmManifest],
      [["inspect", "positional"], "unknown or positional"],
      [["inspect", "--typo", "value"], "unknown or positional"],
      [["inspect", undefined as unknown as string], "unknown or positional"],
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
      [["plan", "--owner"], "requires one value"],
      [["plan", "--owner", spaceOwner, "--owner", spaceOwner], "exactly once"],
      [["plan", "--owner", "invalid"], "must be one exact"],
      [
        ["plan", "--owner", "docs/spaces/owner.md#absent"],
        "outside the exact active",
      ],
      [
        ["plan", "--owner", spaceOwner],
        "no enforced reviewed source population",
        readWithUnboundSpace,
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
          "docs/spaces/owner.md#absent",
          "--observation",
          "spaces-neutral",
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
          ownerAddress(authoring, "instances"),
          "--observation",
          observationId("instances"),
          "--runtime",
          "probe:v1",
          "--verdict",
          "passed",
          "--facts-file",
          "observations/absent.json",
        ],
        "Facts file",
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
    for (const [argv, message, selectedRead] of refusals)
      TestValidator.equals(
        `library review command refuses ${JSON.stringify(argv)} with ${JSON.stringify(message)}`,
        commandRefuses({
          argv,
          root: fixture.root,
          evidence,
          message,
          read: selectedRead,
        }),
        true,
      );
    const atomicPlanArguments = [
      "plan",
      "--owner",
      spaceOwner,
      "--source",
      "src/spaces/owner.ts",
      "--observation",
      "spaces-neutral:artifact",
    ] as const;
    const mutableFs = fs as {
      renameSync: typeof fs.renameSync;
      rmSync: typeof fs.rmSync;
    };
    const renameSync = fs.renameSync;
    const rmSync = fs.rmSync;
    const spacePlanDirectory = path.join(fixture.root, "docs", "spaces");
    const temporaryPlans = (): string[] =>
      fs
        .readdirSync(spacePlanDirectory)
        .filter((entry) => entry.startsWith("owner.review.json."));
    let failedCommitWasCleaned = false;
    let failedCleanupPreservedOriginalFailure = false;
    try {
      mutableFs.renameSync = () => {
        throw new Error("atomic plan commit unavailable");
      };
      failedCommitWasCleaned =
        commandRefuses({
          argv: atomicPlanArguments,
          root: fixture.root,
          evidence,
          message: "atomic plan commit unavailable",
        }) && temporaryPlans().length === 0;
      mutableFs.rmSync = ((target: fs.PathLike, options?: fs.RmOptions) => {
        if (String(target).endsWith(".tmp"))
          throw new Error("atomic plan cleanup unavailable");
        return rmSync(target, options);
      }) as typeof fs.rmSync;
      failedCleanupPreservedOriginalFailure = commandRefuses({
        argv: atomicPlanArguments,
        root: fixture.root,
        evidence,
        message: "atomic plan commit unavailable",
      });
    } finally {
      mutableFs.renameSync = renameSync;
      mutableFs.rmSync = rmSync;
      for (const temporary of temporaryPlans())
        rmSync(path.join(spacePlanDirectory, temporary), { force: true });
    }
    command.runLibraryReviewCommand({
      argv: [
        "plan",
        "--owner",
        spaceOwner,
        "--source",
        "src/spaces/owner.ts",
        "--observation",
        "spaces-neutral:artifact",
        "--observation",
        "space-perspective:artifact",
      ],
      root: fixture.root,
      productionId: "fixture-film",
      evidence,
      read: readAutoMovieProductionEvidence,
    });
    command.runLibraryReviewCommand({
      argv: [
        "record",
        "--owner",
        spaceOwner,
        "--observation",
        "spaces-neutral",
        "--runtime",
        "automovie-library-probe:v2",
        "--verdict",
        "passed",
        "--artifact-project",
        "observations/space.svg",
      ],
      root: fixture.root,
      productionId: "fixture-film",
      evidence,
      read: readAutoMovieProductionEvidence,
    });
    const planIdentityReceipts = (
      JSON.parse(
        fs.readFileSync(
          path.join(fixture.root, "docs", "spaces", "owner.review.json"),
          "utf8",
        ),
      ) as { units: Array<{ receipts: unknown[] }> }
    ).units[0]!.receipts.length;
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
      read: readAutoMovieProductionEvidence,
      output: () => {
        outputCount += 1;
      },
    });
    fs.writeFileSync(
      path.join(fixture.root, "src", "motions", "owner.ts"),
      libraryOwnerSource("motions", "changed"),
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
      libraryOwnerSource("maps", "changed"),
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
      read: readAutoMovieProductionEvidence,
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
    // A failure is evidence and stays. Re-running an unchanged observation and
    // passing it must not erase the failure an author recorded, because the
    // earlier version of this rule dropped every same-identity receipt and did
    // exactly that -- the record of what went wrong vanished from the file the
    // moment it was put right, and nothing said so.
    const recordSpace = (verdict: string): void => {
      command.runLibraryReviewCommand({
        argv: [
          "record",
          "--owner",
          ownerAddress(currentAuthoring, "spaces"),
          "--observation",
          observationId("spaces"),
          "--runtime",
          "automovie-library-probe:v1",
          "--verdict",
          verdict,
          "--artifact-project",
          "observations/space.svg",
        ],
        root: fixture.root,
        productionId: "fixture-film",
        evidence,
        read: readAutoMovieProductionEvidence,
      });
    };
    const spaceVerdicts = (): string[] =>
      (
        JSON.parse(fs.readFileSync(spacePlanPath, "utf8")) as {
          units: Array<{ receipts: Array<{ verdict: string }> }>;
        }
      ).units.flatMap((unit) =>
        unit.receipts.map((receipt) => receipt.verdict),
      );
    // One passed receipt already stands from the paid loop above.
    recordSpace("failed");
    const afterFailure = spaceVerdicts();
    recordSpace("passed");
    const afterRepair = spaceVerdicts();
    recordSpace("passed");
    const afterSecondPass = spaceVerdicts();

    // What a receipt says about where it stood and what it read. Both flags
    // were shipped and no scenario passed either, so every refusal in their
    // parsers -- and the shape they store on success -- was written and never
    // read.
    const POSE = JSON.stringify({
      position: { x: 1, y: 1.6, z: 2 },
      direction: { x: 0, y: 0, z: -1 },
      target: { x: 1, y: 1.6, z: 0 },
      space: "hall",
    });
    const recordAtPose = (extra: readonly string[]): readonly string[] => [
      "record",
      "--owner",
      ownerAddress(currentAuthoring, "spaces"),
      "--observation",
      observationId("spaces"),
      "--runtime",
      "automovie-library-probe:v1",
      "--verdict",
      "passed",
      "--artifact-project",
      "observations/space.svg",
      ...extra,
    ];
    command.runLibraryReviewCommand({
      argv: recordAtPose([
        "--pose",
        POSE,
        "--measurements",
        JSON.stringify({ clearWidth: 0.9, clearHeight: 2.1 }),
      ]),
      root: fixture.root,
      productionId: "fixture-film",
      evidence,
      read: readAutoMovieProductionEvidence,
    });
    const storedReceipt = (
      JSON.parse(fs.readFileSync(spacePlanPath, "utf8")) as {
        units: Array<{
          receipts: Array<{
            verdict: string;
            pose: unknown;
            measurements: Record<string, number>;
          }>;
        }>;
      }
    ).units
      .flatMap((unit) => unit.receipts)
      .filter((receipt) => receipt.verdict === "passed")
      .at(-1);
    const poseRefused = (
      [
        [["--pose", "{"], "--pose must be one JSON object"],
        [
          // The space name is read before any component, so this case has to
          // carry a valid one or it is refused for the space instead and the
          // component rule is never reached. Written the other way first, and
          // it passed for the wrong reason.
          [
            "--pose",
            JSON.stringify({
              position: 1,
              direction: { x: 0, y: 0, z: -1 },
              target: { x: 0, y: 0, z: 0 },
              space: "hall",
            }),
          ],
          "--pose position must be one { x, y, z } object",
        ],
        [
          [
            "--pose",
            JSON.stringify({
              position: { x: 1, y: 1, z: "near" },
              direction: { x: 0, y: 0, z: -1 },
              target: { x: 0, y: 0, z: 0 },
              space: "hall",
            }),
          ],
          "--pose position",
        ],
        [
          [
            "--pose",
            JSON.stringify({
              position: { x: 1, y: 1, z: 1 },
              direction: { x: 0, y: 0, z: -1 },
              target: { x: 0, y: 0, z: 0 },
              space: "  ",
            }),
          ],
          "--pose space must be",
        ],
        [["--measurements", "["], "--measurements must be one JSON object"],
        [
          ["--measurements", JSON.stringify({ clearWidth: "wide" })],
          "--measurements clearWidth must be one finite number",
        ],
      ] as ReadonlyArray<readonly [readonly string[], string]>
    ).map(([extra, message]) =>
      commandRefuses({
        argv: recordAtPose(extra),
        root: fixture.root,
        evidence,
        message,
      }),
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
    const modelWithoutTurntableRefused = commandRefuses({
      argv: [
        "plan",
        "--owner",
        modelOwner,
        "--source",
        modelSourcePath,
        "--observation",
        "whole-model:artifact",
      ],
      root: fixture.root,
      evidence: modelEvidence,
      message: "canonical turntable",
    });
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
      read: readAutoMovieProductionEvidence,
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

    // The refusal above proves the command rejects a model the plan never
    // named. Recording the one it did name is the only way a turntable receipt
    // comes to exist, and a turntable receipt is the only receipt whose
    // currency the compiler answers by asking its own library-path binding
    // whether that model exists. Every other fixture stops short of this, so
    // the binding sits beside the film path's -- identical, covered -- and
    // never runs.
    command.runLibraryReviewCommand({
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
        "soloist",
      ],
      root: fixture.root,
      productionId: "fixture-film",
      evidence: modelEvidence,
      read: readAutoMovieProductionEvidence,
    });
    const turntableRecorded = libraryDiagnostics({
      root: fixture.root,
      authoring: readAutoMovieProductionEvidence({
        root: fixture.root,
        productionEvidence: modelEvidence,
      }),
    });

    TestValidator.equals(
      "generated library plans and receipts close the actual compiler consumer",
      namedFacts([
        [
          "exactPlansWritten",
          () =>
            planResults.length === branches.length &&
            planOutputCount === branches.length &&
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
        [
          "structurallyIncompletePlanRefused",
          () => structurallyIncompletePlanRefused,
        ],
        ["failedCommitWasCleaned", () => failedCommitWasCleaned],
        [
          "failedCleanupPreservedOriginalFailure",
          () => failedCleanupPreservedOriginalFailure,
        ],
        ["commandRefusalMatrix", () => true],
        [
          "cliAdapterSuccessAndFailure",
          () =>
            cliSuccess === 0 &&
            cliFailure === 1 &&
            cliNonError === 1 &&
            entrySuccess &&
            cliOutput.includes('"owners"') &&
            cliError.includes("must be") &&
            cliError.includes("non-error command failure"),
        ],
        ["planIdentityRetainsStaleReceipt", () => planIdentityReceipts === 2],
        ["staleReceiptRetainedAlongsideCurrent", () => motionReceipts === 2],
        [
          "malformedPlanRefusedWithoutMutation",
          () => malformedPlanRefused && malformedPlanUnchanged,
        ],
        [
          "poseAndMeasurementsAreStoredAsGiven",
          () =>
            JSON.stringify(storedReceipt?.pose) === POSE &&
            storedReceipt?.measurements.clearWidth === 0.9 &&
            storedReceipt?.measurements.clearHeight === 2.1,
        ],
        [
          // Malformed JSON, a component that is not an object, an axis that is
          // not a number, a blank space name, a measurement set that is not an
          // object, and a reading offered as text. Each is refused by name
          // rather than stored, because a claim no later reader can check is
          // worse in the file than absent.
          "everyMalformedPoseOrMeasurementIsRefusedByName",
          () => poseRefused.every((refused) => refused),
        ],
        [
          // The failure replaced the accepted receipt and then survived two
          // repairs. Three records, two receipts, and the failed one is still
          // there to read.
          "aRecordedFailureSurvivesBeingPutRight",
          () => {
            const failures = (verdicts: readonly string[]): number =>
              verdicts.filter((verdict) => verdict === "failed").length;
            return (
              // Recording the failure appended it rather than replacing the
              // accepted receipt that stood.
              failures(afterFailure) === 1 &&
              afterFailure.at(-1) === "failed" &&
              // Repairing appended a pass and left the failure where it was.
              failures(afterRepair) === 1 &&
              afterRepair.length === afterFailure.length + 1 &&
              // Passing again replaced that pass rather than growing the file,
              // and still did not touch the failure.
              failures(afterSecondPass) === 1 &&
              afterSecondPass.length === afterRepair.length
            );
          },
        ],
        [
          "mismatchedTurntableRefusedWithoutMutation",
          () => mismatchedTurntableRefused && mismatchedTurntableUnchanged,
        ],
        [
          // The receipt the command wrote is real: the plan named "soloist",
          // the record names "soloist", and the compiler read it rather than
          // reporting the observation unpaid. What it then answers is that a
          // turntable receipt is only current while the canonical views behind
          // it are on disk, and this fixture captured none. That is the whole
          // difference between a receipt existing and a receipt being true.
          "turntableReceiptJudgedByItsViews",
          () =>
            turntableRecorded.some(
              (entry) =>
                entry.target ===
                  "library:models:docs/models/owner.md#models-delivery:whole-model" &&
                entry.message.includes(
                  "does not reopen as the exact current turntable evidence",
                ),
            ) &&
            turntableRecorded.some(
              (entry) =>
                entry.target.includes("whole-model") &&
                entry.message.includes("has no turntable receipt"),
            ) === false,
        ],
        ["modelWithoutTurntableRefused", () => modelWithoutTurntableRefused],
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
        structurallyIncompletePlanRefused: true,
        failedCommitWasCleaned: true,
        failedCleanupPreservedOriginalFailure: true,
        commandRefusalMatrix: true,
        cliAdapterSuccessAndFailure: true,
        planIdentityRetainsStaleReceipt: true,
        staleReceiptRetainedAlongsideCurrent: true,
        malformedPlanRefusedWithoutMutation: true,
        poseAndMeasurementsAreStoredAsGiven: true,
        everyMalformedPoseOrMeasurementIsRefusedByName: true,
        aRecordedFailureSurvivesBeingPutRight: true,
        mismatchedTurntableRefusedWithoutMutation: true,
        turntableReceiptJudgedByItsViews: true,
        modelWithoutTurntableRefused: true,
        inspectAndRecordEmitResults: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
