import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * Code-unit order, so two CI lanes print the same excused files in one order.
 */
const byCodeUnit = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);

/**
 * The two lines a CommonJS transpile writes whether or not the module has a
 * body, and the comment it appends when a source map is asked for.
 *
 * They are matched literally rather than by a pattern because the question this
 * answers is narrow: did the author write anything that runs? A pattern loose
 * enough to tolerate a different spelling would also swallow a real statement.
 */
const MODULE_PREAMBLE: readonly string[] = [
  '"use strict";',
  'Object.defineProperty(exports, "__esModule", { value: true });',
  "export {};",
];

/** Exact compiler output name for every accepted authored source extension. */
export const emittedModuleFilename = (file: string): string | null => {
  const basename = path.basename(file);
  if (basename.endsWith(".cts")) return `${basename.slice(0, -4)}.cjs`;
  if (basename.endsWith(".mts")) return `${basename.slice(0, -4)}.mjs`;
  if (basename.endsWith(".tsx")) return `${basename.slice(0, -4)}.js`;
  if (basename.endsWith(".ts")) return `${basename.slice(0, -3)}.js`;
  return null;
};

/**
 * Whatever the author wrote that survives into an emitted CommonJS module.
 *
 * `c8 --all` fabricates one statement per source line for a file it never
 * loaded, comment lines included. Measured on this repository: the engine's
 * evidence-exclusion ledger is 2,079 lines and its coverage entry carries 2,079
 * statements, of which statement 0 spans line 1 columns 0 to 3 — the `/**` that
 * opens a JSDoc block. A ledger like that is one `export type X = never` and
 * two thousand lines of citation, so it emits the preamble and nothing else and
 * can never be loaded at all: a type-only import is elided before runtime.
 *
 * So the gate was refusing 8,320 positions in a module with no position to
 * reach. This says what is actually there, and an empty answer means the file
 * owes no coverage because there is nothing in it to cover.
 */
export const emittedModuleBody = (emitted: string): string =>
  emitted
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length !== 0 &&
        line.startsWith("//# sourceMappingURL=") === false &&
        MODULE_PREAMBLE.includes(line) === false,
    )
    .join("\n");

export interface IEmitProbe {
  /** Compile one source into `outDirectory`, returning the process status. */
  emit: (props: { file: string; outDirectory: string }) => number;
  /** Read the emitted module, or null when the compile wrote nothing. */
  read: (props: { file: string; outDirectory: string }) => string | null;
}

/**
 * Whether a source contributes no executable statement to the built product.
 *
 * The compiler is asked rather than the source text. Deciding from the text
 * means re-implementing the rule that a type-only declaration erases, which is
 * the compiler's own answer and is exactly the kind of second opinion that
 * drifts from the first. A file that fails to compile is not declared empty:
 * an unanswered question is not a negative answer, so a non-zero status returns
 * `false` and the file keeps its coverage obligation.
 */
export const emitsNoExecutableStatement = (props: {
  file: string;
  outDirectory: string;
  probe: IEmitProbe;
}): boolean => {
  if (
    props.probe.emit({ file: props.file, outDirectory: props.outDirectory }) !==
    0
  )
    return false;
  const emitted = props.probe.read({
    file: props.file,
    outDirectory: props.outDirectory,
  });
  return emitted === null ? false : emittedModuleBody(emitted).length === 0;
};

/** The touched file each gap sentence is about. */
const gapOwner = (gap: string): string => gap.slice(0, gap.indexOf(":"));

/**
 * Set aside the gaps belonging to files with nothing in them to execute.
 *
 * They are separated rather than dropped. A gate that quietly stops judging a
 * file reports the same green as one that judged it and found nothing wrong,
 * and this repository has paid for that shape more than once, so the excused
 * files are named in the report at their own line. What is removed is only the
 * demand that they be covered, which no test could ever satisfy.
 */
export const excuseNonExecutableGaps = (props: {
  gaps: readonly string[];
  isNonExecutable: (file: string) => boolean;
}): { excused: string[]; gaps: string[] } => {
  const excused = [...new Set(props.gaps.map(gapOwner))]
    .filter(props.isNonExecutable)
    .sort(byCodeUnit);
  const set = new Set(excused);
  return {
    excused,
    gaps: props.gaps.filter((gap) => set.has(gapOwner(gap)) === false),
  };
};

/**
 * Ask this repository's own compiler what one source emits.
 *
 * `--noCheck` and `--noResolve` are deliberate: the question is what the file
 * contributes to the built product, not whether the program it belongs to type
 * checks, and the gate already knows the answer to the second from the build
 * lane. A file whose compile fails for any reason answers nothing, and
 * {@link emitsNoExecutableStatement} keeps such a file's obligation rather than
 * reading silence as emptiness.
 */
export const repositoryEmitProbe = (props: {
  /**
   * Where the compiler itself lives, which is not the tree being judged.
   *
   * The gate runs against whatever root it was pointed at, and a fixture root
   * has no installed toolchain. Resolving the compiler from the judged tree
   * made every file in such a tree fail to compile, and a file that cannot be
   * compiled keeps its obligation, so the excuse would have been unreachable in
   * exactly the scenario that proves it.
   */
  compilerRoot: string;
  /** Absolute root the judged paths are relative to. */
  root: string;
  spawn: (
    command: string,
    argv: readonly string[],
    options: { cwd: string },
  ) => { status: number | null };
}): IEmitProbe => ({
  emit: ({ file, outDirectory }) =>
    props.spawn(
      process.execPath,
      [
        path.join(
          props.compilerRoot,
          "node_modules",
          "typescript",
          "lib",
          "tsc.js",
        ),
        "--module",
        "commonjs",
        "--target",
        "es2022",
        "--outDir",
        outDirectory,
        "--skipLibCheck",
        "--noResolve",
        "--noCheck",
        path.resolve(props.root, file),
      ],
      { cwd: props.compilerRoot },
    ).status ?? 1,
  read: ({ file, outDirectory }) => {
    const filename = emittedModuleFilename(file);
    if (filename === null) return null;
    const emitted = path.join(outDirectory, filename);
    return fs.existsSync(emitted) ? fs.readFileSync(emitted, "utf8") : null;
  },
});
