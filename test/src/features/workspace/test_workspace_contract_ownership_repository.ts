import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { runContractOwnership } from "../../integrity/contractOwnership";

const ROOT = path.resolve(__dirname, "../../../..");

/**
 * This repository's own contract units each declare one owner or stand as
 * recorded migration debt.
 *
 * The fixture case beside this one proves the gate's rules against a synthetic
 * tree, which leaves the committed corpus ungated: a measurement nothing runs
 * against the real thing drifts back. This case runs it, so a requirement or
 * specification unit added without an owner, an owner naming a package that
 * carries no positive citation, a project-source owner supplying nothing the
 * product implements, and an edited legacy unit whose debt was never declared
 * all fail here rather than in a later reading of prose.
 *
 * Scenarios:
 *
 * 1. The committed requirements and specifications ledgers accept the working
 *    tree, and the guard reports the declared and remaining legacy counts.
 */
export const test_workspace_contract_ownership_repository = (): void => {
  const stderr: string[] = [];
  const status = runContractOwnership(
    ["check", "--root", ROOT],
    ROOT,
    { write: () => undefined },
    { write: (message) => stderr.push(message) },
  );
  TestValidator.equals(
    `every contract unit declares an owner or stands as recorded debt${
      status === 0 ? "" : `\n${stderr.join("")}`
    }`,
    status,
    0,
  );
};
