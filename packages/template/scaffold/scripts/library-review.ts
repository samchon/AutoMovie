import {
  type IAutoMovieEvidenceConfigProps,
  readAutoMovieProductionEvidence,
} from "@automovie/evidence";
import type {
  AutoMovieLibraryReviewEvidence,
  IAutoMovieLibraryReviewObservationPlan,
  IAutoMovieLibraryReviewOwnerIdentity,
  IAutoMovieLibraryReviewPlanFile,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
  parseAutoMovieLibraryReviewPlan,
  readAutoMovieLibraryReviewRequirements,
} from "@automovie/production";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type Verdict = "failed" | "not-run" | "passed" | "unsupported";

const values = (argv: readonly string[], name: string): string[] => {
  const output: string[] = [];
  for (let index = 0; index < argv.length; index += 1)
    if (argv[index] === name) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--"))
        throw new Error(`${name} requires one value.`);
      output.push(value);
      index += 1;
    }
  return output;
};

const one = (
  argv: readonly string[],
  name: string,
  required: boolean = true,
): string | undefined => {
  const selected = values(argv, name);
  if (selected.length > 1)
    throw new Error(`${name} may be supplied exactly once.`);
  if (required && selected.length === 0)
    throw new Error(`${name} is required.`);
  return selected[0];
};

const ownerParts = (owner: string): { design: string; anchor: string } => {
  const boundary = owner.lastIndexOf("#");
  if (boundary <= 0 || boundary === owner.length - 1)
    throw new Error(
      `Library owner ${JSON.stringify(owner)} must be one exact design.md#h2-anchor address.`,
    );
  return {
    design: owner.slice(0, boundary),
    anchor: owner.slice(boundary + 1),
  };
};

const planPath = (design: string): string =>
  design.replace(/\.md$/u, ".review.json");

const readPlan = (
  root: string,
  relative: string,
): IAutoMovieLibraryReviewPlanFile =>
  parseAutoMovieLibraryReviewPlan(
    fs.readFileSync(path.join(root, relative), "utf8"),
  );

const actionArguments = {
  inspect: new Set<string>(),
  plan: new Set(["--owner", "--source", "--observation"]),
  record: new Set([
    "--owner",
    "--observation",
    "--runtime",
    "--verdict",
    "--artifact-project",
    "--artifact-render",
    "--facts-file",
    "--turntable",
  ]),
} as const;

/** Refuse positional and unknown arguments before any command-side mutation. */
const assertActionArguments = (
  argv: readonly string[],
  action: keyof typeof actionArguments,
): void => {
  const allowed = actionArguments[action];
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === undefined || allowed.has(flag) === false)
      throw new Error(
        `Library review ${action} received unknown or positional argument ${JSON.stringify(flag)}.`,
      );
    if (value === undefined || value.startsWith("--"))
      throw new Error(`${flag} requires one value.`);
  }
};

const writePlan = (props: {
  root: string;
  relative: string;
  plan: IAutoMovieLibraryReviewPlanFile;
}): void => {
  const target = path.join(props.root, props.relative);
  const temporary = `${target}.${process.pid}-${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(props.plan, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    fs.renameSync(temporary, target);
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {
      // Preserve the original write failure; a later run refuses a resident
      // temporary path instead of treating it as a current plan.
    }
    throw error;
  }
};

const observationOf = (raw: string): IAutoMovieLibraryReviewObservationPlan => {
  const [id, evidence, model, ...extra] = raw.split(":");
  if (
    id === undefined ||
    id.trim() !== id ||
    id === "" ||
    extra.length !== 0 ||
    (evidence !== "artifact" &&
      evidence !== "facts" &&
      evidence !== "turntable")
  )
    throw new Error(
      `Observation ${JSON.stringify(raw)} must be id:artifact, id:facts, or id:turntable:model.`,
    );
  if (evidence === "turntable") {
    if (model === undefined || model.trim() !== model || model === "")
      throw new Error(
        `Turntable observation ${JSON.stringify(id)} needs a model.`,
      );
    return { id, evidence, model };
  }
  if (model !== undefined)
    throw new Error(
      `Observation ${JSON.stringify(id)} may name a model only for turntable evidence.`,
    );
  return { id, evidence };
};

const sameIdentity = (
  left: IAutoMovieLibraryReviewOwnerIdentity,
  right: IAutoMovieLibraryReviewOwnerIdentity,
): boolean =>
  left.design === right.design &&
  left.source === right.source &&
  left.generated === right.generated &&
  left.plan === right.plan;

const evidenceOf = (props: {
  argv: readonly string[];
  project: AutoMovieProductionProject;
}): AutoMovieLibraryReviewEvidence => {
  const selected = [
    ["artifact", "project", one(props.argv, "--artifact-project", false)],
    ["artifact", "render", one(props.argv, "--artifact-render", false)],
    ["facts", "project", one(props.argv, "--facts-file", false)],
    ["turntable", "project", one(props.argv, "--turntable", false)],
  ].filter(
    (entry): entry is [string, string, string] => entry[2] !== undefined,
  );
  if (selected.length !== 1)
    throw new Error(
      "Record exactly one --artifact-project, --artifact-render, --facts-file, or --turntable evidence input.",
    );
  const [kind, root, value] = selected[0]!;
  if (kind === "turntable") return { kind, model: value };
  if (kind === "facts") {
    const source = props.project.readProseDocument(value);
    if (source === null)
      throw new Error(
        `Facts file ${JSON.stringify(value)} is absent or unsafe.`,
      );
    const facts = JSON.parse(source) as unknown;
    return {
      kind,
      facts,
      digest: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(facts)),
    };
  }
  const bytes =
    root === "render"
      ? props.project.readRenderFile(value)
      : (() => {
          const source = props.project.readProseDocument(value);
          if (source === null)
            throw new Error(
              `Project artifact ${JSON.stringify(value)} is absent or unsafe.`,
            );
          return Buffer.from(source, "utf8");
        })();
  return {
    kind: "artifact",
    root: root as "project" | "render",
    path: value,
    digest: digestAutoMovieBytes(bytes),
  };
};

/**
 * Inspect, create, or pay one graph-derived library observation plan.
 *
 * Scenarios:
 *
 * 1. `inspect` prints the exact current branch, H2 owner, identity, and finite
 *    observation denominator without writing a receipt.
 * 2. `plan` creates or replaces one H2 plan from exact manifest-owned sources
 *    while retaining its historical receipts for stale classification.
 * 3. `record` reopens one artifact, facts file, or turntable identity, replaces
 *    a duplicate receipt for the same current identity, and writes atomically.
 */
export const runLibraryReviewCommand = (props: {
  argv: readonly string[];
  root: string;
  productionId: string;
  evidence: IAutoMovieEvidenceConfigProps;
  output?: (value: unknown) => void;
}): unknown => {
  const root = path.resolve(props.root);
  const authoring = readAutoMovieProductionEvidence({
    root,
    productionEvidence: props.evidence,
  });
  if (authoring.manifest.kind !== "library")
    throw new Error(
      `Library review commands require production kind "library", not ${JSON.stringify(authoring.manifest.kind)}.`,
    );
  const action = props.argv[0] ?? "inspect";
  if (action !== "inspect" && action !== "plan" && action !== "record")
    throw new Error(
      'Library review action must be "inspect", "plan", or "record".',
    );
  assertActionArguments(props.argv, action);

  if (action === "plan") {
    const requested = one(props.argv, "--owner")!;
    const parts = ownerParts(requested);
    const owner = authoring.designOwners.find(
      (entry) =>
        entry.path === parts.design &&
        entry.units.some((unit) => unit.anchor === parts.anchor),
    );
    if (owner === undefined)
      throw new Error(
        `Owner ${JSON.stringify(requested)} is outside the exact active authoring population.`,
      );
    const sourceBinding = owner.sourceBinding;
    if (sourceBinding?.enforced !== true || sourceBinding.stage !== "review")
      throw new Error(
        `Owner ${JSON.stringify(requested)} has no enforced reviewed source population. Review its manifest-derived source branch before planning observations.`,
      );
    const sources = values(props.argv, "--source");
    if (
      sources.length === 0 ||
      new Set(sources).size !== sources.length ||
      sources.some((source) => sourceBinding.paths.includes(source) !== true)
    )
      throw new Error(
        `Plan sources must be a nonempty unique subset of ${JSON.stringify(sourceBinding.paths)}.`,
      );
    const observations = values(props.argv, "--observation").map(observationOf);
    if (
      observations.length === 0 ||
      new Set(observations.map((entry) => entry.id)).size !==
        observations.length
    )
      throw new Error("A plan needs one or more uniquely named observations.");
    if (
      owner.branch === "models" &&
      observations.some((entry) => entry.evidence === "turntable") === false
    )
      throw new Error(
        "Every model owner needs a canonical turntable observation.",
      );
    if (
      owner.branch !== "models" &&
      observations.some((entry) => entry.evidence === "turntable")
    )
      throw new Error(
        `Branch ${JSON.stringify(owner.branch)} needs its own artifact or facts, not a model turntable.`,
      );
    const relative = planPath(parts.design);
    const previous = fs.existsSync(path.join(root, relative))
      ? readPlan(root, relative)
      : { version: 1 as const, units: [] };
    const retained = previous.units.find(
      (unit) => unit.anchor === parts.anchor,
    )?.receipts;
    const plan: IAutoMovieLibraryReviewPlanFile = {
      version: 1,
      units: [
        ...previous.units.filter((unit) => unit.anchor !== parts.anchor),
        {
          anchor: parts.anchor,
          sources,
          observations,
          receipts: retained ?? [],
        },
      ].sort((left, right) =>
        left.anchor < right.anchor ? -1 : left.anchor > right.anchor ? 1 : 0,
      ),
    };
    writePlan({ root, relative, plan });
    const result = { action, owner: requested, path: relative, plan };
    props.output?.(result);
    return result;
  }

  const project = AutoMovieProductionProject.openReadOnly(
    root,
    props.productionId,
  );
  const checked = new AutoMovieProductionCompiler(project, authoring).lint({
    scope: "source",
  });
  if (checked.success === false)
    throw new Error(
      `Library review requires a clean current source compile: ${JSON.stringify(checked.diagnostics)}`,
    );
  const population = readAutoMovieLibraryReviewRequirements({
    authoring,
    project,
    compileFingerprint: checked.compiler.inputFingerprint,
  });
  if (action === "inspect") {
    props.output?.(population);
    return population;
  }
  if (population.diagnostics.length !== 0)
    throw new Error(
      `Correct the library observation plan before recording: ${JSON.stringify(population.diagnostics)}`,
    );
  const requested = one(props.argv, "--owner")!;
  const observation = one(props.argv, "--observation")!;
  const runtimeIdentity = one(props.argv, "--runtime")!;
  if (runtimeIdentity.trim() !== runtimeIdentity || runtimeIdentity === "")
    throw new Error(
      "--runtime must be one canonical nonblank tool/runtime identity.",
    );
  const verdict = one(props.argv, "--verdict") as Verdict;
  if (!["failed", "not-run", "passed", "unsupported"].includes(verdict))
    throw new Error(`Unsupported terminal verdict ${JSON.stringify(verdict)}.`);
  const owner = population.owners.find((entry) => entry.owner === requested);
  const requirement = owner?.observations.find(
    (entry) => entry.id === observation,
  );
  if (owner === undefined || requirement === undefined)
    throw new Error(
      `Observation ${JSON.stringify(observation)} is outside current owner ${JSON.stringify(requested)}.`,
    );
  const evidence = evidenceOf({ argv: props.argv, project });
  if (evidence.kind !== requirement.evidence)
    throw new Error(
      `Observation ${JSON.stringify(observation)} requires ${requirement.evidence}, not ${evidence.kind}.`,
    );
  if (evidence.kind === "turntable") {
    const planned = population.turntables.find(
      (entry) => entry.owner === requested && entry.observation === observation,
    );
    if (planned?.model !== evidence.model)
      throw new Error(
        `Observation ${JSON.stringify(observation)} requires planned model ${JSON.stringify(planned?.model)}, not ${JSON.stringify(evidence.model)}.`,
      );
  }
  const parts = ownerParts(requested);
  const relative = planPath(parts.design);
  const plan = readPlan(root, relative);
  const unit = plan.units.find((entry) => entry.anchor === parts.anchor)!;
  unit.receipts = [
    ...unit.receipts.filter(
      (receipt) =>
        receipt.observation !== observation ||
        sameIdentity(receipt.identity, owner.identity) === false,
    ),
    {
      observation,
      evidence,
      identity: owner.identity,
      runtimeIdentity,
      verdict,
    },
  ];
  writePlan({ root, relative, plan });
  const result = {
    action,
    owner: requested,
    observation,
    path: relative,
    identity: owner.identity,
    evidence,
    runtimeIdentity,
    verdict,
  };
  props.output?.(result);
  return result;
};

/** Run the process-facing adapter while keeping command behavior testable. */
export const runLibraryReviewCli = (props: {
  argv: readonly string[];
  evidence: IAutoMovieEvidenceConfigProps;
  productionId: string;
  root: string;
  run: typeof runLibraryReviewCommand;
  stderr: (value: string) => void;
  stdout: (value: string) => void;
}): number => {
  try {
    props.run({
      argv: props.argv,
      evidence: props.evidence,
      productionId: props.productionId,
      root: props.root,
      output: (value) => props.stdout(`${JSON.stringify(value, null, 2)}\n`),
    });
    return 0;
  } catch (error) {
    props.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
};
