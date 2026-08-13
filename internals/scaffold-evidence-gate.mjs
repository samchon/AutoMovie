#!/usr/bin/env node
// Runs `packages/cli/scaffold`'s own `@ttsc/evidence` obligation graph, which no
// other check in this repository executes.
//
// The scaffold is not a pnpm workspace project (`pnpm-workspace.yaml` lists
// `packages/*` and the scaffold sits one level below `packages/cli`), so
// `pnpm run build` never reaches it, and it cannot compile where it stands: its
// `package.json` carries `{{version:ttsc}}`-style template tokens instead of
// versions. Every generated project inherits `lint.config.ts`, `src`, and `docs`
// verbatim, so an unpaid citation there is red on a user's first compile while
// this repository stays green.
//
// The gate therefore renders a disposable probe project from those inherited
// inputs, runs `ttsc --noEmit` over it, and reports the `evidence/*` diagnostics.
//
// Two properties make it a gate rather than a number:
//
//   - It reports evidence diagnostics only. The probe does not install
//     `@automovie/*`, so every run carries a population of TS2307/TS7006
//     module-resolution noise that says nothing about the graph. Failing on the
//     total would leave the gate red forever; ignoring the total would leave it
//     blind. Classifying by diagnostic identity is what separates the two.
//   - It carries its own negative twin, in every run rather than in the one that
//     built it. `ttsc` reports no lint diagnostic when the project does not
//     declare the plugins as dependencies, and none when the lint config fails
//     to evaluate; both were observed while this gate was built, and the symptom
//     of each is an empty diagnostic set that reads exactly like a clean graph.
//     So every run plants an uncited exported class and requires
//     `evidence/graph` to reject it by name. When the instrument is not running
//     the canary goes missing and the gate fails as broken rather than passing
//     as clean.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAFFOLD = path.join(ROOT, "packages", "cli", "scaffold");

/**
 * The probe lives under `node_modules/.cache` for three reasons at once: it is
 * already ignored by git and by `format:check`, it is outside every
 * `pnpm-workspace.yaml` glob, and Node resolves from it up into the repository's
 * own `node_modules`, which is where `ttsc`, `@ttsc/lint`, and `@ttsc/evidence`
 * are installed. It is deliberately not under `experimental/`, which holds
 * credentialed sandboxes this gate must never read, write, or name.
 */
const PROBE = path.join(
  ROOT,
  "node_modules",
  ".cache",
  "automovie-scaffold-evidence-gate",
);

/** The inherited inputs the probe compiles, copied verbatim except as noted. */
const INHERITED = ["docs", "src", "lint.config.ts"];

/**
 * The one line of the scaffold that the probe may not take verbatim.
 *
 * `@ttsc/lint` evaluates `lint.config.ts` as its own generated project in a
 * temporary directory outside the probe, and that project resolves neither the
 * probe's `typeRoots` nor a hoisted `@types/node`. The directive therefore fails
 * there with TS2688, the config never evaluates, and `ttsc` then reports zero
 * lint diagnostics while still exiting on the type errors, which is the exact
 * shape of a passing run. A generated project installs `@types/node` for real
 * and never meets this, so the directive is a probe artifact rather than a
 * scaffold defect.
 *
 * The config body uses no Node global, so dropping the directive changes nothing
 * the graph is made of. `render` refuses to continue when the line is absent, so
 * a scaffold that stops carrying it fails loudly instead of silently skipping a
 * rewrite that no longer matches.
 */
const NODE_TYPE_DIRECTIVE = '/// <reference types="node" />\n';

/**
 * The canary's file, planted under a population the scaffold's second
 * implementation claim selects (`src/world/*.ts`). The name is one no authoring
 * pass would choose, so it can never collide with real production source.
 */
const CANARY_FILE = path.join("src", "world", "__evidenceGateCanary.ts");

/** An exported class citing nothing: exactly what the class-grain claim refuses. */
const CANARY_SOURCE = `/** A class the gate plants so the graph has something to reject. */
export class __EvidenceGateCanary {
  /** Present so the class carries a member. */
  public readonly planted: boolean = true;
}
`;

/** The rule whose diagnostic the canary must provoke. */
const CANARY_RULE = "evidence/graph";

/**
 * Colour escapes `ttsc` emits when it decides the stream can render them.
 *
 * It decides that from the stream rather than from a flag, and `--pretty false`
 * was measured not to turn it off, so the gate strips rather than suppresses.
 */
const PLAIN = /\u001b\[[0-9;]*m/gu;

/**
 * A diagnostic `ttsc` printed, split into the parts the gate classifies by.
 *
 * Both of the layouts `ttsc` chooses between are read here rather than one being
 * forced, because the choice is made from the stream rather than from a flag:
 * a location-prefixed line for a compiler diagnostic, and a bare `error TS…:`
 * line for a lint diagnostic, which carries its position inside its own message
 * instead. Lines that match neither are the summary and toolchain notices around
 * the list; they carry no rule identity and are dropped rather than counted as
 * either noise or evidence.
 */
const parse = (output) =>
  output
    .split(/\r?\n/u)
    .map((line) => line.replace(PLAIN, "").trimEnd())
    .map((line) => {
      const match =
        /(?:^|\s)(?:error|warning) (?<code>TS[0-9]+): ?(?<message>.+)$/u.exec(
          line,
        );
      return match === null
        ? undefined
        : {
            code: match.groups.code,
            message: match.groups.message,
            text: line,
          };
    })
    .filter((diagnostic) => diagnostic !== undefined);

/**
 * An evidence diagnostic is one whose message opens with its `evidence` rule id.
 *
 * `@ttsc/lint` reports every rule under one compiler code and names the rule in
 * a `[evidence/graph]` prefix, so the compiler code cannot make the split. The
 * prefix can: a new evidence rule lands in the gate and a new compiler code
 * lands in noise, without either being enumerated here.
 */
const isEvidence = (diagnostic) => diagnostic.message.startsWith("[evidence/");

/** The rule id a lint diagnostic names in its own prefix. */
const ruleOf = (diagnostic) =>
  /^\[(?<rule>[^\]]+)\]/u.exec(diagnostic.message)?.groups.rule;

/**
 * `@types/node` is not hoisted to the repository root, so the probe points at
 * wherever pnpm actually placed it instead of at a version-stamped path written
 * down by hand, which would rot at the next lockfile change.
 */
const nodeTypeRoot = () =>
  path
    .dirname(
      path.dirname(
        createRequire(
          path.join(ROOT, "packages", "cli", "package.json"),
        ).resolve("@types/node/package.json"),
      ),
    )
    .split(path.sep)
    .join("/");

/** Copy one inherited input, whether it is a file or a directory. */
const inherit = (relative) => {
  const target = path.join(PROBE, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(SCAFFOLD, relative), target, { recursive: true });
};

/**
 * Render the probe from the scaffold.
 *
 * The manifest declares `@ttsc/lint` and `@ttsc/evidence` because `ttsc` decides
 * whether to lint at all from the project's declared dependencies. Without them
 * it type-checks and prints no lint diagnostic, which is indistinguishable from
 * a clean graph; the canary pass is what proves the declaration took effect.
 */
const render = () => {
  fs.rmSync(PROBE, { force: true, recursive: true });
  fs.mkdirSync(PROBE, { recursive: true });
  for (const relative of INHERITED) inherit(relative);

  const configFile = path.join(PROBE, "lint.config.ts");
  const config = fs.readFileSync(configFile, "utf8");
  if (config.startsWith(NODE_TYPE_DIRECTIVE) === false)
    throw new Error(
      `packages/cli/scaffold/lint.config.ts no longer opens with ${JSON.stringify(
        NODE_TYPE_DIRECTIVE.trim(),
      )}; re-measure whether the probe still needs to drop it before editing this constant.`,
    );
  fs.writeFileSync(
    configFile,
    config.slice(NODE_TYPE_DIRECTIVE.length),
    "utf8",
  );

  fs.writeFileSync(
    path.join(PROBE, "package.json"),
    `${JSON.stringify(
      {
        name: "automovie-scaffold-evidence-probe",
        private: true,
        type: "module",
        version: "0.0.0",
        devDependencies: {
          "@ttsc/evidence": "*",
          "@ttsc/lint": "*",
          ttsc: "*",
          typescript: "*",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(PROBE, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "esnext",
          lib: ["ESNext", "DOM", "DOM.Iterable"],
          module: "esnext",
          moduleResolution: "bundler",
          esModuleInterop: true,
          resolveJsonModule: true,
          newLine: "lf",
          strict: true,
          skipLibCheck: true,
          typeRoots: [nodeTypeRoot()],
          types: ["node"],
        },
        // `scripts`, `test`, `viewer/src`, `automovie.config.ts`, and
        // `vite.config.ts` are the rest of the scaffold's own `include`. None of
        // them hosts an evidence claim and each one drags more unresolved
        // `@automovie/*` imports into the noise population, so the probe
        // compiles the graphed surface and its config instead.
        include: ["src", "lint.config.ts"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

/** Run `ttsc --noEmit` over the probe and return its status and output. */
const compile = () => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "node_modules", "ttsc", "lib", "launcher", "ttsc.js"),
      "--noEmit",
      "-p",
      "tsconfig.json",
    ],
    { cwd: PROBE, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error !== undefined) throw result.error;
  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    signal: result.signal,
    status: result.status,
  };
};

const report = (lines) => {
  process.stdout.write(`${lines.join("\n")}\n`);
};

/**
 * One compile carries both directions of the twin.
 *
 * The canary is additive: it plants a host that owes a citation and pays none,
 * so it can only add its own diagnostic and can never discharge an obligation
 * some other host owes. A single run that reports the canary's diagnostic and no
 * other evidence diagnostic therefore proves the same two things a planted run
 * followed by a reverted run proves, at half the compile cost, and it proves
 * them of the same tree rather than of two trees a minute apart.
 */
const main = () => {
  render();
  const planted = CANARY_FILE.split(path.sep).join("/");
  fs.writeFileSync(path.join(PROBE, CANARY_FILE), CANARY_SOURCE, "utf8");

  const started = Date.now();
  const run = compile();
  const elapsed = Date.now() - started;
  const diagnostics = parse(run.output);
  const evidence = diagnostics.filter(isEvidence);
  const noise = diagnostics.filter(
    (diagnostic) => isEvidence(diagnostic) === false,
  );
  const provoked = evidence.filter(
    (diagnostic) =>
      ruleOf(diagnostic) === CANARY_RULE &&
      diagnostic.message.includes(planted),
  );
  const owed = evidence.filter(
    (diagnostic) => diagnostic.message.includes(planted) === false,
  );

  report([
    "scaffold evidence gate",
    `  probe:       ${PROBE}`,
    `  ttsc:        exit ${run.status ?? `signal ${run.signal}`}, ${elapsed}ms`,
    `  diagnostics: ${evidence.length} evidence, ${noise.length} module-resolution noise`,
  ]);

  if (provoked.length === 0) {
    report([
      "",
      `FAIL: the instrument is not running. An uncited exported class in ${planted}`,
      `      drew no ${CANARY_RULE} diagnostic, so this run proves nothing about the`,
      "      scaffold's obligation graph and a clean result from it would be a lie.",
      "      Read the probe's own output; a lint config that fails to evaluate and a",
      "      project that never loads the plugin both look exactly like this.",
      ...run.output
        .split(/\r?\n/u)
        .slice(0, 40)
        .map((line) => `  | ${line}`),
    ]);
    process.exitCode = 1;
    return;
  }
  report([`  canary:      rejected by ${CANARY_RULE}, as required`]);

  if (owed.length !== 0) {
    report([
      "",
      "FAIL: packages/cli/scaffold owes the citations below. Every project generated",
      "      from it inherits them, so this is red on an author's first compile.",
      ...owed.map((diagnostic) => `  ${diagnostic.text}`),
    ]);
    process.exitCode = 1;
    return;
  }
  report([
    "",
    "PASS: the scaffold's obligation graph is paid, and the canary this same run",
    "      rejected is what says so. The noise count is unresolved `@automovie/*`",
    "      imports in a probe that installs nothing; it is reported, never gated.",
  ]);
};

main();
