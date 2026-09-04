import type {
  IAutoMovieCompileProjectOutput,
  IAutoMovieDiagnostic,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  LIBRARY_OWNER,
  LIBRARY_SOURCE,
  libraryAuthoring,
  libraryFixture,
} from "./libraryFixtures";

/** One library source module registering the fixture owner with `body`. */
const owner = (body: string): string =>
  `export const hall = {
  design: ${JSON.stringify(LIBRARY_OWNER)},
  build: ${body},
};
`;

/** Lint one fixture whose single source file is `source`. */
const refuse = (props: {
  source?: string;
  paths?: readonly string[];
}): IAutoMovieCompileProjectOutput => {
  const fixture = libraryFixture(
    props.source === undefined ? {} : { [LIBRARY_SOURCE]: props.source },
  );
  try {
    const currentAuthoringEvidence = () =>
      libraryAuthoring({ root: fixture.root, paths: props.paths });
    return new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(fixture.root),
      currentAuthoringEvidence(),
      currentAuthoringEvidence,
    ).lint({ scope: "source" });
  } finally {
    fixture.dispose();
  }
};

/** Whether one output carries a diagnostic with this code and message part. */
const carries = (
  output: IAutoMovieCompileProjectOutput,
  code: IAutoMovieDiagnostic["code"],
  part: string,
): boolean =>
  output.success === false &&
  output.diagnostics.some(
    (diagnostic) =>
      diagnostic.code === code && diagnostic.message.includes(part),
  );

/**
 * A library source module fails the way a shot module fails.
 *
 * Library owners run in the same deterministic sandbox and through the same
 * linker and transpiler, so every refusal a shot module already has applies to
 * one. This pins that: the identities are the shot identities rather than a
 * second vocabulary invented for the library shape, and each one names the file
 * it came from so an author is not left reading a compile-wide failure.
 *
 * Scenarios:
 *
 * 1. A build that throws is `source-execution-failed`, naming the export, and a
 *    build that throws something with no `message` is read the same way. The
 *    compiler stringifies those two through different arms, and only the
 *    `Error` arm had ever been taken.
 * 2. A build that never returns is `source-execution-timeout` at the sandbox's
 *    own limit rather than hanging the compile.
 * 3. A build returning a thenable is `source-export-invalid`, because a
 *    deterministic module that had to wait has left this boundary.
 * 4. A build returning nothing serializable is `source-export-invalid` against
 *    the exact contribution schema.
 * 5. A module reaching outside the sandbox's module surface is refused at the
 *    import rather than at execution.
 * 6. A binding that selects something the project store will not open as source
 *    is `source-path-missing` at that path.
 */
export const test_production_library_source_refusals = (): void => {
  const thrown = refuse({
    source: owner(`() => {
    throw new Error("the hall is not ready");
  }`),
  });
  // Not an `Error`, so `"message" in error` is false and the value itself is
  // what has to be stringified. A module can throw anything, and a compiler
  // that read only `error.message` would report `undefined` for this one.
  const thrownString = refuse({
    source: owner(`() => {
    throw "the hall is not ready";
  }`),
  });
  const looping = refuse({
    source: owner(`() => {
    for (;;) {
      // A module that never returns is the case the sandbox timeout exists for.
    }
  }`),
  });
  const thenable = refuse({
    source: owner("() => ({ then: () => undefined })"),
  });
  const empty = refuse({ source: owner("() => undefined") });
  const forbidden = refuse({
    source: `import fs from "node:fs";

export const hall = {
  design: ${JSON.stringify(LIBRARY_OWNER)},
  build: () => ({ environments: [], models: [fs] }),
};
`,
  });
  const unopenable = refuse({ paths: ["docs/spaces/hall.md"] });

  TestValidator.equals(
    "every library source failure keeps the shot identity that describes it",
    namedFacts([
      [
        "a throwing build names its export and its file",
        () =>
          carries(
            thrown,
            "source-execution-failed",
            'Library source export "hall"',
          ) &&
          thrown.diagnostics.some(
            (diagnostic) => diagnostic.path === LIBRARY_SOURCE,
          ),
      ],
      [
        "a build throwing something with no message is stringified whole",
        () =>
          carries(
            thrownString,
            "source-execution-failed",
            "the hall is not ready",
          ),
      ],
      [
        "a build that never returns is stopped by the sandbox limit",
        () => carries(looping, "source-execution-timeout", "timed out"),
      ],
      [
        "a thenable result is refused rather than awaited",
        () => carries(thenable, "source-export-invalid", "returned a Promise"),
      ],
      [
        "a result that is not a contribution is refused against the schema",
        () =>
          carries(
            empty,
            "source-export-invalid",
            "Fix the returned library contribution",
          ),
      ],
      [
        "a module reaching outside the sandbox surface is refused at the import",
        () =>
          forbidden.success === false &&
          forbidden.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "source-import-unsupported" ||
              diagnostic.code === "source-import-unresolved",
          ),
      ],
      [
        "and a binding the project store will not open as source is named",
        () =>
          carries(unopenable, "source-path-missing", "cannot be read") &&
          unopenable.diagnostics.some(
            (diagnostic) => diagnostic.path === "docs/spaces/hall.md",
          ),
      ],
    ]),
    {
      "a throwing build names its export and its file": true,
      "a build throwing something with no message is stringified whole": true,
      "a build that never returns is stopped by the sandbox limit": true,
      "a thenable result is refused rather than awaited": true,
      "a result that is not a contribution is refused against the schema": true,
      "a module reaching outside the sandbox surface is refused at the import": true,
      "and a binding the project store will not open as source is named": true,
    },
  );
};
