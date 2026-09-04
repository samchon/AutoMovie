import type { IAutoMovieCompileProjectOutput } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  compileAutoMovieProduction,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { rectangularBuilding } from "../internal/envelopeFixtures";
import { namedFacts } from "../internal/predicates";
import {
  LIBRARY_ANCHOR,
  LIBRARY_DESIGN,
  LIBRARY_MODEL_OWNER,
  LIBRARY_MODEL_SOURCE,
  LIBRARY_OWNER,
  LIBRARY_SECOND_ANCHOR,
  LIBRARY_SECOND_OWNER,
  LIBRARY_SOURCE,
  libraryAuthoring,
  libraryFixture,
  libraryModelLiteral,
  libraryModelSourceModule,
  librarySourceModule,
} from "./libraryFixtures";

/** Compile or lint one fixture through the real project store. */
const run = (props: {
  root: string;
  materialize: boolean;
  scope?: "design" | "source" | "review" | "final";
  anchors?: readonly string[];
  models?: boolean;
}): IAutoMovieCompileProjectOutput => {
  const project = props.materialize
    ? AutoMovieProductionProject.open(props.root)
    : AutoMovieProductionProject.openReadOnly(props.root);
  const compiler = new AutoMovieProductionCompiler(
    project,
    libraryAuthoring({
      root: project.root,
      anchors: props.anchors,
      models: props.models,
    }),
  );
  const input = { scope: props.scope ?? "source" } as const;
  return props.materialize ? compiler.compile(input) : compiler.lint(input);
};

/**
 * A library compile executes its own source and publishes what it returned.
 *
 * `runLibrary` used to fingerprint source bytes and return `materialized: []`,
 * so a green library review meant a design document existed and nothing had ever
 * been built. This pins the whole of the replacement against a project on disk:
 * the module is linked, transpiled and evaluated in the deterministic sandbox, a
 * named export registers the exact reviewed H2 it realizes, the building it
 * returns is validated by the same engine validator a shot's is, and the result
 * is written atomically as compiler-owned bytes with a manifest.
 *
 * Scenarios:
 *
 * 1. A `source` compile publishes the building under `library/environments`,
 *    the owner index under `library/index.json`, and reports both as created.
 * 2. The index names the branch, owner, source file, export and source digest,
 *    so a published artifact resolves to the decision it realizes.
 * 3. A second compile of unchanged source reports every file unchanged and the
 *    same input fingerprint, and rewrites nothing.
 * 4. `lint` over the same current tree succeeds and materializes nothing.
 * 5. `design` scope reads no source and publishes nothing.
 * 6. Tampering with a published byte is refused by name at that exact path when
 *    linting, and repaired by a compile.
 * 7. A registration naming an address the authoring declaration does not own is
 *    refused; so is one design owner registered by two exports; so is one
 *    environment id published by two owners.
 * 8. A design owner no export registers warns while source is being written and
 *    blocks from review on.
 * 9. A building the engine validator rejects blocks the compile, and nothing is
 *    published for it.
 */
export const test_production_library_materialization = (): void => {
  const fixture = libraryFixture();
  try {
    const first = run({ root: fixture.root, materialize: true });

    const production = AutoMovieProductionProject.openReadOnly(
      fixture.root,
    ).productionId;
    const index = JSON.parse(
      fixture.generated("library/index.json") ?? "null",
    ) as {
      version: number;
      production: string;
      inputFingerprint: string;
      owners: Array<{
        branch: string;
        owner: string;
        source: string;
        export: string;
        sourceDigest: string;
        environments: string[];
        models: string[];
      }>;
    } | null;
    const second = run({ root: fixture.root, materialize: true });
    const linted = run({ root: fixture.root, materialize: false });
    const designScope = run({
      root: fixture.root,
      materialize: true,
      scope: "design",
    });

    TestValidator.equals(
      "a library compile publishes the building its own source returned",
      namedFacts([
        ["the compile succeeded", () => first.success],
        [
          "and reported the building and the index as created",
          () =>
            first.materialized
              .map((file) => `${file.path}:${file.status}`)
              .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
              .join(",") ===
            [
              "library/environments/hall-house.json:created",
              "library/index.json:created",
            ]
              .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
              .join(","),
        ],
        [
          "which are the exact compiler-owned bytes on disk",
          () =>
            fixture.generated("library/environments/hall-house.json") !== null,
        ],
        [
          "and the published building is the one the source returned",
          () =>
            (
              JSON.parse(
                fixture.generated("library/environments/hall-house.json") ??
                  "null",
              ) as { id: string; boundaries: unknown[] } | null
            )?.boundaries.length === 6,
        ],
        [
          "each generated file is attributed to the owner that produced it",
          () =>
            first.materialized
              .find(
                (file) => file.path === "library/environments/hall-house.json",
              )
              ?.sourceTargets.join(",") === `library:spaces:${LIBRARY_OWNER}`,
        ],
      ]),
      {
        "the compile succeeded": true,
        "and reported the building and the index as created": true,
        "which are the exact compiler-owned bytes on disk": true,
        "and the published building is the one the source returned": true,
        "each generated file is attributed to the owner that produced it": true,
      },
    );

    TestValidator.equals(
      "the index resolves every artifact to the decision it realizes",
      {
        version: index?.version ?? null,
        production: index?.production ?? null,
        fingerprint:
          index?.inputFingerprint === first.compiler.inputFingerprint,
        owners: index?.owners.map((owner) => ({
          branch: owner.branch,
          owner: owner.owner,
          source: owner.source,
          export: owner.export,
          environments: owner.environments,
          models: owner.models,
          digested: owner.sourceDigest.startsWith("sha256:"),
        })),
      },
      {
        version: 1,
        production,
        fingerprint: true,
        owners: [
          {
            branch: "spaces",
            owner: LIBRARY_OWNER,
            source: LIBRARY_SOURCE,
            export: "hall",
            environments: ["hall-house"],
            models: [],
            digested: true,
          },
        ],
      },
    );

    TestValidator.equals(
      "an unchanged recompile churns nothing and lint writes nothing",
      namedFacts([
        [
          "the second compile reports every file unchanged",
          () =>
            second.success &&
            second.materialized.every((file) => file.status === "unchanged"),
        ],
        [
          "at the same input identity",
          () =>
            second.compiler.inputFingerprint ===
            first.compiler.inputFingerprint,
        ],
        [
          "lint succeeds over the current tree and materializes nothing",
          () => linted.success && linted.materialized.length === 0,
        ],
        [
          "design scope reads no source and publishes nothing",
          () =>
            designScope.success &&
            designScope.materialized.length === 0 &&
            designScope.diagnostics.length === 0,
        ],
      ]),
      {
        "the second compile reports every file unchanged": true,
        "at the same input identity": true,
        "lint succeeds over the current tree and materializes nothing": true,
        "design scope reads no source and publishes nothing": true,
      },
    );

    // The package entry every generated project's own compile command calls.
    // Without the authoring declaration it takes the film path and refuses a
    // library for records it was never going to carry, which is how a library
    // could be materialized by this compiler and by nothing an author runs.
    const throughPackageApi = compileAutoMovieProduction({
      projectRoot: fixture.root,
      productionId: production,
      scope: "source",
      authoringEvidence: libraryAuthoring({ root: fixture.root }),
    });
    TestValidator.equals(
      "the package compile entry reaches the library path too",
      {
        success: throughPackageApi.success,
        published: throughPackageApi.materialized
          .map((file) => file.path)
          .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
      },
      {
        success: true,
        published: [
          "library/environments/hall-house.json",
          "library/index.json",
        ],
      },
    );

    fixture.writeGenerated("library/environments/hall-house.json", "{}\n");
    const tampered = run({ root: fixture.root, materialize: false });
    const repaired = run({ root: fixture.root, materialize: true });

    TestValidator.equals(
      "a tampered compiler-owned byte is named where it was changed",
      namedFacts([
        [
          "lint refuses the tampered file at its own path",
          () =>
            tampered.success === false &&
            tampered.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "generated-tampered" &&
                diagnostic.target === "library/environments/hall-house.json",
            ),
        ],
        [
          "and a compile regenerates it as updated",
          () =>
            repaired.success &&
            repaired.materialized.find(
              (file) => file.path === "library/environments/hall-house.json",
            )?.status === "updated",
        ],
      ]),
      {
        "lint refuses the tampered file at its own path": true,
        "and a compile regenerates it as updated": true,
      },
    );
  } finally {
    fixture.dispose();
  }

  const unknownAddress = libraryFixture({
    [LIBRARY_SOURCE]: librarySourceModule({
      design: "docs/spaces/other.md#other-delivery",
    }),
  });
  const duplicateOwner = libraryFixture({
    [LIBRARY_SOURCE]: librarySourceModule({
      second: {
        exportName: "again",
        design: LIBRARY_OWNER,
        environmentId: "hall-house-again",
      },
    }),
  });
  const duplicateEnvironment = libraryFixture({
    [LIBRARY_SOURCE]: librarySourceModule({
      second: {
        exportName: "annex",
        design: LIBRARY_SECOND_OWNER,
        environmentId: "hall-house",
      },
    }),
  });
  const invalidBuilding = libraryFixture({
    [LIBRARY_SOURCE]: librarySourceModule({ environmentId: "  " }),
  });
  const noOwner = libraryFixture({
    [LIBRARY_SOURCE]: "export const helper = { at: 1 };\n",
  });
  const withModel = libraryFixture({
    [LIBRARY_MODEL_SOURCE]: libraryModelSourceModule({
      models: `[${libraryModelLiteral("hall-box")}]`,
    }),
  });
  const duplicateModel = libraryFixture({
    [LIBRARY_MODEL_SOURCE]: `${libraryModelSourceModule({
      models: `[${libraryModelLiteral("hall-box")}]`,
    })}\n${libraryModelSourceModule({
      exportName: "again",
      models: `[${libraryModelLiteral("hall-box")}]`,
    }).replace(
      'import type { IAutoMovieLibrarySourceOwner } from "@automovie/interface";\n\n',
      "",
    )}`,
  });
  const invalidModel = libraryFixture({
    [LIBRARY_MODEL_SOURCE]: libraryModelSourceModule({
      models: `[${libraryModelLiteral(" ")}]`,
    }),
  });
  const swappedOwner = libraryFixture({
    [LIBRARY_SOURCE]: librarySourceModule({
      design: LIBRARY_SECOND_OWNER,
      second: {
        exportName: "annex",
        design: LIBRARY_OWNER,
        environmentId: "hall-annex",
      },
    }),
  });
  const emptySpace = libraryFixture({
    [LIBRARY_SOURCE]: librarySourceModule({ environments: "[]" }),
  });
  const crossBranchSpace = libraryFixture({
    [LIBRARY_SOURCE]: librarySourceModule({
      environments: "[]",
      models: `[${libraryModelLiteral("hall-cross-branch")}]`,
    }),
  });
  // Every other refusal names a field inside the contribution. This one is
  // wrong at the root -- `build()` hands back a list where a contribution
  // belongs -- and the message has a separate half for that, because there is
  // no field path to print.
  const invalidContribution = libraryFixture({
    [LIBRARY_SOURCE]: [
      'import type { IAutoMovieLibrarySourceOwner } from "@automovie/interface";',
      "",
      "export const hall = {",
      `  design: ${JSON.stringify(LIBRARY_OWNER)},`,
      "  build: () => [] as unknown,",
      "} as unknown as IAutoMovieLibrarySourceOwner;",
      "",
    ].join(String.fromCharCode(10)),
  });
  try {
    const unknown = run({ root: unknownAddress.root, materialize: false });
    const duplicated = run({ root: duplicateOwner.root, materialize: false });
    const collided = run({
      root: duplicateEnvironment.root,
      materialize: false,
      anchors: [LIBRARY_ANCHOR, LIBRARY_SECOND_ANCHOR],
    });
    const invalid = run({ root: invalidBuilding.root, materialize: false });
    const rootless = run({
      root: invalidContribution.root,
      materialize: false,
    });
    // Compiled rather than linted, because a project whose compiler-owned tree
    // has never been written is refused for its missing manifest whatever else
    // is wrong with it. What this case is about is the category of one
    // diagnostic while the compile itself still succeeds.
    const unrealizedAtSource = run({
      root: noOwner.root,
      materialize: true,
    });
    const unrealizedAtReview = run({
      root: noOwner.root,
      materialize: false,
      scope: "review",
    });

    TestValidator.equals(
      "every way a registration can be wrong is refused at its own address",
      namedFacts([
        [
          "an address the declaration does not own is refused by name",
          () =>
            unknown.success === false &&
            unknown.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-registration-mismatch" &&
                diagnostic.target === `library-source:${LIBRARY_SOURCE}:hall` &&
                diagnostic.message.includes(
                  "docs/spaces/other.md#other-delivery",
                ),
            ),
        ],
        [
          "one owner registered twice is refused",
          () =>
            duplicated.success === false &&
            duplicated.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-registration-mismatch" &&
                diagnostic.message.includes("is registered by both"),
            ),
        ],
        [
          "and one building id published twice is refused",
          () =>
            collided.success === false &&
            collided.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-export-invalid" &&
                diagnostic.message.includes(
                  'Library built environment "hall-house" is published by both',
                ),
            ),
        ],
        [
          "a building the engine rejects blocks the compile",
          () =>
            invalid.success === false &&
            invalid.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-scene-content-invalid" &&
                diagnostic.path === LIBRARY_SOURCE,
            ),
        ],
        [
          "an unregistered design owner warns while source is written",
          () =>
            unrealizedAtSource.success &&
            unrealizedAtSource.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-export-missing" &&
                diagnostic.category === "warning" &&
                diagnostic.target === `library:spaces:${LIBRARY_OWNER}`,
            ),
        ],
        [
          "and blocks from review on",
          () =>
            unrealizedAtReview.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-export-missing" &&
                diagnostic.category === "error" &&
                diagnostic.target === `library:spaces:${LIBRARY_OWNER}`,
            ),
        ],
      ]),
      {
        "an address the declaration does not own is refused by name": true,
        "one owner registered twice is refused": true,
        "and one building id published twice is refused": true,
        "a building the engine rejects blocks the compile": true,
        "an unregistered design owner warns while source is written": true,
        "and blocks from review on": true,
      },
    );
    const published = run({
      root: withModel.root,
      materialize: true,
      models: true,
    });
    const collidedModel = run({
      root: duplicateModel.root,
      materialize: false,
      models: true,
    });
    const rejectedModel = run({
      root: invalidModel.root,
      materialize: false,
      models: true,
    });
    const swappedAuthoring = libraryAuthoring({
      root: swappedOwner.root,
      anchors: [LIBRARY_ANCHOR, LIBRARY_SECOND_ANCHOR],
    });
    const swapped = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(swappedOwner.root),
      {
        ...swappedAuthoring,
        sourceOwners: swappedAuthoring.sourceOwners.map((binding) => ({
          ...binding,
          targetPath: LIBRARY_DESIGN,
          targetAnchor:
            binding.exportName === "hall"
              ? LIBRARY_ANCHOR
              : LIBRARY_SECOND_ANCHOR,
        })),
      },
    ).lint({ scope: "source" });
    const empty = run({ root: emptySpace.root, materialize: false });
    const crossBranch = run({
      root: crossBranchSpace.root,
      materialize: false,
    });

    TestValidator.equals(
      "a published model lands where every model lands and is owned once",
      namedFacts([
        [
          "two valid owners swapped between exports are refused",
          () =>
            swapped.success === false &&
            swapped.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-owner-mismatch" &&
                diagnostic.message.includes("not runtime owner"),
            ),
        ],
        [
          "the model is written under the compiled model namespace",
          () =>
            published.success &&
            withModel.generated("models/hall-box.json") !== null,
        ],
        [
          "attributed to the owner whose export returned it",
          () =>
            published.materialized
              .find((file) => file.path === "models/hall-box.json")
              ?.sourceTargets.join(",") ===
            `library:models:${LIBRARY_MODEL_OWNER}`,
        ],
        [
          "one model owner registered twice is refused",
          () =>
            collidedModel.success === false &&
            collidedModel.diagnostics.some((diagnostic) =>
              diagnostic.message.includes("is registered by both"),
            ),
        ],
        [
          // Every other refusal names a field inside a contributed record.
          // This one is wrong where the contribution itself is: `build()` hands
          // back a list, so neither `environments` nor `models` is there to
          // read, and both are named rather than one standing for the other.
          "a contribution that is not a contribution is refused at its own shape",
          () =>
            ["environments", "models"].every((field) =>
              rootless.diagnostics.some(
                (diagnostic) =>
                  diagnostic.message.includes(`$input.${field} expects`) &&
                  diagnostic.message.includes(
                    "Fix the returned library contribution in src/spaces/hall.ts",
                  ),
              ),
            ),
        ],
        [
          "and a model the engine rejects blocks the compile",
          () =>
            rejectedModel.success === false &&
            rejectedModel.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-scene-content-invalid" &&
                diagnostic.path === LIBRARY_MODEL_SOURCE,
            ),
        ],
        [
          "anEmptySpaceOwnerCannotBecomeCompleted",
          () =>
            empty.success === false &&
            empty.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-export-invalid" &&
                diagnostic.message.includes(
                  'branch "spaces" returned no environments',
                ),
            ),
        ],
        [
          "aSpaceOwnerCannotCompleteThroughTheModelCarrier",
          () =>
            crossBranch.success === false &&
            crossBranch.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-export-invalid" &&
                diagnostic.message.includes(
                  "payload belongs to the models branch",
                ),
            ),
        ],
      ]),
      {
        "two valid owners swapped between exports are refused": true,
        "the model is written under the compiled model namespace": true,
        "attributed to the owner whose export returned it": true,
        "one model owner registered twice is refused": true,
        "a contribution that is not a contribution is refused at its own shape": true,
        "and a model the engine rejects blocks the compile": true,
        anEmptySpaceOwnerCannotBecomeCompleted: true,
        aSpaceOwnerCannotCompleteThroughTheModelCarrier: true,
      },
    );
  } finally {
    unknownAddress.dispose();
    duplicateOwner.dispose();
    duplicateEnvironment.dispose();
    invalidBuilding.dispose();
    invalidContribution.dispose();
    noOwner.dispose();
    withModel.dispose();
    duplicateModel.dispose();
    invalidModel.dispose();
    swappedOwner.dispose();
    emptySpace.dispose();
    crossBranchSpace.dispose();
  }

  // A library owner's source is one module only because every fixture so far
  // wrote one. The compiler links, inspects, and transpiles each imported module
  // beside the entry, and none of that ran: the loop over imports had nothing to
  // iterate, so a helper that fails inspection would have reached publication
  // unexamined.
  const imports = libraryFixture({
    "src/shared/hall.ts": [
      'export const hallId = () => "hall-house";',
      "",
    ].join("\n"),
    [LIBRARY_SOURCE]: [
      'import type { IAutoMovieLibrarySourceOwner } from "@automovie/interface";',
      "",
      'import { hallId } from "../shared/hall";',
      "",
      `const HALL = ${JSON.stringify(rectangularBuilding(), null, 2)};`,
      "",
      "export const hall = {",
      `  design: ${JSON.stringify(LIBRARY_OWNER)},`,
      "  build: () => ({",
      "    environments: [{ ...HALL, id: hallId() }],",
      "    models: [],",
      "  }),",
      "} satisfies IAutoMovieLibrarySourceOwner;",
      "",
    ].join("\n"),
  });
  // The same shape with a helper the source inspection refuses. The entry is
  // untouched, so a refusal here can only have come from reading the import.
  const badImport = libraryFixture({
    "src/shared/hall.ts": [
      "export const hallId = () => {",
      "  // A clock is the plainest thing deterministic source may not read.",
      '  return Date.now() > 0 ? "hall-house" : "hall-house";',
      "};",
      "",
    ].join("\n"),
    [LIBRARY_SOURCE]: [
      'import type { IAutoMovieLibrarySourceOwner } from "@automovie/interface";',
      "",
      'import { hallId } from "../shared/hall";',
      "",
      `const HALL = ${JSON.stringify(rectangularBuilding(), null, 2)};`,
      "",
      "export const hall = {",
      `  design: ${JSON.stringify(LIBRARY_OWNER)},`,
      "  build: () => ({",
      "    environments: [{ ...HALL, id: hallId() }],",
      "    models: [],",
      "  }),",
      "} satisfies IAutoMovieLibrarySourceOwner;",
      "",
    ].join("\n"),
  });
  try {
    const linkedCompile = run({ root: imports.root, materialize: true });
    const refusedCompile = run({ root: badImport.root, materialize: true });
    TestValidator.equals(
      "an owner's imported module is linked, inspected, and transpiled beside it",
      namedFacts([
        [
          "the import compiles and publishes what the helper named",
          () =>
            linkedCompile.success &&
            imports.generated("library/environments/hall-house.json") !== null,
        ],
        [
          "and a helper the inspection refuses is named at its own path",
          () =>
            refusedCompile.success === false &&
            refusedCompile.diagnostics.some(
              (diagnostic) => diagnostic.path === "src/shared/hall.ts",
            ),
        ],
      ]),
      {
        "the import compiles and publishes what the helper named": true,
        "and a helper the inspection refuses is named at its own path": true,
      },
    );
  } finally {
    imports.dispose();
    badImport.dispose();
  }

  TestValidator.equals(
    "the fixture anchor stays the address every refusal was read at",
    LIBRARY_ANCHOR,
    "hall-delivery",
  );
};
