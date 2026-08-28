import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  ContractOwnershipError,
  inspectContractOwnership,
  queryContractOwnership,
} from "./contract-ownership.mjs";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

const write = (root, relative, text) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
};

const fixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-ownership-"));
  roots.push(root);
  write(
    root,
    "docs/requirements/alpha/contract.md",
    "# Alpha\n\n## Promise {#alpha-promise}\n\nObservable promise.\n",
  );
  write(
    root,
    "docs/specifications/alpha/contract.md",
    "# Alpha specification\n\n## Structure {#alpha-structure}\n\n### Behavior {#alpha-behavior}\n\nSpecified behavior.\n",
  );
  write(
    root,
    "docs/contract-ownership/requirements.json",
    `${JSON.stringify(
      {
        version: 1,
        layer: "requirements",
        declarations: {
          "requirements/alpha/contract.md#alpha-promise": {
            owner: {
              kind: "excluded",
              reason:
                "The fixture keeps its observable promise outside packages.",
            },
          },
        },
        legacy: {},
      },
      null,
      2,
    )}\n`,
  );
  const specifications = {
    version: 1,
    layer: "specifications",
    declarations: {
      "specifications/alpha/contract.md#alpha-behavior": {
        obligations: {
          behavior: {
            owner: {
              kind: "excluded",
              reason: "The fixture does not assign this behavior to a package.",
            },
          },
        },
      },
      "specifications/alpha/contract.md#alpha-structure": {
        structural: {
          reason: "This heading only groups the independently owned behavior.",
        },
      },
    },
    legacy: {},
  };
  write(
    root,
    "docs/contract-ownership/specifications.json",
    `${JSON.stringify(specifications, null, 2)}\n`,
  );
  return { root, specifications };
};

test("a reasoned structural specification unit is not payable debt", () => {
  const { root } = fixture();
  const report = inspectContractOwnership(root);
  assert.deepEqual(report.declarations, {
    requirements: 1,
    specifications: 2,
  });
  assert.deepEqual(
    queryContractOwnership(root, "specifications", "structural"),
    [
      {
        target: "specifications/alpha/contract.md#alpha-structure",
        status: "structural",
      },
    ],
  );
  assert.equal(
    queryContractOwnership(root, "specifications").some(
      ({ target, status }) =>
        target === "specifications/alpha/contract.md#alpha-structure" &&
        status === "structural",
    ),
    true,
  );
  assert.equal(
    queryContractOwnership(root, "specifications", "excluded").some(
      ({ target }) => target.includes("alpha-structure"),
    ),
    false,
  );
});

test("structural classification is exclusive and requires a reason", () => {
  for (const [structural, expected] of [
    [null, "structural classification must be an object"],
    [{}, "structural classification must state a reason"],
    [{ reason: "  " }, "structural classification must state a reason"],
  ]) {
    const { root, specifications } = fixture();
    specifications.declarations[
      "specifications/alpha/contract.md#alpha-structure"
    ].structural = structural;
    write(
      root,
      "docs/contract-ownership/specifications.json",
      `${JSON.stringify(specifications, null, 2)}\n`,
    );
    assert.throws(
      () => inspectContractOwnership(root),
      (error) =>
        error instanceof ContractOwnershipError &&
        error.message.includes(expected),
    );
  }

  const { root, specifications } = fixture();
  specifications.declarations[
    "specifications/alpha/contract.md#alpha-structure"
  ].obligations = {
    fabricated: {
      owner: { kind: "excluded", reason: "This must not coexist." },
    },
  };
  write(
    root,
    "docs/contract-ownership/specifications.json",
    `${JSON.stringify(specifications, null, 2)}\n`,
  );
  assert.throws(
    () => inspectContractOwnership(root),
    (error) =>
      error instanceof ContractOwnershipError &&
      error.message.includes("keys must be exactly structural"),
  );
});
