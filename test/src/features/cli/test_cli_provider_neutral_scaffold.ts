import { renderScaffold } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/**
 * The generated scaffold stays provider-neutral.
 *
 * The scaffold used to install a Claude Code `PreToolUse` hook under `.claude/`
 * that refused writes to tool-owned paths. That put one vendor's control plane
 * on the critical path of a generated project: an author on any other harness
 * got no refusal at all, and the refusal an author did get came from a file the
 * product had no other reason to ship. Ownership refusals belong to the commands
 * that own generated, render, capture, and production state, and those answer
 * every author identically.
 *
 * Absence is the whole contract here, so this is one of the few structural cases
 * the repository keeps: there is no behavior to execute when the correct result
 * is that nothing was installed. What it must not become is a check for one
 * spelling, because the failure it exists to prevent is the hook returning under
 * another name.
 *
 * Scenarios:
 *
 * 1. No rendered path lives under `.claude/`, which is where the removed hook
 *    and its settings sat.
 * 2. No rendered path lives under any `hooks/` directory and no rendered file
 *    carries a `PreToolUse` payload, so the same control plane cannot return
 *    under a provider-neutral-looking directory or inside another file.
 */
export const test_cli_provider_neutral_scaffold = (): void => {
  const rendered = renderScaffold({ name: "provider-neutral-film" });
  const keys = Object.keys(rendered);
  TestValidator.equals(
    "the scaffold installs no provider-specific hook",
    namedFacts([
      [
        "noClaudeDirectory",
        () => keys.every((key) => key.startsWith(".claude/") === false),
      ],
      [
        "noHookPayload",
        () =>
          keys.every((key) => key.includes("hooks/") === false) &&
          Object.values(rendered).every(
            (content) => content.includes("PreToolUse") === false,
          ),
      ],
    ]),
    { noClaudeDirectory: true, noHookPayload: true },
  );
};
