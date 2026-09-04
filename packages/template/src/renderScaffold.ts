import {
  type AutoMovieProductionLanguage,
  createBlankAutoMovieProductionEvidence,
} from "@automovie/evidence";
import * as fs from "node:fs";
import * as path from "node:path";

import { renderAutoMovieLanguageContracts } from "./renderAutoMovieLanguageContracts";
import { renderAutoMovieProductionRouter } from "./renderAutoMovieProductionRouter";
import { renderTemplate } from "./renderTemplate";
import { AUTOMOVIE_TEMPLATE_VERSIONS } from "./templateVersions";

/**
 * Files renamed as the scaffold is rendered. npm strips real `.gitignore` and
 * `.npmrc` files from a published package, so the assets ship without dots and
 * the rendered keys restore them.
 */
const RENAME = new Map<string, string>([
  ["gitignore", ".gitignore"],
  ["npmrc", ".npmrc"],
]);

/**
 * Project-owned values interpolated into the scaffold's `{{...}}` tokens.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Keeps the generated project's portable identity in explicit source input.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Carries that portable identity into deterministic scaffold derivation.
 * @author Samchon
 */
export interface IAutoMovieScaffoldProps {
  /**
   * The created project's package name (replaces `{{name}}`).
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Restricts the name to a portable project identity rather than a host-private path.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Makes the project identity an explicit source input to scaffold derivation.
   */
  name: string;
  /** Exact language contract installed into `docs/language`. */
  language: AutoMovieProductionLanguage;
}

/**
 * One authored scaffold input before its path and bytes are rendered.
 *
 * Keeping the source-relative identity until the complete candidate is
 * validated lets the renderer name both owners of a colliding output instead
 * of silently retaining whichever one happened to be assigned last.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Keeps every authored scaffold source distinct until its portable output identity is proved.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Carries source identity beside the bytes and path derived from that source.
 * @author Samchon
 */
export interface IAutoMovieScaffoldSourceEntry {
  /**
   * Text bytes before line-ending normalization and template rendering.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Makes the authored scaffold text an explicit portable input.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Supplies the exact source text to deterministic derivation.
   */
  content: string;
  /**
   * Scaffold-root-relative source path before stand-in renaming and rendering.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Preserves the project-relative owner of every rendered file.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Retains source identity until output injectivity is validated.
   */
  relative: string;
}

/**
 * Normalize `\r\n` → `\n` so the scaffold emits identical bytes on every host
 * (a Windows checkout with `core.autocrlf` would otherwise ship CRLF and drift
 * from the scaffold's own `lf` convention). The tree is text-only, so this is
 * unconditionally safe.
 */
const normalizeLineEndings = (content: string): string =>
  content.replaceAll("\r\n", "\n");

/** POSIX-slash a path so map keys are host-independent. */
const toPosix = (value: string): string => value.split(path.sep).join("/");

/**
 * The rendered key for one scaffold-relative path.
 *
 * Path segments receive the same strict substitution and unknown-token failure
 * as file payloads. No shipped path carries a token today — authored content
 * directories are named for their owner rather than for the production — but a path is rendered
 * through the same gate as its content so a templated one can never be shipped
 * verbatim by having taken a quieter route.
 */
const renderKey = (
  relative: string,
  variables: Readonly<Record<string, string>>,
): string => {
  const dir = path.dirname(relative);
  const base = RENAME.get(path.basename(relative)) ?? path.basename(relative);
  return renderTemplate(
    toPosix(dir === "." ? base : path.join(dir, base)),
    variables,
  );
};

/**
 * Directory names the scaffold never ships, whatever a host leaves there.
 *
 * A generated project installs its own dependencies and builds its own
 * caches, so anything under these names is a working artifact of whoever ran a
 * tool inside the scaffold directory rather than something the scaffold means
 * to hand over. Naming them here is what makes the shipped set a fact the code
 * decides instead of a fact the disk decides.
 */
const UNSHIPPED_DIRECTORIES = new Set([".cache", ".git", "node_modules"]);

/**
 * File shapes the scaffold never ships, whatever a host leaves there.
 *
 * The scaffold's authored tree is Markdown, TypeScript, JSON, HTML, the two
 * dotfile stand-ins renamed above, a licence and directory placeholders. It
 * contains no JavaScript and no declaration file, so a file carrying a
 * compiler-output shape was emitted into the directory by a tool run rather
 * than authored, and it belongs to the same class as the lint cache above.
 *
 * The reason to name the class rather than the two directories alone is that
 * this one is invisible where it happens. Running the type-checker without
 * `--noEmit` drops `.js`, `.js.map` and `.d.ts` beside every source, and the
 * repository `.gitignore` covers exactly those paths under `scaffold/src`,
 * `scaffold/scripts` and the scaffold root, so `git status` stays quiet while
 * this walk reads them straight off the disk. Measured on this tree: planting
 * `scripts/__emitted.js`, `scripts/__emitted.d.ts` and `.cache/stray.json`
 * took the rendered inventory from 244 keys to 247, so every project generated
 * while they sat there would have installed all three, and a generated
 * project's loader prefers an emitted `.js` to the `.ts` beside it.
 */
const UNSHIPPED_FILES =
  /(?:\.(?:c|m)?js(?:\.map)?|\.d\.(?:c|m)?ts|\.tsbuildinfo)$/u;

/**
 * Every shipped file under `root`, root-relative, in deterministic sorted
 * order.
 *
 * Walking without exclusions made the scaffold's contents whatever happened to
 * be sitting in its directory: a `ttsc` lint cache under
 * `scaffold/node_modules/.cache` rode into every generated project, and did it
 * silently, because a clean CI checkout has no such directory and the gate
 * never saw it.
 */
const listFiles = (root: string): string[] => {
  const out: string[] = [];
  const walk = (dir: string): void => {
    // Code-unit order, not localeCompare: the file listing must be identical
    // on every host (localeCompare varies with host locale/ICU build).
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => Number(a.name > b.name) - Number(a.name < b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (UNSHIPPED_DIRECTORIES.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && UNSHIPPED_FILES.test(entry.name) === false)
        out.push(path.relative(root, full));
    }
  };
  walk(root);
  return out;
};

/**
 * Render an explicit source inventory only after proving that every source has
 * one distinct output path.
 *
 * The returned object has no prototype, so names such as `__proto__` remain
 * ordinary enumerable file identities. Exact output collisions are reported
 * from sorted source identities, making the refusal independent of traversal
 * order.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Produces one deterministic portable file identity for every authored scaffold source.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Rejects a derivation that would merge two distinct source identities into one output.
 * @author Samchon
 */
export const renderScaffoldEntries = (
  entries: readonly IAutoMovieScaffoldSourceEntry[],
  variables: Readonly<Record<string, string>>,
): Record<string, string> => {
  const rendered = entries.map((entry) => ({
    content: renderTemplate(normalizeLineEndings(entry.content), variables),
    relative: renderKey(entry.relative, variables),
    source: toPosix(entry.relative),
  }));
  const ordered = [...rendered].sort((left, right) =>
    left.relative < right.relative
      ? -1
      : left.relative > right.relative
        ? 1
        : left.source < right.source
          ? -1
          : left.source > right.source
            ? 1
            : 0,
  );
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1]!;
    const current = ordered[index]!;
    if (previous.relative === current.relative)
      throw new Error(
        `scaffold sources collide at rendered path "${current.relative}": "${previous.source}", "${current.source}"`,
      );
  }
  const files = Object.create(null) as Record<string, string>;
  for (const entry of rendered)
    Object.defineProperty(files, entry.relative, {
      configurable: true,
      enumerable: true,
      value: entry.content,
      writable: true,
    });
  return files;
};

/**
 * Absolute path to the bundled scaffold assets, resolved relative to this module
 * so it works both from `src` (ttsx, in development) and the published `lib`
 * (the `scaffold/` folder ships alongside).
 *
 * `moduleDirectory` defaults to this module's own, which is the only value any
 * caller passes. It is a parameter so that the missing-assets refusal is an
 * ordinary case over an ordinary input rather than a branch reachable only by
 * moving the shipped directory out from under a running test. A guard whose
 * failure sentence has never been produced is a guard nobody has read.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-technique-example Locates the scaffold whose examples teach reusable authoring techniques instead of supplying finished production content.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Exposes the capability-oriented scaffold as the input to deterministic scaffold rendering.
 */
export const scaffoldAssetDirectory = (
  moduleDirectory: string = __dirname,
): string => {
  const directory = path.resolve(moduleDirectory, "..", "scaffold");
  if (!fs.existsSync(directory))
    throw new Error(`scaffold assets are missing: ${directory}`);
  return directory;
};

/**
 * Render the bundled scaffold into an in-memory `{ posixPath: content }` map:
 * read every asset, normalize line endings, substitute `{{name}}` and the
 * catalog-synced `{{version:*}}` tokens, and rename shipped-safe filenames.
 *
 * The map is deliberately not written to disk here (that is {@link writeFiles}'s
 * job): separating the render from the write mirrors the reference scaffolder,
 * so the same output can be asserted in a test, written by the CLI, or handed
 * to another consumer without disk I/O in the middle.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-technique-example Delivers the scaffold examples that explain one reusable technique, its controls, and its verification path.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Materializes the generated project's routed documentation corpus and its guide entry points.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-choice-surface-discovery Publishes the scaffold's documented authoring choices and declared capability limits together.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-diagnostic-discovery Ships the generated diagnostic commands and their documented recovery paths as ordinary project files.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-capability-gap-discovery Ships the contracts that distinguish missing implementation work from an unavailable product capability.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Emits examples as reusable authoring guidance while leaving each production's content in project-owned source.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-extension-compatibility Materializes an editable scaffold whose capability additions remain separate from project-owned content.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis Scaffold rendering writes template bytes; explicit generation, basis sealing, stale refusal, atomic derived publication, and provenance separation are performed later by the generated project's scripts and its compiler.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal Scaffold rendering writes template bytes; explicit generation, basis sealing, stale refusal, atomic derived publication, and provenance separation are performed later by the generated project's scripts and its compiler.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-explicit-generation Scaffold rendering writes template bytes; explicit generation, basis sealing, stale refusal, atomic derived publication, and provenance separation are performed later by the generated project's scripts and its compiler.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-portable-publication Scaffold rendering writes template bytes; explicit generation, basis sealing, stale refusal, atomic derived publication, and provenance separation are performed later by the generated project's scripts and its compiler.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-provenance-separation Scaffold rendering writes template bytes; explicit generation, basis sealing, stale refusal, atomic derived publication, and provenance separation are performed later by the generated project's scripts and its compiler.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-basis Scaffold rendering writes template bytes and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-budget-boundary Scaffold rendering writes template bytes and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness Scaffold rendering writes template bytes and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-generation Scaffold rendering writes template bytes and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-manifest Scaffold rendering writes template bytes and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-portability Scaffold rendering writes template bytes and implements no derived ledger, basis closure, generation attempt, compile freshness matrix, publication path invariant, or budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage Scaffold materialization emits scaffold bytes but does not execute the generated compiler that records output lineage.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-change-impact-report Scaffold materialization publishes the generated change-impact machinery but does not evaluate a production source change or emit its impact report.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-change-impact-invariant Scaffold materialization publishes the generated change-impact machinery but does not evaluate a production source change.
 * @evidence requirements/agent-authoring/README.md#에이전트-저작-요구사항 Publishes a portable scaffold whose documentation and examples expose reusable authoring capabilities.
 * @evidence requirements/product/README.md#제품-계약-요구사항 Materializes reusable AutoMovie capability while leaving production facts in project-owned source.
 * @evidence specifications/authoring-and-authority/README.md#저작과-권한-시스템-명세 Derives editable project source from explicit scaffold identity and pinned inputs.
 * @evidenceExclude requirements/product/authorability.md#product-authoring-choice-space Scaffold materialization does not implement the product authoring choice space requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-authoring-api-refusal Scaffold materialization does not implement the agent mcp authoring api refusal requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal Scaffold materialization does not implement the agent mcp content supply refusal requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Scaffold materialization does not implement the agent mcp contract guidance requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Scaffold materialization does not implement the agent mcp host evidence requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-no-surprise-external-effects Scaffold materialization does not implement the agent mcp no surprise external effects requirement; it only publishes reusable project-owned authoring capability.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-provider-neutrality Scaffold materialization does not implement the agent mcp provider neutrality requirement; it only publishes reusable project-owned authoring capability.
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
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-agent-input-output Scaffold materialization does not implement the spec authoring agent input output system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Scaffold materialization does not implement the spec authoring authority compatibility system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-violation-failure Scaffold materialization does not implement the spec authoring authority violation failure system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-decision-authority-state Scaffold materialization does not implement the spec authoring decision authority state system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Scaffold materialization does not implement the spec authoring runtime evidence authority invariant system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-user-director-input Scaffold materialization does not implement the spec authoring user director input system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-adoption-output Scaffold materialization does not implement the spec authoring external adoption output system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-execution-state Scaffold materialization does not implement the spec authoring external execution state system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-failure-substitution Scaffold materialization does not implement the spec authoring external failure substitution system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-request-output Scaffold materialization does not implement the spec authoring external request output system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-selection-input Scaffold materialization does not implement the spec authoring external selection input system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-provider-compatibility Scaffold materialization does not implement the spec authoring provider compatibility system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-provider-source-invariant Scaffold materialization does not implement the spec authoring provider source invariant system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Scaffold materialization does not implement the spec authoring host evidence output system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Scaffold materialization does not implement the spec authoring knowledge request output system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Scaffold materialization does not implement the spec authoring tool authoring invariant system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-boundary-compatibility Scaffold materialization does not implement the spec authoring tool boundary compatibility system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Scaffold materialization does not implement the spec authoring tool choice discovery system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Scaffold materialization does not implement the spec authoring tool content side effect invariant system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-diagnostic-failure Scaffold materialization does not implement the spec authoring tool diagnostic failure system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-atomic-invariant Scaffold materialization does not implement the spec authoring partial atomic invariant system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-omission-failure Scaffold materialization does not implement the spec authoring partial omission failure system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-result-checkpoint Scaffold materialization does not implement the spec authoring partial result checkpoint system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-resume-compatibility Scaffold materialization does not implement the spec authoring partial resume compatibility system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Scaffold materialization does not implement the spec authoring partial target input system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Scaffold materialization does not implement the spec authoring partial verification invariant system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-work-state Scaffold materialization does not implement the spec authoring partial work state system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-choice-determinism-invariant Scaffold materialization does not implement the spec authoring choice determinism invariant system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-deterministic-input-identity Scaffold materialization does not implement the spec authoring deterministic input identity system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-downstream-fidelity-output Scaffold materialization does not implement the spec authoring downstream fidelity output system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Scaffold materialization does not implement the spec authoring fidelity failure choice system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-prototype-exclusion-compatibility Scaffold materialization does not implement the spec authoring prototype exclusion compatibility system responsibility; it only derives the portable editable scaffold.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-structural-output-invariant Scaffold materialization does not implement the spec authoring structural output invariant system responsibility; it only derives the portable editable scaffold.
 * @author Samchon
 *
 * @evidenceExclude requirements/agent-authoring/project-ownership.md#agent-editable-source-authority Rendering produces bytes in memory; which of them a project may then edit is decided by the project that receives them, not here.
 * @evidenceExclude requirements/agent-authoring/project-ownership.md#agent-repository-project-boundary The boundary between reusable capability and one work's facts is drawn by the packages a rendered project depends on, not by the act of rendering the template.
 * @evidenceExclude requirements/agent-authoring/project-ownership.md#agent-project-owned-bytes External image, audio, model, and motion bytes are adopted by an authored project through its asset registry; the template ships none of them.
 * @evidenceExclude requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Tool replaceability is a property of the rendered project's dependencies and public contracts, which rendering copies rather than decides.
 * @evidenceExclude requirements/agent-authoring/project-ownership.md#agent-ambiguous-ownership-refusal Refusing an asset of unclear source, license, or digest is the compiler's judgment over an authored production; the template carries no assets to adjudicate.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-system-project-responsibility The split of system and project responsibility is stated by the contracts the template ships, not performed by rendering them.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-state Capability state belongs to the packages a project installs; rendering emits the same bytes whatever those packages can currently do.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-not-content-invariant The invariant is held by what the template contains, which is a harness and no production content; rendering copies that set without deciding it.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-failure-gap Distinguishing a missing implementation from an unavailable capability is a diagnosis the generated project's compiler makes, not a rendering outcome.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Derivation state lives in the generated project's compiler and its tracked output; rendering has no state beyond the bytes it returns.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-ownership-failure Ownership failures are raised where a write or a compile meets an existing tree, which is the writer's and the compiler's job rather than the renderer's.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-resume-compatibility Rendering is a single total act with nothing to resume; resumption belongs to the render job and the compiler.
 */
export const renderScaffold = (
  props: IAutoMovieScaffoldProps,
): Record<string, string> => {
  const name = props.name.trim();
  if (name.length === 0) throw new Error("scaffold requires a project name");
  // A trailing space cannot survive `trim`, so refusing one here would be a
  // rule no input can break: such a name is normalized rather than rejected.
  // A trailing dot is not whitespace and reaches this rule intact, which is
  // why only that half of the Windows restriction is stated.
  if (
    name === "." ||
    name === ".." ||
    name.endsWith(".") ||
    /[<>:"/\\|?*\u0000-\u001f]/u.test(name) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)
  )
    throw new Error(
      `scaffold project name "${name}" must be one portable directory segment`,
    );
  const variables: Record<string, string> = { name, language: props.language };
  for (const [key, value] of Object.entries(AUTOMOVIE_TEMPLATE_VERSIONS))
    variables[`version:${key}`] = value;

  const root = scaffoldAssetDirectory();
  const languageEntries = Object.entries(
    renderAutoMovieLanguageContracts({ language: props.language }),
  ).map(([relative, content]) => ({ content, relative }));
  const files = renderScaffoldEntries(
    [
      ...listFiles(root).map((relative) => ({
      content: fs.readFileSync(path.join(root, relative), "utf8"),
      relative,
      })),
      ...languageEntries,
    ],
    variables,
  );
  const manifest = JSON.parse(files["package.json"]!) as {
    name: string;
    description?: string;
  };
  const blank = createBlankAutoMovieProductionEvidence(root, props.language);
  Object.defineProperty(files, "AGENTS.md", {
    configurable: true,
    enumerable: true,
    value: renderAutoMovieProductionRouter({
      packageName: manifest.name,
      description: manifest.description?.trim() ?? "",
      manifest: {
        kind: blank.kind,
        language: blank.language,
        populationScope: blank.populationScope,
        branches: [],
        bindings: [],
      },
      designOwners: [],
      contracts: [],
    }),
    writable: true,
  });
  return files;
};
