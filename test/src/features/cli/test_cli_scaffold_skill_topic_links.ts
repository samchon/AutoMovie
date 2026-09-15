/**
 * Exercise instruction publication through its pure candidate boundary.
 * The synthetic Markdown population owns all inputs: no checkout path or
 * shipped paragraph is the oracle. Topic links must be valid before a writer
 * can publish them, even when the five entry routers themselves remain valid.
 */
import {
  getAutoMovieInstructionProjectTargets,
  renderAutoMovieProductionInstructionCandidate,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * A valid entry point cannot hide a broken conditional instruction route.
 *
 * Scenarios:
 *
 * 1. A topic resolves a sibling heading, a local heading and an external URL;
 *    a non-Markdown resource with link-looking bytes remains ordinary data.
 * 2. Changing only its sibling file, heading or root traversal makes the same
 *    candidate fail before publication, independently of router validity.
 * 3. Removing the broken link restores admission without deleting the topic.
 */
export const test_cli_scaffold_skill_topic_links = (): void => {
  const sources: Record<string, string> = {};
  for (const name of [
    "contract",
    "evidence-graph",
    "production-lifecycle",
    "review-verification",
    "source-authoring",
  ])
    sources[`.agents/skills/${name}/SKILL.md`] =
      `---\nname: ${name}\ndescription: Synthetic ${name} router.\n---\n# ${name}\n`;
  sources["docs/README.md"] = "# Documents\n";
  sources[".agents/skills/evidence-graph/work-specific.md"] = "# Contracts\n";
  sources[".agents/skills/production-lifecycle/production-kinds.md"] =
    "# Production kinds\n";
  const topic = ".agents/skills/source-authoring/placement.md";
  sources[".agents/skills/source-authoring/frames.md"] =
    "# Frames\n\n## Shared origin\n";
  sources[".agents/skills/source-authoring/example.json"] =
    '{"literal":"[data](missing.md)"}';
  const evidence = {
    contracts: [],
    description: "",
    designOwners: [],
    packageName: "topic-link-probe",
    manifest: {
      bindings: [],
      branches: [],
      kind: null,
      language: "english" as const,
      localAudits: [],
      localBindings: [],
      populationScope: { mode: "complete-production" as const },
    },
  };
  const render = () =>
    renderAutoMovieProductionInstructionCandidate({ evidence, sources });
  sources[topic] =
    "# Placement\n[Origin](frames.md#shared-origin) [Here](#placement) [Reference](https://example.com/reference)\n";
  TestValidator.equals(
    "the complete valid topic survives publication",
    render()[topic],
    sources[topic],
  );
  for (const [destination, diagnostic] of [
    ["absent.md", "missing target"],
    ["frames.md#absent-origin", "missing anchor"],
    ["../../../../outside.md", "escapes its project root"],
  ]) {
    sources[topic] = `# Placement\n[Origin](${destination})\n`;
    TestValidator.predicate(
      `the topic refuses ${destination}`,
      throwsError(render, [topic, diagnostic]),
    );
  }
  sources[topic] = "# Placement\nNo conditional route is needed.\n";
  TestValidator.equals(
    "repair retains the topic and restores admission",
    render()[topic],
    sources[topic],
  );
  sources[topic] =
    "# Placement\n[Project policy](../../../README.md#updates)\n";
  TestValidator.predicate(
    "a project dependency must be read before publication",
    throwsError(render, ["missing target"]),
  );
  const project = { "README.md": "# Overview\n## Updates\n" };
  for (const target of getAutoMovieInstructionProjectTargets(sources)) {
    TestValidator.equals(
      "the topic selects the actual read dependency",
      target,
      "README.md",
    );
    sources[target] = project["README.md"];
  }
  const candidate = render();
  TestValidator.equals(
    "the project file admits the topic",
    candidate[topic],
    sources[topic],
  );
  TestValidator.equals(
    "project facts are not instruction writes",
    candidate["README.md"],
    undefined,
  );
};
