import {
  type IAutoMovieEvidenceConfigProps,
  readAutoMovieProductionEvidence,
} from "@automovie/evidence";
import type {
  AutoMovieLibraryReviewEvidence,
  IAutoMovieLibraryReviewObservationPlan,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  autoMovieMaterializedLibraryContexts,
  autoMovieMaterializedLibraryEnvironments,
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
  parseAutoMovieLibraryReviewPlan,
  readAutoMovieLibraryReviewRequirements,
} from "@automovie/production";
import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  assertCurrentLibraryReview,
  readCurrentLibraryReview,
  readLibraryReviewAuthoring,
} from "./libraryReviewCurrentness";
import {
  admitLibraryReviewReceipt,
  assertLibraryReviewPlanAuthoring,
  libraryReviewPublicationSource,
  parseLibraryReviewPublication,
  planLibraryReviewUnit,
  publishLibraryReview,
  readLibraryReviewPublication,
  recordLibraryReviewReceipt,
} from "./libraryReviewPublication";
import {
  createLibraryReviewPublicationIO,
  libraryReviewPublicationFileSystem,
} from "./libraryReviewPublicationFileSystem";
import {
  readAutoMovieObservationMeasurements,
  readAutoMovieObservationPose,
} from "./libraryReviewRequest";

type Verdict = "failed" | "not-run" | "passed" | "unsupported";

const values = (argv: readonly string[], name: string): string[] => {
  const output: string[] = [];
  for (let index = 0; index < argv.length; index += 1)
    if (argv[index] === name) {
      output.push(argv[index + 1]!);
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
    "--pose",
    "--measurements",
  ]),
} as const;

/** Refuse positional and unknown arguments before any command-side mutation. */
const assertActionArguments = (
  argv: readonly string[],
  action: keyof typeof actionArguments,
): void => {
  const allowed = actionArguments[action];
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index]!;
    const value = argv[index + 1];
    if (allowed.has(flag) === false)
      throw new Error(
        `Library review ${action} received unknown or positional argument ${JSON.stringify(flag)}.`,
      );
    if (value === undefined || value.startsWith("--"))
      throw new Error(`${flag} requires one value.`);
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
 *    only a passed receipt at the same current identity, and preserves the
 *    approved predecessor through exclusive publication or explicit recovery.
 */
export const runLibraryReviewCommand = (props: {
  argv: readonly string[];
  root: string;
  productionId: string;
  evidence: IAutoMovieEvidenceConfigProps;
  read: typeof readAutoMovieProductionEvidence;
  output?: (value: unknown) => void;
}): unknown => {
  const root = path.resolve(props.root);
  const currentAuthoringEvidence = () =>
    readLibraryReviewAuthoring(() =>
      props.read({ root, productionEvidence: props.evidence }),
    );
  const authoring = currentAuthoringEvidence();
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
    const io = createLibraryReviewPublicationIO({
      root,
      target: relative,
      fileSystem: libraryReviewPublicationFileSystem,
    });
    const before = readLibraryReviewPublication({ target: relative, io });
    const previous = parseLibraryReviewPublication({
      before,
      parse: parseAutoMovieLibraryReviewPlan,
    });
    const plan = planLibraryReviewUnit({
      previous,
      unit: { anchor: parts.anchor, sources, observations },
    });
    const publication = publishLibraryReview({
      target: relative,
      before,
      io,
      attempt: randomUUID(),
      source: libraryReviewPublicationSource({ before, previous, plan }),
      admit: () =>
        assertLibraryReviewPlanAuthoring({
          expected: authoring,
          read: currentAuthoringEvidence,
        }),
    });
    const result = {
      action,
      owner: requested,
      path: relative,
      plan,
      publication,
    };
    props.output?.(result);
    return result;
  }

  const project = AutoMovieProductionProject.openReadOnly(
    root,
    props.productionId,
  );
  const readCurrent = () =>
    readCurrentLibraryReview({
      readAuthoring: currentAuthoringEvidence,
      compile: (evidence, currentEvidence) =>
        new AutoMovieProductionCompiler(
          AutoMovieProductionProject.openReadOnly(root, props.productionId),
          evidence,
          currentEvidence,
        ).lint({ scope: "source" }),
      population: (evidence, compileFingerprint) =>
        readAutoMovieLibraryReviewRequirements({
          authoring: evidence,
          project,
          compileFingerprint,
          // The buildings this project's last compile published. Without them this
          // command would report an owner as owing only what its author already
          // wrote down, while the compiler charges it every facade, corner and room
          // its topology derives, and the two answers would disagree at review.
          environments: autoMovieMaterializedLibraryEnvironments({
            read: (relative) => project.readGeneratedFile(relative),
          }),
          // And the worlds it adopted. A map owner publishes no building at all, so
          // without these it would be reported as owing only what its author already
          // wrote down, which is what "an empty population passes every check that
          // compares against it" looks like from the author's side.
          contexts: autoMovieMaterializedLibraryContexts({
            read: (relative) => project.readGeneratedFile(relative),
          }),
        }),
    });
  const snapshot = readCurrent();
  const { population } = snapshot;
  if (action === "inspect") {
    assertCurrentLibraryReview({ expected: snapshot, read: readCurrent });
    const result = { ...population, compilation: snapshot.compilation };
    props.output?.(result);
    return result;
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
  // Where the eye stood and what it read. An interior observation whose
  // receipt states no pose is refused at review, because a picture drawn from
  // the corridor outside carries the same bytes as one drawn inside the room
  // and only the pose tells them apart. Both are parsed here rather than
  // defaulted, so a malformed value is refused by name at the moment it is
  // offered instead of reaching the plan file as something the review gate
  // then has to interpret.
  const pose = readAutoMovieObservationPose(one(props.argv, "--pose", false));
  const measurements = readAutoMovieObservationMeasurements(
    one(props.argv, "--measurements", false),
  );
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
  const io = createLibraryReviewPublicationIO({
    root,
    target: relative,
    fileSystem: libraryReviewPublicationFileSystem,
  });
  const before = readLibraryReviewPublication({ target: relative, io });
  const previous = parseLibraryReviewPublication({
    before,
    parse: parseAutoMovieLibraryReviewPlan,
  });
  const plan = recordLibraryReviewReceipt({
    previous,
    anchor: parts.anchor,
    receipt: {
      observation,
      evidence,
      identity: owner.identity,
      runtimeIdentity,
      pose,
      measurements,
      verdict,
    },
  });
  const publication = publishLibraryReview({
    target: relative,
    before,
    io,
    attempt: randomUUID(),
    source: libraryReviewPublicationSource({ before, previous, plan }),
    admit: () =>
      admitLibraryReviewReceipt({
        assertCurrent: () =>
          assertCurrentLibraryReview({ expected: snapshot, read: readCurrent }),
        expected: evidence,
        read: () => evidenceOf({ argv: props.argv, project }),
      }),
  });
  const result = {
    action,
    owner: requested,
    observation,
    path: relative,
    identity: owner.identity,
    evidence,
    runtimeIdentity,
    verdict,
    publication,
  };
  props.output?.(result);
  return result;
};

/** Run the process-facing adapter while keeping command behavior testable. */
export const runLibraryReviewCli = (props: {
  argv: readonly string[];
  evidence: IAutoMovieEvidenceConfigProps;
  productionId: string;
  read: typeof readAutoMovieProductionEvidence;
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
      read: props.read,
      root: props.root,
      output: (value) => props.stdout(`${JSON.stringify(value, null, 2)}\n`),
    });
    return 0;
  } catch (error) {
    props.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
};
