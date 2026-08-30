import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  contractOwnershipProcessIsEntry,
  describeThrown,
  runContractOwnership,
  runContractOwnershipCli,
  setContractOwnershipExitStatus,
} from "../../integrity/contractOwnership";
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
 *    The drift is also named: `--owner stale` returns the moved unit, `--owner
 *    legacy` still returns the whole recorded debt because a moved unit has not
 *    stopped being legacy, and a settled tree returns nothing stale. A count
 *    nobody can turn into identities cannot be acted on, and finding two moved
 *    units among fifty-one otherwise costs a throwaway digest script.
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
        "## Grouping heading {#spec-structural}",
        "",
        "Independently payable descendants live under this heading.",
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
    // A directory under `packages/` that is not a workspace package. The scan
    // has to walk past it rather than fail on the manifest it does not have.
    write(root, "packages/no-manifest/.keep", "");
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
        "specifications/system.md#spec-structural": {
          structural: {
            reason:
              "This heading only groups descendants that are payable on their own.",
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
    // The count says how much debt this change disturbed; the query has to say
    // which, or the rule that reads the count cannot be followed. `stale` names
    // the moved unit, `legacy` keeps returning the whole recorded debt because a
    // moved unit has not stopped being legacy, and an unmoved tree has nothing
    // stale in it.
    const drifted = temporarily(
      requirementFile,
      requirementSource.replace(
        "An unchanged existing unit.",
        "A changed existing unit.",
      ),
      () => ({
        stale: command(
          root,
          "query",
          "--layer",
          "requirements",
          "--owner",
          "stale",
        ),
        legacy: command(
          root,
          "query",
          "--layer",
          "requirements",
          "--owner",
          "legacy",
        ),
      }),
    );
    const settledStaleQuery = command(
      root,
      "query",
      "--layer",
      "requirements",
      "--owner",
      "stale",
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
    const missingLayer = command(root, "query");

    // Every remaining refusal in the gate, each reached by the one ledger shape
    // that produces it. A diagnostic nothing has ever produced is a sentence,
    // not a guard, and this file is the only place that difference is visible.
    const ledgerWith = (
      source: string,
      update: (ledger: Record<string, any>) => void,
    ): string => {
      const ledger = JSON.parse(source) as Record<string, any>;
      update(ledger);
      // Sortedness is asserted by its own case above, so every mutation here
      // restores it rather than failing on a second diagnostic it did not mean
      // to raise.
      for (const key of ["declarations", "legacy"]) {
        const map: unknown = ledger[key];
        // A case that deliberately replaces the map with something else is
        // asserting on that shape, so re-sorting it would quietly restore an
        // object and the case would pass against material it did not write.
        if (
          typeof map !== "object" ||
          map === null ||
          Array.isArray(map) === true
        )
          continue;
        ledger[key] = Object.fromEntries(
          Object.keys(map)
            .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
            .map((name) => [name, (map as Record<string, unknown>)[name]]),
        );
      }
      return `${JSON.stringify(ledger, null, 2)}\n`;
    };
    const refusedRequirements = (
      update: (ledger: Record<string, any>) => void,
    ): ICommandResult =>
      temporarily(reqLedgerFile, ledgerWith(validReqLedger, update), () =>
        command(root, "check"),
      );
    const refusedSpecifications = (
      update: (ledger: Record<string, any>) => void,
    ): ICommandResult =>
      temporarily(specLedgerFile, ledgerWith(validSpecLedger, update), () =>
        command(root, "check"),
      );
    const requirementOwner = (
      ledger: Record<string, any>,
      target: string,
      owner: unknown,
    ): void => {
      ledger.declarations[target] = { owner };
    };

    const scalarLedger = temporarily(reqLedgerFile, '"not a ledger"\n', () =>
      command(root, "check"),
    );
    const wrongVersion = refusedRequirements((ledger) => {
      ledger.version = 2;
    });
    const wrongLayer = refusedRequirements((ledger) => {
      ledger.layer = "specifications";
    });
    const listDeclarations = refusedRequirements((ledger) => {
      ledger.declarations = [];
    });
    const scalarLegacy = refusedRequirements((ledger) => {
      ledger.legacy = "none";
    });
    const extraLedgerKey = refusedRequirements((ledger) => {
      ledger.snapshot = 1;
    });
    const invalidTarget = refusedRequirements((ledger) => {
      ledger.legacy["requirements/topic.md#NotAnAnchor"] =
        `sha256:${"a".repeat(64)}`;
    });
    const invalidDigest = refusedRequirements((ledger) => {
      ledger.legacy["requirements/topic.md#req-legacy"] = "not-a-digest";
    });
    const scalarDeclaration = refusedRequirements((ledger) => {
      ledger.declarations["requirements/topic.md#req-package"] = "interface";
    });
    const scalarOwner = refusedRequirements((ledger) => {
      requirementOwner(
        ledger,
        "requirements/topic.md#req-package",
        "interface",
      );
    });
    const invalidPackageOwner = refusedRequirements((ledger) => {
      requirementOwner(ledger, "requirements/topic.md#req-package", {
        kind: "package",
        package: "Not A Package",
      });
    });
    const unknownPackageOwner = refusedRequirements((ledger) => {
      requirementOwner(ledger, "requirements/topic.md#req-package", {
        kind: "package",
        package: "@automovie/absent",
      });
    });
    const emptySupplies = refusedRequirements((ledger) => {
      requirementOwner(ledger, "requirements/topic.md#req-project", {
        kind: "project-source",
        supplies: [],
      });
    });
    // Two spellings of the same refusal, kept apart because the supply walk
    // reads the owner in the same pass that reports it: an empty list is walked
    // as an empty list, and an absent key is walked as nothing at all.
    const absentSupplies = refusedRequirements((ledger) => {
      requirementOwner(ledger, "requirements/topic.md#req-project", {
        kind: "project-source",
      });
    });
    const absentObligationSupplies = refusedSpecifications((ledger) => {
      ledger.declarations["specifications/system.md#spec-supply"].obligations[
        "project-assembly"
      ] = { owner: { kind: "project-source" } };
    });
    const invalidSupply = refusedRequirements((ledger) => {
      requirementOwner(ledger, "requirements/topic.md#req-project", {
        kind: "project-source",
        supplies: ["specifications/system.md#spec-supply"],
      });
    });
    const repeatedSupply = refusedRequirements((ledger) => {
      requirementOwner(ledger, "requirements/topic.md#req-project", {
        kind: "project-source",
        supplies: [
          "specifications/system.md#spec-supply::engine-evaluation",
          "specifications/system.md#spec-supply::engine-evaluation",
        ],
      });
    });
    const unsortedSupplies = refusedRequirements((ledger) => {
      requirementOwner(ledger, "requirements/topic.md#req-project", {
        kind: "project-source",
        supplies: [
          "specifications/system.md#spec-supply::engine-evaluation",
          "specifications/system.md#spec-chain::engine-binding",
        ],
      });
    });
    const emptyObligations = refusedSpecifications((ledger) => {
      ledger.declarations["specifications/system.md#spec-chain"] = {
        obligations: {},
      };
    });
    const scalarObligation = refusedSpecifications((ledger) => {
      ledger.declarations["specifications/system.md#spec-chain"].obligations[
        "engine-binding"
      ] = "engine";
    });
    const invalidObligationId = refusedSpecifications((ledger) => {
      ledger.declarations["specifications/system.md#spec-chain"].obligations = {
        Engine_Binding: {
          owner: { kind: "package", package: "@automovie/engine" },
        },
      };
    });
    const scalarStructural = refusedSpecifications((ledger) => {
      ledger.declarations["specifications/system.md#spec-structural"] = {
        structural: "a grouping heading",
      };
    });
    const emptyStructuralReason = refusedSpecifications((ledger) => {
      ledger.declarations["specifications/system.md#spec-structural"] = {
        structural: { reason: "  " },
      };
    });
    const extraStructuralKey = refusedSpecifications((ledger) => {
      ledger.declarations["specifications/system.md#spec-structural"] = {
        structural: { reason: "Groups payable descendants.", note: "extra" },
      };
    });
    const structuralQuery = command(
      root,
      "query",
      "--layer",
      "specifications",
      "--owner",
      "structural",
    );
    const brokenManifest = temporarily(
      path.join(root, "packages", "engine", "package.json"),
      "{",
      () => command(root, "check"),
    );

    // A tree with no ledger at all, which is also the only shape that walks a
    // `packages` directory and a documents directory that are not there.
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-bare-"));
    let missingLedger: ICommandResult;
    try {
      missingLedger = command(bare, "check");
    } finally {
      fs.rmSync(bare, { force: true, recursive: true });
    }

    // The CLI defaults, which the `command` helper cannot reach because it
    // always supplies a command word and a `--root`.
    const flagFirst: string[] = [];
    const flagFirstStatus = runContractOwnership(
      ["--root", root],
      root,
      { write: (message) => flagFirst.push(message) },
      { write: (message) => flagFirst.push(message) },
    );
    const cwdRoot: string[] = [];
    const cwdRootStatus = runContractOwnership(
      ["check"],
      root,
      { write: (message) => cwdRoot.push(message) },
      { write: (message) => cwdRoot.push(message) },
    );

    const thrownDescriptions = [
      describeThrown(new Error("the ledger could not be read")),
      describeThrown("a value nothing in this repository throws"),
    ];

    // The module-scope entry guard, which only a real invocation can take. It is
    // a value and a unit here for the same reason the coverage command's is: the
    // binding between a command and its own resolved path is the one part of the
    // wiring nothing else can inspect, and `require.main === module` has already
    // silently disarmed one gate in this repository.
    const cliStatuses: number[] = [];
    runContractOwnershipCli(
      false,
      () => {
        throw new Error("the command ran for an importing module");
      },
      (status) => cliStatuses.push(status),
    );
    runContractOwnershipCli(
      true,
      () => 7,
      (status) => cliStatuses.push(status),
    );
    const entryDecision = {
      own: contractOwnershipProcessIsEntry(
        path.resolve(__dirname, "../../integrity/contractOwnership.ts"),
      ),
      launcher: contractOwnershipProcessIsEntry(
        path.resolve(__dirname, "../../index.ts"),
      ),
      absent: contractOwnershipProcessIsEntry(undefined),
    };
    const previousExitStatus = process.exitCode;
    setContractOwnershipExitStatus(0);
    const directExitStatus = process.exitCode;
    process.exitCode = previousExitStatus;

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
          "touchedLegacyNamed",
          () =>
            drifted.stale.stdout.includes("req-legacy") &&
            drifted.stale.stdout.includes('"status": "stale"'),
        ],
        [
          "legacyStillWholeDebt",
          () =>
            drifted.legacy.stdout.includes("req-legacy") &&
            drifted.legacy.stdout.includes('"status": "stale"'),
        ],
        [
          "settledTreeHasNothingStale",
          () =>
            settledStaleQuery.status === 0 &&
            settledStaleQuery.stdout.trim() === "[]",
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
        [
          "missingLayerRejected",
          () => missingLayer.stderr.includes("layer must be one of"),
        ],
        [
          "scalarLedgerRejected",
          () => scalarLedger.stderr.includes("declarations must be an object"),
        ],
        [
          "wrongVersionRejected",
          () => wrongVersion.stderr.includes("ledger version must be 1"),
        ],
        [
          "wrongLayerRejected",
          () =>
            wrongLayer.stderr.includes(
              "requirements ledger declares layer 'specifications'",
            ),
        ],
        [
          "listDeclarationsRejected",
          () =>
            listDeclarations.stderr.includes("declarations must be an object"),
        ],
        [
          "scalarLegacyRejected",
          () => scalarLegacy.stderr.includes("legacy must be an object"),
        ],
        [
          "extraLedgerKeyRejected",
          () =>
            extraLedgerKey.stderr.includes(
              "requirements ledger keys must be exactly",
            ),
        ],
        [
          "invalidTargetRejected",
          () => invalidTarget.stderr.includes("ledger has invalid target"),
        ],
        [
          "invalidDigestRejected",
          () =>
            invalidDigest.stderr.includes("invalid snapshot digest") &&
            // The touch-to-migrate ratchet reads that digest, so a malformed one
            // must be refused rather than counted as drift.
            invalidDigest.status === 1,
        ],
        [
          "scalarDeclarationRejected",
          () =>
            scalarDeclaration.stderr.includes("declaration must be an object"),
        ],
        [
          "scalarOwnerRejected",
          () => scalarOwner.stderr.includes("must declare one owner object"),
        ],
        [
          "invalidPackageOwnerRejected",
          () =>
            invalidPackageOwner.stderr.includes("has invalid package owner"),
        ],
        [
          "unknownPackageOwnerRejected",
          () =>
            unknownPackageOwner.stderr.includes(
              "names unknown package owner '@automovie/absent'",
            ),
        ],
        [
          "emptySuppliesRejected",
          () => emptySupplies.stderr.includes("must name product supplies"),
        ],
        [
          "absentSuppliesRejected",
          () => absentSupplies.stderr.includes("must name product supplies"),
        ],
        [
          "absentObligationSuppliesRejected",
          () =>
            absentObligationSupplies.stderr.includes(
              "must name product supplies",
            ),
        ],
        [
          "invalidSupplyRejected",
          () =>
            invalidSupply.stderr.includes(
              "has invalid project-source supply target",
            ),
        ],
        [
          "repeatedSupplyRejected",
          () =>
            repeatedSupply.stderr.includes("repeats a project-source supply"),
        ],
        [
          "unsortedSuppliesRejected",
          () =>
            unsortedSupplies.stderr.includes(
              "project-source supplies must be sorted",
            ),
        ],
        [
          "emptyObligationsRejected",
          () =>
            emptyObligations.stderr.includes(
              "must declare at least one obligation",
            ),
        ],
        [
          "scalarObligationRejected",
          () =>
            scalarObligation.stderr.includes("declaration must be an object"),
        ],
        [
          "invalidObligationIdRejected",
          () =>
            invalidObligationId.stderr.includes("has invalid obligation id"),
        ],
        [
          "scalarStructuralRejected",
          () =>
            scalarStructural.stderr.includes(
              "structural classification must be an object",
            ),
        ],
        [
          "emptyStructuralReasonRejected",
          () =>
            emptyStructuralReason.stderr.includes(
              "structural classification must state a reason",
            ),
        ],
        [
          "extraStructuralKeyRejected",
          () =>
            extraStructuralKey.stderr.includes(
              "structural keys must be exactly reason",
            ),
        ],
        [
          "structuralQueryable",
          () =>
            structuralQuery.stdout.includes("spec-structural") &&
            structuralQuery.stdout.includes('"status": "structural"'),
        ],
        [
          // The parse error's own wording is Node's and changes between
          // releases, so what is pinned is the consequence: the manifest could
          // not be read, so the package it names is not a workspace package and
          // every owner that claimed it is refused by name.
          "brokenManifestRejected",
          () =>
            brokenManifest.status === 1 &&
            brokenManifest.stderr.includes(
              "names unknown package owner '@automovie/engine'",
            ),
        ],
        [
          "missingLedgerRejected",
          () => missingLedger.stderr.includes("missing ownership ledger"),
        ],
        [
          "leadingFlagRunsCheck",
          () =>
            flagFirstStatus === 0 &&
            flagFirst.join("").includes('"declarations"'),
        ],
        [
          "absentRootFallsBackToCwd",
          () =>
            cwdRootStatus === 0 && cwdRoot.join("").includes('"declarations"'),
        ],
        [
          "thrownValuesDescribed",
          () =>
            thrownDescriptions[0] === "the ledger could not be read" &&
            thrownDescriptions[1] ===
              "a value nothing in this repository throws",
        ],
        [
          "entryGuardRunsOnceForItsOwnModule",
          () =>
            cliStatuses.length === 1 &&
            cliStatuses[0] === 7 &&
            directExitStatus === 0,
        ],
        [
          "entryPathDecidesTheBinding",
          () =>
            entryDecision.own === true &&
            entryDecision.launcher === false &&
            entryDecision.absent === false,
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
          "touchedLegacyNamed",
          "legacyStillWholeDebt",
          "settledTreeHasNothingStale",
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
          "missingLayerRejected",
          "scalarLedgerRejected",
          "wrongVersionRejected",
          "wrongLayerRejected",
          "listDeclarationsRejected",
          "scalarLegacyRejected",
          "extraLedgerKeyRejected",
          "invalidTargetRejected",
          "invalidDigestRejected",
          "scalarDeclarationRejected",
          "scalarOwnerRejected",
          "invalidPackageOwnerRejected",
          "unknownPackageOwnerRejected",
          "emptySuppliesRejected",
          "absentSuppliesRejected",
          "absentObligationSuppliesRejected",
          "invalidSupplyRejected",
          "repeatedSupplyRejected",
          "unsortedSuppliesRejected",
          "emptyObligationsRejected",
          "scalarObligationRejected",
          "invalidObligationIdRejected",
          "scalarStructuralRejected",
          "emptyStructuralReasonRejected",
          "extraStructuralKeyRejected",
          "structuralQueryable",
          "brokenManifestRejected",
          "missingLedgerRejected",
          "leadingFlagRunsCheck",
          "absentRootFallsBackToCwd",
          "thrownValuesDescribed",
          "entryGuardRunsOnceForItsOwnModule",
          "entryPathDecidesTheBinding",
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
