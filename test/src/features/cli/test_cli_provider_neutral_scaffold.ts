import { renderScaffold } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/**
 * The generated scaffold stays provider-neutral.
 *
 * A generated project must not install a Claude-specific hook or any hidden
 * substitute. Ownership refusals remain the responsibility of the commands
 * that own generated, render, capture, and production state.
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
