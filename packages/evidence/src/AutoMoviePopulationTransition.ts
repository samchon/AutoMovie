import crypto from "node:crypto";
import path from "node:path";

import {
  parseAutoMovieEvidenceSyntax,
  projectAutoMovieAuthoredMarkdown,
} from "./parseAutoMovieEvidenceSyntax";

/**
 * Exact retained host identity captured when a first pilot passes.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes every retained host identity an explicit reset input.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the two independent host digests recorded by a pilot receipt.
 */
export interface IAutoMovieRetainedPilotHost {
  /** Normalized project-relative path. */
  path: string;
  /** SHA-256 of authored bytes after structural evidence metadata is removed. */
  bodySha256: string;
  /** SHA-256 of ordered native evidence declarations. */
  evidenceTagSha256: string;
}

/**
 * Passed film-pilot state required by a complete-production reset.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the exact film predecessor visible in the reset declaration.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the versioned film transition receipt.
 */
export interface IAutoMovieFilmPopulationTransitionReceipt {
  /** Versioned receipt syntax. */
  version: 1;
  /** Production shape whose pilot passed. */
  kind: "film";
  /** Absolute production root bound to the receipt. */
  productionLocation: string;
  /** Human or process owner that recorded the transition. */
  owner: string;
  /** Exact prior film pilot population. */
  pilotScope: {
    mode: "first-pilot";
    partitionGroup: `001-${string}`;
  };
  /** Complete film ladder that was in review when the receipt was made. */
  reviewedBranches: readonly ["treatments", "scripts", "screenplays"];
  /** Pilot hosts preserved into the reset tree. */
  retainedHosts: readonly IAutoMovieRetainedPilotHost[];
}

/**
 * One reviewed design/source pair carried by a library pilot receipt.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Names the reviewed library pair authorized to reset together.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Restricts a library predecessor to a real design/source pair.
 */
export interface IAutoMovieReviewedLibraryPair {
  /** Authored design branch. */
  design:
    | "instances"
    | "maps"
    | "materials"
    | "models"
    | "motions"
    | "spaces"
    | "systems";
  /** Matching TypeScript source branch. */
  source:
    | "instanceSources"
    | "mapSources"
    | "materialSources"
    | "modelSources"
    | "motionSources"
    | "spaceSources"
    | "systemSources";
}

/**
 * Passed library-pilot state required by a complete-production reset.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the exact library predecessor visible in the reset declaration.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the versioned library transition receipt.
 */
export interface IAutoMovieLibraryPopulationTransitionReceipt {
  /** Versioned receipt syntax. */
  version: 1;
  /** Production shape whose pilot passed. */
  kind: "library";
  /** Absolute production root bound to the receipt. */
  productionLocation: string;
  /** Human or process owner that recorded the transition. */
  owner: string;
  /** Exact prior library pilot population. */
  pilotScope: { mode: "first-pilot" };
  /** Real design/source pairs that were both in review at transition time. */
  reviewedPairs: readonly IAutoMovieReviewedLibraryPair[];
  /** Pilot hosts preserved into the reset tree. */
  retainedHosts: readonly IAutoMovieRetainedPilotHost[];
}

/**
 * Historical predecessor accepted by a complete-production reset.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Restricts reset authority to one declared film or library predecessor.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Exposes the closed transition-receipt union.
 */
export type AutoMoviePopulationTransitionReceipt =
  | IAutoMovieFilmPopulationTransitionReceipt
  | IAutoMovieLibraryPopulationTransitionReceipt;

/**
 * Current host supplied to transition validation.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the reset candidate population explicit.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Carries one current host's stable path and complete source.
 */
export interface IAutoMoviePopulationTransitionHost {
  /** Normalized project-relative host path. */
  path: string;
  /** Complete current source. */
  source: string;
}

/**
 * Inputs required to validate one reset against its passed pilot.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the reset shape, root, receipt, stages, and hosts visible together.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the complete transition-validation input.
 */
export interface IValidateAutoMoviePopulationTransitionProps {
  /** Current production shape. */
  kind: "film" | "library";
  /** Current absolute production root. */
  productionLocation: string;
  /** Current owner accepting responsibility for the reset. */
  owner: string;
  /** Receipt stored on the reset population declaration. */
  receipt: AutoMoviePopulationTransitionReceipt;
  /** Current branch stages keyed by their declaration names. */
  stages: Readonly<Record<string, string>>;
  /** Exact reset-relevant host population in the current tree. */
  hosts: readonly IAutoMoviePopulationTransitionHost[];
}

const SHA256 = /^[0-9a-f]{64}$/u;
const FILM_BRANCHES = ["treatments", "scripts", "screenplays"] as const;
const LIBRARY_PAIRS = new Map<string, string>([
  ["instances", "instanceSources"],
  ["maps", "mapSources"],
  ["materials", "materialSources"],
  ["models", "modelSources"],
  ["motions", "motionSources"],
  ["spaces", "spaceSources"],
  ["systems", "systemSources"],
]);

/**
 * Creates the body and evidence identity stored for one retained pilot host.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Captures the exact retained-host predecessor used by reset validation.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Produces the stable body and tag identities required by the reset state machine.
 */
export function createAutoMovieRetainedPilotHost(
  host: IAutoMoviePopulationTransitionHost,
): IAutoMovieRetainedPilotHost {
  const normalizedPath = normalizeRelativePath(host.path);
  const body = normalizedPath.endsWith(".md")
    ? projectAutoMovieAuthoredMarkdown(host.source)
    : projectTypeScriptAuthoredBody(normalizedPath, host.source);
  const annotations = parseAutoMovieEvidenceSyntax({
    path: normalizedPath,
    source: host.source,
  });
  return {
    path: normalizedPath,
    bodySha256: digest(body),
    evidenceTagSha256: digest(
      annotations.map((annotation) => annotation.text).join("\n"),
    ),
  };
}

/**
 * Validates the privileged reset transition against its exact passed pilot.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Makes the only backward stage transition executable from a versioned predecessor.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Requires the complete film ladder or every recorded library pair to move from reviewed predecessor to current draft together.
 */
export function validateAutoMoviePopulationTransition(
  props: IValidateAutoMoviePopulationTransitionProps,
): void {
  const receipt = props.receipt as
    | AutoMoviePopulationTransitionReceipt
    | undefined;
  if (receipt === undefined || receipt === null || typeof receipt !== "object")
    throw new Error(
      "A complete-production reset requires a transition receipt.",
    );
  if (receipt.version !== 1)
    throw new Error(
      "A complete-production reset requires transition receipt version 1.",
    );
  if (receipt.kind !== props.kind)
    throw new Error(
      `Reset kind ${props.kind} does not match pilot receipt kind ${receipt.kind}.`,
    );
  if (
    typeof receipt.productionLocation !== "string" ||
    !path.isAbsolute(receipt.productionLocation) ||
    !path.isAbsolute(props.productionLocation) ||
    path.resolve(receipt.productionLocation) !==
      path.resolve(props.productionLocation)
  )
    throw new Error(
      "Reset production location does not match its pilot receipt.",
    );
  if (typeof receipt.owner !== "string" || receipt.owner.trim() === "")
    throw new Error("A reset transition receipt requires a non-empty owner.");
  if (typeof props.owner !== "string" || props.owner.trim() === "")
    throw new Error(
      "A complete-production reset requires a non-empty current owner.",
    );
  if (receipt.owner !== props.owner)
    throw new Error("Reset owner does not match its pilot transition receipt.");
  if (
    receipt.pilotScope === null ||
    typeof receipt.pilotScope !== "object" ||
    receipt.pilotScope.mode !== "first-pilot"
  )
    throw new Error("A reset transition receipt must describe a first pilot.");

  if (receipt.kind === "film") validateFilmReceipt(receipt, props.stages);
  else validateLibraryReceipt(receipt, props.stages);

  if (
    !Array.isArray(receipt.retainedHosts) ||
    receipt.retainedHosts.length === 0
  )
    throw new Error(
      "A reset transition receipt requires a retained pilot host.",
    );
  const expected = new Map<string, IAutoMovieRetainedPilotHost>();
  for (const host of receipt.retainedHosts) {
    if (
      host === null ||
      typeof host !== "object" ||
      typeof host.path !== "string"
    )
      throw new Error(
        "A reset transition receipt contains an invalid retained host.",
      );
    const hostPath = normalizeRelativePath(host.path);
    if (!SHA256.test(host.bodySha256) || !SHA256.test(host.evidenceTagSha256))
      throw new Error(
        `${hostPath}: retained pilot host has an invalid SHA-256 identity.`,
      );
    if (expected.has(hostPath))
      throw new Error(
        `${hostPath}: retained pilot host is repeated in the receipt.`,
      );
    expected.set(hostPath, { ...host, path: hostPath });
  }

  const current = new Map<string, IAutoMovieRetainedPilotHost>();
  for (const host of props.hosts) {
    const identity = createAutoMovieRetainedPilotHost(host);
    if (current.has(identity.path))
      throw new Error(
        `${identity.path}: reset host is repeated in the current population.`,
      );
    current.set(identity.path, identity);
    if (
      !expected.has(identity.path) &&
      parseAutoMovieEvidenceSyntax({ path: identity.path, source: host.source })
        .length !== 0
    )
      throw new Error(
        `${identity.path}: a new reset host cannot carry a retained pilot evidence tag.`,
      );
  }

  for (const [hostPath, ancestor] of expected) {
    const candidate = current.get(hostPath);
    if (candidate === undefined)
      throw new Error(
        `${hostPath}: retained pilot host is absent from the reset population.`,
      );
    if (candidate.bodySha256 !== ancestor.bodySha256)
      throw new Error(
        `${hostPath}: retained pilot authored body changed before reset.`,
      );
    if (candidate.evidenceTagSha256 !== ancestor.evidenceTagSha256)
      throw new Error(
        `${hostPath}: retained pilot evidence tags changed before reset.`,
      );
  }
}

/** Require the exact three reviewed film branches to reset together. */
function validateFilmReceipt(
  receipt: IAutoMovieFilmPopulationTransitionReceipt,
  stages: Readonly<Record<string, string>>,
): void {
  if (
    typeof receipt.pilotScope.partitionGroup !== "string" ||
    !/^001-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(receipt.pilotScope.partitionGroup)
  )
    throw new Error(
      "A film reset receipt requires one exact 001-* pilot partition.",
    );
  if (
    !Array.isArray(receipt.reviewedBranches) ||
    receipt.reviewedBranches.length !== FILM_BRANCHES.length ||
    FILM_BRANCHES.some(
      (branch, index) => receipt.reviewedBranches[index] !== branch,
    )
  )
    throw new Error(
      "A film reset receipt requires the complete reviewed narrative ladder.",
    );
  for (const branch of FILM_BRANCHES)
    if (stages[branch] !== "draft")
      throw new Error(
        `A film reset requires ${branch} to move to draft together.`,
      );
}

/** Require every recorded library design/source pair to reset together. */
function validateLibraryReceipt(
  receipt: IAutoMovieLibraryPopulationTransitionReceipt,
  stages: Readonly<Record<string, string>>,
): void {
  if (
    !Array.isArray(receipt.reviewedPairs) ||
    receipt.reviewedPairs.length !== 1
  )
    throw new Error(
      "A library reset receipt requires one exact reviewed design/source pair.",
    );
  const pair = receipt.reviewedPairs[0]!;
  if (
    pair === null ||
    typeof pair !== "object" ||
    typeof pair.design !== "string" ||
    typeof pair.source !== "string" ||
    LIBRARY_PAIRS.get(pair.design) !== pair.source
  )
    throw new Error(
      "A library reset receipt requires a recognized design/source branch pair.",
    );
  const recorded = `${pair.design}\0${pair.source}`;
  if (stages[pair.design] !== "draft" || stages[pair.source] !== "draft")
    throw new Error(
      `A library reset requires ${pair.design} and ${pair.source} to move to draft together.`,
    );
  for (const [design, source] of LIBRARY_PAIRS)
    if (
      stages[design] === "draft" &&
      stages[source] === "draft" &&
      recorded !== `${design}\0${source}`
    )
      throw new Error(
        `A library reset cannot lower unrecorded pair ${design}/${source} to draft.`,
      );
}

/** Remove only structural evidence rows from TypeScript documentation. */
function projectTypeScriptAuthoredBody(file: string, source: string): string {
  const ranges = parseAutoMovieEvidenceSyntax({ path: file, source });
  if (ranges.length === 0) return source;
  const lines = source.match(/[^\r\n]*(?:\r\n|\r|\n|$)/gu) ?? [];
  for (const range of ranges)
    for (let line = range.line; line <= range.endLine; line++) {
      const raw = lines[line - 1]!;
      const ending = /(?:\r\n|\r|\n)$/u.exec(raw)?.[0] ?? "";
      const content = raw.slice(0, raw.length - ending.length);
      const start =
        line === range.line
          ? content.indexOf("@evidence")
          : (/^(?:\s*\*\s?)/u.exec(content)?.[0].length ?? 0);
      const close = content.indexOf("*/", Math.max(start, 0));
      const end =
        line === range.endLine && close !== -1 ? close : content.length;
      lines[line - 1] =
        `${content.slice(0, start)}${content.slice(end)}${ending}`;
    }
  return lines.join("");
}

/** Validate and normalize one project-relative host identity. */
function normalizeRelativePath(value: string): string {
  const slashed = value.replaceAll("\\", "/");
  const normalized = path.posix.normalize(slashed);
  if (
    slashed !== value ||
    slashed === "" ||
    normalized !== slashed ||
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:/u.test(normalized) ||
    normalized.split("/").some((part) => part === "." || part === "..")
  )
    throw new Error(
      `${value}: expected a normalized project-relative host path.`,
    );
  return normalized;
}

/** Compute one lowercase SHA-256 identity. */
function digest(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
