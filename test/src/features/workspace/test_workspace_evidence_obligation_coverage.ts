import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

const ROOT = path.resolve(__dirname, "../../../..");
const GUARD = path.join(ROOT, "internals", "contract-ownership.mjs");
const SPECIFICATION =
  "specifications/example/partial-coverage.md#spec-partial-coverage";

interface IFixtureFailure {
  error: unknown;
}

class EvidenceObligationFixtureCleanupError extends AggregateError {}

/** Preserve a primary assertion failure when removal of its fixture also fails. */
const preserveFixtureCleanup = (
  failure: IFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new EvidenceObligationFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Evidence-obligation fixture cleanup failed after the test failed.",
    );
  }
};

/** Run one contract-ownership command against the isolated repository. */
const invoke = (
  root: string,
  command: "check" | "initialize",
  layer?: string,
) =>
  spawnSync(
    process.execPath,
    [
      GUARD,
      command,
      "--root",
      root,
      ...(layer === undefined ? [] : ["--layer", layer]),
    ],
    { encoding: "utf8" },
  );

/** Replace one initialized legacy unit with an obligation declaration. */
const declareSpecification = (
  root: string,
  ownerOfSecond: "excluded" | "package",
): void => {
  const location = path.join(
    root,
    "docs",
    "contract-ownership",
    "specifications.json",
  );
  const ledger = JSON.parse(fs.readFileSync(location, "utf8")) as {
    declarations: Record<string, unknown>;
    legacy: Record<string, string>;
  };
  delete ledger.legacy[SPECIFICATION];
  ledger.declarations[SPECIFICATION] = {
    obligations: {
      "declared-segment": {
        owner: { kind: "package", package: "@automovie/engine" },
      },
      "remaining-segment": {
        owner:
          ownerOfSecond === "package"
            ? { kind: "package", package: "@automovie/engine" }
            : {
                kind: "excluded",
                reason:
                  "The fixture deliberately places this fragment outside its product boundary.",
              },
      },
    },
  };
  fs.writeFileSync(location, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
};

/** Write the package carrier, optionally with the exact fragment acknowledgement. */
const writeCarrier = (root: string, includePart: boolean): void => {
  fs.writeFileSync(
    path.join(root, "packages", "engine", "src", "answer.ts"),
    `/**
 * Answers the declared part of the fixture specification.
 *
 * @evidence ${SPECIFICATION} Implements the selected specification unit.
${includePart ? ` * @evidencePart ${SPECIFICATION}::declared-segment Implements this exact fragment.\n` : ""} */
export const answer = true;
`,
    "utf8",
  );
};

/**
 * The contract-ownership gate distinguishes complete fragment coverage from a
 * source that merely cites the containing specification unit.
 *
 * Scenarios:
 *
 * 1. One package claims only the first of two package-owned obligations, so the
 *    gate fails on the exact uncovered fragment.
 * 2. A containing `@evidence` without its exact `@evidencePart` cannot aggregate
 *    the fragment into a false pass.
 * 3. The same implemented fragment passes when the other fragment has one
 *    machine-readable exclusion carrying a non-empty reason.
 */
export const test_workspace_evidence_obligation_coverage = (): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-evidence-obligations-"),
  );
  let fixtureFailure: IFixtureFailure | undefined;
  try {
    fs.mkdirSync(path.join(root, "docs", "requirements", "example"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "docs", "specifications", "example"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "packages", "engine", "src"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "docs", "requirements", "example", "promise.md"),
      "# Fixture Requirement {#fixture-requirement}\n\n## Promise {#fixture-promise}\n\nThe product preserves the fixture contract.\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(
        root,
        "docs",
        "specifications",
        "example",
        "partial-coverage.md",
      ),
      "# Fixture Specification {#fixture-specification}\n\n## Boundary {#fixture-boundary}\n\n### Partial Coverage {#spec-partial-coverage}\n\nThe system implements the declared segment and accounts for the remaining segment.\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "packages", "engine", "package.json"),
      JSON.stringify({ name: "@automovie/engine", version: "0.0.0" }),
      "utf8",
    );
    const initializedRequirements = invoke(root, "initialize", "requirements");
    const initializedSpecifications = invoke(
      root,
      "initialize",
      "specifications",
    );

    declareSpecification(root, "package");
    writeCarrier(root, true);
    const uncovered = invoke(root, "check");

    declareSpecification(root, "excluded");
    writeCarrier(root, false);
    const aggregateOnly = invoke(root, "check");

    writeCarrier(root, true);
    const covered = invoke(root, "check");

    TestValidator.equals(
      "part claims cover every declared obligation without aggregate citation escape",
      namedFacts([
        ["initializedRequirements", () => initializedRequirements.status === 0],
        [
          "initializedSpecifications",
          () => initializedSpecifications.status === 0,
        ],
        ["uncoveredRejected", () => uncovered.status === 1],
        [
          "uncoveredNamesPart",
          () =>
            uncovered.stderr.includes(`${SPECIFICATION}::remaining-segment`),
        ],
        ["aggregateOnlyRejected", () => aggregateOnly.status === 1],
        [
          "aggregateOnlyNamesPart",
          () =>
            aggregateOnly.stderr.includes(`${SPECIFICATION}::declared-segment`),
        ],
        ["coveredAccepted", () => covered.status === 0],
      ]),
      {
        initializedRequirements: true,
        initializedSpecifications: true,
        uncoveredRejected: true,
        uncoveredNamesPart: true,
        aggregateOnlyRejected: true,
        aggregateOnlyNamesPart: true,
        coveredAccepted: true,
      },
    );
  } catch (error) {
    fixtureFailure = { error };
    throw error;
  } finally {
    preserveFixtureCleanup(fixtureFailure, () =>
      fs.rmSync(root, { force: true, recursive: true }),
    );
  }
};
