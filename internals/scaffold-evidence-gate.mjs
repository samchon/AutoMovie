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
const SCAFFOLD = path.join(ROOT, "packages", "template", "scaffold");

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
  "template",
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
 * the file that killed a generated project: it named `src` and `lint.config.mjs`
 * while `npm run lint:source` compiles `viewer/src`, `scripts`, `test` and the
 * two root configs as well, so `viewer/src/subject.ts` failed
 * `typescript/switch-exhaustiveness-check` on a user's first `npm run lint`
 * while this gate stayed green. `docs` is added because it hosts no compiled
 * file and every evidence reference the graph resolves. `AGENTS.md` is added
 * because it is the generated author's entry contract and must be inspected by
 * the consumer canary even though TypeScript does not compile it.
 */
const INHERITED = ["AGENTS.md", "docs", ...TSCONFIG.include];

/**
 * The two canaries, one per axis this gate reports on.
 *
 * Each is a defect planted every run whose rejection is what licenses that
 * axis's clean result. An axis with no canary cannot tell a clean scaffold from
 * an instrument that stopped running, and both of the ways this instrument
 * stops were observed while it was built: `ttsc` reports no lint diagnostic at
 * all when the project does not declare the plugins as dependencies, and none
 * when `lint.config.mjs` fails to evaluate. The symptom of each is an empty
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
      `packages/template/scaffold/tsconfig.json now includes the pattern ${JSON.stringify(relative)}; teach the probe to expand it before it can compile what the scaffold compiles.`,
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
 * both the runtime-validated `import.meta.dirname` capability and that package's
 * Node-backed implementation. The real scaffold declares all three. The canary
 * pass proves the two runtime declarations took effect, while the paid pass
 * exercises the type declaration.
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

  // A generated project resolves the shared contracts from the installed
  // `@automovie/template`, so the probe has to as well. Copying the published
  // `docs` beside a minimal manifest reproduces exactly what an author's
  // `node_modules` holds, and keeps the probe from reading contracts the
  // repository happens to have lying around at a different path.
  const linkedTemplate = path.join(
    PROBE,
    "node_modules",
    "@automovie",
    "template",
  );
  fs.mkdirSync(linkedTemplate, { recursive: true });
  fs.cpSync(
    path.join(ROOT, "packages", "template", "docs"),
    path.join(linkedTemplate, "docs"),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(linkedTemplate, "package.json"),
    `${JSON.stringify({ name: "@automovie/template", version: "0.0.0" }, null, 2)}
`,
    "utf8",
  );

  // Native ESM lint configuration executes in plain Node, exactly as it does
  // in an installed production. Give that evaluator the publish view instead
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
  for (const dependency of ["@ttsc/evidence", "typescript-compiler"]) {
    const target = path.join(PROBE, "node_modules", dependency);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(
      path.join(ROOT, "node_modules", dependency),
      target,
      "junction",
    );
  }

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
        files: ["lint.config.mjs", "test/scaffold.test.ts"],
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
      .readFileSync(
        path.join(ROOT, "packages", "template", "docs", relative),
        "utf8",
      )
      .matchAll(/^## .+ \{#(?<anchor>[^}]+)\}$/gmu),
  ].map((match) => `${relative}#${match.groups.anchor}`);

/**
 * Turn the disposable probe into the smallest structurally complete active
 * library-settings population.
 *
 * This is deliberately generated after the blank-scaffold pass. The public
 * scaffold must contain no production prose or evidence tags, but inspecting
 * config structure alone cannot prove that its real shared claims accept a
 * paid population. Sixteen independent primary H2 owners cover the sixteen settings
 * obligations, every H2 answers every common and settings principle for
 * itself, and the separate contract index carries the complete truthful
 * negative discovery audit. Settings has no inherited file relationship to
 * pay.
 */
const activatePaidSettings = () => {
  const configFile = path.join(PROBE, "productionEvidence.mjs");
  const config = fs.readFileSync(configFile, "utf8");
  const kindSelector = "  kind: null,";
  const settingsSelector = '  settings: "disabled",';
  if (
    config.split(kindSelector).length !== 2 ||
    config.split(settingsSelector).length !== 2
  )
    throw new Error(
      "The scaffold graph selector changed; update the active settings probe before trusting this gate.",
    );
  fs.writeFileSync(
    configFile,
    config
      .replace(kindSelector, '  kind: "library",')
      .replace(settingsSelector, '  settings: "evidence",'),
    "utf8",
  );

  const principleTargets = [
    ...contractAnchors("principles/core/common.md"),
    ...contractAnchors("principles/core/settings.md"),
  ];
  const obligationTargets = [
    ...contractAnchors("obligations/core/common.md"),
    ...contractAnchors("obligations/core/settings.md"),
  ];
  const principleReason = (target, unit) => {
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
  const settingsUnits = [
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
  const ownedObligations = new Set(
    settingsUnits.flatMap((unit) => unit.obligations),
  );
  for (const target of obligationTargets)
    if (ownedObligations.has(target) === false)
      throw new Error(`No paid-probe H2 owns ${target}.`);
  const obligationLine = (target, unit) =>
    `@evidence ${target} ${unit.title} is the population owner that states this role concretely: ${unit.body}`;
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
        (target) => `@evidence ${target} ${principleReason(target, unit)}`,
      ),
      ...unit.obligations.map((target) => obligationLine(target, unit)),
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
  const obligationUnderpayment = (obligationTarget) => {
    const unit = settingsUnits.find((candidate) =>
      candidate.obligations.includes(obligationTarget),
    );
    if (unit === undefined)
      throw new Error(`The paid probe lost its ${obligationTarget} owner.`);
    return {
      file: target,
      line: obligationLine(obligationTarget, unit),
      target: obligationTarget,
    };
  };
  return {
    underpayments: [
      {
        file: discoveryFile,
        line: `@evidenceExclude discovery/core/common.md#shared-local-boundary ${discoveryExclusions["discovery/core/common.md#shared-local-boundary"]}`,
        target: "discovery/core/common.md#shared-local-boundary",
      },
      obligationUnderpayment(
        "obligations/core/settings.md#operative-subject-inventory",
      ),
      obligationUnderpayment(
        "obligations/core/settings.md#design-dependent-subject-conditions",
      ),
      obligationUnderpayment(
        "obligations/core/settings.md#production-visual-grammar",
      ),
      obligationUnderpayment(
        "obligations/core/settings.md#accessibility-deliverable-states",
      ),
    ],
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
      "FAIL: packages/template/scaffold owes the diagnostics below. Every project",
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

  for (const underpayment of active.underpayments) {
    const paidSource = fs.readFileSync(underpayment.file, "utf8");
    if (paidSource.split(underpayment.line).length !== 2)
      throw new Error(
        `The paid settings probe no longer has exactly one ${underpayment.target} acknowledgement.`,
      );
    fs.writeFileSync(
      underpayment.file,
      paidSource.replace(underpayment.line, ""),
      "utf8",
    );
    const underpaidRun = compile();
    fs.writeFileSync(underpayment.file, paidSource, "utf8");
    const underpaidDiagnostics = parse(underpaidRun.output);
    const underpaidEvidence = underpaidDiagnostics.filter(
      (diagnostic) => axisOf(diagnostic) === "evidence",
    );
    const underpaidCorrectness = underpaidDiagnostics.filter(
      (diagnostic) => axisOf(diagnostic) === "correctness",
    );
    const expectedUnderpayment = underpaidEvidence.filter((diagnostic) =>
      diagnostic.text.includes(underpayment.target),
    );
    if (
      underpaidEvidence.length !== 1 ||
      expectedUnderpayment.length !== 1 ||
      underpaidCorrectness.length !== 0
    ) {
      report([
        "",
        `FAIL: removing ${underpayment.target} did not produce an isolated`,
        " evidence diagnostic. The shared claim's negative edge is therefore",
        " unproved.",
        ...underpaidDiagnostics.map((diagnostic) => ` ${diagnostic.text}`),
      ]);
      process.exitCode = 1;
      return;
    }
    report([
      ` active graph: removed ${underpayment.target} was rejected by evidence/graph`,
    ]);
  }
  report([
    "",
    "PASS: the scaffold's production evidence graph is paid and its own lint rules hold over",
    " everything `npm run lint:source` compiles. The two blank-scaffold canaries,",
    " paid active settings population, and isolated underpayment probes prove both lint",
    " axes and both directions of the real shared graph. The noise count is what",
    " a probe that installs nothing cannot resolve; it is reported, never gated.",
  ]);
};

main();
