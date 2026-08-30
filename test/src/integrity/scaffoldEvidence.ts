/**
 * Exercise the exact lint and evidence surface inherited by every generated
 * project. Blank, paid, underpaid, structural, and rule canaries distinguish a
 * genuinely clean scaffold from a graph or compiler that never ran.
 */
import { renderScaffold } from "@automovie/template";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface IDiagnostic {
  code: string;
  message: string;
  text: string;
}

type DiagnosticAxis = "correctness" | "evidence" | "uninstalled";

interface ISettingsUnit {
  anchor: string;
  title: string;
  obligations: string[];
  body: string;
}

interface IUnderpayment {
  file: string;
  line: string;
  target: string;
}

interface ICanary {
  axis: "correctness" | "evidence";
  file: string;
  rule: string;
  source: string;
}

interface IPlantedCanary extends ICanary {
  path: string;
}

interface IProcessResult {
  output: string;
  status: number;
}

interface ISpawnOutcome {
  error?: Error;
  stdout?: string | null;
  stderr?: string | null;
  signal: NodeJS.Signals | null;
  status: number | null;
}

const processResult = (result: ISpawnOutcome): IProcessResult => {
  if (result.error !== undefined) throw result.error;
  if (result.status === null)
    throw new Error(
      `child process did not return an exit status (signal ${String(result.signal)})`,
    );
  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    status: result.status,
  };
};

const ROOT = path.resolve(__dirname, "../../..");
const SCAFFOLD = path.join(ROOT, "packages", "template", "scaffold");

/**
 * The probe lives under the repository's already ignored `node_modules/.cache`
 * with a per-process name. It is outside every workspace glob and never changes
 * tracked scaffold bytes, while its own `node_modules` can still present the
 * generated consumer's publish-view dependencies. It is deliberately not under
 * `experimental/`, which holds credentialed sandboxes this gate must never read,
 * write, or name.
 */
const PROBE = path.join(
  ROOT,
  "node_modules",
  ".cache",
  `automovie-scaffold-evidence-gate-${process.pid}`,
);

/** The scaffold's own compiler project, which decides what the probe compiles. */
const TSCONFIG = JSON.parse(
  fs.readFileSync(path.join(SCAFFOLD, "tsconfig.json"), "utf8"),
) as {
  compilerOptions: Record<string, unknown>;
  include: string[];
};

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
 * file and every evidence reference the graph resolves. `AGENTS.md` is added
 * because it is the generated author's entry contract and must be inspected by
 * the consumer canary even though TypeScript does not compile it.
 */
const INHERITED = [
  ".agents",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "docs",
  ...TSCONFIG.include,
];

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
const CANARIES: ICanary[] = [
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
 * What the probe compiles: everything the scaffold compiles, plus the directory
 * of any canary this gate plants that the scaffold's own project does not
 * already cover.
 *
 * The two lists are deliberately different, and collapsing them is what broke
 * this gate. The scaffold's `include` is the generated project's own contract,
 * so it may only name directories the scaffold actually ships; it stopped
 * naming `test` when the scaffold stopped shipping one. The evidence canary
 * still has to sit at the exact path the reserved claim selects,
 * `test/__evidenceGraphCanary.ts`, because a claim whose file selector matches
 * nothing is dropped before its references are read. A planted canary the
 * project never compiles therefore draws no diagnostic, which this gate reads,
 * correctly, as the instrument having stopped.
 *
 * Deriving the difference from the canaries themselves keeps the probe
 * compiling every canary it plants without asking a generated project to
 * declare a directory it does not have, and without a second hand-written list
 * to fall out of step with the first.
 */
const PROBE_INCLUDE = [
  ...TSCONFIG.include,
  ...[
    ...new Set(
      CANARIES.map((canary) =>
        path.dirname(canary.file).split(path.sep).join("/"),
      ),
    ),
  ].filter((directory) => TSCONFIG.include.includes(directory) === false),
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
const parse = (output: string): IDiagnostic[] =>
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
            code: match.groups!.code!,
            message: match.groups!.message!,
            text: line,
          };
    })
    .filter(
      (diagnostic): diagnostic is IDiagnostic => diagnostic !== undefined,
    );

/** The rule id a lint diagnostic names in its own prefix. */
const ruleOf = (diagnostic: IDiagnostic): string | undefined =>
  /^\[(?<rule>[^\]]+)\]/u.exec(diagnostic.message)?.groups?.rule;

/** The scaffold's own manifest, which every generated project installs from. */
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(SCAFFOLD, "package.json"), "utf8"),
) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

/** Everything that manifest tells `npm install` to fetch. */
const DECLARED = new Set([
  ...Object.keys(MANIFEST.dependencies),
  ...Object.keys(MANIFEST.devDependencies),
]);

/** The package a module specifier names, scope and subpath accounted for. */
const packageOf = (specifier: string): string =>
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
const isUninstalled = (diagnostic: IDiagnostic): boolean => {
  if (diagnostic.code !== "TS2307") return false;
  const module = /Cannot find module '(?<module>[^']+)'/u.exec(
    diagnostic.message,
  )?.groups?.module;
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
const axisOf = (diagnostic: IDiagnostic): DiagnosticAxis => {
  const rule = ruleOf(diagnostic);
  if (rule !== undefined)
    return rule.startsWith("evidence/") ? "evidence" : "correctness";
  return isUninstalled(diagnostic) ? "uninstalled" : "correctness";
};

/** A path in the form a `tsconfig.json` reads on either platform. */
const posix = (absolute: string): string => absolute.split(path.sep).join("/");

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
      .sort((left, right) => left.localeCompare(right))
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
const inherit = (relative: string): void => {
  if (/[*?]/u.test(relative) === true)
    throw new Error(
      `packages/template/scaffold/tsconfig.json now includes the pattern ${JSON.stringify(relative)}; teach the probe to expand it before it can compile what the scaffold compiles.`,
    );
  const target = path.join(PROBE, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(SCAFFOLD, relative), target, { recursive: true });
};

const assertBuiltPackages = (unbuilt: readonly string[]): void => {
  if (unbuilt.length !== 0)
    throw new Error(
      `${unbuilt.join(", ")} carry no built lib/index.d.ts, so the probe cannot resolve what a generated project installs. Run \`pnpm run build\` first.`,
    );
};

/**
 * Render the probe from the scaffold.
 *
 * The manifest declares `@ttsc/lint`, `@automovie/evidence`, and `@types/node`
 * because `ttsc` decides whether to lint at all from the project's declared
 * dependencies, the lint config imports the reusable graph package, and its
 * explicit Node type reference must resolve while the isolated evaluator checks
 * both the runtime-validated `import.meta.dirname` capability and that package's
 * Node-backed implementation. The real scaffold declares all three. The canary
 * pass proves the two runtime declarations took effect, while the paid pass
 * exercises the type declaration.
 *
 */
const render = (): void => {
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
  assertBuiltPackages(unbuilt);

  fs.rmSync(PROBE, { force: true, recursive: true });
  fs.mkdirSync(PROBE, { recursive: true });
  for (const relative of INHERITED) inherit(relative);

  // The typed lint configuration executes through the same evaluator as an
  // installed production. Give it the evidence package's publish view instead
  // of the workspace package whose development exports point at TypeScript.
  const linkedEvidence = path.join(
    PROBE,
    "node_modules",
    "@automovie",
    "evidence",
  );
  fs.mkdirSync(linkedEvidence, { recursive: true });
  fs.cpSync(
    path.join(ROOT, "packages", "evidence", "lib"),
    path.join(linkedEvidence, "lib"),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(linkedEvidence, "package.json"),
    `${JSON.stringify(
      {
        name: "@automovie/evidence",
        version: "0.0.0",
        main: "./lib/index.js",
        types: "./lib/index.d.ts",
        exports: {
          ".": {
            types: "./lib/index.d.ts",
            default: "./lib/index.js",
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const linkedTemplate = path.join(
    PROBE,
    "node_modules",
    "@automovie",
    "template",
  );
  fs.mkdirSync(linkedTemplate, { recursive: true });
  fs.cpSync(
    path.join(ROOT, "packages", "template", "lib"),
    path.join(linkedTemplate, "lib"),
    { recursive: true },
  );
  fs.cpSync(
    path.join(SCAFFOLD, ".agents"),
    path.join(linkedTemplate, "scaffold", ".agents"),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(linkedTemplate, "package.json"),
    `${JSON.stringify(
      {
        name: "@automovie/template",
        version: "0.0.0",
        main: "./lib/index.js",
        types: "./lib/index.d.ts",
        exports: {
          ".": {
            types: "./lib/index.d.ts",
            default: "./lib/index.js",
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  for (const dependency of ["@ttsc/evidence", "typescript-compiler"]) {
    const target = path.join(PROBE, "node_modules", dependency);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(
      path.join(ROOT, "node_modules", dependency),
      target,
      "junction",
    );
  }
  const nodeTypes = path.join(PROBE, "node_modules", "@types", "node");
  fs.mkdirSync(path.dirname(nodeTypes), { recursive: true });
  fs.symlinkSync(
    path.join(ROOT, "packages", "template", "node_modules", "@types", "node"),
    nodeTypes,
    "junction",
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
          "@automovie/evidence": "*",
          "@automovie/template": "*",
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
        include: PROBE_INCLUDE,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

/** Run `ttsc --noEmit` over the probe and return its status and output. */
const compile = (): IProcessResult => {
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
  return processResult(result);
};

/** Every explicit H2 address in one shared Markdown contract. */
const contractAnchors = (relative: string): string[] =>
  [
    ...fs
      .readFileSync(path.join(SCAFFOLD, "docs", relative), "utf8")
      .matchAll(/^## .+ \{#(?<anchor>[^}]+)\}$/gmu),
  ].map((match) => `${relative}#${match.groups!.anchor!}`);

const activeSettingsConfig = (config: string): string => {
  const kindSelector = "  kind: null,";
  const settingsSelector = '  settings: "disabled",';
  if (
    config.split(kindSelector).length !== 2 ||
    config.split(settingsSelector).length !== 2
  )
    throw new Error(
      "The scaffold graph selector changed; update the active settings probe before trusting this gate.",
    );
  return config
    .replace(kindSelector, '  kind: "library",')
    .replace(settingsSelector, '  settings: "evidence",');
};

const paidPrincipleReason = (target: string, unit: ISettingsUnit): string => {
  const anchor = target.slice(target.indexOf("#") + 1);
  if (anchor === "scope-preservation")
    return `${unit.title} owns its one named settings role and leaves no promised descendant or delivery fact inside that role unassigned.`;
  if (anchor === "substantive-completion")
    return `${unit.title} states the complete calibration decision needed from this settings role rather than a placeholder for downstream work.`;
  if (anchor === "machine-default")
    return `${unit.title} carries none of the marks: it states its calibration decision in plain declaratives with no restating closer, and its shape follows the information-structure rule this file cites rather than an untouched default.`;
  if (anchor === "evidence-content-conformance")
    return `${unit.title} cites only the unit principles and population roles that its concrete calibration statement actually realizes.`;
  if (anchor === "declared-basis")
    return `${unit.title} declares its statement as a local disposable calibration choice and derives no authority from an unstated external source.`;
  if (anchor === "information-structure")
    return `${unit.title} is one addressable H2 with an explicit status and one bounded settings decision.`;
  if (anchor === "fact-status")
    return `${unit.title} labels its fact as a production invention valid only in this disposable compiler probe.`;
  if (anchor === "source-support")
    return `${unit.title} makes no externally checkable claim and therefore needs no external source beyond its declared local calibration basis.`;
  if (anchor === "capability-boundary")
    return `${unit.title} confines its capability claim to the compiler calibration role stated in this H2 and invents no downstream production capability.`;
  if (anchor === "constraint-sufficiency")
    return `${unit.title} states the actor, condition, and observable compiler consequence needed to use this one settings decision without downstream guessing.`;
  if (anchor === "observable-identity")
    return `${unit.title} defines no delivered person, place, object, or sound; its only observable identity is the named compiler-calibration result.`;
  throw new Error(`No paid-probe reason owns ${target}.`);
};

const evidenceObligationLine = (target: string, unit: ISettingsUnit): string =>
  `@evidence ${target} ${unit.title} is the population owner that states this role concretely: ${unit.body}`;

const assertOwnedObligations = (
  targets: readonly string[],
  units: readonly ISettingsUnit[],
): void => {
  const owned = new Set(units.flatMap((unit) => unit.obligations));
  for (const target of targets)
    if (owned.has(target) === false)
      throw new Error(`No paid-probe H2 owns ${target}.`);
};

const obligationUnderpayment = (
  obligationTarget: string,
  units: readonly ISettingsUnit[],
  file: string,
): IUnderpayment => {
  const unit = units.find((candidate) =>
    candidate.obligations.includes(obligationTarget),
  );
  if (unit === undefined)
    throw new Error(`The paid probe lost its ${obligationTarget} owner.`);
  return {
    file,
    line: evidenceObligationLine(obligationTarget, unit),
    target: obligationTarget,
  };
};

/**
 * Turn the disposable probe into the smallest structurally complete active
 * library-settings population.
 *
 * This is deliberately generated after the blank-scaffold pass. The public
 * scaffold must contain no production-authored documents or evidence tags, but inspecting
 * config structure alone cannot prove that its real shared claims accept a
 * paid population. Sixteen independent primary H2 owners cover the sixteen settings
 * obligations, every H2 answers every common and settings principle for
 * itself, and the separate contract index carries the complete truthful
 * negative discovery audit. Settings has no inherited file relationship to
 * pay.
 */
const activatePaidSettings = (): { underpayments: IUnderpayment[] } => {
  const configFile = path.join(PROBE, "lint.config.ts");
  const config = fs.readFileSync(configFile, "utf8");
  fs.writeFileSync(configFile, activeSettingsConfig(config), "utf8");

  const principleTargets = [
    ...contractAnchors("principles/core/common.md"),
    ...contractAnchors("principles/core/settings.md"),
  ];
  const obligationTargets = [
    ...contractAnchors("obligations/core/common.md"),
    ...contractAnchors("obligations/core/settings.md"),
  ];
  const discoveryExclusions = Object.freeze({
    "discovery/core/common.md#shared-local-boundary":
      "The probe examined its compiler-calibration directive, library promise, repository-gate operator, shared contracts, dependencies, sole planned compiler-diagnostic consumer, and false-green risk; the shared principles and settings obligations fully own them, so no independent cross-layer condition remains.",
    "discovery/core/common.md#canonical-realization":
      "After examining the calibration directive, library promise, operator, dependencies, sole planned compiler-diagnostic consumer, and false-owner risk, the complete boundary search retained no independent production contract; the sixteen settings owners and shared claim wiring are sufficient, so no additional semantic owner or additive claim exists.",
    "discovery/core/settings.md#directive-promise-subject-requirements":
      "The probe examined its direct calibration instruction, diagnostic promise, operator, file dependency, sole planned compiler-diagnostic consumer, unowned-subject risk, and false-green failure; the sixteen settings owners classify them completely without an additional production-specific fact or constraint.",
    "discovery/core/settings.md#planned-delivery-backcast":
      "Backcasting this settings-only library from its calibration instruction and config through the sole planned compiler-diagnostic consumer and its downstream-invention and false-green risks found no fact beyond the delivery, aim, visual-grammar, fidelity, build-or-adopt, access, accessibility, unit, review, coverage, operative-subject, agency, design-condition, inherited-default, and coherence owners already present.",
  });
  const settingsUnits: ISettingsUnit[] = [
    {
      anchor: "probe-addressable-canon",
      title: "Probe addressable canon",
      obligations: [
        "obligations/core/settings.md#addressable-canon",
        "obligations/core/common.md#proportionate-development",
      ],
      body: "Sixteen independently addressable H2 owners divide the complete settings contract without a catch-all owner or a hidden descendant.",
    },
    {
      anchor: "probe-delivery-scope",
      title: "Probe delivery scope",
      obligations: [
        "obligations/core/settings.md#delivery-scope",
        "obligations/core/common.md#purpose-fit",
      ],
      body: "This disposable library delivers only a compiler calibration result: the active settings graph must accept this complete population and no production artifact is published.",
    },
    {
      anchor: "probe-governing-aim",
      title: "Probe governing aim",
      obligations: ["obligations/core/settings.md#governing-aim"],
      body: "The governing aim is to distinguish a fully paid shared graph from a graph that silently stopped enforcing one configured relationship.",
    },
    {
      anchor: "probe-production-visual-grammar",
      title: "Probe production visual grammar",
      obligations: ["obligations/core/settings.md#production-visual-grammar"],
      body: "This compiler calibration promises no visible surface, color, silhouette, material, spatial design, registered visual reference, or external rendition; that explicit absence is its complete production-wide visual boundary.",
    },
    {
      anchor: "probe-production-fidelity-tier",
      title: "Probe production fidelity tier",
      obligations: ["obligations/core/settings.md#production-fidelity-tier"],
      body: "The diagnostic-only tier supports exactly one inference: whether the configured evidence graph accepts or rejects the disposable calibration; it is neither a rendered prototype nor an audience image and authorizes no visual inference.",
    },
    {
      anchor: "probe-subject-breakdown-production-scope",
      title: "Probe subject breakdown and production scope",
      obligations: [
        "obligations/core/settings.md#subject-breakdown-production-scope",
      ],
      body: "The promised compiler result requires no map, model, space, material, instance, motion, system, external asset, or rendition to build, adopt, reuse, or derive; the generated lint configuration and this settings population are existing harness inputs rather than delivery assets.",
    },
    {
      anchor: "probe-operator-access",
      title: "Probe operator access",
      obligations: ["obligations/core/settings.md#audience-operator-access"],
      body: "The repository gate is the sole operator and may observe only compiler exit status and classified diagnostics from this disposable directory.",
    },
    {
      anchor: "probe-accessibility-deliverable-states",
      title: "Probe accessibility deliverable states",
      obligations: [
        "obligations/core/settings.md#accessibility-deliverable-states",
      ],
      body: "Operator-readable English text diagnostics are required and realized by compiler output; captions, subtitles, transcripts, audio description, media alternatives, and interactive controls are intentionally absent because this calibration has no timed media, audio, image, or user interface; the consequence is that the repository-gate operator receives no timed-text, synchronized transcript, described-media, media-alternative, or interactive accessibility surface, while no applicable accessibility product remains optional or silently unsupported.",
    },
    {
      anchor: "probe-coordinate-unit-convention",
      title: "Probe coordinate and unit convention",
      obligations: ["obligations/core/settings.md#coordinate-unit-convention"],
      body: "Paths are repository-relative POSIX strings, elapsed time is measured in milliseconds, and no spatial world is represented by this compiler-only probe.",
    },
    {
      anchor: "probe-delivery-review-condition",
      title: "Probe delivery review condition",
      obligations: ["obligations/core/settings.md#delivery-review-condition"],
      body: "The result is reviewable only when the paid population yields no evidence or correctness diagnostic other than declared uninstalled-probe noise.",
    },
    {
      anchor: "probe-settings-coverage-map",
      title: "Probe settings coverage map",
      obligations: [
        "obligations/core/settings.md#settings-coverage-map",
        "obligations/core/common.md#layer-boundary",
      ],
      body: "Open discovery of the compiler calibration's direct inputs and planned consumers requires its addressability, delivery, aim, visual grammar, fidelity tier, build-or-adopt scope, operator access, accessibility state, coordinate convention, review condition, coverage map, operative-subject inventory, agency, design-dependent subject condition, inherited-default boundary, and coherence owners. All sixteen are explicit canon in separate H2s, and no material settings requirement remains inherited, outside scope, or unresolved.",
    },
    {
      anchor: "probe-operative-subject-inventory",
      title: "Probe operative subject inventory",
      obligations: ["obligations/core/settings.md#operative-subject-inventory"],
      body: "The repository gate is the only operative subject: it controls the compile, observes the diagnostic result, and has no independent person, collective, object, environmental agent, institution, subsystem, or affected population left unclassified.",
    },
    {
      anchor: "probe-agency-and-limits",
      title: "Probe agency and limits",
      obligations: ["obligations/core/settings.md#agency-and-limits"],
      body: "The repository gate may start or decline the compile, read its exit status and classified diagnostics, and refuse a false green; once any owed diagnostic appears, the zero-owed-diagnostic threshold is crossed and it must block publication until the relationship is repaired and the compile reruns. It cannot alter contract inventory, suppress a configured relationship, or publish a successful result after that threshold. No physical, financial, or private cost is authored; the bounded operational cost is repair and rerun, and its vulnerability is a configured relationship being silently suppressed.",
    },
    {
      anchor: "probe-design-dependent-subject-conditions",
      title: "Probe design-dependent subject conditions",
      obligations: [
        "obligations/core/settings.md#design-dependent-subject-conditions",
      ],
      body: "No dimension, route, control geometry, view, interaction, or acceptance threshold in this compiler-only calibration depends on a bodily, sensory, equipment, load, assistance, or movement profile; operator text access remains separately owned by the access and accessibility-deliverable units.",
    },
    {
      anchor: "probe-minimal-departure",
      title: "Probe minimal departure",
      obligations: ["obligations/core/settings.md#minimal-departure"],
      body: "The production departs from shared defaults only by activating this disposable settings-only calibration; all design, narrative, source, render, and delivery content remains absent.",
    },
    {
      anchor: "probe-internal-coherence",
      title: "Probe internal coherence",
      obligations: [
        "obligations/core/settings.md#internal-coherence",
        "obligations/core/common.md#production-language",
      ],
      body: "Repository-relative POSIX paths, milliseconds, one repository-gate operator, compiler diagnostics, and consistent English calibration vocabulary form one compatible settings contract.",
    },
  ];
  assertOwnedObligations(obligationTargets, settingsUnits);
  const body = [
    "# Active settings graph probe",
    "",
    "Every fact below is a production invention valid only inside this disposable compiler calibration.",
    "",
    ...settingsUnits.flatMap((unit) => [
      `## ${unit.title} {#${unit.anchor}}`,
      "",
      "<!--",
      ...principleTargets.map(
        (target) => `@evidence ${target} ${paidPrincipleReason(target, unit)}`,
      ),
      ...unit.obligations.map((target) => evidenceObligationLine(target, unit)),
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
  const discoveryLines = Object.entries(discoveryExclusions).map(
    ([discoveryTarget, reason]) =>
      `@evidenceExclude ${discoveryTarget} ${reason}`,
  );
  const discoveryFile = path.join(PROBE, "docs", "contracts", "index.md");
  fs.mkdirSync(path.dirname(discoveryFile), { recursive: true });
  fs.writeFileSync(
    discoveryFile,
    [
      "<!--",
      ...discoveryLines,
      "-->",
      "",
      "# Work-specific contract audit",
      "",
      "This disposable compiler probe retained no independent production rule after the complete settings-layer discovery audit.",
      "",
    ].join("\n"),
    "utf8",
  );
  return {
    underpayments: [
      {
        file: discoveryFile,
        line: `@evidenceExclude discovery/core/common.md#shared-local-boundary ${discoveryExclusions["discovery/core/common.md#shared-local-boundary"]}`,
        target: "discovery/core/common.md#shared-local-boundary",
      },
      obligationUnderpayment(
        "obligations/core/settings.md#operative-subject-inventory",
        settingsUnits,
        target,
      ),
      obligationUnderpayment(
        "obligations/core/settings.md#design-dependent-subject-conditions",
        settingsUnits,
        target,
      ),
      obligationUnderpayment(
        "obligations/core/settings.md#production-visual-grammar",
        settingsUnits,
        target,
      ),
      obligationUnderpayment(
        "obligations/core/settings.md#accessibility-deliverable-states",
        settingsUnits,
        target,
      ),
    ],
  };
};

/** Execute one graph test without loading lint plugins into its test program. */
const testGraph = ({
  cwd,
  project,
  file,
  noCheck = false,
}: {
  cwd: string;
  project: string;
  file: string;
  noCheck?: boolean;
}): IProcessResult => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "node_modules", "ttsc", "lib", "launcher", "ttsx.js"),
      "--project",
      project,
      "--cwd",
      cwd,
      "--no-plugins",
      ...(noCheck ? ["--noCheck"] : []),
      file,
    ],
    { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return processResult(result);
};

const assertInstructionSync = (props: {
  result: IProcessResult;
  installedPackageDocs: boolean;
  localContractUnchanged: boolean;
}): void => {
  if (
    props.result.status !== 0 ||
    props.result.output.includes(
      "Synchronized 3 generated instruction path(s).",
    ) === false ||
    props.installedPackageDocs ||
    props.localContractUnchanged === false
  )
    throw new Error(
      [
        "The generated project's instruction sync did not preserve its local contract inventory without installed package docs.",
        props.result.output,
      ].join("\n"),
    );
};

/** Run the generated project's real sync command against a docs-free package. */
const testInstructionSync = (): void => {
  const localContract = path.join(
    PROBE,
    "docs",
    "principles",
    "design",
    "maps.md",
  );
  const before = fs.readFileSync(localContract, "utf8");
  const result = testGraph({
    cwd: PROBE,
    project: "tsconfig.json",
    file: "scripts/sync.ts",
    noCheck: true,
  });
  const installedDocs = path.join(
    PROBE,
    "node_modules",
    "@automovie",
    "template",
    "docs",
  );
  assertInstructionSync({
    result,
    installedPackageDocs: fs.existsSync(installedDocs),
    localContractUnchanged: fs.readFileSync(localContract, "utf8") === before,
  });
};

/**
 * The four authoring procedures a generated project is instructed to read.
 *
 * They are named here rather than discovered from the directory because the
 * claim is that exactly these four ship: a fifth appearing, or one silently
 * dropped, is the change this list is meant to report.
 */
const SHIPPED_SKILLS = [
  "evidence-graph",
  "production-lifecycle",
  "review-verification",
  "source-authoring",
] as const;

/**
 * Surfaces `#2150` retired, spelled as the shapes they would come back as.
 *
 * Each entry is a class rather than one filename, because what has to stay true
 * is that the class is absent. A provider hook returning under a different
 * directory name, a second graph declaration in another module format, or a
 * tool cache under a name nobody thought of would all satisfy a check written
 * against the exact three paths that were deleted.
 */
const RETIRED_SURFACES: readonly {
  readonly reason: string;
  readonly matches: (key: string) => boolean;
}[] = [
  {
    reason: "a provider-specific control plane under `.claude/`",
    matches: (key) => key === ".claude" || key.startsWith(".claude/"),
  },
  {
    reason: "a second graph declaration outside the typed `lint.config.ts`",
    matches: (key) =>
      /(?:^|\/)lint\.config\.(?!ts$)/u.test(key) ||
      /(?:^|\/)productionEvidence\./u.test(key),
  },
  {
    reason: "a tool cache the scaffold never authored",
    matches: (key) => key.split("/").slice(0, -1).includes(".cache"),
  },
  {
    reason: "compiler output emitted beside a source",
    matches: (key) =>
      /(?:\.(?:c|m)?js(?:\.map)?|\.d\.(?:c|m)?ts|\.tsbuildinfo)$/u.test(key),
  },
];

/** Reject any generated byte inventory that carries a retired surface. */
const assertRetiredSurfacesAbsent = (keys: readonly string[]): void => {
  const carried = RETIRED_SURFACES.flatMap((surface) =>
    keys.filter(surface.matches).map((key) => `${key} (${surface.reason})`),
  );
  if (carried.length !== 0)
    throw new Error(
      [
        "FAIL: the generated byte inventory carries a surface a generated project",
        " must not receive. Every project created from this scaffold installs it.",
        ...carried.map((entry) => ` ${entry}`),
      ].join("\n"),
    );
};

/** Reject a rendered inventory that changed while derived artifacts sat in the tree. */
const assertInventoryIgnoresArtifacts = (
  before: readonly string[],
  after: readonly string[],
): void => {
  const added = after.filter((key) => before.includes(key) === false);
  const lost = before.filter((key) => after.includes(key) === false);
  if (added.length === 0 && lost.length === 0) return;
  throw new Error(
    [
      "FAIL: derived artifacts sitting in the scaffold directory changed what a",
      " generated project receives. `git status` cannot report this, because the",
      " repository ignores exactly these paths, so the scaffolder is the only",
      " place it can be refused.",
      ...added.map((key) => ` shipped: ${key}`),
      ...lost.map((key) => ` lost: ${key}`),
    ].join("\n"),
  );
};

/**
 * Every explicit and slug anchor one Markdown body offers to a citing link.
 *
 * Both forms are collected because the scaffold's own documents use explicit
 * `{#anchor}` addresses while the generated router links plain headings, and a
 * checker that knew only one of them would report half the corpus as broken.
 */
const markdownAnchors = (body: string): Set<string> => {
  const anchors = new Set<string>();
  for (const match of body.matchAll(/^#{1,6} .*?\{#(?<anchor>[^}]+)\}\s*$/gmu))
    anchors.add(match.groups!.anchor!);
  for (const match of body.matchAll(/^#{1,6} +(?<title>.+?)\s*$/gmu))
    anchors.add(
      match
        .groups!.title!.replace(/\{#[^}]+\}/u, "")
        .trim()
        .toLowerCase()
        .replace(/[`*_]/gu, "")
        .replace(/[^a-z0-9 -]/gu, "")
        .trim()
        .replace(/ +/gu, "-"),
    );
  return anchors;
};

/** Resolve one relative link against the directory of the file that wrote it. */
const resolveLink = (from: string, target: string): string => {
  const segments = from.split("/").slice(0, -1);
  for (const segment of target.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/");
};

/**
 * Every relative link in the generated inventory resolves inside that inventory.
 *
 * The population is what a customer actually receives rather than what this
 * repository holds, which is the difference that matters: a skill linking a
 * sibling procedure resolves here because both are shipped, while a link
 * reaching a repository document a generated project never installs would
 * resolve when read from a checkout and dangle for every author. Anchors are
 * checked too, because an address that survives a rename but not a rewording is
 * the failure this corpus is most exposed to.
 */
const assertResolvableLinks = (
  files: Readonly<Record<string, string>>,
): number => {
  const keys = new Set(Object.keys(files));
  const broken: string[] = [];
  let checked = 0;
  for (const [key, body] of Object.entries(files)) {
    if (key.endsWith(".md") === false) continue;
    for (const match of body.matchAll(/\[[^\]]*\]\((?<target>[^)\s]+)\)/gu)) {
      const target = match.groups!.target!;
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/u.test(target)) continue;
      checked += 1;
      const hash = target.indexOf("#");
      const anchor = hash === -1 ? undefined : target.slice(hash + 1);
      const resolved = resolveLink(
        key,
        hash === -1 ? target : target.slice(0, hash),
      );
      if (keys.has(resolved) === false) {
        broken.push(`${key} -> ${target} (no ${resolved} is shipped)`);
        continue;
      }
      if (anchor === undefined || resolved.endsWith(".md") === false) continue;
      if (markdownAnchors(files[resolved]!).has(anchor) === false)
        broken.push(`${key} -> ${target} (no such anchor in ${resolved})`);
    }
  }
  if (broken.length !== 0)
    throw new Error(
      [
        "FAIL: the generated instruction corpus carries a link an author cannot",
        " follow. Every project created from this scaffold inherits it.",
        ...broken.map((entry) => ` ${entry}`),
      ].join("\n"),
    );
  if (checked === 0)
    throw new Error(
      [
        "FAIL: the link check selected no link at all, so its clean result is",
        " about nothing. An empty inventory, a corpus with no Markdown, and a",
        " match pattern that stopped matching all report exactly this, and all",
        " three read as a corpus whose every link resolves.",
      ].join("\n"),
    );
  return checked;
};

/**
 * What a generated project receives, and that no derived artifact rides along.
 *
 * The negative half plants the exact class that reached this tree four times in
 * one cycle: running the type-checker without `--noEmit` drops `.js`, `.js.map`
 * and `.d.ts` beside every source, and the repository ignores those paths under
 * the scaffold, so `git status` says nothing while the scaffolder reads them off
 * the disk. Measured before the filter existed, planting three such files took
 * the inventory from 244 keys to 247, which is emitted output installed into a
 * customer's project. The plant is removed in `finally` and carries a name no
 * author would choose, so a run that dies mid-probe leaves a file the next run's
 * positive half reports rather than one that hides.
 */
const testShippedInventory = (): void => {
  const rendered = renderScaffold({ name: "inventory-probe" });
  const before = Object.keys(rendered);
  assertRetiredSurfacesAbsent(before);
  const links = assertResolvableLinks(rendered);
  const cache = path.join(SCAFFOLD, ".cache", `inventory-${process.pid}`);
  const planted = [
    path.join(
      SCAFFOLD,
      "scripts",
      `__shippedInventoryCanary.${process.pid}.js`,
    ),
    path.join(
      SCAFFOLD,
      "scripts",
      `__shippedInventoryCanary.${process.pid}.d.ts`,
    ),
    path.join(cache, "canary.json"),
  ];
  try {
    for (const file of planted) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "0\n", "utf8");
    }
    assertInventoryIgnoresArtifacts(
      before,
      Object.keys(renderScaffold({ name: "inventory-probe" })),
    );
  } finally {
    for (const file of planted) fs.rmSync(file, { force: true });
    fs.rmSync(cache, { force: true, recursive: true });
    // Only this run's own subdirectory is removed above. The shared parent goes
    // when it is empty and stays when a concurrent run still owns something in
    // it, so two suites on one checkout cannot delete each other's plant and
    // read the resulting unchanged inventory as a pass.
    try {
      fs.rmdirSync(path.join(SCAFFOLD, ".cache"));
    } catch {
      /* another run still owns a plant here */
    }
  }
  report([
    ` byte inventory: ${before.length} shipped paths, no retired surface, ` +
      `${links} links resolve, ${planted.length} planted artifacts refused`,
  ]);
};

/** Reject a synchronized project missing an authoring procedure or its route. */
const assertSynchronizedInstructions = (props: {
  claude: string;
  router: string;
  divergent: readonly string[];
}): void => {
  const missing = SHIPPED_SKILLS.filter(
    (skill) =>
      props.router.includes(`.agents/skills/${skill}/SKILL.md`) === false,
  );
  if (
    props.claude.trim() !== "@AGENTS.md" ||
    missing.length !== 0 ||
    props.divergent.length !== 0
  )
    throw new Error(
      [
        "FAIL: a synchronized generated project cannot reach its own authoring",
        " procedures. A skill that ships but is never routed to is a procedure",
        " nobody arrives at.",
        ...missing.map((skill) => ` ${skill} is not routed from AGENTS.md`),
        ...props.divergent.map(
          (file) => ` ${file} differs from the installed template`,
        ),
        ` CLAUDE.md is ${JSON.stringify(props.claude.trim())}`,
      ].join("\n"),
    );
};

/** Every file under one directory, relative to it, in deterministic order. */
const treeFiles = (root: string): string[] => {
  const out: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort(
        (left, right) =>
          Number(left.name > right.name) - Number(left.name < right.name),
      )) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  walk(root);
  return out;
};

/**
 * The four procedures land byte-identically and the router names every one.
 *
 * This is the discoverability half of the instruction contract, and it is
 * checked on a project that ran its own `npm run sync` rather than on this
 * repository's copy. Published, documented and reachable are three different
 * states: the sync command already refuses an installed template missing a
 * skill entry point, which proves the bytes exist, and says nothing about
 * whether an author is ever sent to them.
 */
const testSynchronizedSkills = (): void => {
  const installed = path.join(
    PROBE,
    "node_modules",
    "@automovie",
    "template",
    "scaffold",
    ".agents",
    "skills",
  );
  const synchronized = path.join(PROBE, ".agents", "skills");
  const expected = treeFiles(installed);
  const divergent = [
    ...expected.filter(
      (file) =>
        fs.existsSync(path.join(synchronized, file)) === false ||
        fs.readFileSync(path.join(synchronized, file), "utf8") !==
          fs.readFileSync(path.join(installed, file), "utf8"),
    ),
    ...treeFiles(synchronized).filter(
      (file) => expected.includes(file) === false,
    ),
  ];
  assertSynchronizedInstructions({
    claude: fs.readFileSync(path.join(PROBE, "CLAUDE.md"), "utf8"),
    divergent,
    router: fs.readFileSync(path.join(PROBE, "AGENTS.md"), "utf8"),
  });
  report([
    ` shipped skills: ${SHIPPED_SKILLS.length} routed from the generated router, ` +
      `${expected.length} instruction files byte-identical`,
  ]);
};

/**
 * One state the graph must refuse, spelled as a mutation of the probe's own
 * typed declaration.
 */
interface IConfigRefusal {
  /** What the mutation makes the declaration say. */
  name: string;
  /** Text the refusal must contain, taken from a real run rather than guessed. */
  expect: string;
  /** Replacements applied to the scaffold's own `lint.config.ts` bytes. */
  edits: readonly (readonly [string, string])[];
  /** Disposable probe-relative files the state needs, as path and content. */
  plants?: readonly (readonly [string, string])[];
}

/** One addressable disposable host, enough for a stage rule to have something to read. */
const STAGE_PROBE_HOST =
  "# Stage probe\n\n## Stage probe unit {#stage-probe-unit}\n\nOne disposable host.\n";

/**
 * The three refusals the underpayment probes cannot reach.
 *
 * Underpayment proves that a paid population loses a diagnostic when one
 * acknowledgement is removed. It says nothing about the states an author
 * actually reaches first: activating a layer with nothing under it, activating
 * a child before its parent is reviewed, and damaging the typed declaration
 * that owns the whole graph. Each of those fails while the configuration is
 * evaluated, before any file is checked, and `@ttsc/lint` reports a config that
 * fails to evaluate by printing no lint diagnostic at all, which is exactly
 * what a clean project looks like. So they are proved by exit status and by the
 * text the refusal names, rather than by the diagnostic parser the other probes
 * read.
 *
 * Every expectation below was read off a real `ttsc --noEmit` over a probe
 * rendered from this scaffold, never copied out of the implementation.
 */
const CONFIG_REFUSALS: readonly IConfigRefusal[] = [
  {
    name: "an active settings layer with no Markdown host",
    expect: "settings cannot enter evidence without a Markdown host.",
    edits: [
      ["  kind: null,", '  kind: "library",'],
      ['  settings: "disabled",', '  settings: "evidence",'],
    ],
  },
  {
    name: "a child branch activated before its parent is reviewed",
    expect: "models cannot enter evidence before settings is in review.",
    edits: [
      ["  kind: null,", '  kind: "library",'],
      ['  settings: "disabled",', '  settings: "draft",'],
      ['  models: "disabled",', '  models: "evidence",'],
    ],
    plants: [
      ["docs/settings/__stageProbe.md", STAGE_PROBE_HOST],
      ["docs/models/__stageProbe.md", STAGE_PROBE_HOST],
    ],
  },
  {
    name: "authored JavaScript inside a governed source branch",
    expect:
      "Could not find a declaration file for module './__authoredJavaScriptCanary'",
    edits: [],
    plants: [
      [
        "src/models/__authoredJavaScriptCanary.js",
        "export const canary = (value) => value;\n",
      ],
      [
        "src/models/__authoredJavaScriptCanaryConsumer.ts",
        'import { canary } from "./__authoredJavaScriptCanary";\n\nexport const consume = (): unknown => canary(1);\n',
      ],
    ],
  },
  {
    name: "a damaged typed declaration surface",
    expect:
      "'__damagedTypeSurfaceProbe' does not exist in type 'IAutoMovieEvidenceConfigProps'",
    edits: [
      [
        "  claims: [],",
        '  __damagedTypeSurfaceProbe: "evidence",\n  claims: [],',
      ],
    ],
  },
];

/**
 * Apply one replacement, refusing when the anchor it needs is gone.
 *
 * `String.replace` returns its input unchanged when the anchor is absent, so a
 * probe that trusted it would compile unmutated material and report the clean
 * result as proof of a refusal that never ran.
 */
const replaceOnce = (source: string, from: string, to: string): string => {
  if (source.split(from).length !== 2)
    throw new Error(
      `The scaffold declaration no longer contains exactly one ${JSON.stringify(from)}; update the refusal probes before trusting this gate.`,
    );
  return source.replace(from, to);
};

/** Rewrite the probe's declaration into one refusable state. */
const applyConfigRefusal = (refusal: IConfigRefusal): void => {
  const configured = refusal.edits.reduce(
    (source, [from, to]) => replaceOnce(source, from, to),
    fs.readFileSync(path.join(SCAFFOLD, "lint.config.ts"), "utf8"),
  );
  fs.writeFileSync(path.join(PROBE, "lint.config.ts"), configured, "utf8");
  for (const [relative, content] of refusal.plants ?? []) {
    const target = path.join(PROBE, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }
};

/** Put the probe back to the blank scaffold's own bytes. */
const restoreConfigRefusal = (refusal: IConfigRefusal): void => {
  fs.copyFileSync(
    path.join(SCAFFOLD, "lint.config.ts"),
    path.join(PROBE, "lint.config.ts"),
  );
  for (const [relative] of refusal.plants ?? [])
    fs.rmSync(path.join(PROBE, relative), { force: true });
};

/** Require the compile to have failed, naming what the refusal was about. */
const assertConfigRefusal = (
  refusal: IConfigRefusal,
  result: IProcessResult,
): void => {
  if (result.status !== 0 && result.output.includes(refusal.expect)) return;
  throw new Error(
    [
      `FAIL: ${refusal.name} was not refused with its own diagnostic.`,
      ` expected text: ${refusal.expect}`,
      ` exit status: ${result.status}`,
      ...result.output
        .split(/\r?\n/u)
        .slice(0, 20)
        .map((line) => ` | ${line}`),
    ].join("\n"),
  );
};

const validateInitialCompile = (
  run: IProcessResult,
  planted: readonly IPlantedCanary[],
): {
  correctness: IDiagnostic[];
  evidence: IDiagnostic[];
  uninstalled: IDiagnostic[];
} => {
  const diagnostics = parse(run.output);
  const of = (axis: DiagnosticAxis): IDiagnostic[] =>
    diagnostics.filter((diagnostic) => axisOf(diagnostic) === axis);
  const evidence = of("evidence");
  const correctness = of("correctness");
  const uninstalled = of("uninstalled");
  const mentions = (diagnostic: IDiagnostic): boolean =>
    planted.some((canary) => diagnostic.text.includes(canary.path));
  const missing = planted.filter(
    (canary) =>
      diagnostics.some(
        (diagnostic) =>
          ruleOf(diagnostic) === canary.rule &&
          diagnostic.text.includes(canary.path),
      ) === false,
  );
  if (missing.length !== 0)
    throw new Error(
      [
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
      ].join("\n"),
    );
  const owed = [...evidence, ...correctness].filter(
    (diagnostic) => mentions(diagnostic) === false,
  );
  if (owed.length !== 0)
    throw new Error(
      [
        "FAIL: packages/template/scaffold owes the diagnostics below. Every project",
        " generated from it inherits them, so this is red on an author's first",
        " `npm run lint`.",
        ...owed.map((diagnostic) => ` ${diagnostic.text}`),
      ].join("\n"),
    );
  return { correctness, evidence, uninstalled };
};

const assertGraphConsumer = (result: IProcessResult): void => {
  if (result.status === 0) return;
  throw new Error(
    [
      "FAIL: the reusable evidence package's structural graph canaries failed.",
      ...result.output.split(/\r?\n/u).map((line) => ` | ${line}`),
    ].join("\n"),
  );
};

const assertPaidCompile = (result: IProcessResult): void => {
  const owed = parse(result.output).filter(
    (diagnostic) => axisOf(diagnostic) !== "uninstalled",
  );
  if (owed.length !== 0)
    throw new Error(
      [
        "FAIL: the real active settings graph rejected its completely paid",
        " disposable population. Structural inspection is not a substitute for",
        " executing the shared claims an author will activate.",
        ...owed.map((diagnostic) => ` ${diagnostic.text}`),
      ].join("\n"),
    );
};

const assertPaidSourceLine = (
  underpayment: IUnderpayment,
  paidSource: string,
): void => {
  if (paidSource.split(underpayment.line).length !== 2)
    throw new Error(
      `The paid settings probe no longer has exactly one ${underpayment.target} acknowledgement.`,
    );
};

const assertUnderpayment = (
  underpayment: IUnderpayment,
  result: IProcessResult,
): void => {
  const diagnostics = parse(result.output);
  const evidence = diagnostics.filter(
    (diagnostic) => axisOf(diagnostic) === "evidence",
  );
  const correctness = diagnostics.filter(
    (diagnostic) => axisOf(diagnostic) === "correctness",
  );
  const expected = evidence.filter((diagnostic) =>
    diagnostic.text.includes(underpayment.target),
  );
  if (
    evidence.length !== 1 ||
    expected.length !== 1 ||
    correctness.length !== 0
  )
    throw new Error(
      [
        `FAIL: removing ${underpayment.target} did not produce an isolated`,
        " evidence diagnostic. The shared claim's negative edge is therefore",
        " unproved.",
        ...diagnostics.map((diagnostic) => ` ${diagnostic.text}`),
      ].join("\n"),
    );
};

const report = (lines: readonly string[]): void => {
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
const main = (): void => {
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
  const { correctness, evidence, uninstalled } = validateInitialCompile(
    run,
    planted,
  );

  report([
    "scaffold lint:source gate",
    ` probe: ${PROBE}`,
    ` ttsc: exit ${run.status}, ${elapsed}ms`,
    ` compiled: ${PROBE_INCLUDE.join(", ")}`,
    ` diagnostics: ${evidence.length} evidence, ${correctness.length} correctness,` +
      ` ${uninstalled.length} uninstalled-probe noise`,
  ]);

  report(
    planted.map(
      (canary) => `  canary:      ${canary.axis} rejected by ${canary.rule}`,
    ),
  );

  for (const canary of planted)
    fs.rmSync(path.join(PROBE, canary.file), { force: true });
  const packageGraphTests = testGraph({
    cwd: ROOT,
    project: "packages/evidence/tsconfig.test.json",
    file: "packages/evidence/test/createAutoMovieEvidenceConfig.test.ts",
  });
  assertGraphConsumer(packageGraphTests);
  report([" graph tests: reusable package canaries passed"]);
  testInstructionSync();
  report([" instruction sync: local-docs consumer passed"]);
  testSynchronizedSkills();
  testShippedInventory();

  for (const refusal of CONFIG_REFUSALS) {
    applyConfigRefusal(refusal);
    const refusedRun = compile();
    restoreConfigRefusal(refusal);
    assertConfigRefusal(refusal, refusedRun);
    report([` blank graph: ${refusal.name} was refused`]);
  }

  const active = activatePaidSettings();
  const paidRun = compile();
  assertPaidCompile(paidRun);
  report([" active graph: paid settings population passed"]);

  for (const underpayment of active.underpayments) {
    const paidSource = fs.readFileSync(underpayment.file, "utf8");
    assertPaidSourceLine(underpayment, paidSource);
    fs.writeFileSync(
      underpayment.file,
      paidSource.replace(underpayment.line, ""),
      "utf8",
    );
    const underpaidRun = compile();
    fs.writeFileSync(underpayment.file, paidSource, "utf8");
    assertUnderpayment(underpayment, underpaidRun);
    report([
      ` active graph: removed ${underpayment.target} was rejected by evidence/graph`,
    ]);
  }
  render();
  report([
    "",
    "PASS: the scaffold's production evidence graph is paid and its own lint rules hold over",
    " everything `npm run lint:source` compiles. The two blank-scaffold canaries,",
    " paid active settings population, and isolated underpayment probes prove both lint",
    " axes and both directions of the real shared graph. The noise count is what",
    " a probe that installs nothing cannot resolve; it is reported, never gated.",
    " Each refused state above was restored to the scaffold's own bytes before the",
    " next ran, and the paid population that follows them compiles those restored",
    " bytes cleanly, which is what proves the restoration rather than a claim about it.",
  ]);
};

/** Execute the complete generated-scaffold consumer contract. */
export const runScaffoldEvidenceGate = (): void => {
  try {
    main();
  } finally {
    fs.rmSync(PROBE, { force: true, recursive: true });
  }
};

/** Pure guard and classifier seams exercised by the typed negative scenarios. */
export const scaffoldEvidenceTestContract = {
  activeSettingsConfig,
  assertBuiltPackages,
  assertConfigRefusal,
  assertGraphConsumer,
  assertInstructionSync,
  assertInventoryIgnoresArtifacts,
  assertOwnedObligations,
  assertPaidCompile,
  assertPaidSourceLine,
  assertResolvableLinks,
  assertRetiredSurfacesAbsent,
  assertSynchronizedInstructions,
  assertUnderpayment,
  axisOf,
  inherit,
  markdownAnchors,
  obligationUnderpayment,
  packageOf,
  paidPrincipleReason,
  parse,
  processResult,
  replaceOnce,
  resolveLink,
  validateInitialCompile,
};
