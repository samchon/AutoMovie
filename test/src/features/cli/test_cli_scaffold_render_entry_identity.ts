import { renderScaffoldEntries } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

/**
 * Scaffold rendering preserves every source until output paths are injective.
 *
 * Scenarios:
 *
 * 1. Renamed, tokenized, normalized, and ordinary entries retain their exact
 *    own output keys and rendered text.
 * 2. Rename and token convergence refuse both source identities in a stable
 *    diagnostic independent of input order.
 * 3. `__proto__`, one entry, and the empty inventory remain ordinary own-key
 *    map cases rather than prototype mutation or missing output.
 */
export const test_cli_scaffold_render_entry_identity = (): void => {
  const variables = { name: "film" };
  const rendered = renderScaffoldEntries(
    [
      { relative: "gitignore", content: "dist\r\n" },
      { relative: "docs/{{name}}.md", content: "# {{name}}\r\n" },
    ],
    variables,
  );
  TestValidator.equals(
    "rendered entries preserve exact own paths and bytes",
    Object.entries(rendered),
    [
      [".gitignore", "dist\n"],
      ["docs/film.md", "# film\n"],
    ],
  );

  const refusal = (
    entries: { relative: string; content: string }[],
  ): string => {
    try {
      renderScaffoldEntries(entries, variables);
      return "accepted";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  const renameCollision = [
    { relative: "npmrc", content: "one" },
    { relative: ".npmrc", content: "two" },
  ];
  TestValidator.equals(
    "collisions name both sorted source identities independent of input order",
    [refusal(renameCollision), refusal([...renameCollision].reverse())],
    [
      'scaffold sources collide at rendered path ".npmrc": ".npmrc", "npmrc"',
      'scaffold sources collide at rendered path ".npmrc": ".npmrc", "npmrc"',
    ],
  );
  TestValidator.equals(
    "token convergence is refused before map construction",
    [
      refusal([
        { relative: "{{name}}/README.md", content: "one" },
        { relative: "film/README.md", content: "two" },
      ]),
      refusal([
        { relative: "same", content: "one" },
        { relative: "same", content: "two" },
      ]),
    ],
    [
      'scaffold sources collide at rendered path "film/README.md": "film/README.md", "{{name}}/README.md"',
      'scaffold sources collide at rendered path "same": "same", "same"',
    ],
  );

  const prototype = renderScaffoldEntries(
    [{ relative: "__proto__", content: "x" }],
    variables,
  );
  TestValidator.equals(
    "prototype-looking paths and empty inventories are ordinary map cases",
    {
      empty: Object.entries(renderScaffoldEntries([], variables)),
      entry: Object.entries(prototype),
      own: Object.hasOwn(prototype, "__proto__"),
      prototype: Object.getPrototypeOf(prototype),
    },
    {
      empty: [],
      entry: [["__proto__", "x"]],
      own: true,
      prototype: null,
    },
  );
};
