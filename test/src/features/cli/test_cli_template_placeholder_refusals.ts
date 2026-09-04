import { renderTemplate } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

/**
 * Template rendering accepts only complete, named, declared placeholders.
 *
 * Scenarios:
 *
 * 1. Literal text and repeated known placeholders render in source order.
 * 2. Unknown, empty, whitespace, malformed, nested, unmatched-opening, and
 *    unmatched-closing forms, plus replacement text containing delimiters, are
 *    refused before a rendered payload is returned.
 * 3. Empty input and delimiter-like single braces remain ordinary literal text.
 */
export const test_cli_template_placeholder_refusals = (): void => {
  const variables = { name: "film", "version:engine": "^1.2.3" };
  const refusal = (content: string): string => {
    try {
      renderTemplate(content, variables);
      return "accepted";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };

  TestValidator.equals(
    "known placeholders render without residue",
    renderTemplate("{{name}}/{{version:engine}}/{{name}}", variables),
    "film/^1.2.3/film",
  );
  TestValidator.equals(
    "every invalid placeholder class is refused distinctly",
    [
      refusal("{{missing}}"),
      refusal("{{toString}}"),
      refusal("{{}}"),
      refusal("{{   }}"),
      refusal("{{bad key}}"),
      refusal("{{outer{{inner}}"),
      refusal("prefix {{name"),
      refusal("prefix }} suffix"),
      refusal("{{name}} }}"),
      (() => {
        try {
          renderTemplate("{{name}}", { name: "{{nested}}" });
          return "accepted";
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      })(),
      (() => {
        try {
          renderTemplate("{{name}}", { name: "nested}}" });
          return "accepted";
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      })(),
    ],
    [
      "unknown scaffold variable: {{missing}}",
      "unknown scaffold variable: {{toString}}",
      "empty scaffold placeholder: {{}}",
      "whitespace scaffold placeholder: {{   }}",
      "malformed scaffold placeholder: {{bad key}}",
      "malformed scaffold placeholder: {{outer{{inner}}",
      "unmatched scaffold placeholder opening delimiter at offset 7",
      "unmatched scaffold placeholder closing delimiter at offset 7",
      "unmatched scaffold placeholder closing delimiter at offset 9",
      "scaffold variable {{name}} expands to placeholder syntax",
      "scaffold variable {{name}} expands to placeholder syntax",
    ],
  );
  const magicVariables = Object.create(null) as Record<string, string>;
  Reflect.set(magicVariables, "__proto__", "literal");
  TestValidator.equals(
    "an explicitly declared magic key remains a variable",
    renderTemplate("{{__proto__}}", magicVariables),
    "literal",
  );
  TestValidator.equals(
    "empty input and single braces remain literal",
    [renderTemplate("", variables), renderTemplate("{name} } {", variables)],
    ["", "{name} } {"],
  );
};
