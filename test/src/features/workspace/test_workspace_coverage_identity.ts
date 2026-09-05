import { TestValidator } from "@nestia/e2e";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  canonicalCoverageEntryPath,
  canonicalCoveragePath,
  coverageSourceAttribution,
  functionIdentity,
  statementIdentity,
} from "../../coverage/coverageIdentity";
import {
  emitsNoExecutableStatement,
  emittedModuleBody,
  emittedModuleFilename,
  excuseNonExecutableGaps,
} from "../../coverage/executableEmission";
import { sourceMapSourceFiles } from "../../coverage/measureCoverage";
import { namedFacts } from "../internal/predicates";

/**
 * Coverage identity is exact across sources, emitted modules, and positions.
 *
 * A raw V8 script URL is attributed to at most one authored source, an
 * accepted source extension names exactly one compiler output, and a hit is
 * reconciled only against a complete declaration or position identity. Every
 * ambiguity fails closed: two source-map candidates, a guessed output name, or
 * a span missing a column each yield no identity rather than a near one.
 *
 * Scenarios:
 *
 * 1. A direct authored URL is measured; a toolchain module, an unmeasured
 *    package, entry barrels and a declaration are excluded; one source-map
 *    attribution is measured and two are ambiguous; every map source survives
 *    resolution.
 * 2. Both canonical path forms preserve case on a case-sensitive host and
 *    fold it on Windows, the report-key form also normalising separators.
 * 3. `.ts` and `.tsx` emit `.js`, `.cts` emits `.cjs`, `.mts` emits `.mjs`,
 *    and an unsupported extension names no output; the exact bodies the
 *    repository compiler writes for a type-only module of each kind read as
 *    empty, while a user export that resembles the ESM marker stays
 *    executable.
 * 4. The non-executable probe excuses an empty emitted module, keeps the
 *    obligation for a runtime statement, a failed compile and a missing exact
 *    output, asks the probe about the original source identity, and moves only
 *    proven-empty owners out of the gap list.
 * 5. Two statements on one line, and one name at two declarations, are
 *    distinct identities; an incomplete position has none.
 */
export const test_workspace_coverage_identity = (): void => {
  const repository = path.resolve("/repo");
  const url = (relative: string): string =>
    pathToFileURL(path.resolve(repository, relative)).href;
  const measured = coverageSourceAttribution({
    repository,
    url: url("packages/engine/src/logic.ts"),
  });
  const excluded = [
    "node_modules/pkg/index.js",
    "packages/evidence/src/internal.ts",
    "packages/production/src/index.ts",
    "test/src/index.ts",
    "packages/engine/lint.config.ts",
  ].map((relative) =>
    coverageSourceAttribution({ repository, url: url(relative) }),
  );
  const mapped = coverageSourceAttribution({
    attributed: [path.resolve(repository, "packages/engine/src/mapped.ts")],
    repository,
    url: url("node_modules/.cache/emitted.js"),
  });
  const ambiguous = coverageSourceAttribution({
    attributed: [
      path.resolve(repository, "packages/engine/src/one.ts"),
      path.resolve(repository, "packages/engine/src/two.ts"),
    ],
    repository,
    url: url("node_modules/.cache/emitted.js"),
  });

  const requested: string[] = [];
  const empty = (file: string, emitted: string | null, status: number = 0) =>
    emitsNoExecutableStatement({
      file,
      outDirectory: "/out",
      probe: {
        emit: () => status,
        read: ({ file: read }) => (requested.push(read), emitted),
      },
    });
  const excused = excuseNonExecutableGaps({
    gaps: ["b.cts:1 uncovered", "a.mts:1 uncovered", "b.cts:2 uncovered"],
    isNonExecutable: (file) => file !== "b.cts",
  });
  const span = (line: number, column: number) => ({
    start: { line, column },
    end: { line, column: column + 1 },
  });
  const mappedFiles = sourceMapSourceFiles({
    map: { sourceRoot: "../src", sources: ["one.ts", 7, "two.ts"] },
    mapFile: path.resolve(repository, "cache/output.js.map"),
  });
  const mixedCaseSource = path.resolve(
    repository,
    "packages/engine/src/AutoMovieScene.ts",
  );

  TestValidator.equals(
    "coverage uses exact source, emitted-file and declaration identities",
    namedFacts([
      [
        "authored TypeScript URL is measured",
        () => measured.reason === "measured",
      ],
      [
        "excluded URLs have no measurement authority",
        () => excluded.every((entry) => entry.reason === "excluded"),
      ],
      [
        "one source-map attribution is measured",
        () => mapped.reason === "measured",
      ],
      [
        "multiple source-map attributions fail closed",
        () => ambiguous.reason === "ambiguous",
      ],
      [
        "source-map paths preserve every candidate",
        () =>
          mappedFiles.length === 2 &&
          mappedFiles[0]?.endsWith(path.join("src", "one.ts")) === true,
      ],
      [
        "case-sensitive hosts preserve source case",
        () =>
          canonicalCoveragePath(mixedCaseSource, "linux").endsWith(
            "AutoMovieScene.ts",
          ),
      ],
      [
        "Windows source identity folds case",
        () =>
          canonicalCoveragePath(mixedCaseSource, "win32").endsWith(
            "automoviescene.ts",
          ),
      ],
      [
        "case-sensitive hosts preserve report key case",
        () =>
          canonicalCoverageEntryPath("/Repo/Engine/Scene.ts", "linux") ===
          "/Repo/Engine/Scene.ts",
      ],
      [
        "Windows report keys fold case and separators",
        () =>
          canonicalCoverageEntryPath("D:\\Repo\\Engine\\Scene.ts", "win32") ===
          "d:/repo/engine/scene.ts",
      ],
      [
        "ts maps to js",
        () => emittedModuleFilename("ledger.ts") === "ledger.js",
      ],
      [
        "tsx maps to js",
        () => emittedModuleFilename("ledger.tsx") === "ledger.js",
      ],
      [
        "cts maps to cjs",
        () => emittedModuleFilename("ledger.cts") === "ledger.cjs",
      ],
      [
        "mts maps to mjs",
        () => emittedModuleFilename("ledger.mts") === "ledger.mjs",
      ],
      [
        "unsupported extension has no guessed output",
        () => emittedModuleFilename("ledger.js") === null,
      ],
      [
        "exact CJS preamble is empty",
        () =>
          emittedModuleBody(
            '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n',
          ) === "",
      ],
      [
        "exact ESM empty marker is empty",
        () => emittedModuleBody("export {};\n") === "",
      ],
      // The bodies TypeScript 5.9 writes for `export type Ledger = never;`
      // under `--module commonjs`: the `.cjs` and `.js` carry the CommonJS
      // preamble, the `.mjs` carries the strict directive and the ESM marker.
      [
        "the compiler's type-only mjs body is empty",
        () => emittedModuleBody('"use strict";\nexport {};\n') === "",
      ],
      [
        "the compiler's type-only cjs body with a map trailer is empty",
        () =>
          emittedModuleBody(
            '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n//# sourceMappingURL=ledger.cjs.map\n',
          ) === "",
      ],
      [
        "the compiler's runtime mjs body is kept",
        () =>
          emittedModuleBody('"use strict";\nexport const run = () => 1;\n') ===
          "export const run = () => 1;",
      ],
      [
        "similar user export remains executable",
        () => emittedModuleBody("export { value };\n") === "export { value };",
      ],
      [
        "empty emitted module is excused",
        () => empty("ledger.mts", "export {};\n"),
      ],
      [
        "runtime statement keeps obligation",
        () => empty("ledger.cts", "register();\n") === false,
      ],
      [
        "compile failure keeps obligation",
        () => empty("ledger.cts", null, 1) === false,
      ],
      [
        "missing exact output keeps obligation",
        () => empty("ledger.cts", null) === false,
      ],
      [
        "probe receives the original source identity",
        () =>
          requested.every(
            (file) => file === "ledger.mts" || file === "ledger.cts",
          ),
      ],
      [
        "only proven empty owners are excused",
        () =>
          excused.excused.join(",") === "a.mts" && excused.gaps.length === 2,
      ],
      [
        "statement columns distinguish one line",
        () => statementIdentity(span(1, 0)) !== statementIdentity(span(1, 4)),
      ],
      [
        "function declarations distinguish one name",
        () =>
          functionIdentity({
            name: "same",
            decl: span(1, 0),
            loc: span(1, 0),
          }) !==
          functionIdentity({ name: "same", decl: span(4, 0), loc: span(4, 0) }),
      ],
      [
        "incomplete position has no identity",
        () => statementIdentity({ start: { line: 1 } }) === null,
      ],
    ]),
    Object.fromEntries(
      [
        "authored TypeScript URL is measured",
        "excluded URLs have no measurement authority",
        "one source-map attribution is measured",
        "multiple source-map attributions fail closed",
        "source-map paths preserve every candidate",
        "case-sensitive hosts preserve source case",
        "Windows source identity folds case",
        "case-sensitive hosts preserve report key case",
        "Windows report keys fold case and separators",
        "ts maps to js",
        "tsx maps to js",
        "cts maps to cjs",
        "mts maps to mjs",
        "unsupported extension has no guessed output",
        "exact CJS preamble is empty",
        "exact ESM empty marker is empty",
        "the compiler's type-only mjs body is empty",
        "the compiler's type-only cjs body with a map trailer is empty",
        "the compiler's runtime mjs body is kept",
        "similar user export remains executable",
        "empty emitted module is excused",
        "runtime statement keeps obligation",
        "compile failure keeps obligation",
        "missing exact output keeps obligation",
        "probe receives the original source identity",
        "only proven empty owners are excused",
        "statement columns distinguish one line",
        "function declarations distinguish one name",
        "incomplete position has no identity",
      ].map((key) => [key, true]),
    ),
  );
};
