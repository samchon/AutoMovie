/**
 * Substitute `{{key}}` tokens in a template payload from `variables`, throwing
 * on an unknown key. Throwing (rather than leaving the token, or silently
 * blanking it) makes a mistyped placeholder a loud build-time failure instead
 * of a broken scaffold shipped to a user — the same discipline the reference
 * scaffolder uses.
 *
 * @author Samchon
 */
export const renderTemplate = (
  content: string,
  variables: Record<string, string>,
): string =>
  content.replace(/\{\{([A-Za-z0-9:_@./-]+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (value === undefined)
      throw new Error(`unknown scaffold variable: {{${key}}}`);
    return value;
  });
