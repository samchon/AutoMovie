import fs from "node:fs";
import path from "node:path";

import { projectAutoMovieMarkdownSyntax } from "./parseAutoMovieEvidenceSyntax";

/**
 * Lifecycle state of one structured production-local contract rule.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes local rule state an explicit author input.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the closed lifecycle vocabulary.
 */
export type AutoMovieContractRuleStatus = "active" | "hold" | "rejected";

/**
 * Earliest operation at which one structured rule may be applied.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Exposes safe application timing instead of inferring it from prose.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the closed application vocabulary.
 */
export type AutoMovieContractRuleApplication =
  | "composition-safe"
  | "observation-only"
  | "population-distribution"
  | "post-draft-frequency";

/**
 * Routing metadata attached to one optional structured contract rule.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes local rule identity, state, timing, and source visible together.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the exact structured rule record.
 */
export interface IAutoMovieContractRuleMetadata {
  /** Stable lower-kebab identity independent of file movement. */
  id: string;
  /** Whether the rule is active, held for measurement, or rejected. */
  status: AutoMovieContractRuleStatus;
  /** Earliest operation at which applying the rule is safe. */
  safeApplication: AutoMovieContractRuleApplication;
  /** Exact authoring or review event at which the rule is evaluated. */
  timing: string;
  /** Immutable source or measurement revision that established the routing. */
  sourceIdentity: string;
}

/**
 * One anchored H2 carrying an exact structured contract rule.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Binds structured routing to one stable local contract address.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Carries the validated heading and rule metadata together.
 */
export interface IAutoMovieContractRule {
  /** Stable evidence address relative to the parsed root. */
  address: string;
  /** Explicit H2 anchor. */
  anchor: string;
  /** Visible H2 title without its anchor. */
  heading: string;
  /** Markdown path relative to the parsed root. */
  file: string;
  /** Validated routing metadata. */
  metadata: IAutoMovieContractRuleMetadata;
}

/**
 * Reads optional structured H2 rule metadata from a contract tree.
 *
 * Prose-only H2s remain valid. A `contract-rule` block, when present, is an
 * exact machine route whose lifecycle state, safe application, timing, and
 * source identity are all mandatory. Callers may name files where every H2
 * must carry metadata without turning the whole inherited corpus into a
 * migration prerequisite.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-additive-extension Keeps optional structured rules additive to prose contracts and shared claims.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-additive-extension Returns only validated active, held, or rejected local rule declarations.
 */
export function readAutoMovieContractRules(
  root: string,
  options: { requireEveryH2In?: readonly string[] } = {},
): readonly IAutoMovieContractRule[] {
  if (!fs.existsSync(root)) return [];
  const required = new Set(
    (options.requireEveryH2In ?? []).map((file) => normalizePath(file)),
  );
  const rules = markdownFiles(root).flatMap((file) =>
    rulesOfFile(
      root,
      file,
      required.has(normalizePath(path.relative(root, file))),
    ),
  );
  const identities = new Map<string, string>();
  for (const rule of rules) {
    const owner = identities.get(rule.metadata.id);
    if (owner !== undefined)
      throw new Error(
        `${rule.address}: duplicate contract rule id ${rule.metadata.id} already owned by ${owner}.`,
      );
    identities.set(rule.metadata.id, rule.address);
  }
  return rules;
}

/**
 * Selects active structured rules at one exact safe application boundary.
 *
 * Held and rejected rules remain available in the complete reader DTO for
 * review and diagnostics, but can never enter an executable rule population.
 * A rule is not promoted earlier or later than its declared application.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Keeps inactive or differently timed local rules outside the selected claim population.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Projects only active rules whose exact safe-application route matches the caller.
 */
export function selectAutoMovieContractRules(
  rules: readonly IAutoMovieContractRule[],
  application: AutoMovieContractRuleApplication,
): readonly IAutoMovieContractRule[] {
  if (
    ![
      "composition-safe",
      "observation-only",
      "population-distribution",
      "post-draft-frequency",
    ].includes(application)
  )
    throw new Error(
      `Unsupported contract rule application ${String(application)}.`,
    );
  return rules.filter(
    (rule) =>
      rule.metadata.status === "active" &&
      rule.metadata.safeApplication === application,
  );
}

/** Read structured rules from one Markdown file in visible H2 order. */
function rulesOfFile(
  root: string,
  file: string,
  required: boolean,
): IAutoMovieContractRule[] {
  const source = fs.readFileSync(file, "utf8");
  const visible = projectAutoMovieMarkdownSyntax({
    path: file,
    source,
  }).visibleLines;
  const headings = visible
    .map((line, index) => {
      const match = /^##(?!#)\s+(.+?)[ \t]+\{#([^{}\s]+)\}[ \t]*$/u.exec(line);
      return match === null
        ? null
        : { anchor: match[2]!, heading: match[1]!, line: index + 1 };
    })
    .filter(
      (heading): heading is { anchor: string; heading: string; line: number } =>
        heading !== null,
    );
  const rawLines = source.split(/\r\n|\r|\n/u);
  const relative = normalizePath(path.relative(root, file));
  return headings.flatMap((heading, index) => {
    const end = headings[index + 1]?.line ?? rawLines.length + 1;
    const body = rawLines.slice(heading.line, end - 1).join("\n");
    const openings = [...body.matchAll(/^ {0,3}```contract-rule[ \t]*$/gmu)];
    if (openings.length > 1)
      throw new Error(
        `${relative}#${heading.anchor}: an H2 may declare only one contract-rule JSON block.`,
      );
    const block =
      /^\s*```contract-rule[ \t]*\n(?<json>[\s\S]*?)\n```[ \t]*(?:\n|$)/u.exec(
        body,
      );
    if (block?.groups?.json === undefined) {
      if (openings.length !== 0)
        throw new Error(
          `${relative}#${heading.anchor}: a contract-rule JSON block must immediately follow its H2.`,
        );
      if (required)
        throw new Error(
          `${relative}#${heading.anchor}: every selected H2 requires an immediate contract-rule JSON block.`,
        );
      return [];
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(block.groups.json);
    } catch {
      throw new Error(
        `${relative}#${heading.anchor}: contract-rule metadata must be valid JSON.`,
      );
    }
    return [
      {
        address: `${relative}#${heading.anchor}`,
        anchor: heading.anchor,
        heading: heading.heading.trim(),
        file: relative,
        metadata: validateMetadata(decoded, `${relative}#${heading.anchor}`),
      },
    ];
  });
}

/** Validate one closed structured-rule record. */
function validateMetadata(
  input: unknown,
  location: string,
): IAutoMovieContractRuleMetadata {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error(
      `${location}: contract rule metadata must be a JSON object.`,
    );
  const value = input as Record<string, unknown>;
  const keys = ["id", "safeApplication", "sourceIdentity", "status", "timing"];
  const unexpected = Object.keys(value).filter((key) => !keys.includes(key));
  if (unexpected.length !== 0)
    throw new Error(
      `${location}: unsupported contract rule metadata fields: ${unexpected.join(", ")}.`,
    );
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(String(value.id ?? "")))
    throw new Error(
      `${location}: contract rule id must be stable lower kebab case.`,
    );
  if (!["active", "hold", "rejected"].includes(String(value.status)))
    throw new Error(`${location}: invalid contract rule status.`);
  if (
    ![
      "composition-safe",
      "observation-only",
      "population-distribution",
      "post-draft-frequency",
    ].includes(String(value.safeApplication))
  )
    throw new Error(`${location}: invalid safe application.`);
  for (const key of ["timing", "sourceIdentity"])
    if (typeof value[key] !== "string" || value[key].trim() === "")
      throw new Error(`${location}: ${key} must be a non-empty string.`);
  return value as unknown as IAutoMovieContractRuleMetadata;
}

/** Walk Markdown files without following symlinked entries. */
function markdownFiles(root: string): string[] {
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && entry.name.endsWith(".md"))
        output.push(target);
    }
  };
  visit(root);
  return output.sort(compareCodeUnits);
}

/** Normalize one public path identity to POSIX separators. */
function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

/** Sort independent of host locale and ICU data. */
function compareCodeUnits(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}
