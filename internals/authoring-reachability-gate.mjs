import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const CLASSIFICATIONS = new Set([
  "authoring-contract",
  "unpaid-authoring-edge",
  "not-author-driven",
  "intentional-exclusion",
]);
const SKIPPED_DIRECTORIES = new Set([".cache", "dist", "lib", "node_modules"]);
const PLACEHOLDER = /^(?:n\/?a|none|pending|tbd|todo|unknown|unspecified)$/iu;

/** A deterministic authoring-reachability ledger failure. */
export class AuthoringReachabilityError extends Error {
  constructor(diagnostics) {
    super(diagnostics.join("\n"));
    this.name = "AuthoringReachabilityError";
    this.diagnostics = diagnostics;
  }
}

const slash = (value) => value.replaceAll(path.sep, "/");
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const useful = (value) =>
  typeof value === "string" &&
  value.trim().length >= 12 &&
  PLACEHOLDER.test(value.trim()) === false;

const walk = (directory, predicate) => {
  if (fs.existsSync(directory) === false) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory())
      return SKIPPED_DIRECTORIES.has(entry.name) ? [] : walk(target, predicate);
    return entry.isFile() && predicate(target) ? [target] : [];
  });
};

const markdownHeadings = (file, level) => {
  const pattern = new RegExp(
    `^#{${level}}\\s+.+?\\s+\\{#([a-z0-9][a-z0-9-]*)\\}\\s*$`,
    "gmu",
  );
  return [
    ...fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n").matchAll(pattern),
  ].map((match) => match[1]);
};

const jsdocTagLines = (text) =>
  [...text.matchAll(/\/\*\*[\s\S]*?\*\//gu)].flatMap((match) =>
    match[0]
      .slice(3, -2)
      .split(/\r?\n/u)
      .map((line) => line.replace(/^\s*\*\s?/u, "").trim())
      .filter((line) => line.startsWith("@")),
  );

const markdownTagLines = (text) =>
  [...text.matchAll(/<!--[\s\S]*?-->/gu)].flatMap((match) =>
    match[0]
      .slice(4, -3)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("@")),
  );

/** Collect every requirement family and its explicitly anchored H3 count. */
export const collectRequirementFamilies = (root) => {
  const directory = path.join(root, "docs", "requirements");
  if (fs.existsSync(directory) === false)
    throw new AuthoringReachabilityError([
      "missing requirement root 'docs/requirements'",
    ]);
  return new Map(
    fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compare)
      .map((family) => {
        const files = walk(path.join(directory, family), (file) =>
          file.endsWith(".md"),
        );
        return [
          family,
          files.reduce(
            (count, file) => count + markdownHeadings(file, 3).length,
            0,
          ),
        ];
      }),
  );
};

const collectContractInventory = (root) =>
  Object.fromEntries(
    ["discovery", "principles", "obligations"].map((kind) => {
      const directory = path.join(root, "packages", "template", "docs", kind);
      const files = walk(directory, (file) => file.endsWith(".md"));
      return [
        kind,
        files.reduce(
          (count, file) => count + markdownHeadings(file, 2).length,
          0,
        ),
      ];
    }),
  );

const validateReference = (root, reference, label, diagnostics) => {
  if (typeof reference !== "string" || reference.length === 0) {
    diagnostics.push(`${label} must be a non-empty repository path`);
    return;
  }
  const separator = reference.lastIndexOf("#");
  const relative = separator === -1 ? reference : reference.slice(0, separator);
  const anchor = separator === -1 ? undefined : reference.slice(separator + 1);
  const file = path.resolve(root, relative);
  const inside = path.relative(root, file);
  if (
    inside === "" ||
    inside === ".." ||
    inside.startsWith(`..${path.sep}`) ||
    path.isAbsolute(inside)
  ) {
    diagnostics.push(`${label} escapes the repository: '${reference}'`);
    return;
  }
  if (fs.existsSync(file) === false || fs.statSync(file).isFile() === false) {
    diagnostics.push(`${label} does not exist: '${reference}'`);
    return;
  }
  if (anchor !== undefined) {
    if (/^[a-z0-9][a-z0-9-]*$/u.test(anchor) === false) {
      diagnostics.push(`${label} has an invalid anchor: '${reference}'`);
      return;
    }
    const text = fs.readFileSync(file, "utf8");
    const anchoredHeading = new RegExp(
      `^#{1,6}\\s+.+?\\s+\\{#${anchor}\\}\\s*$`,
      "mu",
    );
    if (anchoredHeading.test(text) === false)
      diagnostics.push(`${label} has no matching anchor: '${reference}'`);
  }
};

const validateReferences = (root, values, label, diagnostics) => {
  if (values === undefined) return;
  if (Array.isArray(values) === false) {
    diagnostics.push(`${label} must be an array`);
    return;
  }
  for (const [index, reference] of values.entries())
    validateReference(root, reference, `${label}[${index}]`, diagnostics);
};

const collectSpecificationFragments = (root) => {
  const declarations = new Set();
  let evidence = 0;
  let exclusions = 0;
  let reviews = 0;
  const specificationRoot = path.join(root, "docs", "specifications");
  for (const file of walk(specificationRoot, (candidate) =>
    candidate.endsWith(".md"),
  )) {
    const relative = slash(path.relative(specificationRoot, file));
    let anchor;
    const text = fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n");
    for (const line of markdownTagLines(text)) {
      if (/^@evidence\s+\S+\s+.+/u.test(line)) evidence++;
      if (/^@evidenceExclude\s+\S+\s+.+/u.test(line)) exclusions++;
      if (/^@evidence(?:Exclude)?Review\s+\S+/u.test(line)) reviews++;
    }
    for (const line of text.split("\n")) {
      const heading = /^#{1,6}\s+.+?\s+\{#([a-z0-9][a-z0-9-]*)\}\s*$/u.exec(
        line,
      );
      if (heading !== null) anchor = heading[1];
      const obligation =
        /<!--\s*@evidenceObligation\s+([a-z0-9][a-z0-9-]*)\b/u.exec(line);
      if (obligation === null) continue;
      if (anchor === undefined)
        throw new AuthoringReachabilityError([
          `evidence obligation '${obligation[1]}' in '${relative}' has no anchored owner`,
        ]);
      declarations.add(`${relative}#${anchor}::${obligation[1]}`);
    }
  }

  const parts = new Set();
  for (const packageEntry of fs.readdirSync(path.join(root, "packages"), {
    withFileTypes: true,
  })) {
    if (packageEntry.isDirectory() === false) continue;
    const sourceRoot = path.join(root, "packages", packageEntry.name, "src");
    for (const file of walk(sourceRoot, (candidate) =>
      /\.(?:[cm]?ts|tsx)$/u.test(candidate),
    )) {
      const text = fs.readFileSync(file, "utf8");
      for (const line of jsdocTagLines(text)) {
        const match =
          /@evidencePart\s+specifications\/([^\s]+)::([a-z0-9][a-z0-9-]*)\b/u.exec(
            line,
          );
        if (match !== null) parts.add(`${match[1]}::${match[2]}`);
      }
    }
  }
  return {
    declarations,
    parts,
    evidence,
    exclusions,
    reviews,
    unpaid: new Set(
      [...declarations].filter((target) => parts.has(target) === false),
    ),
    orphanParts: new Set(
      [...parts].filter((target) => declarations.has(target) === false),
    ),
  };
};

const collectSourceEvidence = (root) => {
  let evidence = 0;
  let exclusions = 0;
  let reviews = 0;
  const exclusionReasons = new Map();
  const packageRoot = path.join(root, "packages");
  for (const packageEntry of fs.readdirSync(packageRoot, {
    withFileTypes: true,
  })) {
    if (packageEntry.isDirectory() === false) continue;
    const sourceRoot = path.join(packageRoot, packageEntry.name, "src");
    for (const file of walk(sourceRoot, (candidate) =>
      /\.(?:[cm]?ts|tsx)$/u.test(candidate),
    )) {
      const text = fs.readFileSync(file, "utf8");
      for (const line of jsdocTagLines(text)) {
        if (/^@evidence\s+\S+\s+.+/u.test(line)) evidence++;
        const exclusion = /^@evidenceExclude\s+\S+\s+(.+)/u.exec(line);
        if (exclusion !== null) {
          exclusions++;
          const reason = exclusion[1].trim();
          exclusionReasons.set(reason, (exclusionReasons.get(reason) ?? 0) + 1);
        }
        if (/^@evidence(?:Exclude)?Review\s+\S+/u.test(line)) reviews++;
      }
    }
  }
  const ordered = [...exclusionReasons.entries()].sort(
    ([leftReason, leftCount], [rightReason, rightCount]) =>
      rightCount - leftCount || compare(leftReason, rightReason),
  );
  return {
    evidence,
    exclusions,
    reviews,
    uniqueExclusionReasons: exclusionReasons.size,
    topExclusionReasonCount: ordered[0]?.[1] ?? 0,
    topTwentyExclusionCount: ordered
      .slice(0, 20)
      .reduce((sum, [, count]) => sum + count, 0),
  };
};

const evidenceReviewConfigs = (root) =>
  ["config", "docs", "packages", "test"]
    .flatMap((directory) =>
      walk(path.join(root, directory), (file) =>
        /^lint\.config\.(?:mjs|ts)$/u.test(path.basename(file)),
      ),
    )
    .filter((file) =>
      /["']evidence\/review["']/u.test(fs.readFileSync(file, "utf8")),
    )
    .map((file) => slash(path.relative(root, file)))
    .sort(compare);

const loadLedger = (root) => {
  const file = path.join(
    root,
    "docs",
    "authoring-reachability",
    "families.json",
  );
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new AuthoringReachabilityError([
      `cannot read authoring reachability ledger: ${error.message}`,
    ]);
  }
};

/** Inspect the family crosswalk and every measured debt population. */
export const inspectAuthoringReachability = (root, suppliedLedger) => {
  const ledger = suppliedLedger ?? loadLedger(root);
  const diagnostics = [];
  if (ledger?.version !== 1) diagnostics.push("ledger version must be 1");
  if (Array.isArray(ledger?.families) === false)
    diagnostics.push("ledger families must be an array");
  if (diagnostics.length !== 0)
    throw new AuthoringReachabilityError(diagnostics);

  const actualFamilies = collectRequirementFamilies(root);
  const seen = new Set();
  let previous = "";
  for (const [index, entry] of ledger.families.entries()) {
    const label = `families[${index}]`;
    if (typeof entry?.family !== "string" || entry.family.length === 0) {
      diagnostics.push(`${label}.family must be a non-empty string`);
      continue;
    }
    if (seen.has(entry.family))
      diagnostics.push(`duplicate family '${entry.family}'`);
    seen.add(entry.family);
    if (previous !== "" && compare(previous, entry.family) >= 0)
      diagnostics.push(
        `families must be sorted: '${previous}' before '${entry.family}'`,
      );
    previous = entry.family;
    if (actualFamilies.has(entry.family) === false) {
      diagnostics.push(
        `ledger family '${entry.family}' has no requirement directory`,
      );
    } else if (entry.requirementUnits !== actualFamilies.get(entry.family)) {
      diagnostics.push(
        `family '${entry.family}' records ${entry.requirementUnits} H3 units; actual is ${actualFamilies.get(entry.family)}`,
      );
    }
    if (CLASSIFICATIONS.has(entry.classification) === false)
      diagnostics.push(
        `family '${entry.family}' has invalid classification '${entry.classification}'`,
      );
    if (useful(entry.reason) === false)
      diagnostics.push(`family '${entry.family}' needs a concrete reason`);

    validateReferences(
      root,
      entry.correspondences,
      `family '${entry.family}' correspondences`,
      diagnostics,
    );
    validateReferences(
      root,
      entry.partialCorrespondences,
      `family '${entry.family}' partialCorrespondences`,
      diagnostics,
    );
    validateReferences(
      root,
      entry.workflow,
      `family '${entry.family}' workflow`,
      diagnostics,
    );
    validateReferences(
      root,
      entry.ownerEvidence,
      `family '${entry.family}' ownerEvidence`,
      diagnostics,
    );

    if (
      entry.classification === "authoring-contract" &&
      (Array.isArray(entry.correspondences) === false ||
        entry.correspondences.length === 0)
    )
      diagnostics.push(
        `family '${entry.family}' has no authoring correspondence`,
      );
    if (
      entry.classification === "unpaid-authoring-edge" &&
      (Number.isInteger(entry.issue) === false || entry.issue <= 0)
    )
      diagnostics.push(
        `unpaid family '${entry.family}' needs its owning issue`,
      );
    if (
      entry.classification === "not-author-driven" &&
      (useful(entry.owner) === false ||
        Array.isArray(entry.ownerEvidence) === false ||
        entry.ownerEvidence.length === 0)
    )
      diagnostics.push(
        `not-author-driven family '${entry.family}' needs an owner and owner evidence`,
      );
    if (
      entry.classification === "intentional-exclusion" &&
      useful(entry.resumptionCondition) === false
    )
      diagnostics.push(
        `intentional exclusion '${entry.family}' needs a resumption condition`,
      );
  }
  for (const family of actualFamilies.keys())
    if (seen.has(family) === false)
      diagnostics.push(
        `requirement family '${family}' is missing from the ledger`,
      );

  const actualInventory = collectContractInventory(root);
  for (const kind of ["discovery", "principles", "obligations"])
    if (ledger.contractInventory?.[kind] !== actualInventory[kind])
      diagnostics.push(
        `contract inventory '${kind}' records ${ledger.contractInventory?.[kind]}; actual is ${actualInventory[kind]}`,
      );

  const unpaidFamilies = ledger.families.filter(
    (entry) => entry.classification === "unpaid-authoring-edge",
  );
  if (ledger.acceptedDebt?.unpaidAuthoringFamilies !== unpaidFamilies.length)
    diagnostics.push(
      `accepted unpaid authoring families is ${ledger.acceptedDebt?.unpaidAuthoringFamilies}; classified total is ${unpaidFamilies.length}`,
    );

  let fragments;
  try {
    fragments = collectSpecificationFragments(root);
  } catch (error) {
    if (error instanceof AuthoringReachabilityError)
      diagnostics.push(...error.diagnostics);
    else throw error;
  }
  if (fragments !== undefined) {
    for (const target of fragments.orphanParts)
      diagnostics.push(`source evidence part has no declaration: '${target}'`);
    if (
      ledger.acceptedDebt?.unpaidSpecificationFragments !==
      fragments.unpaid.size
    )
      diagnostics.push(
        `accepted unpaid specification fragments is ${ledger.acceptedDebt?.unpaidSpecificationFragments}; actual is ${fragments.unpaid.size}`,
      );
    const actualUnpaidTargets = [...fragments.unpaid].sort(compare);
    if (
      Array.isArray(ledger.acceptedDebt?.unpaidSpecificationTargets) ===
        false ||
      JSON.stringify(ledger.acceptedDebt.unpaidSpecificationTargets) !==
        JSON.stringify(actualUnpaidTargets)
    )
      diagnostics.push(
        `accepted unpaid specification targets do not match: ${JSON.stringify(actualUnpaidTargets)}`,
      );
  }

  const reviewConfigs = evidenceReviewConfigs(root);
  const reviewPolicy = ledger.repositoryReviewPolicy;
  if (reviewPolicy?.evidenceReview !== "disabled")
    diagnostics.push(
      "repository evidenceReview policy must be 'disabled' or be re-specified by this gate",
    );
  if (useful(reviewPolicy?.reason) === false)
    diagnostics.push("repository review policy needs a concrete reason");
  if (useful(reviewPolicy?.reconsiderWhen) === false)
    diagnostics.push(
      "repository review policy needs a reconsideration condition",
    );
  if (
    Array.isArray(reviewPolicy?.substitutes) === false ||
    reviewPolicy.substitutes.length === 0
  )
    diagnostics.push("repository review policy needs substitute controls");
  else
    validateReferences(
      root,
      reviewPolicy.substitutes,
      "repository review substitutes",
      diagnostics,
    );
  if (reviewConfigs.length !== 0)
    diagnostics.push(
      `repository policy disables evidence/review but configs enable it: ${reviewConfigs.join(", ")}`,
    );

  if (diagnostics.length !== 0)
    throw new AuthoringReachabilityError(diagnostics);
  const sourceEvidence = collectSourceEvidence(root);
  const repositoryEvidence = {
    evidence: fragments.evidence + sourceEvidence.evidence,
    exclusions: fragments.exclusions + sourceEvidence.exclusions,
    reviews: fragments.reviews + sourceEvidence.reviews,
  };
  return {
    requirementFamilies: actualFamilies.size,
    requirementUnits: [...actualFamilies.values()].reduce(
      (sum, count) => sum + count,
      0,
    ),
    contractInventory: actualInventory,
    classifications: Object.fromEntries(
      [...CLASSIFICATIONS].map((classification) => [
        classification,
        ledger.families.filter(
          (entry) => entry.classification === classification,
        ).length,
      ]),
    ),
    unpaidAuthoringUnits: unpaidFamilies.reduce(
      (sum, entry) => sum + entry.requirementUnits,
      0,
    ),
    specificationFragments: {
      declared: fragments.declarations.size,
      paid: fragments.declarations.size - fragments.unpaid.size,
      unpaid: fragments.unpaid.size,
      unpaidTargets: [...fragments.unpaid].sort(compare),
    },
    sourceEvidence,
    repositoryEvidence,
    evidenceReviewConfigs: reviewConfigs,
  };
};

export const parseRoot = (arguments_) => {
  const index = arguments_.indexOf("--root");
  if (index === -1) return path.resolve(import.meta.dirname, "..");
  if (index === arguments_.length - 1)
    throw new AuthoringReachabilityError(["--root requires a path"]);
  return path.resolve(arguments_[index + 1]);
};

const main = () => {
  try {
    const report = inspectAuthoringReachability(
      parseRoot(process.argv.slice(2)),
    );
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(
      `authoring reachability: ${report.requirementFamilies} families / ${report.requirementUnits} H3 units`,
    );
    console.log(
      `authoring contracts: discovery ${report.contractInventory.discovery}, principles ${report.contractInventory.principles}, obligations ${report.contractInventory.obligations}`,
    );
    console.log(
      `unpaid authoring: ${report.classifications["unpaid-authoring-edge"]} family edges / ${report.unpaidAuthoringUnits} represented H3 units`,
    );
    console.log(
      `unpaid specification fragments: ${report.specificationFragments.unpaid}/${report.specificationFragments.declared}`,
    );
    console.log(
      `repository source evidence: ${report.sourceEvidence.evidence} positive / ${report.sourceEvidence.exclusions} exclusions / ${report.sourceEvidence.reviews} review companions`,
    );
    console.log(
      `repository graph tags: ${report.repositoryEvidence.evidence} positive / ${report.repositoryEvidence.exclusions} exclusions / ${report.repositoryEvidence.reviews} review companions`,
    );
  } catch (error) {
    if (error instanceof AuthoringReachabilityError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main();
