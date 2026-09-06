import { planScaffoldPublication } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import * as path from "node:path";

/**
 * A scaffold candidate is complete and immutable before publication begins.
 *
 * Scenarios:
 *
 * 1. Ordinary text becomes exact UTF-8 bytes and absolute targets in input
 *    order, and both the candidate and entries are frozen.
 * 2. Non-text content, NUL, root identity, lexical escape, case-fold collision,
 *    and file-directory ancestry collision are refused during planning.
 * 3. An empty map is a complete empty candidate and creates no hidden entry.
 */
export const test_cli_scaffold_publication_plan = (): void => {
  const root = path.resolve("synthetic-publication-root");
  const candidate = planScaffoldPublication({
    files: { "src/a.ts": "한", "README.md": "film" },
    root,
  });
  TestValidator.equals(
    "planning freezes exact paths and UTF-8 bytes before mutation",
    {
      bytes: candidate.map((entry) => Array.from(entry.bytes)),
      frozen: Object.isFrozen(candidate) && candidate.every(Object.isFrozen),
      relative: candidate.map((entry) => entry.relative),
      target: candidate.map((entry) => entry.target),
    },
    {
      bytes: [
        Array.from(Buffer.from("한", "utf8")),
        Array.from(Buffer.from("film")),
      ],
      frozen: true,
      relative: ["src/a.ts", "README.md"],
      target: [path.resolve(root, "src/a.ts"), path.resolve(root, "README.md")],
    },
  );

  const refusal = (files: Readonly<Record<string, string>>): string => {
    try {
      planScaffoldPublication({ files, root });
      return "accepted";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  TestValidator.predicate(
    "every invalid candidate is refused before publication",
    [
      refusal({ bad: 1 } as unknown as Record<string, string>),
      refusal({ "bad\0path": "x" }),
      refusal({ ".": "x" }),
      refusal({ "..": "x" }),
      refusal({ "../escape": "x" }),
      refusal({ "A/file": "x", "a/FILE": "y" }),
      refusal({ parent: "x", "parent/child": "y" }),
    ].every((message) => message !== "accepted"),
  );
  TestValidator.equals(
    "an empty input is one frozen empty candidate",
    planScaffoldPublication({ files: {}, root }),
    [],
  );
};
