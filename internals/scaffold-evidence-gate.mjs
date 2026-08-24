#!/usr/bin/env node
/**
 * Exercise the exact lint and evidence surface inherited by every generated
 * project. Blank, paid, underpaid, structural, and rule canaries distinguish a
 * genuinely clean scaffold from a graph or compiler that never ran.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAFFOLD = path.join(ROOT, "packages", "cli", "scaffold");

/**
 * The probe lives under the CLI package's ignored `.cache` for four reasons at
 * once: it is outside every workspace glob, local config imports remain outside
 * `node_modules` for the lint evaluator's dependency graph, Node resolves
 * through the adjacent CLI installation that carries the generated project's
 * compiler dependencies, and the evaluator can resolve that installation's
 * `@types/node` while compiling the complete project declaration. It is deliberately not
 * under `experimental/`, which holds credentialed sandboxes this gate must
 * never read, write, or name.
 */
const PROBE = path.join(
  ROOT,
  "packages",
  "cli",
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
 * The evidence canary is an exported property citing nothing, planted under
 * the graph's reserved test-only canary population. It stays independent of a
 * production kind or stage, so proving the lint instrument never requires the
 * blank scaffold to pretend that authored production content exists.
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
    file: path.join("test", "__evidenceGraphCanary.ts"),
    rule: "evidence/graph",
    source: `/** A property the gate plants so the graph has something to reject. */
export const __evidenceGraphCanary = true; `,
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
export const __lintGateCanary = (kind: AutoMovieViewerSubjectKind): string => { switch (kind) { case "instance": return "instance"; } return ""; }; `,
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
 * a location-prefixed line for a compiler diagnostic, and a bare `error TS1234:`
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
 *
 */
const modulePaths = () => ({
  "@automovie/*": [
    posix(path.join(ROOT, "packages", "*", "lib", "index.d.ts")),
  ],
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
 * The manifest declares `@ttsc/lint`, `@automovie/evidence`, and `@types/node`
 * because `ttsc` decides whether to lint at all from the project's declared
 * dependencies, the lint config imports the reusable graph package, and its
 * explicit Node type reference must resolve while the isolated evaluator checks
 * both `import.meta.dirname` and that package's Node-backed implementation. The
 * real scaffold declares all three. The canary pass proves the two runtime
 * declarations took effect, while the paid pass exercises the type declaration.
 *
 */
const render = () => {
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

  fs.writeFileSync(
    path.join(PROBE, "package.json"),
    `${JSON.stringify(
      {
        name: "automovie-scaffold-evidence-probe",
        private: true,
        type: "module",
        version: "0.0.0",
        devDependencies: {
          "@automovie/evidence": "*",
          "@ttsc/lint": "*",
          "@types/node": "*",
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
          ...TSCONFIG.compilerOptions,
          typeRoots: typeRoots(),
          paths: modulePaths(),
        },
        include: TSCONFIG.include,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(PROBE, "test-tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          ...TSCONFIG.compilerOptions,
          typeRoots: typeRoots(),
          paths: modulePaths(),
        },
        files: ["lint.config.ts", "test/scaffold.test.ts"],
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

/** Every explicit H2 address in one shared Markdown contract. */
const contractAnchors = (relative) =>
  [
    ...fs
      .readFileSync(path.join(PROBE, "docs", relative), "utf8")
      .matchAll(/^## .+ \{#(?<anchor>[^}]+)\}$/gmu),
  ].map((match) => `${relative}#${match.groups.anchor}`);

/**
 * Turn the disposable probe into the smallest structurally complete active
 * library-settings population.
 *
 * This is deliberately generated after the blank-scaffold pass. The public
 * scaffold must contain no production prose or evidence tags, but inspecting
 * config structure alone cannot prove that its real shared claims accept a
 * paid population. Seven independent H2 owners cover the seven distributed
 * settings roles; each H2 pays every per-unit common obligation, while the
 * population pays every discovery target and the file pays every file-level
 * common and settings principle.
 */
const activatePaidSettings = () => {
  const configFile = path.join(PROBE, "lint.config.ts");
  const config = fs.readFileSync(configFile, "utf8");
  const selector = '  kind: null,\n  settings: "disabled",';
  if (config.split(selector).length !== 2)
    throw new Error(
      "The scaffold graph selector changed; update the active settings probe before trusting this gate.",
    );
  fs.writeFileSync(
    configFile,
    config.replace(selector, '  kind: "library",\n  settings: "evidence",'),
    "utf8",
  );

  const principleTargets = [
    ...contractAnchors("principles/common.md"),
    ...contractAnchors("principles/settings.md"),
  ];
  const commonTargets = contractAnchors("obligations/common.md");
  const fileReasons = Object.freeze({
    "principles/common.md#purpose-fit":
      "This file exists only to prove that the active settings graph accepts a fully paid disposable population and rejects a missing relationship.",
    "principles/common.md#layer-boundary":
      "Every H2 states a compiler-calibration setting; none authors design, narrative, source implementation, or audience content.",
    "principles/common.md#declared-basis":
      "The preamble and every status line declare these facts as disposable production inventions rather than external claims.",
    "principles/common.md#production-language":
      "The complete file uses one consistent English calibration vocabulary for its repository-gate reader.",
    "principles/settings.md#addressable-canon":
      "Delivery, aim, access, convention, review condition, and domain coverage each have one independently addressable H2 owner.",
    "principles/settings.md#information-structure":
      "Each H2 opens with status and one bounded statement of its owner, condition, and compiler consequence.",
    "principles/settings.md#fact-status":
      "Every H2 explicitly labels its calibration fact as a production invention scoped to this disposable probe.",
    "principles/settings.md#source-support":
      "The file makes no externally checkable production claim and attaches no external authority to its invented calibration facts.",
    "principles/settings.md#capability-boundary":
      "The delivery scope explicitly excludes any subject or environment capability, leaving none for downstream source to guess.",
    "principles/settings.md#constraint-sufficiency":
      "The seven owners bound the operator, observable diagnostic result, path and time units, operative subjects, and every excluded production domain.",
    "principles/settings.md#observable-identity":
      "The file defines no subject, place, or audible identity and confines its only observable result to classified compiler diagnostics.",
    "principles/settings.md#minimal-departure":
      "Only calibration-specific departures are authored; all unrelated production domains are explicitly outside this disposable delivery.",
    "principles/settings.md#internal-coherence":
      "The declared repository-relative paths, millisecond time, sole operator, and diagnostic review condition describe one compatible result.",
  });
  const commonReason = (target, unit) => {
    const anchor = target.slice(target.indexOf("#") + 1);
    if (anchor === "scope-preservation")
      return `${unit.title} owns its one named settings role and leaves no promised descendant or delivery fact inside that role unassigned.`;
    if (anchor === "substantive-completion")
      return `${unit.title} states the complete calibration decision needed from this settings role rather than a placeholder for downstream work.`;
    if (anchor === "proportionate-development")
      return `${unit.title} receives one bounded H2 because its role is independently cited, while no subordinate production detail is invented.`;
    if (anchor === "evidence-content-conformance")
      return `${unit.title} cites only the file rules and distributed settings role that its stated calibration fact actually realizes.`;
    throw new Error(`No paid-probe reason owns ${target}.`);
  };
  const discoveryExclusions = Object.freeze({
    "discovery/common.md#shared-local-boundary":
      "The probe examined its compiler-calibration directive, library promise, repository-gate operator, shared contracts, dependencies, and false-green risk; the shared principles and settings obligations fully own them, so no independent cross-layer condition remains.",
    "discovery/common.md#canonical-realization":
      "The complete boundary search retained no independent production contract, so the seven settings owners and their shared claim wiring are sufficient and no additional semantic owner or additive claim exists.",
    "discovery/settings.md#directive-promise-subject-requirements":
      "The probe examined its direct calibration instruction, diagnostic promise, operator, file dependency, unowned-subject risk, and false-green failure; the seven settings owners classify them completely without an additional production-specific fact or constraint.",
    "discovery/settings.md#planned-delivery-backcast":
      "Backcasting this settings-only library through its sole planned compiler-diagnostic consumer found no downstream fact beyond the delivery, aim, access, unit, review, coverage, and operative-subject owners already present.",
  });
  const settingsUnits = [
    {
      anchor: "probe-delivery-scope",
      title: "Probe delivery scope",
      obligation: "obligations/settings.md#delivery-scope",
      body: "This disposable library delivers only a compiler calibration result: the active settings graph must accept this complete population and no production artifact is published.",
      discovery: [
        "discovery/common.md#shared-local-boundary",
        "discovery/common.md#canonical-realization",
      ],
    },
    {
      anchor: "probe-governing-aim",
      title: "Probe governing aim",
      obligation: "obligations/settings.md#governing-aim",
      body: "The governing aim is to distinguish a fully paid shared graph from a graph that silently stopped enforcing one configured relationship.",
    },
    {
      anchor: "probe-operator-access",
      title: "Probe operator access",
      obligation: "obligations/settings.md#audience-operator-access",
      body: "The repository gate is the sole operator and may observe only compiler exit status and classified diagnostics from this disposable directory.",
    },
    {
      anchor: "probe-coordinate-unit-convention",
      title: "Probe coordinate and unit convention",
      obligation: "obligations/settings.md#coordinate-unit-convention",
      body: "Paths are repository-relative POSIX strings, elapsed time is measured in milliseconds, and no spatial world is represented by this compiler-only probe.",
    },
    {
      anchor: "probe-delivery-review-condition",
      title: "Probe delivery review condition",
      obligation: "obligations/settings.md#delivery-review-condition",
      body: "The result is reviewable only when the paid population yields no evidence or correctness diagnostic other than declared uninstalled-probe noise.",
    },
    {
      anchor: "probe-settings-coverage-map",
      title: "Probe settings coverage map",
      obligation: "obligations/settings.md#settings-coverage-map",
      body: "Delivery, aim, operator access, coordinate convention, and review condition each have the separate owner above; every other production domain is outside this compiler calibration scope.",
      discovery: ["discovery/settings.md#planned-delivery-backcast"],
    },
    {
      anchor: "probe-operative-subject-inventory",
      title: "Probe operative subject inventory",
      obligation: "obligations/settings.md#operative-subject-inventory",
      body: "The repository gate is the only operative subject: it controls the compile, observes the diagnostic result, and has no independent person, collective, object, environmental agent, institution, subsystem, or affected population left unclassified.",
      discovery: [
        "discovery/settings.md#directive-promise-subject-requirements",
      ],
    },
  ];
  const fileEvidence = principleTargets.map((target) => {
    const reason = fileReasons[target];
    if (reason === undefined)
      throw new Error(`No paid-probe reason owns ${target}.`);
    return `@evidence ${target} ${reason}`;
  });
  const body = [
    "<!--",
    ...fileEvidence,
    "-->",
    "",
    "# Active settings graph probe",
    "",
    "Every fact below is a production invention valid only inside this disposable compiler calibration.",
    "",
    ...settingsUnits.flatMap((unit) => [
      `## ${unit.title} {#${unit.anchor}}`,
      "",
      "<!--",
      ...commonTargets.map(
        (target) => `@evidence ${target} ${commonReason(target, unit)}`,
      ),
      ...(unit.discovery ?? []).map((target) => {
        const reason = discoveryExclusions[target];
        if (reason === undefined)
          throw new Error(`No paid-probe discovery reason owns ${target}.`);
        return `@evidenceExclude ${target} ${reason}`;
      }),
      `@evidence ${unit.obligation} This unit is the population owner that directly states the named settings role.`,
      "-->",
      "",
      "**Status:** production invention, disposable compiler calibration.",
      "",
      unit.body,
      "",
    ]),
  ].join("\n");
  const target = path.join(PROBE, "docs", "settings", "production.md");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body, "utf8");
  return {
    file: target,
    missing: `@evidenceExclude discovery/common.md#shared-local-boundary ${discoveryExclusions["discovery/common.md#shared-local-boundary"]}`,
  };
};

/** Execute one graph test without loading lint plugins into its test program. */
const testGraph = ({ cwd, project, file }) => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "node_modules", "ttsc", "lib", "launcher", "ttsx.js"),
      "--project",
      project,
      "--cwd",
      cwd,
      "--no-plugins",
      file,
    ],
    { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
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
    ` probe: ${PROBE}`,
    ` ttsc: exit ${run.status ?? `signal ${run.signal}`}, ${elapsed}ms`,
    ` compiled: ${TSCONFIG.include.join(", ")}`,
    ` diagnostics: ${evidence.length} evidence, ${correctness.length} correctness,` +
      ` ${uninstalled.length} uninstalled-probe noise`,
  ]);

  if (missing.length !== 0) {
    report([
      "",
      "FAIL: the instrument is not running. Each canary below is a defect this run",
      " planted in the probe, and the rule that owes a diagnostic about it said",
      " nothing, so this run proves nothing and a clean result from it would be",
      " a lie. Read the probe's own output: a lint config that fails to",
      " evaluate, a project that never loads the plugin, and a union that",
      " resolved to `any` because its package was not found all look exactly",
      " like this.",
      ...missing.map((canary) => ` ${canary.path} drew no ${canary.rule}`),
      ...run.output
        .split(/\r?\n/u)
        .slice(0, 40)
        .map((line) => ` | ${line}`),
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
      " generated from it inherits them, so this is red on an author's first",
      " `npm run lint`.",
      ...owed.map((diagnostic) => ` ${diagnostic.text}`),
    ]);
    process.exitCode = 1;
    return;
  }
  for (const canary of planted)
    fs.rmSync(path.join(PROBE, canary.file), { force: true });
  const packageGraphTests = testGraph({
    cwd: ROOT,
    project: "packages/evidence/tsconfig.test.json",
    file: "packages/evidence/test/createAutoMovieEvidenceConfig.test.ts",
  });
  if (packageGraphTests.status !== 0) {
    report([
      "",
      "FAIL: the reusable evidence package's structural graph canaries failed.",
      ...packageGraphTests.output.split(/\r?\n/u).map((line) => ` | ${line}`),
    ]);
    process.exitCode = 1;
    return;
  }
  report([" graph tests: reusable package canaries passed"]);

  const scaffoldGraphTests = testGraph({
    cwd: PROBE,
    project: "test-tsconfig.json",
    file: "test/scaffold.test.ts",
  });
  if (scaffoldGraphTests.status !== 0) {
    report([
      "",
      "FAIL: the generated scaffold's graph consumer canary failed.",
      ...scaffoldGraphTests.output.split(/\r?\n/u).map((line) => ` | ${line}`),
    ]);
    process.exitCode = 1;
    return;
  }
  report([" graph tests: generated-project consumer passed"]);

  const active = activatePaidSettings();
  const paidRun = compile();
  const paidDiagnostics = parse(paidRun.output);
  const paidOwed = paidDiagnostics.filter(
    (diagnostic) => axisOf(diagnostic) !== "uninstalled",
  );
  if (paidOwed.length !== 0) {
    report([
      "",
      "FAIL: the real active settings graph rejected its completely paid",
      " disposable population. Structural inspection is not a substitute for",
      " executing the shared claims an author will activate.",
      ...paidOwed.map((diagnostic) => ` ${diagnostic.text}`),
    ]);
    process.exitCode = 1;
    return;
  }
  report([" active graph: paid settings population passed"]);

  const paidSource = fs.readFileSync(active.file, "utf8");
  if (paidSource.split(active.missing).length !== 2)
    throw new Error(
      "The paid settings probe no longer has exactly one selected evidence-content-conformance answer.",
    );
  fs.writeFileSync(active.file, paidSource.replace(active.missing, ""), "utf8");
  const underpaidRun = compile();
  const underpaidDiagnostics = parse(underpaidRun.output);
  const underpaidEvidence = underpaidDiagnostics.filter(
    (diagnostic) => axisOf(diagnostic) === "evidence",
  );
  const underpaidCorrectness = underpaidDiagnostics.filter(
    (diagnostic) => axisOf(diagnostic) === "correctness",
  );
  const expectedUnderpayment = underpaidEvidence.filter((diagnostic) =>
    diagnostic.text.includes("discovery/common.md#shared-local-boundary"),
  );
  if (
    underpaidEvidence.length !== 1 ||
    expectedUnderpayment.length !== 1 ||
    underpaidCorrectness.length !== 0
  ) {
    report([
      "",
      "FAIL: removing one required discovery acknowledgement did not produce",
      " an isolated evidence diagnostic. The shared claim's negative edge is",
      " therefore unproved.",
      ...underpaidDiagnostics.map((diagnostic) => ` ${diagnostic.text}`),
    ]);
    process.exitCode = 1;
    return;
  }
  report([
    " active graph: one removed discovery acknowledgement was rejected by evidence/graph",
  ]);
  report([
    "",
    "PASS: the scaffold's obligation graph is paid and its own lint rules hold over",
    " everything `npm run lint:source` compiles. The two blank-scaffold",
    " canaries and the paid/underpaid active settings twins prove both lint",
    " axes and both directions of the real shared graph. The noise count is",
    " what a probe that installs nothing cannot resolve; it is reported,",
    " never gated.",
  ]);
};

main();
