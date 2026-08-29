import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runContractOwnership } from "../../integrity/contractOwnership";
import { namedFacts } from "../internal/predicates";

interface ICommandResult {
  status: number;
  stderr: string;
  stdout: string;
}

interface IFixtureFailure {
  error: unknown;
}

class ContractOwnershipFixtureCleanupError extends AggregateError {}

/** Remove the fixture without replacing the failure that made cleanup run. */
const preserveFixtureCleanup = (
  failure: IFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupError) {
    if (failure === undefined) throw cleanupError;
    throw new ContractOwnershipFixtureCleanupError(
      [failure.error, cleanupError],
      "Contract-ownership fixture cleanup failed after the test failed.",
    );
  }
};

/** Run one isolated ownership-ledger command. */
const command = (root: string, ...args: string[]): ICommandResult => {
  const normalized = [...args];
  if (normalized.length === 0) normalized.push("check");
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = runContractOwnership(
    [...normalized, "--root", root],
    root,
    { write: (message) => stdout.push(message) },
    { write: (message) => stderr.push(message) },
  );
  return {
    status,
    stderr: stderr.join(""),
    stdout: stdout.join(""),
  };
};

/** Write one UTF-8 fixture file and all of its parents. */
const write = (root: string, relative: string, content: string): void => {
  const file = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
};

/** Load and rewrite a ledger without obscuring the fixture's intended delta. */
const updateLedger = (
  root: string,
  layer: "requirements" | "specifications",
  update: (ledger: Record<string, any>) => void,
): void => {
  const file = path.join(root, "docs", "contract-ownership", `${layer}.json`);
  const ledger = JSON.parse(fs.readFileSync(file, "utf8"));
  update(ledger);
  fs.writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
};

/** Restore a file after one deliberate failing mutation. */
const temporarily = <T>(
  file: string,
  content: string,
  operation: () => T,
): T => {
  const previous = fs.readFileSync(file, "utf8");
  if (previous === content)
    throw new Error(
      `The mutation of '${file}' changed nothing, so the case would assert against unmutated material.`,
    );
  fs.writeFileSync(file, content, "utf8");
  try {
    return operation();
  } finally {
    fs.writeFileSync(file, previous, "utf8");
  }
};

/**
 * Contract ownership is positive, queryable, and ratcheted without rebasing old
 * silence. The fixture keeps a project-source requirement, a package-owned
 * requirement, one reasoned exclusion, one legacy unit, a package obligation,
 * and a project-source obligation that terminates at another package atom.
 *
 * Scenarios:
 *
 * 1. Initializing both absent ledgers captures stable legacy hashes and refuses
 *    to overwrite either snapshot.
 * 2. Moving three requirements and two specifications into declarations makes
 *    package, project-source, exclusion, obligation, and legacy debt queryable.
 * 3. A new unit fails until it is classified, a removed unit fails until its
 *    debt entry is pruned, and an edited legacy unit is counted as drift rather
 *    than refused, because forcing a declaration there buys a manufactured one.
 * 4. Package ownership without positive native evidence and a part tag separated
 *    from its native base citation both fail.
 * 5. Missing product supplies, missing specification refinement, a supply cycle,
 *    and a supply ending at an exclusion all fail rather than laundering project
 *    ownership through prose.
 * 6. Unknown owners, empty exclusion reasons, malformed ledgers, duplicate
 *    anchors, unordered keys, invalid targets, and unknown CLI input fail closed.
 */
export const test_workspace_contract_ownership = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-ownership-"));
  let failure: IFixtureFailure | undefined;
  try {
    write(
      root,
      "docs/requirements/topic.md",
      [
        "# Fixture requirements",
        "",
        "## Project-authored relation {#req-project}",
        "",
        "Project source authors the relation with a product query.",
        "",
        "## Product query {#req-package}",
        "",
        "The product answers a deterministic query.",
        "",
        "## Decided exclusion {#req-excluded}",
        "",
        "A deliberately external concern.",
        "",
        "## Migration debt {#req-legacy}",
        "",
        "An unchanged existing unit.",
        "",
      ].join("\n"),
    );
    write(
      root,
      "docs/specifications/system.md",
      [
        "# Fixture specifications",
        "",
        "## Supplied query {#spec-supply}",
        "",
        "<!-- @evidence requirements/topic.md#req-project Refines the authored relation with a product query. -->",
        "",
        "The engine classifies the relation.",
        "",
        "## Runtime binding {#spec-chain}",
        "",
        "The engine binds the authored input.",
        "",
        "## Deliberate omission {#spec-excluded}",
        "",
        "The product does not claim this atom.",
        "",
        "## Specification migration debt {#spec-legacy}",
        "",
        "An unchanged existing specification.",
        "",
      ].join("\n"),
    );
    write(
      root,
      "packages/interface/package.json",
      JSON.stringify({ name: "@automovie/interface" }),
    );
    write(
      root,
      "packages/interface/src/query.ts",
      [
        "/**",
        " * The portable query contract.",
        " * @evidence requirements/topic.md#req-package Implements the product-owned query promise.",
        " */",
        "export interface Query { value: string; }",
        "",
      ].join("\n"),
    );
    write(
      root,
      "packages/engine/package.json",
      JSON.stringify({ name: "@automovie/engine" }),
    );
    const engineFile = path.join(root, "packages", "engine", "src", "query.ts");
    const engineSource = [
      "/**",
      " * The deterministic query evaluation.",
      " * @evidence specifications/system.md#spec-supply Implements the complete supplied-query unit.",
      " * @evidencePart specifications/system.md#spec-supply::engine-evaluation Owns deterministic classification.",
      " */",
      "export function evaluate(): void {}",
      "",
      "/**",
      " * The runtime binding terminal.",
      " * @evidence specifications/system.md#spec-chain Implements the complete runtime-binding unit.",
      " * @evidencePart specifications/system.md#spec-chain::engine-binding Owns the executable terminal.",
      " */",
      "export function bind(): void {}",
      "",
    ].join("\n");
    write(root, "packages/engine/src/query.ts", engineSource);

    const initializedRequirements = command(
      root,
      "initialize",
      "--layer",
      "requirements",
    );
    const initializedSpecifications = command(
      root,
      "initialize",
      "--layer",
      "specifications",
    );
    const overwriteRefused = command(
      root,
      "initialize",
      "--layer",
      "requirements",
    );

    updateLedger(root, "requirements", (ledger) => {
      ledger.declarations = {
        "requirements/topic.md#req-excluded": {
          owner: {
            kind: "excluded",
            reason: "Professional certification is external.",
          },
        },
        "requirements/topic.md#req-package": {
          owner: { kind: "package", package: "@automovie/interface" },
        },
        "requirements/topic.md#req-project": {
          owner: {
            kind: "project-source",
            supplies: [
              "specifications/system.md#spec-supply::engine-evaluation",
            ],
          },
        },
      };
      for (const target of Object.keys(ledger.declarations))
        delete ledger.legacy[target];
    });
    updateLedger(root, "specifications", (ledger) => {
      ledger.declarations = {
        "specifications/system.md#spec-chain": {
          obligations: {
            "engine-binding": {
              owner: { kind: "package", package: "@automovie/engine" },
            },
          },
        },
        "specifications/system.md#spec-excluded": {
          obligations: {
            "external-certification": {
              owner: {
                kind: "excluded",
                reason: "A licensed professional owns certification.",
              },
            },
          },
        },
        "specifications/system.md#spec-supply": {
          obligations: {
            "engine-evaluation": {
              owner: { kind: "package", package: "@automovie/engine" },
            },
            "project-assembly": {
              owner: {
                kind: "project-source",
                supplies: [
                  "specifications/system.md#spec-chain::engine-binding",
                ],
              },
            },
          },
        },
      };
      for (const target of Object.keys(ledger.declarations))
        delete ledger.legacy[target];
    });

    const accepted = command(root, "check");
    const defaultAccepted = command(root);
    const packageQuery = command(
      root,
      "query",
      "--layer",
      "requirements",
      "--owner",
      "@automovie/interface",
    );
    const projectQuery = command(
      root,
      "query",
      "--layer",
      "requirements",
      "--owner",
      "project-source",
    );
    const excludedQuery = command(
      root,
      "query",
      "--layer",
      "requirements",
      "--owner",
      "excluded",
    );
    const legacyQuery = command(
      root,
      "query",
      "--layer",
      "requirements",
      "--owner",
      "legacy",
    );
    const obligationQuery = command(
      root,
      "query",
      "--layer",
      "specifications",
      "--owner",
      "@automovie/engine",
    );

    const requirementFile = path.join(root, "docs", "requirements", "topic.md");
    const requirementSource = fs.readFileSync(requirementFile, "utf8");
    const newUnitRejected = temporarily(
      requirementFile,
      `${requirementSource}\n## Silent addition {#req-new}\n\nNo owner.\n`,
      () => command(root, "check"),
    );
    const touchedLegacyCounted = temporarily(
      requirementFile,
      requirementSource.replace(
        "An unchanged existing unit.",
        "A changed existing unit.",
      ),
      () => command(root, "check"),
    );
    const removedLegacyRejected = temporarily(
      requirementFile,
      requirementSource.replace(
        "## Migration debt {#req-legacy}\n\nAn unchanged existing unit.\n",
        "",
      ),
      () => command(root, "check"),
    );
    const missingPackageEvidence = temporarily(
      path.join(root, "packages", "interface", "src", "query.ts"),
      "export interface Query { value: string; }\n",
      () => command(root, "check"),
    );
    const splitPartEvidence = temporarily(
      engineFile,
      engineSource.replace(
        " * @evidencePart specifications/system.md#spec-supply::engine-evaluation Owns deterministic classification.\n",
        " */\n/** @evidencePart specifications/system.md#spec-supply::engine-evaluation Owns deterministic classification. */\n/**\n",
      ),
      () => command(root, "check"),
    );
    const specificationFile = path.join(
      root,
      "docs",
      "specifications",
      "system.md",
    );
    const specificationSource = fs.readFileSync(specificationFile, "utf8");
    const missingRefinement = temporarily(
      specificationFile,
      specificationSource.replace(
        "<!-- @evidence requirements/topic.md#req-project Refines the authored relation with a product query. -->",
        "<!-- The refinement citation was removed. -->",
      ),
      () => command(root, "check"),
    );

    const specLedgerFile = path.join(
      root,
      "docs",
      "contract-ownership",
      "specifications.json",
    );
    const validSpecLedger = fs.readFileSync(specLedgerFile, "utf8");
    const cycleRejected = temporarily(
      specLedgerFile,
      validSpecLedger.replace(
        "specifications/system.md#spec-chain::engine-binding",
        "specifications/system.md#spec-supply::project-assembly",
      ),
      () => command(root, "check"),
    );
    const excludedTerminalRejected = temporarily(
      specLedgerFile,
      validSpecLedger.replace(
        "specifications/system.md#spec-chain::engine-binding",
        "specifications/system.md#spec-excluded::external-certification",
      ),
      () => command(root, "check"),
    );
    const missingSupplyRejected = temporarily(
      specLedgerFile,
      validSpecLedger.replace(
        "specifications/system.md#spec-chain::engine-binding",
        "specifications/system.md#spec-chain::missing",
      ),
      () => command(root, "check"),
    );

    const reqLedgerFile = path.join(
      root,
      "docs",
      "contract-ownership",
      "requirements.json",
    );
    const validReqLedger = fs.readFileSync(reqLedgerFile, "utf8");
    const malformedLedger = temporarily(reqLedgerFile, "{", () =>
      command(root, "check"),
    );
    const unknownOwner = temporarily(
      reqLedgerFile,
      validReqLedger.replace('"kind": "excluded"', '"kind": "nobody"'),
      () => command(root, "check"),
    );
    const emptyReason = temporarily(
      reqLedgerFile,
      validReqLedger.replace(
        '"reason": "Professional certification is external."',
        '"reason": " "',
      ),
      () => command(root, "check"),
    );
    const unsortedDeclarations = temporarily(
      reqLedgerFile,
      validReqLedger.replace(
        '"requirements/topic.md#req-excluded"',
        '"requirements/topic.md#z-excluded"',
      ),
      () => command(root, "check"),
    );
    const duplicateAnchor = temporarily(
      requirementFile,
      `${requirementSource}\n## Duplicate {#req-package}\n`,
      () => command(root, "check"),
    );
    const unknownCommand = command(root, "unknown");
    const unknownLayer = command(root, "query", "--layer", "unknown");

    TestValidator.equals(
      "ownership declarations, migration ratchet, evidence twins, and supply closure all gate",
      namedFacts([
        ["requirementsInitialized", () => initializedRequirements.status === 0],
        [
          "specificationsInitialized",
          () => initializedSpecifications.status === 0,
        ],
        ["overwriteRefused", () => overwriteRefused.status === 1],
        ["accepted", () => accepted.status === 0],
        ["defaultAccepted", () => defaultAccepted.status === 0],
        ["packageQueryable", () => packageQuery.stdout.includes("req-package")],
        ["projectQueryable", () => projectQuery.stdout.includes("req-project")],
        [
          "exclusionQueryable",
          () => excludedQuery.stdout.includes("req-excluded"),
        ],
        ["legacyQueryable", () => legacyQuery.stdout.includes("req-legacy")],
        [
          "obligationQueryable",
          () => obligationQuery.stdout.includes("engine-evaluation"),
        ],
        [
          "newUnitRejected",
          () => newUnitRejected.stderr.includes("exactly one"),
        ],
        [
          "touchedLegacyCounted",
          () =>
            touchedLegacyCounted.status === 0 &&
            touchedLegacyCounted.stdout.includes('"stale":{"requirements":1'),
        ],
        [
          "removedLegacyRejected",
          () => removedLegacyRejected.stderr.includes("names missing unit"),
        ],
        [
          "packageEvidenceRejected",
          () => missingPackageEvidence.stderr.includes("positive @evidence"),
        ],
        [
          "splitPartRejected",
          () => splitPartEvidence.stderr.includes("one JSDoc block"),
        ],
        [
          "missingRefinementRejected",
          () => missingRefinement.stderr.includes("does not refine"),
        ],
        ["cycleRejected", () => cycleRejected.stderr.includes("supply cycle")],
        [
          "excludedTerminalRejected",
          () =>
            excludedTerminalRejected.stderr.includes(
              "terminates at an exclusion",
            ),
        ],
        [
          "missingSupplyRejected",
          () => missingSupplyRejected.stderr.includes("does not name"),
        ],
        [
          "malformedRejected",
          () => malformedLedger.stderr.includes("cannot parse"),
        ],
        [
          "unknownOwnerRejected",
          () => unknownOwner.stderr.includes("unknown owner kind"),
        ],
        [
          "emptyReasonRejected",
          () => emptyReason.stderr.includes("state a reason"),
        ],
        [
          "unsortedRejected",
          () => unsortedDeclarations.stderr.includes("keys must be sorted"),
        ],
        [
          "duplicateAnchorRejected",
          () => duplicateAnchor.stderr.includes("duplicate contract unit"),
        ],
        [
          "unknownCommandRejected",
          () => unknownCommand.stderr.includes("unknown command"),
        ],
        [
          "unknownLayerRejected",
          () => unknownLayer.stderr.includes("layer must be one of"),
        ],
      ]),
      Object.fromEntries(
        [
          "requirementsInitialized",
          "specificationsInitialized",
          "overwriteRefused",
          "accepted",
          "defaultAccepted",
          "packageQueryable",
          "projectQueryable",
          "exclusionQueryable",
          "legacyQueryable",
          "obligationQueryable",
          "newUnitRejected",
          "touchedLegacyCounted",
          "removedLegacyRejected",
          "packageEvidenceRejected",
          "splitPartRejected",
          "missingRefinementRejected",
          "cycleRejected",
          "excludedTerminalRejected",
          "missingSupplyRejected",
          "malformedRejected",
          "unknownOwnerRejected",
          "emptyReasonRejected",
          "unsortedRejected",
          "duplicateAnchorRejected",
          "unknownCommandRejected",
          "unknownLayerRejected",
        ].map((name) => [name, true]),
      ),
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveFixtureCleanup(failure, () =>
      fs.rmSync(root, { force: true, recursive: true }),
    );
  }
};
