import fs from "node:fs";
import path from "node:path";

import { describeThrown } from "../integrity/describeThrown";
import { runGit } from "./changedCoverage";
import {
  canonicalCoveragePath,
  isAuthoredExecutableSource,
} from "./coverageIdentity";
import {
  type ICoveragePublication,
  loadCoveragePublication,
  publicationReport,
} from "./coveragePublication";

type Writer = (line: string) => void;

const slash = (value: string): string => value.replaceAll("\\", "/");

/**
 * Code-unit order, the spelling the scaffold renderer already uses.
 *
 * `localeCompare` varies with the host's locale and ICU build, and this decides
 * the order two CI lanes print the same diagnostics in. Written as a subtraction
 * rather than as nested conditionals because it is then one expression with
 * nothing in it that a test would have to reach.
 */
const byCodeUnit = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);

export interface ICoveragePopulationInspection {
  measured: number;
  obliged: number;
  unjudged: string[];
  unmeasured: string[];
}

/**
 * Every repository path a coverage run could be expected to account for.
 *
 * Tracked files plus the ones the working tree has added and `.gitignore` does
 * not remove, which is the population the changed-file gate already collects. A
 * gitignored file on one contributor's disk is not a repository fact and must
 * not decide a gate that has to mean the same thing in CI.
 */
export const repositoryCandidates = (root: string): string[] => {
  const listing = (arguments_: string[]): string[] =>
    runGit(root, arguments_)
      .split("\0")
      .filter((entry) => entry.length !== 0)
      .map(slash);
  return [
    ...new Set([
      ...listing(["ls-files", "-z"]),
      ...listing(["ls-files", "--others", "--exclude-standard", "-z"]),
    ]),
  ].sort(byCodeUnit);
};

/**
 * Compare the population the gate judges against the population c8 measured.
 *
 * These are two independent statements of one set. `coverageIncludes` tells c8
 * what to instrument and `isAuthoredExecutableSource` tells the changed-file
 * gate what to demand 100% of, and nothing kept them equal. Both directions of
 * the drift are faults, and both read as something other than what they are.
 *
 * A file the predicate admits and the includes miss reaches the changed gate as
 * `changed measured source is absent from coverage-final.json`, which blames the
 * measurement for a population decision; two scaffold sources were in that state
 * when this was written. A file the includes measure and the predicate refuses
 * is quieter and worse: it is instrumented, reported, and never judged, so it
 * can be edited to any coverage at all without a diagnostic. The four modules
 * under `test/src/coverage/` were in that state, which is to say the per-change
 * obligation did not apply to the code that enforces it.
 *
 * Judged over the git-known population in both directions. A report entry the
 * repository does not know about is a local artifact rather than a contract
 * defect, and a tracked file removed from the working tree cannot be
 * instrumented by anything.
 */
export const inspectCoveragePopulation = (props: {
  candidates: readonly string[];
  measured: readonly string[];
  root: string;
}): ICoveragePopulationInspection => {
  const known = new Map<string, string>(
    props.candidates.map(
      (file) =>
        [
          canonicalCoveragePath(path.resolve(props.root, file)),
          slash(file),
        ] as const,
    ),
  );
  const measured = new Map<string, string>();
  for (const file of props.measured) {
    const relative = slash(path.relative(props.root, file));
    if (relative.length === 0 || relative.startsWith("../")) continue;
    measured.set(canonicalCoveragePath(file), relative);
  }
  const obliged = [...known.values()]
    .filter(isAuthoredExecutableSource)
    .filter((file) => fs.existsSync(path.resolve(props.root, file)))
    .sort(byCodeUnit);
  return {
    obliged: obliged.length,
    measured: measured.size,
    unmeasured: obliged.filter(
      (file) =>
        measured.has(canonicalCoveragePath(path.resolve(props.root, file))) ===
        false,
    ),
    unjudged: [...measured]
      .map(([identity, relative]) => known.get(identity) ?? relative)
      .filter((file) =>
        known.has(canonicalCoveragePath(path.resolve(props.root, file))),
      )
      .filter((file) => isAuthoredExecutableSource(file) === false)
      .sort(byCodeUnit),
  };
};

/** Print the two population sizes and name every file they disagree about. */
export const reportCoveragePopulation = (
  result: ICoveragePopulationInspection,
  write: Writer,
): void => {
  write(
    `Coverage population: ${result.obliged} authored executable sources owed coverage, ${result.measured} measured entries in the report.`,
  );
  for (const file of result.unmeasured)
    write(
      `INSTRUMENT FAILURE: ${file}: the changed-file gate judges this source and the measurement never took it; widen coverageIncludes or state why it is not authored executable source`,
    );
  for (const file of result.unjudged)
    write(
      `INSTRUMENT FAILURE: ${file}: the measurement takes this source and the changed-file gate never judges it; align isAuthoredExecutableSource with coverageIncludes`,
    );
};

const readCoverageKeys = (report: string): string[] => {
  const parsed: unknown = JSON.parse(fs.readFileSync(report, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error(`${report} does not contain a coverage object`);
  return Object.keys(parsed);
};

/**
 * Refuse a run whose measured population and judged population disagree.
 *
 * Runs before the changed-file gate because the disagreement decides whether
 * that gate's verdict means anything: a source it would have demanded 100% of
 * and never saw, and one it saw and never demanded, both leave a verdict that
 * answered about a different set than the one it names. Exits 2 for the same
 * reason the changed gate does, so an instrument fault stays a different colour
 * from a coverage gap.
 */
export const runCoveragePopulationGate = (options: {
  publication?: ICoveragePublication;
  reportDirectory?: string;
  root: string;
  write?: Writer;
}): number => {
  const write = options.write ?? console.log;
  try {
    const root = path.resolve(options.root);
    let publication = options.publication;
    if (publication === undefined) {
      if (options.reportDirectory === undefined)
        throw new Error("coverage population requires an explicit publication");
      publication = loadCoveragePublication(
        path.resolve(options.reportDirectory),
      );
    }
    const result = inspectCoveragePopulation({
      root,
      candidates: repositoryCandidates(root),
      measured: readCoverageKeys(publicationReport(publication)),
    });
    reportCoveragePopulation(result, write);
    return result.unmeasured.length + result.unjudged.length === 0 ? 0 : 2;
  } catch (error) {
    write(
      `INSTRUMENT FAILURE: coverage population could not be inspected: ${describeThrown(error)}`,
    );
    return 2;
  }
};
