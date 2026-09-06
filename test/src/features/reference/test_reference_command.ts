import {
  createAutoMovieReferenceProvider,
  runAutoMovieReferenceCommand,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { ReferenceError } from "../../../../packages/mcp/src/internal/referenceError";

/**
 * The local command delivers the same provider result with a result-only stdout.
 *
 * Scenarios:
 * 1. An explicit root and request return the provider's exact JSON envelope.
 * 2. Malformed argv, JSON, binding and request inputs route errors without source leaks.
 */
export const test_reference_command = async (): Promise<void> => {
  const output: string[] = [];
  const diagnostics: string[] = [];
  const roots: string[] = [];
  const reader = {
    read: async () => Buffer.from("## A {#a}\nbody"),
    list: async () => [],
  };
  const runtime = {
    reader: async (root: string) => {
      roots.push(root);
      return reader;
    },
    stdout: (value: string) => {
      output.push(value);
    },
    stderr: (value: string) => {
      diagnostics.push(value);
    },
  };
  const input = {
    operation: "read_section_without_annotations",
    location: "docs/settings/a.md#a",
  };
  const code = await runAutoMovieReferenceCommand(
    ["--root", "/production", "--request", JSON.stringify(input)],
    runtime,
  );
  TestValidator.equals("success status", code, 0);
  TestValidator.equals("explicit root", roots, ["/production"]);
  TestValidator.equals(
    "same provider result",
    output[0],
    `${JSON.stringify(await createAutoMovieReferenceProvider(reader)(input))}\n`,
  );
  TestValidator.equals("no success diagnostic", diagnostics, []);
  for (const argv of [
    [],
    ["--root", "/production"],
    ["--other", "/production", "--request", "{}"],
    ["--root", "/production", "--other", "{}"],
  ]) {
    TestValidator.equals(
      "usage status",
      await runAutoMovieReferenceCommand(argv, runtime),
      1,
    );
  }
  TestValidator.equals("invalid argv never binds", roots.length, 1);
  TestValidator.equals(
    "malformed JSON status",
    await runAutoMovieReferenceCommand(
      ["--root", "/production", "--request", "secret-not-json"],
      runtime,
    ),
    1,
  );
  TestValidator.equals(
    "malformed JSON is one result",
    JSON.parse(output[1]).error.code,
    "INVALID_JSON",
  );
  TestValidator.predicate(
    "input not reflected",
    !output.join("").includes("secret-not-json"),
  );
  TestValidator.equals(
    "invalid request status",
    await runAutoMovieReferenceCommand(
      ["--root", "/production", "--request", "{}"],
      runtime,
    ),
    1,
  );
  TestValidator.equals(
    "invalid request provider result",
    JSON.parse(output[2]).error.code,
    "INVALID_REQUEST",
  );
  for (const error of [
    new Error("private path"),
    new ReferenceError("PERMISSION_DENIED", "Read denied."),
  ]) {
    const status = await runAutoMovieReferenceCommand(
      ["--root", "/production", "--request", "{}"],
      {
        ...runtime,
        reader: async () => {
          throw error;
        },
      },
    );
    TestValidator.equals("binding failure status", status, 1);
  }
  TestValidator.predicate(
    "startup failure sanitized",
    !diagnostics.join("").includes("private path"),
  );
  TestValidator.equals("startup failure produces no result", output.length, 3);
};
