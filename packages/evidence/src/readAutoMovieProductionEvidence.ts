import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IAutoMovieEvidenceConfigProps,
  createAutoMovieContractBindingManifest,
} from "./createAutoMovieEvidenceConfig";
import { parseAutoMovieEvidenceMarkdownHeadings } from "./parseAutoMovieEvidenceMarkdown";
import {
  isAutoMovieEvidencePhysicalFile,
  walkAutoMovieProjectPopulationFiles,
} from "./walkAutoMovieProjectPopulationFiles";
import {
  type IAutoMovieEvidenceReviewAlarmReport,
  inspectAutoMovieEvidenceReviewAlarms,
} from "./inspectAutoMovieEvidenceReviewAlarms";
import {
  type IAutoMovieContractRule,
  readAutoMovieContractRules,
} from "./readAutoMovieContractRules";

/**
 * One exact H2 unit carried by a production-owned contract or design owner.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Exposes one typed unit in the generated project's production-evidence view.
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the exact anchored unit and current digest visible to project-owned consumers.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Carries one reusable unit identity in the visible declaration projection.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Represents one selected owner unit and its canonical content state.
 * @author Samchon
 */
export interface IAutoMovieProductionEvidenceUnit {
  /** Stable evidence address without the leading `#`. */
  anchor: string;
  /** Human-readable heading text without its evidence anchor. */
  title: string;
  /** SHA-256 of this H2's canonical LF text through the next H2 or EOF. */
  digest: string;
}

/**
 * The source population that realizes one active design branch.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Exposes one typed source population in the generated project's production-evidence view.
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the selected source branch, stage, symbols, and files visible together.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Carries one reusable source-binding state in the visible declaration projection.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Represents the exact source population attached to one selected design branch.
 * @author Samchon
 */
export interface IAutoMovieProductionEvidenceSourceBinding {
  /** Source branch identity derived from the binding manifest. */
  branch: string;
  /** Current lifecycle stage of that source branch. */
  stage: string;
  /** Whether the graph currently enforces this lineage relationship. */
  enforced: boolean;
  /** Evidence root of the source population. */
  root: string;
  /** Exact manifest globs selecting the source population. */
  files: readonly string[];
  /** Exact manifest symbol kinds selected from those files. */
  symbols: readonly string[];
  /** Existing project-relative source files selected by the manifest globs. */
  paths: readonly string[];
}

/**
 * One exact production-owned design document selected by the live graph.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Exposes one typed design owner in the generated project's production-evidence view.
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the exact owner file, H2 units, and source binding visible together.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Carries one reusable design-owner state in the visible declaration projection.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Represents one selected design document and its exact unit denominator.
 * @author Samchon
 */
export interface IAutoMovieProductionEvidenceDesignOwner {
  /** Authored design branch identity derived from the binding manifest. */
  branch: string;
  /** Project-relative POSIX path of the design owner. */
  path: string;
  /** The document's sole H1 title. */
  title: string;
  /** Exact H2 denominator in document order. */
  units: readonly IAutoMovieProductionEvidenceUnit[];
  /** Active source lineage for this owner, or null before that branch starts. */
  sourceBinding: IAutoMovieProductionEvidenceSourceBinding | null;
}

/**
 * One active design branch, retained even when its owner population is empty.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Exposes one typed active design branch in the generated project's production-evidence view.
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Keeps the selected design and source stages visible even before an owner exists.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Carries one reusable design-branch state in the visible declaration projection.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Represents one active design branch and its manifest-derived source relationship.
 * @author Samchon
 */
export interface IAutoMovieProductionEvidenceDesignBranch {
  /** Authored design branch identity derived from the binding manifest. */
  branch: string;
  /** Current lifecycle stage of the authored design branch. */
  designStage: string;
  /** Active source lineage, or null before that source branch starts. */
  sourceBinding: IAutoMovieProductionEvidenceSourceBinding | null;
}

/**
 * One flat production-local contract and every H2 item it declares.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Exposes one typed local contract in the generated project's production-evidence view.
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes each project-owned additive contract and H2 item visible.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Carries one reusable local-contract state in the visible declaration projection.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Represents the exact flat local target inventory appended by the project.
 * @author Samchon
 */
export interface IAutoMovieProductionEvidenceContract {
  /** Project-relative POSIX path under `docs/contracts`. */
  path: string;
  /** The document's sole H1 title. */
  title: string;
  /** Exact H2 contract inventory in document order. */
  items: readonly IAutoMovieProductionEvidenceUnit[];
}

/**
 * The project-owned authoring identity derived from one evidence declaration.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Exposes a typed project view derived from the same declaration that governs lint.
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Carries the selected kind, active branches, owners, and contracts without a second routing list.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Carries the reusable production evidence system's inspected authoring identity.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Represents the visible declaration together with its exact physical owner projection.
 * @author Samchon
 */
export interface IAutoMovieProductionEvidence {
  /** Absolute generated-project root inspected by the reader. */
  root: string;
  /** Package identity from the tracked manifest. */
  packageName: string;
  /** Trimmed package description, or an empty string when absent. */
  description: string;
  /** The exact tracked declaration supplied to lint and this reader. */
  configuration: IAutoMovieEvidenceConfigProps;
  /** Shape-aware binding manifest derived by the evidence factory. */
  manifest: ReturnType<typeof createAutoMovieContractBindingManifest>;
  /** Active design branches, including an exact empty owner population. */
  designBranches: readonly IAutoMovieProductionEvidenceDesignBranch[];
  /** Exact active design owner denominator and its source lineage. */
  designOwners: readonly IAutoMovieProductionEvidenceDesignOwner[];
  /** Exact flat project-local contract inventory. */
  contracts: readonly IAutoMovieProductionEvidenceContract[];
  /** Complete structured local rule inventory, including held and rejected rules. */
  contractRules: readonly IAutoMovieContractRule[];
  /** Non-gating semantic alarms that require a fresh evidence Self-Review. */
  reviewAlarms: IAutoMovieEvidenceReviewAlarmReport;
}

interface IMarkdownDocument {
  path: string;
  title: string;
  units: IAutoMovieProductionEvidenceUnit[];
}

/**
 * Read one generated project's graph-backed authoring identity synchronously.
 *
 * The caller supplies the same tracked `productionEvidence` object exported by
 * the generated project's typed `lint.config.ts`. The reader refuses a
 * declaration for another root, derives the shape-aware manifest through the
 * evidence factory, then reads only the active design owners and flat local
 * contracts that manifest governs. Source lineage and physical source paths
 * come from the manifest rather than from a second model-to-source table.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Implements a reusable inspection of the generated project's declared evidence identity.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Exposes shared bindings and production-local targets together without copying either inventory.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Reads only design branches selected by the canonical kind-and-stage declaration.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Refuses a foreign root and returns exact H1, H2, source population, and local-contract identities.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Uses code-unit path order and returns no partial result after validation failure.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Implements the synchronous project-identity reader over the reusable graph.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Reuses the canonical manifest instead of maintaining a second contract route list.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Projects active design branches from the canonical shape-and-stage machine.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Walks the exact selected real, non-linked owner and source populations and refuses ambiguous lineage.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Sorts filesystem-derived populations by portable code-unit order.
 * @author Samchon
 */
export const readAutoMovieProductionEvidence = (props: {
  root: string;
  productionEvidence: IAutoMovieEvidenceConfigProps;
}): IAutoMovieProductionEvidence => {
  const root = path.resolve(props.root);
  if (path.resolve(props.productionEvidence.location) !== root)
    throw new Error(
      `${props.productionEvidence.location}: productionEvidence belongs to another project root; expected ${root}.`,
    );

  const manifest = createAutoMovieContractBindingManifest(
    props.productionEvidence,
  );
  const packageIdentity = readPackageIdentity(root);
  const designBranches = new Set(
    manifest.bindings
      .filter(
        (binding) =>
          binding.host.type === "markdown" &&
          binding.relationship === "checklist" &&
          binding.target.type === "contract" &&
          binding.target.domain === "design",
      )
      .map((binding) => binding.branch),
  );

  const branches: IAutoMovieProductionEvidenceDesignBranch[] = [
    ...designBranches,
  ]
    .map((branch) => ({
      branch,
      designStage: manifest.branches.find((entry) => entry.name === branch)!
        .stage,
      sourceBinding: sourceBindingOf(root, branch, manifest.bindings),
    }))
    .sort((left, right) => compareCodeUnits(left.branch, right.branch));
  const designOwners: IAutoMovieProductionEvidenceDesignOwner[] = [];
  for (const branch of branches) {
    const ownerRoot = path.join(root, "docs", branch.branch);
    const sourceBinding = branch.sourceBinding;
    for (const file of listMarkdownFiles(root, ownerRoot)) {
      const document = readMarkdownDocument(root, file);
      designOwners.push({
        branch: branch.branch,
        path: document.path,
        title: document.title,
        units: document.units,
        sourceBinding,
      });
    }
  }
  designOwners.sort((left, right) => compareCodeUnits(left.path, right.path));

  const contracts = listMarkdownFiles(
    root,
    path.join(root, "docs", "contracts"),
  )
    .map((file) => readMarkdownDocument(root, file))
    .map((document) => ({
      path: document.path,
      title: document.title,
      items: document.units,
    }));
  const evidenceDocuments = (extension: ".md" | ".ts", directory: string) =>
    walkAutoMovieProjectPopulationFiles(
      root,
      path.join(root, directory),
      extension,
    ).map((file) => ({
      path: posix(path.relative(root, file)),
      source: fs.readFileSync(file, "utf8"),
    }));
  const targetDocuments = evidenceDocuments(".md", "docs");

  return {
    root,
    ...packageIdentity,
    configuration: props.productionEvidence,
    manifest,
    designBranches: branches,
    designOwners,
    contracts,
    contractRules: readAutoMovieContractRules(
      path.join(root, "docs", "contracts"),
    ),
    reviewAlarms: inspectAutoMovieEvidenceReviewAlarms({
      documents: [...targetDocuments, ...evidenceDocuments(".ts", "src")],
      targets: targetDocuments,
    }),
  };
};

/** Read the tracked package identity without inventing a missing description. */
const readPackageIdentity = (
  root: string,
): { packageName: string; description: string } => {
  const location = path.join(root, "package.json");
  if (!isAutoMovieEvidencePhysicalFile(fs.lstatSync(location)))
    throw new Error(
      `${location}: package identity must be one unlinked regular file.`,
    );
  const manifest = JSON.parse(fs.readFileSync(location, "utf8")) as {
    name?: unknown;
    description?: unknown;
  };
  if (typeof manifest.name !== "string" || manifest.name.trim() === "")
    throw new Error(`${root}: package.json declares no package name.`);
  return {
    packageName: manifest.name,
    description:
      typeof manifest.description === "string"
        ? manifest.description.trim()
        : "",
  };
};

/** Derive one design branch's active source lineage from manifest populations. */
const sourceBindingOf = (
  root: string,
  designBranch: string,
  bindings: ReturnType<
    typeof createAutoMovieContractBindingManifest
  >["bindings"],
): IAutoMovieProductionEvidenceSourceBinding | null => {
  const ownerPattern = `${designBranch}/**/*.md`;
  const candidates = bindings.filter(
    (binding) =>
      binding.relationship === "lineage" &&
      binding.host.type === "typescript" &&
      binding.target.type === "population" &&
      binding.target.root === "docs" &&
      binding.target.files.includes(ownerPattern),
  );
  if (candidates.length === 0) return null;
  const candidate = candidates[0]!;
  return {
    branch: candidate.branch,
    stage: candidate.stage,
    enforced: candidate.enforced,
    root: candidate.host.root,
    files: [...candidate.host.files],
    symbols: [...new Set(candidates.flatMap((item) => item.host.symbols))].sort(
      compareCodeUnits,
    ),
    paths: resolvePopulationFiles(
      root,
      candidate.host.root,
      candidate.host.files,
    ),
  };
};

/** Parse one governed Markdown document outside comments and fenced code. */
const readMarkdownDocument = (
  root: string,
  file: string,
): IMarkdownDocument => {
  const source = fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  const lines = source.split("\n");
  const headings = parseAutoMovieEvidenceMarkdownHeadings(source);
  const h1 = headings.find((heading) => heading.depth === 1)!;
  const h2 = headings.filter((heading) => heading.depth === 2);
  return {
    path: posix(path.relative(root, file)),
    title: h1.title,
    units: h2.map((heading, index) => {
      const next = h2[index + 1];
      const canonical = lines
        .slice(
          heading.line - 1,
          next === undefined ? lines.length : next.line - 1,
        )
        .join("\n");
      return {
        anchor: heading.anchor!,
        title: heading.title,
        digest: crypto.createHash("sha256").update(canonical).digest("hex"),
      };
    }),
  };
};

/** Resolve manifest source globs without walking unrelated project trees. */
const resolvePopulationFiles = (
  projectRoot: string,
  populationRoot: string,
  patterns: readonly string[],
): string[] => {
  const root = path.resolve(projectRoot, populationRoot);
  const candidates = walkAutoMovieProjectPopulationFiles(
    projectRoot,
    root,
    ".ts",
  );
  const selected = new Set(
    fs
      .globSync(patterns, { cwd: root })
      .map((file) => path.resolve(root, file)),
  );
  return candidates
    .filter((file) => selected.has(file))
    .map((file) => posix(path.relative(projectRoot, file)))
    .sort(compareCodeUnits);
};

/** List one already-validated Markdown population without leaving its root. */
const listMarkdownFiles = (projectRoot: string, root: string): string[] =>
  walkAutoMovieProjectPopulationFiles(projectRoot, root, ".md");

/** Stable code-unit ordering independent of host locale and ICU data. */
const compareCodeUnits = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);

/** Use POSIX separators in every project-relative public identity. */
const posix = (value: string): string => value.replaceAll("\\", "/");
