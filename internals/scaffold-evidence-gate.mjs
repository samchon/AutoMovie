#!/usr/bin/env node
// Runs `packages/cli/scaffold`'s own `npm run lint:source`, which is its
// `@ttsc/evidence` obligation graph and its `@ttsc/lint` correctness rules
// together, and which no other check in this repository executes.
//
// The scaffold is not a pnpm workspace project (`pnpm-workspace.yaml` lists
// `packages/*` and the scaffold sits one level below `packages/cli`), so
// `pnpm run build` never reaches it, and it cannot compile where it stands: its
// `package.json` carries `{{version:ttsc}}`-style template tokens instead of
// versions. Every generated project inherits that whole compiled surface
// verbatim, so an unpaid citation or an unhandled union member there is red on
// a user's first compile while this repository stays green.
//
// The gate therefore renders a disposable probe project from those inherited
// inputs and runs the scaffold's own `npm run lint:source` over it, which is
// `ttsc --noEmit -p tsconfig.json`.
//
// It compiles what that script compiles, which is the scaffold's whole
// `include` and not a chosen part of it. Compiling only `src` and
// `lint.config.ts`, which is what this gate did when it landed, left
// `viewer/src` and `scripts` outside: `viewer/src/subject.ts` failed
// `typescript/switch-exhaustiveness-check`, the rule the scaffold's own config
// calls the load-bearing one, and every generated project died on its first
// `npm run lint` while this gate reported a clean scaffold (3d004b41).
//
// Three properties make it a gate rather than a number:
//
//   - It classifies rather than totals. `@ttsc/lint` prefixes each diagnostic
//     with its rule id, so the evidence graph and the correctness rules are
//     separable from each other and from what a probe that installs nothing
//     cannot resolve. Failing on the total would leave the gate red forever;
//     ignoring the total would leave it blind.
//   - It resolves what a generated project installs. The rules the scaffold
//     leans on are type-aware, and an import that resolves to `any` silences
//     them; measured here, a switch missing thirteen members of a union drew
//     nothing at all until the probe could see the union. So the probe points
//     at the workspace's own installations and at the built `@automovie/*`
//     declarations, which is what `npm install` puts in a generated project.
//   - It carries its own negative twins, in every run rather than in the one
//     that built it. `ttsc` reports no lint diagnostic when the project does not
//     declare the plugins as dependencies, and none when the lint config fails
//     to evaluate; both were observed while this gate was built, and the symptom
//     of each is an empty diagnostic set that reads exactly like a clean
//     project. So every run plants one defect per axis and requires the owning
//     rule to reject it by name. When the instrument is not running a canary
//     goes missing and the gate fails as broken rather than passing as clean.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
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

/** The scaffold's own compiler project, which decides what the probe compiles. */
const TSCONFIG = JSON.parse(
  fs.readFileSync(path.join(SCAFFOLD, "tsconfig.json"), "utf8"),
);

/**
 * The inherited inputs the probe compiles, copied verbatim except as noted.
 *
 * The list is derived from the scaffold's own `include` rather than written
 * down here, because a hand-written list is exactly how this gate came to miss
 * the file that killed a generated project: it named `src` and `lint.config.ts`
 * while `npm run lint:source` compiles `viewer/src`, `scripts`, `test` and the
 * two root configs as well, so `viewer/src/subject.ts` failed
 * `typescript/switch-exhaustiveness-check` on a user's first `npm run lint`
 * while this gate stayed green. `docs` is added because it hosts no compiled
 * file and every evidence reference the graph resolves.
 */
const INHERITED = ["docs", ...TSCONFIG.include];

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
 * The two canaries, one per axis this gate reports on.
 *
 * Each is a defect planted every run whose rejection is what licenses that
 * axis's clean result. An axis with no canary cannot tell a clean scaffold from
 * an instrument that stopped running, and both of the ways this instrument
 * stops were observed while it was built: `ttsc` reports no lint diagnostic at
 * all when the project does not declare the plugins as dependencies, and none
 * when `lint.config.ts` fails to evaluate. The symptom of each is an empty
 * diagnostic set that reads exactly like a paid graph and clean source.
 *
 * The evidence canary is an exported class citing nothing, planted under a
 * population the scaffold's class-grain claim selects (`src/world/*.ts`), which
 * is exactly what that claim refuses.
 *
 * The correctness canary answers the same question for the type-aware half, and
 * it is deliberately not a syntactic defect. `no-debugger` would fire off the
 * parse tree alone and would therefore stay green in a probe whose imports all
 * resolve to `any`, which is the state this gate compiled in until it started
 * resolving modules. So the canary is a switch over `AutoMovieViewerSubjectKind`
 * imported from `@automovie/viewer` that names one member of fourteen: the same
 * rule, on the same union, in the same directory as the defect that killed a
 * generated project's first `npm run lint`. It can only be rejected if the
 * newly covered `viewer/src` is compiled, if lint runs, and if a cross-package
 * union resolved to something enumerable rather than to `any`.
 *
 * Both names are ones no authoring pass would choose, so neither can collide
 * with real production source.
 */
const CANARIES = [
  {
    axis: "evidence",
    file: path.join("src", "world", "__evidenceGateCanary.ts"),
    rule: "evidence/graph",
    source: `/** A class the gate plants so the graph has something to reject. */
export class __EvidenceGateCanary {
  /** Present so the class carries a member. */
  public readonly planted: boolean = true;
}
`,
  },
  {
    axis: "correctness",
    file: path.join("viewer", "src", "__lintGateCanary.ts"),
    rule: "typescript/switch-exhaustiveness-check",
    source: `import type { AutoMovieViewerSubjectKind } from "@automovie/viewer";

/**
 * A switch the gate plants so the type-aware rules have something to reject.
 *
 * It names one member of a union of fourteen, so it is rejected only where the
 * union resolved to its members rather than to \`any\`.
 */
export const __lintGateCanary = (kind: AutoMovieViewerSubjectKind): string => {
  switch (kind) {
    case "instance":
      return "instance";
  }
  return "";
};
`,
  },
];

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
 * the list; they carry no diagnostic identity and are dropped rather than
 * counted into any of the three populations.
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

/** The rule id a lint diagnostic names in its own prefix. */
const ruleOf = (diagnostic) =>
  /^\[(?<rule>[^\]]+)\]/u.exec(diagnostic.message)?.groups.rule;

/** The scaffold's own manifest, which every generated project installs from. */
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(SCAFFOLD, "package.json"), "utf8"),
);

/** Everything that manifest tells `npm install` to fetch. */
const DECLARED = new Set([
  ...Object.keys(MANIFEST.dependencies),
  ...Object.keys(MANIFEST.devDependencies),
]);

/** The package a module specifier names, scope and subpath accounted for. */
const packageOf = (specifier) =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/");

/**
 * Whether a diagnostic is the probe reporting that it installed nothing.
 *
 * The probe resolves through the repository's own `node_modules` instead of an
 * install of its own, and a few packages the scaffold declares are not present
 * anywhere in this workspace to be reached that way. Those unresolved imports
 * say nothing about the scaffold: a generated project runs `npm install` and
 * resolves them. Gating on them would leave the gate red forever, and gating on
 * a diagnostic total would leave it choosing between that and blindness.
 *
 * The split is not the code alone. `Cannot find module 'x'` is a probe artifact
 * when the scaffold declares `x` and a real defect when it does not, because an
 * import of something no manifest asks for fails in a generated project exactly
 * as it fails here. So the module is read out of the message and checked
 * against the scaffold's own manifest, and only a declared one is excused.
 *
 * The uninstalled population shrank from 53 to 4 when the probe started
 * resolving modules, and the 15 `TS7006` implicit-`any` parameters in the old
 * count went with it: they were callbacks on values whose package was missing,
 * not code the scaffold owes anyone. Nothing is excused by code any more.
 */
const isUninstalled = (diagnostic) => {
  if (diagnostic.code !== "TS2307") return false;
  const module = /Cannot find module '(?<module>[^']+)'/u.exec(
    diagnostic.message,
  )?.groups.module;
  return module !== undefined && DECLARED.has(packageOf(module));
};

/**
 * Which of the three populations a diagnostic belongs to.
 *
 * `@ttsc/lint` reports every rule under one compiler code and names the rule in
 * a `[evidence/graph]` prefix, so the compiler code cannot make the split
 * between the two lint axes. The prefix can: a new evidence rule lands on the
 * evidence axis and a new correctness rule on the correctness axis, without
 * either being enumerated here.
 *
 * A compiler error that is not the probe's own missing install is correctness,
 * because `npm run lint:source` is `ttsc --noEmit` and fails on it too.
 */
const axisOf = (diagnostic) => {
  const rule = ruleOf(diagnostic);
  if (rule !== undefined)
    return rule.startsWith("evidence/") ? "evidence" : "correctness";
  return isUninstalled(diagnostic) ? "uninstalled" : "correctness";
};

/** A path in the form a `tsconfig.json` reads on either platform. */
const posix = (absolute) => absolute.split(path.sep).join("/");

/**
 * Every `node_modules` pnpm wrote here, in a fixed order, root last.
 *
 * pnpm hoists nothing to the repository root but the root project's own
 * dependencies, so `three`, `@types/three`, `playwright` and the rest sit in
 * the `node_modules` of whichever workspace project declares them. The list is
 * discovered rather than enumerated because a hand-written module list is the
 * thing that rots at the next dependency change, and it is sorted because a
 * gate that resolves a duplicated package differently per directory listing is
 * a gate that reports different things on different machines.
 */
const installations = () =>
  [
    ...fs
      .readdirSync(path.join(ROOT, "packages"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .map((name) => path.join(ROOT, "packages", name, "node_modules")),
    path.join(ROOT, "test", "node_modules"),
    path.join(ROOT, "node_modules"),
  ].filter((directory) => fs.existsSync(directory));

/**
 * Where the probe finds ambient type packages.
 *
 * `@types/node`, `@types/three` and `@types/pngjs` are all declared by the
 * scaffold and none of them is hoisted to the repository root, so the probe
 * points at wherever pnpm actually placed each instead of at a version-stamped
 * path written down by hand. Naming only `@types/node`, which this gate did
 * while it compiled `src` alone, leaves `three` untyped the moment `viewer/src`
 * is compiled: the import then resolves to a `.cjs` with no declaration file,
 * which is TS7016 noise in place of the typed union the load-bearing rules
 * read.
 */
const typeRoots = () =>
  installations()
    .map((directory) => path.join(directory, "@types"))
    .filter((directory) => fs.existsSync(directory))
    .map(posix);

/**
 * Where the probe resolves the modules the scaffold imports.
 *
 * A generated project installs `three`, `@automovie/*`, `playwright` and the
 * rest for real, and the rules the scaffold calls load-bearing are type-aware:
 * `typescript/switch-exhaustiveness-check` sees a union it can enumerate or it
 * sees `any` and says nothing. Measured on this probe: with `@automovie/viewer`
 * unresolved, a switch missing thirteen members of `AutoMovieViewerSubjectKind`
 * draws no diagnostic at all. So a probe that resolves nothing does not merely
 * carry noise, it silently stops being able to observe the defect class that
 * motivated widening it, and would report a clean run over the very file that
 * killed a generated project.
 *
 * pnpm links workspace packages into their dependents' `node_modules`, so this
 * list resolves `@automovie/*` through the same symlinks the scaffold's own
 * dependants use, and reaches the third-party packages that are installed
 * beside them. It is discovered rather than enumerated because a hand-written
 * module list is the thing that rots at the next dependency change.
 */
const modulePaths = () => ({
  // `@automovie/*` is pinned to the built declarations on purpose, which is
  // what `npm install` puts in a generated project. Left to the fallback below
  // it resolves through pnpm's workspace links to `packages/*/src/index.ts`,
  // because the published entry points live under `publishConfig` and the
  // in-repo `exports` field points at source. That drags the repository's own
  // TypeScript into the probe's program, where it is neither the scaffold's
  // code nor covered by `skipLibCheck`, and the gate starts reporting the
  // repository to the author of a generated project.
  "@automovie/*": [
    posix(path.join(ROOT, "packages", "*", "lib", "index.d.ts")),
  ],
  // `@types` comes first because a bare `three` otherwise resolves to the
  // runtime `three.cjs`, which TypeScript accepts as the resolution and then
  // reports as untyped (TS7016). A real install finds `@types/three` by walking
  // `node_modules` up from the importing file, which a probe outside any
  // install cannot do, so the ordering here is what stands in for that walk.
  // The scaffold declares `@types/three`, `@types/pngjs` and `@types/node`
  // itself, so these are the type sources a generated project uses too.
  "*": [
    ...installations().map((directory) => `${posix(directory)}/@types/*`),
    ...installations().map((directory) => `${posix(directory)}/*`),
  ],
});

/**
 * Copy one inherited input, whether it is a file or a directory.
 *
 * The scaffold's `include` is a list of plain paths today, and this refuses a
 * glob rather than failing at `cpSync` with an unexplained `ENOENT` if that
 * ever changes.
 */
const inherit = (relative) => {
  if (/[*?]/u.test(relative) === true)
    throw new Error(
      `packages/cli/scaffold/tsconfig.json now includes the pattern ${JSON.stringify(relative)}; teach the probe to expand it before it can compile what the scaffold compiles.`,
    );
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
  // A generated project installs published `@automovie/*` packages, so the
  // probe reads their built declarations. Saying so here turns the confusing
  // failure that follows an unbuilt tree, a canary that draws nothing because
  // its union resolved to `any`, into the one instruction that fixes it.
  const unbuilt = [...DECLARED]
    .filter((name) => name.startsWith("@automovie/"))
    .filter(
      (name) =>
        fs.existsSync(
          path.join(
            ROOT,
            "packages",
            name.slice("@automovie/".length),
            "lib",
            "index.d.ts",
          ),
        ) === false,
    );
  if (unbuilt.length !== 0)
    throw new Error(
      `${unbuilt.join(", ")} carry no built lib/index.d.ts, so the probe cannot resolve what a generated project installs. Run \`pnpm run build\` first.`,
    );

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
        // The scaffold's own compiler options, verbatim, because `npm run
        // lint:source` is `ttsc --noEmit -p tsconfig.json` against exactly
        // these. Only what the probe's location makes necessary is added:
        // `typeRoots` because `@types/node` is not hoisted here, and `paths`
        // because the probe installs nothing.
        compilerOptions: {
          ...TSCONFIG.compilerOptions,
          typeRoots: typeRoots(),
          // No `baseUrl`: this TypeScript removed the option (TS5102), and
          // every path below is absolute, so none is needed.
          paths: modulePaths(),
        },
        include: TSCONFIG.include,
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
  const planted = CANARIES.map((canary) => ({
    ...canary,
    path: canary.file.split(path.sep).join("/"),
  }));
  for (const canary of planted) {
    const target = path.join(PROBE, canary.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, canary.source, "utf8");
  }

  const started = Date.now();
  const run = compile();
  const elapsed = Date.now() - started;
  const diagnostics = parse(run.output);
  const mentions = (diagnostic) =>
    planted.some((canary) => diagnostic.text.includes(canary.path));
  const of = (axis) =>
    diagnostics.filter((diagnostic) => axisOf(diagnostic) === axis);
  const evidence = of("evidence");
  const correctness = of("correctness");
  const uninstalled = of("uninstalled");
  const missing = planted.filter(
    (canary) =>
      diagnostics.some(
        (diagnostic) =>
          ruleOf(diagnostic) === canary.rule &&
          diagnostic.text.includes(canary.path),
      ) === false,
  );
  const owed = [...evidence, ...correctness].filter(
    (diagnostic) => mentions(diagnostic) === false,
  );

  report([
    "scaffold lint:source gate",
    `  probe:       ${PROBE}`,
    `  ttsc:        exit ${run.status ?? `signal ${run.signal}`}, ${elapsed}ms`,
    `  compiled:    ${TSCONFIG.include.join(", ")}`,
    `  diagnostics: ${evidence.length} evidence, ${correctness.length} correctness,` +
      ` ${uninstalled.length} uninstalled-probe noise`,
  ]);

  if (missing.length !== 0) {
    report([
      "",
      "FAIL: the instrument is not running. Each canary below is a defect this run",
      "      planted in the probe, and the rule that owes a diagnostic about it said",
      "      nothing, so this run proves nothing and a clean result from it would be",
      "      a lie. Read the probe's own output: a lint config that fails to",
      "      evaluate, a project that never loads the plugin, and a union that",
      "      resolved to `any` because its package was not found all look exactly",
      "      like this.",
      ...missing.map((canary) => `  ${canary.path} drew no ${canary.rule}`),
      ...run.output
        .split(/\r?\n/u)
        .slice(0, 40)
        .map((line) => `  | ${line}`),
    ]);
    process.exitCode = 1;
    return;
  }
  report(
    planted.map(
      (canary) => `  canary:      ${canary.axis} rejected by ${canary.rule}`,
    ),
  );

  if (owed.length !== 0) {
    report([
      "",
      "FAIL: packages/cli/scaffold owes the diagnostics below. Every project",
      "      generated from it inherits them, so this is red on an author's first",
      "      `npm run lint`.",
      ...owed.map((diagnostic) => `  ${diagnostic.text}`),
    ]);
    process.exitCode = 1;
    return;
  }
  report([
    "",
    "PASS: the scaffold's obligation graph is paid and its own lint rules hold over",
    "      everything `npm run lint:source` compiles, and the two canaries this same",
    "      run rejected are what say so. The noise count is what a probe that",
    "      installs nothing cannot resolve; it is reported, never gated.",
  ]);
};

main();
