/**
 * Explain the authoring work between a blank harness and a runnable production.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Names the installed commands and project-owned decisions a new checkout must supply.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-state Keeps available tooling distinct from a production whose content is still unselected.
 */
export const renderAutoMovieScaffoldNextSteps = (directory: string): string =>
  `\n\nNext (from ${directory}):\n` +
  `  1. Read README.md, AGENTS.md, and docs/README.md. This is an empty harness.\n` +
  `  2. Run npm install, npm run capture:install, and npm run capture:doctor.\n` +
  `  3. Select film, brief, or library and its active branches in lint.config.ts; run npm run sync.\n` +
  `  4. Author and review the required docs, then their source. Extend the marked block in scripts/emitDesign.ts with the records this production owns.\n` +
  `  5. Run npm run lint:source, npm run design, npm run compile, and npm run lint at their documented authoring stages.\n\n` +
  `The blank kind:null project and the unconfigured design emitter deliberately refuse production compilation.\n` +
  `After current source compilation, use the selected shape's preview/inspection and review commands. Film/brief rendering additionally needs authored shot and delivery source; a library does not need a film.\n` +
  `npm run viewer opens the local viewer at http://127.0.0.1:5173; opening it is not proof that production content exists.\n`;
