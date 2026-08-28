import {
  type IAutoMovieEvidenceConfigProps,
  readAutoMovieProductionEvidence,
} from "@automovie/evidence";
import fs from "node:fs";
import path from "node:path";

import { renderAutoMovieProductionRouter } from "./renderAutoMovieProductionRouter";
import { scaffoldAssetDirectory } from "./renderScaffold";

/**
 * Overwrite one generated project's shared instruction surface from its template.
 *
 * `AGENTS.md`, `CLAUDE.md`, and `.agents/skills` are generated and ignored.
 * Every fact the production owns remains tracked elsewhere: the package
 * manifest, `productionEvidence.ts`, authored documents, source, and local
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
  /** The same tracked declaration imported by `lint.config.ts`. */
  productionEvidence: IAutoMovieEvidenceConfigProps;
  /** Alternate scaffold asset root used only by deterministic consumers/tests. */
  scaffoldRoot?: string;
}): string[] => {
  const root = path.resolve(props.root);
  const scaffoldRoot = path.resolve(
    props.scaffoldRoot ?? scaffoldAssetDirectory(),
  );
  const sourceSkills = path.join(scaffoldRoot, ".agents", "skills");
  if (!fs.existsSync(sourceSkills))
    throw new Error(
      `${sourceSkills}: the installed production skills are missing.`,
    );
  assertInstructionSourceIsPhysical(sourceSkills);
  const productionSkill = path.join(sourceSkills, "production", "SKILL.md");
  if (!fs.lstatSync(productionSkill, { throwIfNoEntry: false })?.isFile())
    throw new Error(
      `${productionSkill}: the installed production skill entry point is missing.`,
    );
  if (fs.realpathSync(root) === fs.realpathSync(scaffoldRoot))
    throw new Error(
      `${root}: a scaffold source cannot synchronize instructions into itself.`,
    );

  const targetSkills = path.join(root, ".agents", "skills");
  const agents = path.join(root, "AGENTS.md");
  const claude = path.join(root, "CLAUDE.md");
  for (const target of [targetSkills, agents, claude])
    assertManagedPathIsPhysical(root, target);

  const identity = readAutoMovieProductionEvidence({
    root,
    productionEvidence: props.productionEvidence,
  });
  fs.rmSync(targetSkills, { force: true, recursive: true });
  fs.mkdirSync(path.dirname(targetSkills), { recursive: true });
  fs.cpSync(sourceSkills, targetSkills, { recursive: true });

  fs.writeFileSync(agents, renderAutoMovieProductionRouter(identity), "utf8");
  fs.writeFileSync(claude, "@AGENTS.md\n", "utf8");
  return [targetSkills, agents, claude];
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
const assertManagedPathIsPhysical = (root: string, target: string): void => {
  let cursor = root;
  for (const segment of path.relative(root, target).split(path.sep)) {
    cursor = path.join(cursor, segment);
    const metadata = fs.lstatSync(cursor, { throwIfNoEntry: false });
    if (metadata === undefined) return;
    if (metadata.isSymbolicLink())
      throw new Error(
        `${cursor}: generated instruction paths may not be links.`,
      );
  }
};
