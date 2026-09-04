import {
  type IAutoMovieEvidenceConfigProps,
  readAutoMovieProductionEvidence,
} from "@automovie/evidence";
import fs from "node:fs";
import path from "node:path";

import { renderAutoMovieProductionInstructionCandidate } from "./renderAutoMovieProductionRouter";
import { scaffoldAssetDirectory } from "./renderScaffold";
import { ScaffoldPublicationError, publishFiles } from "./writeFiles";

/**
 * Overwrite one generated project's shared instruction surface from its template.
 *
 * `AGENTS.md`, `CLAUDE.md`, and `.agents/skills` are generated and ignored.
 * Every fact the production owns remains tracked elsewhere: the package
 * manifest, `lint.config.ts`, authored documents, source, and local
 * contracts. Sync therefore removes the old shipped skill tree before copying
 * the installed one, so a renamed doctrine file cannot survive as a stale fork.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Rebuilds agent instructions from the installed public toolchain and project-owned tracked declaration.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Publishes the current routed authoring procedure and exact project contract inventory.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-choice-surface-discovery Replaces stale generated doctrine with the installed shape-aware instruction surface.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Derives generated instructions from explicit tracked project input and the installed contract version.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-extension-compatibility Delivers additive doctrine upgrades without rewriting production-owned content.
 */
export const writeAutoMovieProductionInstructions = (props: {
  /** Generated-project root whose instruction surface is replaced. */
  root: string;
  /** The same tracked declaration exported by `lint.config.ts`. */
  productionEvidence: IAutoMovieEvidenceConfigProps;
  /** Alternate scaffold asset root used only by deterministic consumers/tests. */
  scaffoldRoot?: string;
}): string[] => {
  const root = path.resolve(props.root);
  const scaffoldRoot = path.resolve(
    props.scaffoldRoot ?? scaffoldAssetDirectory(),
  );
  assertManagedRootIsPhysical(root);
  const sourceSkills = path.join(scaffoldRoot, ".agents", "skills");
  if (!fs.existsSync(sourceSkills))
    throw new Error(
      `${sourceSkills}: the installed production skills are missing.`,
    );
  assertInstructionSourceIsPhysical(sourceSkills);
  if (fs.realpathSync(root) === fs.realpathSync(scaffoldRoot))
    throw new Error(
      `${root}: a scaffold source cannot synchronize instructions into itself.`,
    );

  const targetSkills = path.join(root, ".agents", "skills");
  const agents = path.join(root, "AGENTS.md");
  const claude = path.join(root, "CLAUDE.md");
  assertManagedPathIsPhysical(root, targetSkills, "directory");
  assertManagedPathIsPhysical(root, agents, "file");
  assertManagedPathIsPhysical(root, claude, "file");

  const identity = readAutoMovieProductionEvidence({
    root,
    productionEvidence: props.productionEvidence,
  });
  const sources = Object.create(null) as Record<string, string>;
  collectInstructionFiles({
    directory: sourceSkills,
    files: sources,
    relative: path.join(".agents", "skills"),
  });
  for (const relative of new Set([
    "docs/README.md",
    ...identity.contracts.map((contract) => contract.path),
    ...identity.designOwners.map((owner) => owner.path),
  ]))
    collectProjectInstructionTarget(root, relative, sources);
  const files = renderAutoMovieProductionInstructionCandidate({
    evidence: identity,
    sources,
  });
  const receipt = publishFiles(root, files, { force: true });
  if (receipt.status !== "completed")
    throw new ScaffoldPublicationError(receipt);
  removeStaleInstructionEntries(targetSkills, new Set(Object.keys(files)));
  return [targetSkills, agents, claude];
};

/** Add one dynamic project document addressed by the generated root router. */
const collectProjectInstructionTarget = (
  root: string,
  relative: string,
  files: Record<string, string>,
): void => {
  const target = path.resolve(root, relative);
  const contained = path.relative(root, target);
  if (
    contained === "" ||
    contained === ".." ||
    contained.startsWith(`..${path.sep}`) ||
    path.isAbsolute(contained)
  )
    throw new Error(
      `${relative}: instruction target escapes the project root.`,
    );
  const metadata = fs.lstatSync(target, { throwIfNoEntry: false });
  if (metadata === undefined || metadata.isSymbolicLink() || !metadata.isFile())
    throw new Error(`${relative}: instruction target is not a physical file.`);
  files[relative.replaceAll("\\", "/")] = fs.readFileSync(target, "utf8");
};

/** Read the whole installed instruction candidate before target mutation. */
const collectInstructionFiles = (props: {
  directory: string;
  files: Record<string, string>;
  relative: string;
}): void => {
  for (const entry of fs
    .readdirSync(props.directory, { withFileTypes: true })
    .sort(
      (left, right) =>
        Number(left.name > right.name) - Number(left.name < right.name),
    )) {
    const source = path.join(props.directory, entry.name);
    const relative = path.join(props.relative, entry.name);
    if (entry.isDirectory())
      collectInstructionFiles({
        directory: source,
        files: props.files,
        relative,
      });
    else if (entry.isFile())
      props.files[relative] = fs.readFileSync(source, "utf8");
    else
      throw new Error(
        `${source}: installed production instructions must contain only physical files and directories.`,
      );
  }
};

/** Remove stale generated doctrine only after every desired file completed. */
const removeStaleInstructionEntries = (
  targetSkills: string,
  desiredFiles: ReadonlySet<string>,
): void => {
  const root = path.dirname(path.dirname(targetSkills));
  const desired = new Set(
    [...desiredFiles].map((entry) =>
      canonicalInstructionPath(path.resolve(root, entry)),
    ),
  );
  const visit = (directory: string): void => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(target);
        if (fs.readdirSync(target).length === 0) fs.rmdirSync(target);
      } else if (!desired.has(canonicalInstructionPath(path.resolve(target))))
        fs.rmSync(target, { force: true });
    }
  };
  visit(targetSkills);
};

const canonicalInstructionPath = (target: string): string =>
  process.platform === "win32" ? target.toLowerCase() : target;

/** Refuse a generated-project root that aliases or is not a directory. */
const assertManagedRootIsPhysical = (root: string): void => {
  let cursor = path.parse(root).root;
  const segments = path
    .relative(cursor, root)
    .split(path.sep)
    .filter((segment) => segment.length !== 0);
  for (const segment of ["", ...segments]) {
    cursor = path.join(cursor, segment);
    const metadata = fs.lstatSync(cursor, { throwIfNoEntry: false });
    if (
      metadata === undefined ||
      metadata.isSymbolicLink() ||
      !metadata.isDirectory()
    )
      throw new Error(
        `${cursor}: the generated project root must have a physical directory ancestry.`,
      );
  }
};

/** Refuse links and non-directories anywhere in the installed skill tree. */
const assertInstructionSourceIsPhysical = (directory: string): void => {
  const metadata = fs.lstatSync(directory);
  if (metadata.isSymbolicLink() || !metadata.isDirectory())
    throw new Error(
      `${directory}: the installed production skills are missing or linked.`,
    );
  for (const entry of fs
    .readdirSync(directory, { withFileTypes: true })
    .sort(
      (left, right) =>
        Number(left.name > right.name) - Number(left.name < right.name),
    )) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(
        `${target}: installed production skills may not contain links.`,
      );
    if (entry.isDirectory()) assertInstructionSourceIsPhysical(target);
  }
};

/** Refuse a generated instruction path whose existing component is a link. */
const assertManagedPathIsPhysical = (
  root: string,
  target: string,
  expected: "directory" | "file",
): void => {
  let cursor = root;
  const segments = path.relative(root, target).split(path.sep);
  for (const [index, segment] of segments.entries()) {
    cursor = path.join(cursor, segment);
    const metadata = fs.lstatSync(cursor, { throwIfNoEntry: false });
    if (metadata === undefined) return;
    if (metadata.isSymbolicLink())
      throw new Error(
        `${cursor}: generated instruction paths may not be links.`,
      );
    const final = index === segments.length - 1;
    if (!final && !metadata.isDirectory())
      throw new Error(
        `${cursor}: generated instruction parent paths must be directories.`,
      );
    if (
      final &&
      (expected === "directory" ? !metadata.isDirectory() : !metadata.isFile())
    )
      throw new Error(
        `${cursor}: the generated instruction target must be a ${expected}.`,
      );
  }
};
