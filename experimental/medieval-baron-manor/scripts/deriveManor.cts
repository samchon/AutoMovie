/**
 * Run the declared manor generators through the workspace TypeScript loader.
 *
 * Workspace packages export source, while a standalone packed production uses
 * built JavaScript. The shared runner resolves and transforms those source
 * imports before the instance generator and its environment consumer execute.
 * Use one synchronous module graph for workspace CommonJS and native ESM
 * assets. Three's CommonJS compatibility entry delegates to its ESM build.
 */
require("./deriveManorCritical.mjs");
require("./deriveManorEnvironment.mjs");
