/**
 * Exercise the read population needed before instruction synchronization.
 * Synthetic topics advertise project files, generated instructions and remote
 * references. The selector must collect only project-owned dependencies; the
 * shared link validator then checks their actual bytes before publication.
 * No filesystem or installed scaffold supplies this test's expected result.
 */
import {
  getAutoMovieInstructionProjectTargets,
  validateAutoMovieInstructionLink,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Synchronization collects conditional project targets using the same root
 * and decoding rules that admit the complete instruction candidate.
 *
 * Scenarios:
 *
 * 1. Empty inputs have no targets; project documents and non-Markdown skill
 *    resources are data rather than recursive instruction sources.
 * 2. Topics collect root Markdown, nested code and JSON dependencies once,
 *    including encoded names and portable separators, while sibling topics,
 *    generated entry points and HTTP references need no project-owned read.
 * 3. The same route parser refuses invalid encoding, unsupported schemes,
 *    absolute paths and traversals beyond the project root in both consumers.
 * 4. Target bytes admit existing headings and resident directory routes;
 *    absent sources, files, headings and directory anchors remain errors.
 */
export const test_cli_scaffold_instruction_project_targets = (): void => {
  const topic = ".agents/skills/source-authoring/topic.md";
  const select = (destination: string) =>
    getAutoMovieInstructionProjectTargets({
      [topic]: `# Topic\n[Reference](${destination})\n`,
    });
  TestValidator.equals(
    "empty population",
    getAutoMovieInstructionProjectTargets({}),
    [],
  );
  const sources = {
    [topic]: [
      "# Topic",
      "[Policy](../../../README.md#updates)",
      "[Policy again](../../../README.md#)",
      "[Configuration](../../../scripts/configuration.ts)",
      "[Assets](..\\..\\..\\automovie\\assets.json)",
      "[Named file](../../../docs/a%20file.md#an%2Danchor)",
      "[Sibling](other.md) [Local](#topic)",
      "[Shared](../../../AGENTS.md) [Client](../../../CLAUDE.md)",
      "[HTTP](http://example.com) [HTTPS](HTTPS://example.com)",
    ].join("\n"),
    "docs/notes.md": "[Ordinary document](not-recursively-followed.md)",
    ".agents/skills/source-authoring/example.json":
      '{"literal":"[Data](absent.md)"}',
    ".agents/skills/source-authoring/other.md": "# Other\n",
  };
  const targets = getAutoMovieInstructionProjectTargets(sources);
  TestValidator.equals(
    "project-owned dependencies in first-use order",
    targets,
    [
      "README.md",
      "scripts/configuration.ts",
      "automovie/assets.json",
      "docs/a file.md",
    ],
  );
  const resident = [
    ...Object.entries(sources).map(([path, content]) => ({ path, content })),
    { path: "README.md", content: "# Overview\n## Updates\n" },
    {
      path: "scripts/configuration.ts",
      content: "export const kind = 'film';",
    },
    { path: "automovie/assets.json", content: "{}" },
    { path: "docs/a file.md", content: "# Named\n## An anchor\n" },
  ];
  for (const destination of [
    "../../../README.md",
    "../../../README.md#updates",
    "../../../README.md#",
    "../../../docs/a%20file.md#an%2Danchor",
    "..\\..\\..\\automovie\\assets.json",
    "../../../scripts/",
    "../../../scripts/#",
    "#topic",
    "http://example.com",
    "https://example.com",
  ])
    validateAutoMovieInstructionLink(resident, topic, destination);
  for (const [destination, diagnostic] of [
    ["%ZZ", "not valid percent-encoded text"],
    ["#%ZZ", "not valid percent-encoded text"],
    ["mailto:someone@example.com", "unsupported scheme"],
    ["/outside.md", "escapes its project root"],
    ["C:\\outside.md", "escapes its project root"],
    ["../../../../outside.md", "escapes its project root"],
    ["../../../..", "escapes its project root"],
  ]) {
    TestValidator.predicate(
      `selection refuses ${destination}`,
      throwsError(() => select(destination!), [diagnostic!]),
    );
    TestValidator.predicate(
      `validation refuses ${destination}`,
      throwsError(
        () => validateAutoMovieInstructionLink(resident, topic, destination!),
        [diagnostic!],
      ),
    );
  }
  for (const [destination, diagnostic] of [
    ["../../../missing.md", "missing target"],
    ["../../../README.md#absent", "missing anchor"],
    ["../../../scripts/#absent", "anchor targets a directory"],
  ])
    TestValidator.predicate(
      `resident bytes refuse ${destination}`,
      throwsError(
        () => validateAutoMovieInstructionLink(resident, topic, destination!),
        [diagnostic!],
      ),
    );
  TestValidator.predicate(
    "an unpublished source cannot advertise even an external reference",
    throwsError(
      () => validateAutoMovieInstructionLink([], topic, "https://example.com"),
      ["source is not published"],
    ),
  );
};
