import type { ITtscEvidenceGraphReference } from "@ttsc/evidence";
import fs from "node:fs";
import path from "node:path";

import { CONTRACTS, DOCS } from "./graphConstants";

/** Builds one item-by-item principle checklist for every selected host. */
const principleChecklist = (
  file: string,
  requireReview: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: CONTRACTS,
  files: [`principles/${file}`],
  symbol: "h2",
  checklist: true,
  noEvidenceExclude: true,
  requireReview,
});

/** Principle checklists that bind one authored Markdown layer. */
export const authoredPrinciples = (
  layer:
    | "settings"
    | "research"
    | "models"
    | "motions"
    | "storylines"
    | "scenarios"
    | "scripts"
    | "briefs",
  requireReview: boolean,
): ITtscEvidenceGraphReference[] => [
  principleChecklist("common.md", requireReview),
  ...(["storylines", "scenarios", "scripts"].includes(layer)
    ? [principleChecklist("narratives.md", requireReview)]
    : []),
  principleChecklist(`${layer}.md`, requireReview),
];

/** Covers source principles across a population without making every symbol a checklist. */
export const sourcePrinciples = (
  file: string,
  requireReview: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: CONTRACTS,
  files: [`principles/${file}`],
  symbol: "h2",
  noEvidenceExclude: true,
  requireReview,
});

/** Every selected authored unit answers every common obligation. */
export const commonUnitObligations = (
  requireReview: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: CONTRACTS,
  files: ["obligations/common.md"],
  symbol: "h2",
  checklist: true,
  noEvidenceExclude: true,
  requireReview,
});

/** Shared roles distributed across one owning H2 population. */
export const layerObligations = (
  file: "settings" | "storylines" | "models" | "motions",
  requireReview: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: CONTRACTS,
  files: [`obligations/${file}.md`],
  symbol: "h2",
  noEvidenceExclude: file === "motions" ? undefined : true,
  requireReview,
});

/** Creates one independently covered reference per Markdown file. */
export const referencesPerFile = (
  location: string,
  directory: string,
  symbol: "file" | "h2" | "h3" | "h4",
  requireReview: boolean,
  noEvidenceExclude = false,
): ITtscEvidenceGraphReference[] => {
  const docsRoot = path.join(location, DOCS);
  const root = path.join(docsRoot, directory);
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .sort((x, y) => Number(x.name > y.name) - Number(x.name < y.name))) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && entry.name.endsWith(".md"))
        files.push(path.relative(docsRoot, absolute));
    }
  };
  walk(root);
  return files.map((file) => ({
    type: "markdown",
    root: DOCS,
    files: [file.replaceAll("\\", "/")],
    symbol,
    noEvidenceExclude,
    requireReview,
  }));
};

/** One reference per settings file keeps every setting independently visible. */
export const settingsReferences = (
  location: string,
  requireReview: boolean,
): ITtscEvidenceGraphReference[] =>
  referencesPerFile(location, "settings", "h2", requireReview);

/** One reference per model file keeps every represented model independently visible. */
export const modelReferences = (
  location: string,
  requireReview: boolean,
): ITtscEvidenceGraphReference[] =>
  referencesPerFile(location, "models", "h2", requireReview);

/** One reference per motion file keeps every authored motion independently visible. */
export const motionReferences = (
  location: string,
  requireReview: boolean,
): ITtscEvidenceGraphReference[] =>
  referencesPerFile(location, "motions", "h2", requireReview);

/** Exact one-to-one parentage between matching narrative units. */
export const lineage = (
  files: string[],
  symbol: "h2" | "h3" | "h4",
  requireReview: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files,
  symbol,
  noEvidenceExclude: true,
  uniqueEvidence: true,
  singleEvidencePerSymbol: true,
  requireReview,
});

/** A source owner answers for exactly one design file. */
export const oneDesignFile = (
  files: string[],
  requireReview: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files,
  symbol: "file",
  noEvidenceExclude: true,
  singleEvidencePerSymbol: true,
  requireReview,
});
