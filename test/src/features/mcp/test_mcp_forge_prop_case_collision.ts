import { AutoMovieApplication, IAutoMovieMcpPropSpec } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { hasViolation } from "../internal/predicates";
import { mcpDoorSpec } from "./test_mcp_forge_prop";

const caseVariant = (node: string): IAutoMovieMcpPropSpec => {
  const spec = mcpDoorSpec();
  return {
    ...spec,
    node,
    model: { ...spec.model, id: node, name: node },
  };
};

/**
 * A prop node id differing from a stored sibling's only by case shares its
 * slice filename on a case-insensitive filesystem, so the upsert rename would
 * silently destroy the sibling's spec while the exact-id guards never fire
 * (#1093, the prop twin of the #1011 beat-slice clobber). `forgeProp` refuses
 * the write-through with a located violation, on every platform, keeping the
 * project portable to case-insensitive filesystems.
 *
 * Scenarios (resident project, "Door" stored first):
 *
 * 1. Forging "door" still forges (the gate is pure) but is NOT stored: a type
 *    violation at `$input.spec.node` names both ids, and the stored "Door" spec
 *    survives byte-identical.
 * 2. Negative twin: the exact id "Door" re-forges as the ordinary upsert (`stored:
 *    true`), replacing its own file.
 * 3. A distinct id ("gate") is no collision and stores beside "Door".
 */
export const test_mcp_forge_prop_case_collision = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-propcase-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });

    const stored = app.forgeProp({ spec: caseVariant("Door") });
    TestValidator.equals("Door stores first", stored.stored, true);
    const doorFile = path.join(root, "props", "Door.json");
    const doorBytes = fs.readFileSync(doorFile, "utf8");

    // 1. the case variant is refused and the sibling survives
    const variant = app.forgeProp({ spec: caseVariant("door") });
    TestValidator.equals(
      "the case variant still forges",
      variant.forged.success,
      true,
    );
    TestValidator.equals(
      "the case variant is not stored",
      variant.stored,
      false,
    );
    TestValidator.predicate(
      "the refusal locates the node and names both ids",
      variant.validation !== undefined &&
        hasViolation(variant.validation, "type", "$input.spec.node") &&
        variant.validation.success === false &&
        variant.validation.violations.some(
          (v) => v.expected.includes('"door"') && v.expected.includes('"Door"'),
        ),
    );
    TestValidator.equals(
      "the stored sibling survives byte-identical",
      fs.readFileSync(doorFile, "utf8"),
      doorBytes,
    );
    TestValidator.equals(
      "the slice directory still lists exactly Door",
      app.nextSteps().status.props,
      ["Door"],
    );

    // 2. negative twin: the exact id is the ordinary upsert
    const exact = app.forgeProp({ spec: caseVariant("Door") });
    TestValidator.equals("the exact id upserts", exact.stored, true);

    // 3. a distinct id stores beside the sibling
    const gate = app.forgeProp({ spec: caseVariant("gate") });
    TestValidator.equals("a distinct id stores", gate.stored, true);
    TestValidator.equals(
      "both props are stored",
      app.nextSteps().status.props.sort(),
      ["Door", "gate"],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
