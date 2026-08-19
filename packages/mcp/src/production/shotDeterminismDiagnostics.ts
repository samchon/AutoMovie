import {
  IAutoMovieDiagnostic,
  IAutoMovieShotContract,
} from "@automovie/interface";

/**
 * Inputs a shot build path may not read, and what each one breaks.
 *
 * Each entry is a source spelling rather than a concept, because this scan has
 * no type checker: it reads the module's own text and must say something true
 * about what it found.
 */
const FORBIDDEN: ReadonlyArray<{
  found: string;
  pattern: RegExp;
  why: string;
}> = [
  {
    found: "Date.now",
    pattern: /\bDate\s*\.\s*now\s*\(/u,
    why: "a wall clock makes two compiles of the same source disagree",
  },
  {
    found: "new Date",
    pattern: /\bnew\s+Date\s*\(\s*\)/u,
    why: "a wall clock makes two compiles of the same source disagree",
  },
  {
    found: "Math.random",
    pattern: /\bMath\s*\.\s*random\s*\(/u,
    why: "variation belongs to a seed the design states, so it can be reproduced",
  },
  {
    found: "performance.now",
    pattern: /\bperformance\s*\.\s*now\s*\(/u,
    why: "a wall clock makes two compiles of the same source disagree",
  },
  {
    found: "process",
    pattern: /\bprocess\s*\.\s*(?:env|argv|cwd|hrtime|platform|pid)\b/u,
    why: "process state makes the film depend on the machine that built it",
  },
  {
    found: "node:fs",
    pattern: /["']node:fs["']|["']fs["']/u,
    why: "a build function that reads the filesystem depends on state no record carries",
  },
];

/** Lines that are only a comment, which state intent rather than run. */
const executable = (line: string): boolean => {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("*") === false &&
    trimmed.startsWith("//") === false &&
    trimmed.startsWith("/*") === false
  );
};

/**
 * A shot module reads nothing it was not given.
 *
 * `determinism` is a named criterion of the `source` review, and until now it
 * was the only one with no mechanical enforcement anywhere: nothing refused a
 * wall clock, a filesystem read, or unseeded randomness inside a shot build
 * function, so an agent discharged the criterion by reading for it. A criterion
 * a machine can decide is not a review criterion, and this is the machine.
 *
 * The scan is textual and says so. It has no type checker, so it names the
 * spelling it found rather than a resolved symbol, and it skips comment-only
 * lines because a JSDoc sentence about `Math.random` is not a call to it. What
 * it cannot see — an alias, a dynamic import, a helper in another module — is
 * the reason the source review keeps a reader for the rest.
 *
 * The severity is not scope-dependent. Determinism is the property every other
 * check in this product compares two runs against, so a violation is wrong at
 * the moment it is written rather than by the time delivery is claimed.
 */
export const shotDeterminismDiagnostics = (props: {
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  read: (relativePath: string) => string | null;
}): IAutoMovieDiagnostic[] => {
  const modules = new Map<string, string[]>();
  for (const [id, contract] of props.contracts) {
    const module = contract.source.module;
    modules.set(module, [...(modules.get(module) ?? []), id]);
  }
  const diagnostics: IAutoMovieDiagnostic[] = [];
  for (const [module, shots] of [...modules].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const content = props.read(module);
    if (content === null) continue;
    const lines = content.replace(/\r\n/gu, "\n").split("\n");
    for (const entry of FORBIDDEN) {
      const line = lines.findIndex(
        (text) => executable(text) && entry.pattern.test(text),
      );
      if (line === -1) continue;
      diagnostics.push({
        code: "source-shot-nondeterministic",
        category: "error",
        phase: "source",
        target: "source",
        path: module,
        message: `"${module}" reads ${entry.found} at line ${line + 1}, and it builds ${shots.length === 1 ? "shot" : "shots"} ${shots
          .map((id) => `"${id}"`)
          .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
          .join(
            ", ",
          )}. A shot build path reads nothing it was not given, because ${entry.why}. Move the value into a design record or a declared seed, or read it from a standalone script instead, then compile again.`,
      });
    }
  }
  return diagnostics;
};
