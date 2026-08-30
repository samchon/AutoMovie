import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runChangedCoverageGate } from "../../coverage/changedCoverage";
import {
  emitsNoExecutableStatement,
  emittedModuleBody,
  excuseNonExecutableGaps,
  repositoryEmitProbe,
} from "../../coverage/executableEmission";
import { writeMeasuredSources } from "../../coverage/measureCoverage";

const ROOT = path.resolve(__dirname, "../../../..");

/**
 * A source with nothing to execute is excused from coverage, and only that.
 *
 * `c8 --all` fabricates one statement per source line for a file it never
 * loaded, comment lines included, so a type-only ledger of two thousand
 * citations arrives at the gate as two thousand uncovered statements. The
 * module emits the CommonJS preamble and nothing else and a type-only import is
 * elided before runtime, so no test could ever reach one of those positions.
 * The gate was demanding what cannot be given.
 *
 * What matters as much is the shape of the excuse. It is not a list of file
 * names, which is the thing that never shrinks; it is a question put to the
 * compiler, one file at a time, only about a file already being refused. And it
 * is not silent: an excused file is named on its own line in the report,
 * because a gate that quietly stops judging something reports the same green as
 * one that judged it and was satisfied.
 *
 * Scenarios:
 *
 * 1. The preamble is not a body, in either line ending and with or without the
 *    source-map comment, and a real statement survives.
 * 2. A compile that fails and a compile that writes nothing both leave the
 *    obligation in place, because an unanswered question is not a negative
 *    answer. Only an emitted module with an empty body excuses one.
 * 3. Excusing moves exactly the excused files' gaps and keeps every other
 *    sentence untouched.
 * 4. Against this repository's own sources and its own compiler: the engine and
 *    interface exclusion ledgers emit nothing, and two ordinary modules do not.
 *    Without this case the other three would pass over a predicate that never
 *    once met a real file.
 */
export const test_workspace_non_executable_source = (): void => {
  const preamble = [
    '"use strict";',
    'Object.defineProperty(exports, "__esModule", { value: true });',
  ];

  TestValidator.equals(
    "the module preamble is not a body and a statement is",
    {
      bare: emittedModuleBody(`${preamble.join("\n")}\n`),
      withSourceMap: emittedModuleBody(
        `${preamble.join("\n")}\n//# sourceMappingURL=x.js.map\n`,
      ),
      carriageReturns: emittedModuleBody(`${preamble.join("\r\n")}\r\n`),
      indented: emittedModuleBody(`  ${preamble[0]}\n   ${preamble[1]}\n`),
      empty: emittedModuleBody(""),
      body: emittedModuleBody(
        `${preamble.join("\n")}\nexports.value = 1;\n//# sourceMappingURL=x.js.map\n`,
      ),
    },
    {
      bare: "",
      withSourceMap: "",
      carriageReturns: "",
      indented: "",
      empty: "",
      body: "exports.value = 1;",
    },
  );

  const probeOf = (status: number, emitted: string | null) => ({
    emit: () => status,
    read: () => emitted,
  });
  TestValidator.equals(
    "only an emitted empty module excuses an obligation",
    {
      compileFailed: emitsNoExecutableStatement({
        file: "a.ts",
        outDirectory: "out",
        probe: probeOf(1, `${preamble.join("\n")}\n`),
      }),
      wroteNothing: emitsNoExecutableStatement({
        file: "a.ts",
        outDirectory: "out",
        probe: probeOf(0, null),
      }),
      emittedBody: emitsNoExecutableStatement({
        file: "a.ts",
        outDirectory: "out",
        probe: probeOf(0, `${preamble.join("\n")}\nexports.value = 1;\n`),
      }),
      emittedNothing: emitsNoExecutableStatement({
        file: "a.ts",
        outDirectory: "out",
        probe: probeOf(0, `${preamble.join("\n")}\n`),
      }),
    },
    {
      compileFailed: false,
      wroteNothing: false,
      emittedBody: false,
      emittedNothing: true,
    },
  );

  const gaps = [
    "packages/b/src/ledger.ts:1 uncovered statement",
    "packages/b/src/ledger.ts:2 uncovered line",
    "packages/a/src/real.ts:9 uncovered statement",
    "packages/c/src/other.ts:4 uncovered function build",
  ];
  const judged = excuseNonExecutableGaps({
    gaps,
    isNonExecutable: (file) =>
      file === "packages/b/src/ledger.ts" || file === "packages/c/src/other.ts",
  });
  TestValidator.equals(
    "excusing takes the excused files' gaps and nothing else",
    judged,
    {
      excused: ["packages/b/src/ledger.ts", "packages/c/src/other.ts"],
      gaps: ["packages/a/src/real.ts:9 uncovered statement"],
    },
  );

  const outDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-emission-case-"),
  );
  try {
    const probe = repositoryEmitProbe({
      compilerRoot: ROOT,
      root: ROOT,
      spawn: spawnSync,
    });
    const asked = (file: string): boolean =>
      emitsNoExecutableStatement({ file, outDirectory, probe });
    TestValidator.equals(
      "this repository's own ledgers emit nothing and its modules do",
      {
        engineLedger: asked(
          "packages/engine/src/AutoMovieEngineEvidenceExclusions.ts",
        ),
        interfaceLedger: asked(
          "packages/interface/src/AutoMovieInterfaceEvidenceExclusions.ts",
        ),
        engineModule: asked(
          "packages/engine/src/architecture/builtEnvironmentObservation.ts",
        ),
        templateModule: asked("packages/template/src/renderScaffold.ts"),
      },
      {
        engineLedger: true,
        interfaceLedger: true,
        engineModule: false,
        templateModule: false,
      },
    );

    // The probe's own two failure answers, asked directly. A compile of a file
    // that is not there fails, and reading its output finds nothing -- and
    // neither is an emptiness answer, which is what the case above pins.
    const absent = {
      file: "packages/engine/src/no-such-source.ts",
      outDirectory,
    };
    TestValidator.equals(
      "an absent source refuses to compile and emits nothing to read",
      {
        status: probe.emit(absent) === 0,
        emitted: probe.read(absent),
        spawnWithoutStatus: repositoryEmitProbe({
          compilerRoot: ROOT,
          root: ROOT,
          spawn: () => ({ status: null }),
        }).emit(absent),
      },
      { status: false, emitted: null, spawnWithoutStatus: 1 },
    );
  } finally {
    fs.rmSync(outDirectory, { recursive: true, force: true });
  }

  const repository = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-emission-gate-"),
  );
  try {
    const git = (...argv: string[]): void => {
      const result = spawnSync("git", argv, { cwd: repository, shell: false });
      if (result.status !== 0)
        throw new Error(`git ${argv.join(" ")} failed in the gate fixture`);
    };
    const sourceDirectory = path.join(repository, "packages", "x", "src");
    fs.mkdirSync(sourceDirectory, { recursive: true });
    const write = (name: string, body: string): string => {
      const file = path.join(sourceDirectory, name);
      fs.writeFileSync(file, body, "utf8");
      return file;
    };
    const ledger = write(
      "ledger.ts",
      ["/** A citation ledger. */", "export type Ledger = never;", ""].join(
        "\n",
      ),
    );
    const real = write(
      "real.ts",
      ["export const build = (): number => 1;", ""].join("\n"),
    );

    git("init", "--initial-branch", "main");
    git(
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "commit",
      "--allow-empty",
      "-m",
      "base",
    );
    git("add", "--all");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-m", "sources");

    const report = path.join(repository, "report");
    fs.mkdirSync(report);
    const entryOf = (file: string, hits: number) => {
      const lines = fs.readFileSync(file, "utf8").trimEnd().split(/\r?\n/u);
      return {
        path: file,
        statementMap: Object.fromEntries(
          lines.map((line, index) => [
            index,
            {
              start: { line: index + 1, column: 0 },
              end: { line: index + 1, column: line.length },
            },
          ]),
        ),
        s: Object.fromEntries(lines.map((_, index) => [index, hits])),
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      };
    };
    const publish = (realHits: number): void => {
      fs.writeFileSync(
        path.join(report, "coverage-final.json"),
        JSON.stringify({
          [ledger]: entryOf(ledger, 0),
          [real]: entryOf(real, realHits),
        }),
      );
      writeMeasuredSources(report);
    };
    const argv = [
      "--root",
      repository,
      "--report-directory",
      report,
      "--base",
      "HEAD~1",
    ];
    const runGate = (): { lines: string[]; status: number } => {
      const lines: string[] = [];
      const status = runChangedCoverageGate(argv, {}, (line) => {
        lines.push(line);
      });
      return { lines, status };
    };

    publish(0);
    const refused = runGate();
    publish(1);
    const excusedOnly = runGate();

    const names = (lines: string[], prefix: string): string[] =>
      lines
        .filter((line) => line.startsWith(prefix))
        .map((line) => line.slice(prefix.length).split(" ")[0] ?? "");

    TestValidator.equals(
      "the gate excuses the ledger by name and still refuses the real file",
      {
        refusedStatus: refused.status,
        refusedGapFiles: [...new Set(names(refused.lines, "COVERAGE GAP: "))],
        refusedExcused: names(refused.lines, "NOT EXECUTABLE: "),
        coveredStatus: excusedOnly.status,
        coveredGapFiles: [
          ...new Set(names(excusedOnly.lines, "COVERAGE GAP: ")),
        ],
        coveredExcused: names(excusedOnly.lines, "NOT EXECUTABLE: "),
      },
      {
        refusedStatus: 1,
        refusedGapFiles: ["packages/x/src/real.ts:1"],
        refusedExcused: ["packages/x/src/ledger.ts"],
        coveredStatus: 0,
        coveredGapFiles: [],
        coveredExcused: ["packages/x/src/ledger.ts"],
      },
    );
  } finally {
    fs.rmSync(repository, { recursive: true, force: true });
  }
};
