import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import {
  type IAutoMovieEvidenceConfigProps,
  createAutoMovieContractBindingManifest,
} from "./createAutoMovieEvidenceConfig";
import { walkAutoMovieProjectPopulationFiles } from "./walkAutoMovieProjectPopulationFiles";

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
 * One graph-selected source export and the exact authored unit it realizes.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Exposes an executable source owner through the reusable production-evidence view.
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Carries the selected export, target, source digest, stage, and review state together.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Carries one reusable resolved source-owner edge in the visible declaration projection.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Represents one exact graph-selected export-to-authored-unit binding.
 * @author Samchon
 */
export interface IAutoMovieProductionEvidenceSourceOwnerBinding {
  /** Source branch that selected this edge. */
  branch: string;
  /** Current lifecycle stage of that source branch. */
  stage: string;
  /** Whether the graph currently enforces this relationship. */
  enforced: boolean;
  /** Exact graph relationship carried into runtime admission. */
  relationship: "lineage";
  /** Canonical project-relative POSIX source path. */
  sourcePath: string;
  /** Named top-level export that carries the citation. */
  exportName: string;
  /** Evidence symbol kind of that export. */
  symbolKind: "function" | "property" | "type";
  /** SHA-256 of the normalized source bytes inspected for this edge. */
  sourceDigest: string;
  /** Canonical project-relative POSIX authored target path. */
  targetPath: string;
  /** Exact explicit target anchor without `#`. */
  targetAnchor: string;
  /** Whether a review-stage edge carries the current target fingerprint. */
  reviewed: boolean;
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
  /** Exact graph-selected export-to-owner edges available to compilation. */
  sourceOwners: readonly IAutoMovieProductionEvidenceSourceOwnerBinding[];
  /** Exact flat project-local contract inventory. */
  contracts: readonly IAutoMovieProductionEvidenceContract[];
}

interface IMarkdownDocument {
  path: string;
  title: string;
  units: IAutoMovieProductionEvidenceUnit[];
}

interface IMarkdownSourceOwnerTarget {
  anchor: string;
  depth: number;
  fingerprint: string;
  path: string;
  relativeTarget: string;
}

interface ISourceOwnerExport {
  exportName: string;
  nodes: readonly ts.Node[];
  symbolKind: "function" | "property" | "type";
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
  const sourceOwners = sourceOwnerBindingsOf(root, manifest.bindings);

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

  return {
    root,
    ...packageIdentity,
    configuration: props.productionEvidence,
    manifest,
    designBranches: branches,
    designOwners,
    sourceOwners,
    contracts,
  };
};

/** Resolve the runtime-bearing lineage edges selected by the live manifest. */
const sourceOwnerBindingsOf = (
  root: string,
  bindings: ReturnType<
    typeof createAutoMovieContractBindingManifest
  >["bindings"],
): IAutoMovieProductionEvidenceSourceOwnerBinding[] => {
  const output: IAutoMovieProductionEvidenceSourceOwnerBinding[] = [];
  const seen = new Set<string>();
  for (const binding of bindings) {
    if (
      binding.relationship !== "lineage" ||
      binding.host.type !== "typescript" ||
      binding.target.type !== "population" ||
      binding.target.symbols.some((symbol) => /^h[234]$/u.test(symbol)) ===
        false
    )
      continue;
    const targetSymbols = new Set(binding.target.symbols);
    const targets = new Map<string, IMarkdownSourceOwnerTarget>();
    for (const file of resolvePopulationFiles(
      root,
      binding.target.root,
      binding.target.files,
      ".md",
    )) {
      const absolute = path.resolve(root, file);
      for (const target of markdownSourceOwnerTargets(
        root,
        binding.target.root,
        absolute,
      ))
        if (targetSymbols.has(`h${target.depth}`))
          targets.set(target.relativeTarget, target);
    }
    for (const sourcePath of resolvePopulationFiles(
      root,
      binding.host.root,
      binding.host.files,
    )) {
      const source = readNormalizedSource(path.resolve(root, sourcePath));
      const sourceDigest = `sha256:${crypto
        .createHash("sha256")
        .update(source)
        .digest("hex")}`;
      const parsed = ts.createSourceFile(
        sourcePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      for (const owner of exportedSourceOwners(parsed)) {
        if (binding.host.symbols.includes(owner.symbolKind) === false) continue;
        const tags = jsDocTagsOf(owner.nodes);
        const reviews = new Map<string, string[]>();
        for (const tag of tags.filter((tag) => tag.name === "evidenceReview")) {
          const [target, fingerprint, ...description] =
            tag.comment.split(/\s+/u);
          if (
            target === undefined ||
            fingerprint === undefined ||
            /^#[0-9a-f]{7}$/u.test(fingerprint) === false ||
            description.length === 0
          )
            continue;
          reviews.set(target, [
            ...(reviews.get(target) ?? []),
            fingerprint.slice(1),
          ]);
        }
        for (const tag of tags.filter((tag) => tag.name === "evidence")) {
          const [cited, ...reason] = tag.comment.split(/\s+/u);
          if (cited === undefined || reason.length === 0) continue;
          const target = targets.get(cited);
          if (target === undefined) continue;
          const identity = JSON.stringify([
            binding.branch,
            sourcePath,
            owner.exportName,
            target.relativeTarget,
          ]);
          if (seen.has(identity)) continue;
          seen.add(identity);
          output.push({
            branch: binding.branch,
            stage: binding.stage,
            enforced: binding.enforced,
            relationship: "lineage",
            sourcePath,
            exportName: owner.exportName,
            symbolKind: owner.symbolKind,
            sourceDigest,
            targetPath: target.path,
            targetAnchor: target.anchor,
            reviewed:
              binding.stage === "review" &&
              reviews.get(target.relativeTarget)?.length === 1 &&
              reviews.get(target.relativeTarget)?.[0] === target.fingerprint,
          });
        }
      }
    }
  }
  return output.sort((left, right) =>
    compareCodeUnits(
      JSON.stringify([
        left.branch,
        left.sourcePath,
        left.exportName,
        left.targetPath,
        left.targetAnchor,
      ]),
      JSON.stringify([
        right.branch,
        right.sourcePath,
        right.exportName,
        right.targetPath,
        right.targetAnchor,
      ]),
    ),
  );
};

/** Read source in the same BOM and line-ending form the compiler executes. */
const readNormalizedSource = (file: string): string => {
  let source = fs.readFileSync(file, "utf8");
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  return source.replace(/\r\n?/gu, "\n");
};

/** Enumerate named top-level exports with their evidence symbol identity. */
const exportedSourceOwners = (source: ts.SourceFile): ISourceOwnerExport[] => {
  const local = new Map<
    string,
    { nodes: ts.Node[]; symbolKind: ISourceOwnerExport["symbolKind"] }
  >();
  const exposed = new Map<string, string>();
  const modifiers = (node: ts.Node): readonly ts.Modifier[] =>
    ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
  const directlyExported = (node: ts.Node): boolean =>
    modifiers(node).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
  const defaultExported = (node: ts.Node): boolean =>
    modifiers(node).some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    );
  const remember = (
    name: string,
    node: ts.Node,
    symbolKind: ISourceOwnerExport["symbolKind"],
  ): void => {
    const present = local.get(name);
    if (present === undefined) local.set(name, { nodes: [node], symbolKind });
    else present.nodes.push(node);
  };
  for (const statement of source.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier === undefined &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause)
    )
      for (const element of statement.exportClause.elements)
        if (!element.isTypeOnly)
          exposed.set(
            element.name.text,
            (element.propertyName ?? element.name).text,
          );
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) {
          remember(declaration.name.text, statement, "property");
          if (directlyExported(statement))
            exposed.set(declaration.name.text, declaration.name.text);
        }
    if (ts.isFunctionDeclaration(statement)) {
      const localName = statement.name?.text ?? `\0default:${statement.pos}`;
      remember(localName, statement, "function");
      if (directlyExported(statement))
        exposed.set(
          defaultExported(statement) ? "default" : localName,
          localName,
        );
    }
    if (
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
    ) {
      const localName = statement.name?.text ?? `\0default:${statement.pos}`;
      remember(localName, statement, "type");
      if (directlyExported(statement))
        exposed.set(
          defaultExported(statement) ? "default" : localName,
          localName,
        );
    }
  }
  return [...exposed]
    .flatMap(([exportName, localName]) => {
      const entry = local.get(localName);
      return entry === undefined ? [] : [{ ...entry, exportName }];
    })
    .sort((left, right) => compareCodeUnits(left.exportName, right.exportName));
};

/** Read parser-owned custom JSDoc tags without scanning comment-shaped text. */
const jsDocTagsOf = (
  nodes: readonly ts.Node[],
): Array<{ name: string; comment: string }> =>
  nodes.flatMap((node) =>
    ts.getJSDocTags(node).map((tag) => ({
      name: tag.tagName.text,
      comment:
        typeof tag.comment === "string"
          ? tag.comment.trim()
          : (tag.comment ?? [])
              .map((part) => part.text)
              .join("")
              .trim(),
    })),
  );

/** Materialize exact Markdown target identities and current fingerprints. */
const markdownSourceOwnerTargets = (
  projectRoot: string,
  populationRoot: string,
  file: string,
): IMarkdownSourceOwnerTarget[] => {
  const source = fs.readFileSync(file, "utf8").replace(/\r\n?/gu, "\n");
  const headings = markdownHeadings(source);
  const digestLines = markdownFingerprintLines(source);
  const relative = posix(
    path.relative(path.resolve(projectRoot, populationRoot), file),
  );
  const units: Array<
    IMarkdownHeading & {
      digest: string;
      parent: number | undefined;
      target: string;
    }
  > = [];
  const owned = new Map<number, string[]>();
  const headingsByLine = new Map(
    headings.map((heading) => [heading.line, heading]),
  );
  const stack: number[] = [];
  let current: number | undefined;
  for (let line = 1; line <= digestLines.length; ++line) {
    const heading = headingsByLine.get(line);
    if (heading !== undefined) {
      while (
        stack.length !== 0 &&
        units[stack[stack.length - 1]!]!.depth >= heading.depth
      )
        stack.pop();
      if (heading.depth <= 4 && heading.anchor !== undefined) {
        current = units.length;
        units.push({
          ...heading,
          digest: "",
          parent: stack[stack.length - 1],
          target: `${relative}#${heading.anchor}`,
        });
        stack.push(current);
      } else current = stack[stack.length - 1];
    }
    const content = digestLines[line - 1];
    if (current !== undefined && content !== null)
      owned.set(current, [...(owned.get(current) ?? []), content]);
  }
  for (const [index, unit] of units.entries()) {
    const contentLines = (owned.get(index) ?? []).map((line) => line.trimEnd());
    while (contentLines[contentLines.length - 1] === "") contentLines.pop();
    const content = contentLines.join("\n");
    unit.digest = crypto.createHash("sha256").update(content).digest("hex");
  }
  return units
    .map((unit, index) => ({ unit, index }))
    .filter(({ unit }) => unit.anchor !== undefined)
    .map(({ unit, index }) => {
      const scope = units
        .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
        .filter(({ candidateIndex }) => {
          let cursor: number | undefined = candidateIndex;
          while (cursor !== undefined) {
            if (cursor === index) return true;
            cursor = units[cursor]!.parent;
          }
          return false;
        })
        .map(({ candidate }) => candidate)
        .sort((left, right) =>
          compareCodeUnits(
            `${left.target}\0h${left.depth}\0${left.digest}`,
            `${right.target}\0h${right.depth}\0${right.digest}`,
          ),
        );
      const composite = crypto.createHash("sha256");
      for (const entry of scope)
        composite.update(`${entry.target}\0h${entry.depth}\0${entry.digest}\0`);
      return {
        path: posix(path.relative(projectRoot, file)),
        anchor: unit.anchor!,
        depth: unit.depth,
        relativeTarget: unit.target,
        fingerprint: composite.digest("hex").slice(0, 7),
      };
    });
};

/** Read the tracked package identity without inventing a missing description. */
const readPackageIdentity = (
  root: string,
): { packageName: string; description: string } => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  ) as { name?: unknown; description?: unknown };
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
  const headings = markdownHeadings(source);
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

interface IMarkdownHeading {
  anchor: string | undefined;
  depth: number;
  line: number;
  title: string;
}

/** Extract visible ATX headings while ignoring comments and fenced examples. */
const markdownHeadings = (source: string): IMarkdownHeading[] => {
  const output: IMarkdownHeading[] = [];
  for (const [index, line] of visibleMarkdownLines(source).entries()) {
    const heading = /^ {0,3}(#{1,6})(?!#)(?:[ \t]+(.*)|[ \t]*)$/u.exec(line);
    if (heading === null) continue;
    let rawTitle = (heading[2] ?? "").trim();
    const withoutClosingHashes = rawTitle.replace(/[ \t]+#+[ \t]*$/u, "");
    if (withoutClosingHashes !== rawTitle)
      rawTitle = withoutClosingHashes.trim();
    const anchored = /[ \t]*\{#([A-Za-z0-9][A-Za-z0-9._:-]*)\}[ \t]*$/u.exec(
      rawTitle,
    );
    const title = rawTitle
      .replace(/[ \t]*\{#[A-Za-z0-9][A-Za-z0-9._:-]*\}[ \t]*$/u, "")
      .trim();
    output.push({
      anchor: anchored?.[1] ?? (markdownSlug(title) || undefined),
      depth: heading[1]!.length,
      line: index + 1,
      title,
    });
  }
  return output;
};

/** Derive the same Unicode-aware implicit anchor used by evidence targets. */
const markdownSlug = (title: string): string => {
  let output = "";
  let hyphen = false;
  for (const character of title.toLowerCase())
    if (
      /^\p{L}$/u.test(character) ||
      /^\p{N}$/u.test(character) ||
      character === "_"
    ) {
      output += character;
      hyphen = false;
    } else if (
      (character === "-" || /^\s$/u.test(character)) &&
      output !== ""
    ) {
      if (hyphen === false) output += "-";
      hyphen = true;
    }
  return output.replace(/-$/u, "");
};

/** Preserve authored Markdown content while removing exact tag positions. */
const markdownFingerprintLines = (source: string): Array<string | null> => {
  const output: Array<string | null> = [];
  let fence: { character: "`" | "~"; length: number } | undefined;
  let htmlComment = false;
  for (const sourceLine of source.split("\n")) {
    if (fence !== undefined) {
      output.push(sourceLine);
      if (
        new RegExp(
          `^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`,
          "u",
        ).test(sourceLine)
      )
        fence = undefined;
      continue;
    }
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(sourceLine)?.[1];
    if (marker !== undefined) {
      fence = {
        character: marker[0] as "`" | "~",
        length: marker.length,
      };
      output.push(sourceLine);
      continue;
    }
    const trimmed = sourceLine.trimStart();
    if (htmlComment || trimmed.startsWith("<!--")) {
      if (sourceLine.includes("-->")) htmlComment = false;
      else htmlComment = true;
      output.push(null);
      continue;
    }
    output.push(sourceLine.replace(/<!--.*?-->/gu, ""));
  }
  return output;
};

/** Blank Markdown comments and fenced code without changing line addresses. */
const visibleMarkdownLines = (source: string): string[] => {
  const output: string[] = [];
  let fence: { character: "`" | "~"; length: number } | undefined;
  let htmlComment = false;
  for (const sourceLine of source.split(/\r?\n/u)) {
    if (fence !== undefined) {
      if (
        new RegExp(
          `^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`,
          "u",
        ).test(sourceLine)
      )
        fence = undefined;
      output.push("");
      continue;
    }
    let line = "";
    for (let cursor = 0; cursor < sourceLine.length; ) {
      if (htmlComment) {
        const close = sourceLine.indexOf("-->", cursor);
        if (close === -1) {
          line += " ".repeat(sourceLine.length - cursor);
          break;
        }
        line += " ".repeat(close + 3 - cursor);
        cursor = close + 3;
        htmlComment = false;
      } else {
        const open = sourceLine.indexOf("<!--", cursor);
        if (open === -1) {
          line += sourceLine.slice(cursor);
          break;
        }
        line += `${sourceLine.slice(cursor, open)}    `;
        cursor = open + 4;
        htmlComment = true;
      }
    }
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
    if (marker !== undefined) {
      fence = {
        character: marker[0] as "`" | "~",
        length: marker.length,
      };
      output.push("");
      continue;
    }
    output.push(line);
  }
  return output;
};

/** Resolve manifest source globs without walking unrelated project trees. */
const resolvePopulationFiles = (
  projectRoot: string,
  populationRoot: string,
  patterns: readonly string[],
  extension: ".md" | ".ts" = ".ts",
): string[] => {
  const root = path.resolve(projectRoot, populationRoot);
  const candidates = walkAutoMovieProjectPopulationFiles(
    projectRoot,
    root,
    extension,
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
