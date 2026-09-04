import { listAutoMovieDiagnosticCatalog } from "@automovie/production";
import {
  renderScaffold,
  validateAutoMovieInstructionLink,
  validateAutoMovieSkillRouterLinks,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

const messageOf = (sources: readonly { path: string; content: string }[]) => {
  try {
    validateAutoMovieSkillRouterLinks(sources);
    return "accepted";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/**
 * Shipped skill entries are H1-only routers with root-bound live links.
 *
 * Scenarios:
 *
 * 1. A sibling file, root-relative escape back to project docs, and explicit
 *    anchor resolve against one synthetic source population.
 * 2. A root escape, missing file, missing anchor, directory anchor, and
 *    multi-heading router fail at their exact boundary.
 * 3. The complete first scaffold candidate passes the same validator.
 */
export const test_cli_scaffold_skill_router_links = (): void => {
  const valid = [
    {
      path: ".agents/skills/topic/SKILL.md",
      content:
        "---\nname: topic\n---\n\n# Topic\n\nRead [this route](#topic), [index](index.md#route), and [docs](../../../docs/README.md).\n",
    },
    {
      path: ".agents/skills/topic/index.md",
      content: "# Procedure\n\n## Route {#route}\n",
    },
    { path: "docs/README.md", content: "# Contracts\n" },
  ];
  TestValidator.equals("valid root-bound routes", messageOf(valid), "accepted");
  TestValidator.predicate(
    "the rendered blank scaffold carries only valid skill routers",
    (() => {
      const scaffold = renderScaffold({
        name: "router-film",
        language: "english",
      });
      const sources = Object.entries(scaffold)
        .filter(([file]) => file.endsWith(".md"))
        .map(([path, content]) => ({ path, content }));
      try {
        validateAutoMovieSkillRouterLinks(sources);
        for (const entry of listAutoMovieDiagnosticCatalog())
          validateAutoMovieInstructionLink(
            sources,
            "AGENTS.md",
            entry.reference.path,
          );
        return true;
      } catch {
        return false;
      }
    })(),
  );
  TestValidator.equals(
    "invalid route classes fail independently",
    {
      escape: messageOf([
        ...valid.slice(1),
        { path: ".agents/skills/topic/SKILL.md", content: "# Topic\n\n[bad](../../../../outside.md)\n" },
      ]).includes("escapes its project root"),
      drive: messageOf([
        ...valid.slice(1),
        { path: ".agents/skills/topic/SKILL.md", content: "# Topic\n\n[bad](C:/outside.md)\n" },
      ]).includes("escapes its project root"),
      file: messageOf([
        ...valid.slice(1),
        { path: ".agents/skills/topic/SKILL.md", content: "# Topic\n\n[bad](missing.md)\n" },
      ]).includes("missing target"),
      anchor: messageOf([
        ...valid.slice(1),
        { path: ".agents/skills/topic/SKILL.md", content: "# Topic\n\n[bad](index.md#missing)\n" },
      ]).includes("missing anchor"),
      directoryAnchor: messageOf([
        ...valid.slice(1),
        { path: ".agents/skills/topic/SKILL.md", content: "# Topic\n\n[bad](../../../docs#missing)\n" },
      ]).includes("anchor targets a directory"),
      heading: messageOf([
        ...valid.slice(1),
        { path: ".agents/skills/topic/SKILL.md", content: "# Topic\n\n## Body\n" },
      ]).includes("H1-only"),
    },
    {
      escape: true,
      drive: true,
      file: true,
      anchor: true,
      directoryAnchor: true,
      heading: true,
    },
  );
};
