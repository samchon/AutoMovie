/**
 * Explain the authoring work between a blank harness and a runnable production.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Names the installed commands and project-owned decisions a new checkout must supply.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-state Keeps available tooling distinct from a production whose content is still unselected.
 */
export const renderAutoMovieScaffoldNextSteps = (directory: string): string =>
  `\n\nNext (from ${directory}):\n` +
  `  1. Read README.md, AGENTS.md, and docs/README.md. This is an empty harness.\n` +
  `  2. Run npm install.\n` +
  `  3. Select film, brief, or library and its active branches in src/lint.config.ts; run npm run sync.\n` +
  `  4. Author and review the required docs, then their TypeScript source under src.\n` +
  `  5. Run npm run lint, then npm run viewer to inspect the source preview.\n\n` +
  `A blank project contains no production content. Author the selected shape with the public AutoMovie package APIs.\n` +
  `npm run viewer opens the local viewer at http://127.0.0.1:5173; opening it is not proof that production content exists.\n`;
