import * as fs from "node:fs";
import * as path from "node:path";

import { renderTemplate } from "./renderTemplate";
import { AUTOMOVIE_TEMPLATE_VERSIONS } from "./templateVersions";

/**
 * Files renamed as the scaffold is rendered. npm strips real `.gitignore` and
 * `.npmrc` files from a published package, so the assets ship without dots and
 * the rendered keys restore them.
 */
const RENAME: Record<string, string> = {
  gitignore: ".gitignore",
  npmrc: ".npmrc",
};

/**
 * Project-owned values interpolated into the starter's `{{...}}` tokens.
 *
 * @author Samchon
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Keeps the generated project's portable identity in explicit source input.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Carries that portable identity into deterministic scaffold derivation.
 */
export interface IAutoMovieScaffoldProps {
  /**
   * The created project's package name (replaces `{{name}}`).
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Restricts the name to a portable project identity rather than a host-private path.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Makes the project identity an explicit source input to scaffold derivation.
   */
  name: string;
}

/**
 * Normalize `\r\n` → `\n` so the scaffold emits identical bytes on every host
 * (a Windows checkout with `core.autocrlf` would otherwise ship CRLF and drift
 * from the starter's own `lf` convention). The tree is text-only, so this is
 * unconditionally safe.
 */
const normalizeLineEndings = (content: string): string =>
  content.replaceAll("\r\n", "\n");

/** POSIX-slash a path so map keys are host-independent. */
const toPosix = (value: string): string => value.split(path.sep).join("/");

/**
 * The rendered key for one scaffold-relative path.
 *
 * Production-owned prose uses `docs/{{name}}`, so path tokens receive the same
 * strict substitution and unknown-token failure as file payloads.
 */
const renderKey = (
  relative: string,
  variables: Readonly<Record<string, string>>,
): string => {
  const dir = path.dirname(relative);
  const base = RENAME[path.basename(relative)] ?? path.basename(relative);
  return renderTemplate(
    toPosix(dir === "." ? base : path.join(dir, base)),
    variables,
  );
};

/** Every file under `root`, root-relative, in deterministic sorted order. */
const listFiles = (root: string): string[] => {
  const out: string[] = [];
  const walk = (dir: string): void => {
    // Code-unit order, not localeCompare: the file listing must be identical
    // on every host (localeCompare varies with host locale/ICU build).
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(path.relative(root, full));
    }
  };
  walk(root);
  return out;
};

/**
 * Absolute path to the bundled starter assets, resolved relative to this module
 * so it works both from `src` (ttsx, in development) and the published `lib`
 * (the `scaffold/` folder ships alongside).
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-technique-example Locates the starter whose examples teach reusable authoring techniques instead of supplying finished production content.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Exposes the capability-oriented starter as the input to deterministic scaffold rendering.
 */
export const scaffoldAssetDirectory = (): string => {
  const directory = path.resolve(__dirname, "..", "scaffold");
  if (!fs.existsSync(directory))
    throw new Error(`scaffold assets are missing: ${directory}`);
  return directory;
};

/**
 * Render the bundled starter into an in-memory `{ posixPath: content }` map:
 * read every asset, normalize line endings, substitute `{{name}}` and the
 * catalog-synced `{{version:*}}` tokens, and rename shipped-safe filenames.
 *
 * The map is deliberately not written to disk here (that is {@link writeFiles}'s
 * job): separating the render from the write mirrors the reference scaffolder,
 * so the same output can be asserted in a test, written by the CLI, or handed
 * to another consumer without disk I/O in the middle.
 *
 * @author Samchon
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-technique-example Delivers the starter examples that explain one reusable technique, its controls, and its verification path.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Materializes the generated project's routed documentation corpus and its guide entry points.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-choice-surface-discovery Publishes the starter's documented authoring choices and declared capability limits together.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-diagnostic-discovery Ships the generated diagnostic commands and their documented recovery paths as ordinary project files.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-capability-gap-discovery Ships the contracts that distinguish missing implementation work from an unavailable product capability.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Emits examples as reusable authoring guidance while leaving each production's content in project-owned source.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-extension-compatibility Materializes an editable starter whose capability additions remain separate from project-owned content.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage Scaffold materialization emits starter bytes but does not execute the generated compiler that records output lineage.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-change-impact-invariant Scaffold materialization publishes the generated change-impact machinery but does not evaluate a production source change.
 * @evidence requirements/agent-authoring/README.md#에이전트-저작-요구사항 Publishes a portable starter whose documentation and examples expose reusable authoring capabilities.
 * @evidence requirements/product/README.md#제품-계약-요구사항 Materializes reusable AutoMovie capability while leaving production facts in project-owned source.
 * @evidence specifications/authoring-and-authority/README.md#저작과-권한-시스템-명세 Derives editable project source from explicit scaffold identity and pinned inputs.
 * @evidenceExclude requirements/product/authorability.md#product-authoring-choice-space Scaffold materialization does not implement the product authoring choice space requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/mcp-boundary.md#agent-mcp-authoring-api-refusal Scaffold materialization does not implement the agent mcp authoring api refusal requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/mcp-boundary.md#agent-mcp-content-supply-refusal Scaffold materialization does not implement the agent mcp content supply refusal requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/mcp-boundary.md#agent-mcp-contract-guidance Scaffold materialization does not implement the agent mcp contract guidance requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/mcp-boundary.md#agent-mcp-host-evidence Scaffold materialization does not implement the agent mcp host evidence requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/mcp-boundary.md#agent-mcp-no-surprise-external-effects Scaffold materialization does not implement the agent mcp no surprise external effects requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/mcp-boundary.md#agent-mcp-provider-neutrality Scaffold materialization does not implement the agent mcp provider neutrality requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-atomic-compilation Scaffold materialization does not implement the agent atomic compilation requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-declared-omission Scaffold materialization does not implement the agent declared omission requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-partial-result-control Scaffold materialization does not implement the agent partial result control requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-partial-verification-scope Scaffold materialization does not implement the agent partial verification scope requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-partial-work-gap-distinction Scaffold materialization does not implement the agent partial work gap distinction requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-resumable-authoring Scaffold materialization does not implement the agent resumable authoring requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md#agent-author-authority Scaffold materialization does not implement the agent author authority requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md#agent-director-authority Scaffold materialization does not implement the agent director authority requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md#agent-evidence-producer-authority Scaffold materialization does not implement the agent evidence producer authority requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md#agent-runtime-authority Scaffold materialization does not implement the agent runtime authority requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md#agent-user-delegation-authority Scaffold materialization does not implement the agent user delegation authority requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-change-impact-visibility Scaffold materialization does not implement the agent change impact visibility requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Scaffold materialization does not implement the agent narrowest valid check requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Scaffold materialization does not implement the agent ordinary code authoring requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-reviewable-source-change Scaffold materialization does not implement the agent reviewable source change requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Scaffold materialization does not implement the agent source result link requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/authorability.md#product-discoverable-control Scaffold materialization does not implement the product discoverable control requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/authorability.md#product-explicit-control Scaffold materialization does not implement the product explicit control requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/authorability.md#product-hidden-inference-refusal Scaffold materialization does not implement the product hidden inference refusal requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/charter.md#product-author-owned-film Scaffold materialization does not implement the product author owned film requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/charter.md#product-reproducible-judgment Scaffold materialization does not implement the product reproducible judgment requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/charter.md#product-structural-output Scaffold materialization does not implement the product structural output requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-delegation-not-proxy-decision Scaffold materialization does not implement the product delegation not proxy decision requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-deterministic-external-adoption Scaffold materialization does not implement the product deterministic external adoption requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-external-substitution-choice Scaffold materialization does not implement the product external substitution choice requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-provider-neutral-capability Scaffold materialization does not implement the product provider neutral capability requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-capability-gap Scaffold materialization does not implement the product capability gap requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-explicit-protocol-change Scaffold materialization does not implement the product explicit protocol change requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-independent-extension-axes Scaffold materialization does not implement the product independent extension axes requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-omission-compatibility Scaffold materialization does not implement the product omission compatibility requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/prototype-quality.md#product-authored-variation-determinism Scaffold materialization does not implement the product authored variation determinism requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-geometry Scaffold materialization does not implement the product prototype geometry requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-handoff Scaffold materialization does not implement the product prototype handoff requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-motion-time Scaffold materialization does not implement the product prototype motion time requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-readability Scaffold materialization does not implement the product prototype readability requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-content-catalogue-exclusion Scaffold materialization does not implement the product content catalogue exclusion requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion Scaffold materialization does not implement the product detailed likeness exclusion requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-editor-export-exclusion Scaffold materialization does not implement the product editor export exclusion requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-exclusion-reopening Scaffold materialization does not implement the product exclusion reopening requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-nondeterministic-completion-exclusion Scaffold materialization does not implement the product nondeterministic completion exclusion requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-agent-input-output Scaffold materialization does not implement the spec authoring agent input output system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Scaffold materialization does not implement the spec authoring authority compatibility system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-violation-failure Scaffold materialization does not implement the spec authoring authority violation failure system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-decision-authority-state Scaffold materialization does not implement the spec authoring decision authority state system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Scaffold materialization does not implement the spec authoring runtime evidence authority invariant system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-user-director-input Scaffold materialization does not implement the spec authoring user director input system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-adoption-output Scaffold materialization does not implement the spec authoring external adoption output system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-execution-state Scaffold materialization does not implement the spec authoring external execution state system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-failure-substitution Scaffold materialization does not implement the spec authoring external failure substitution system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-request-output Scaffold materialization does not implement the spec authoring external request output system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-selection-input Scaffold materialization does not implement the spec authoring external selection input system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-provider-compatibility Scaffold materialization does not implement the spec authoring provider compatibility system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-provider-source-invariant Scaffold materialization does not implement the spec authoring provider source invariant system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Scaffold materialization does not implement the spec authoring host evidence output system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Scaffold materialization does not implement the spec authoring knowledge request output system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Scaffold materialization does not implement the spec authoring tool authoring invariant system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-boundary-compatibility Scaffold materialization does not implement the spec authoring tool boundary compatibility system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Scaffold materialization does not implement the spec authoring tool choice discovery system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Scaffold materialization does not implement the spec authoring tool content side effect invariant system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-diagnostic-failure Scaffold materialization does not implement the spec authoring tool diagnostic failure system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-atomic-invariant Scaffold materialization does not implement the spec authoring partial atomic invariant system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-omission-failure Scaffold materialization does not implement the spec authoring partial omission failure system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-result-checkpoint Scaffold materialization does not implement the spec authoring partial result checkpoint system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-resume-compatibility Scaffold materialization does not implement the spec authoring partial resume compatibility system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Scaffold materialization does not implement the spec authoring partial target input system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Scaffold materialization does not implement the spec authoring partial verification invariant system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-work-state Scaffold materialization does not implement the spec authoring partial work state system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-choice-determinism-invariant Scaffold materialization does not implement the spec authoring choice determinism invariant system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-deterministic-input-identity Scaffold materialization does not implement the spec authoring deterministic input identity system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-downstream-fidelity-output Scaffold materialization does not implement the spec authoring downstream fidelity output system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Scaffold materialization does not implement the spec authoring fidelity failure choice system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-prototype-exclusion-compatibility Scaffold materialization does not implement the spec authoring prototype exclusion compatibility system responsibility; it only derives the portable editable starter.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-structural-output-invariant Scaffold materialization does not implement the spec authoring structural output invariant system responsibility; it only derives the portable editable starter.
 */
export const renderScaffold = (
  props: IAutoMovieScaffoldProps,
): Record<string, string> => {
  const name = props.name.trim();
  if (name.length === 0) throw new Error("scaffold requires a project name");
  if (
    name === "." ||
    name === ".." ||
    name.endsWith(".") ||
    name.endsWith(" ") ||
    /[<>:"/\\|?*\u0000-\u001f]/u.test(name) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)
  )
    throw new Error(
      `scaffold project name "${name}" must be one portable directory segment`,
    );
  const variables: Record<string, string> = { name };
  for (const [key, value] of Object.entries(AUTOMOVIE_TEMPLATE_VERSIONS))
    variables[`version:${key}`] = value;

  const root = scaffoldAssetDirectory();
  const files: Record<string, string> = {};
  for (const relative of listFiles(root))
    files[renderKey(relative, variables)] = renderTemplate(
      normalizeLineEndings(fs.readFileSync(path.join(root, relative), "utf8")),
      variables,
    );
  return files;
};
