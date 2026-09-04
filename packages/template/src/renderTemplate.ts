/**
 * Substitute `{{key}}` tokens in a template payload from `variables`, throwing
 * on an unknown key. Throwing (rather than leaving the token, or silently
 * blanking it) makes a mistyped placeholder a loud build-time failure instead
 * of a broken scaffold shipped to a user, the same discipline the reference
 * scaffolder uses.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Keeps every generated token value explicit and reproducible in a new checkout.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Treats template variables as declared derivation inputs and rejects undeclared placeholders.
 * @author Samchon
 */
export const renderTemplate = (
  content: string,
  variables: Record<string, string>,
): string => {
  let cursor = 0;
  let rendered = "";
  while (cursor < content.length) {
    const opening = content.indexOf("{{", cursor);
    const closing = content.indexOf("}}", cursor);
    if (closing !== -1 && (opening === -1 || closing < opening))
      throw new Error(
        `unmatched scaffold placeholder closing delimiter at offset ${closing}`,
      );
    if (opening === -1) {
      rendered += content.slice(cursor);
      break;
    }
    rendered += content.slice(cursor, opening);
    const end = content.indexOf("}}", opening + 2);
    if (end === -1)
      throw new Error(
        `unmatched scaffold placeholder opening delimiter at offset ${opening}`,
      );
    const key = content.slice(opening + 2, end);
    if (key.length === 0) throw new Error("empty scaffold placeholder: {{}}");
    if (key.trim().length === 0)
      throw new Error(`whitespace scaffold placeholder: {{${key}}}`);
    if (/^[A-Za-z0-9:_@./-]+$/u.test(key) === false)
      throw new Error(`malformed scaffold placeholder: {{${key}}}`);
    if (Object.prototype.hasOwnProperty.call(variables, key) === false)
      throw new Error(`unknown scaffold variable: {{${key}}}`);
    const value = variables[key]!;
    if (value.includes("{{") || value.includes("}}"))
      throw new Error(
        `scaffold variable {{${key}}} expands to placeholder syntax`,
      );
    rendered += value;
    cursor = end + 2;
  }
  return rendered;
};
