/// <reference types="node" />
import type { ITtscLintPlugin } from "@ttsc/lint";
import path from "node:path";

import { version } from "../package.json";

export * from "./structures/IAutoMovieStatePresenceRuleOptions";
export * from "./typings/ITtscLintContributorRules";
export * from "./typings/ITtscLintRuleOptionsMap";

/**
 * AutoMovie's project-contract contributor for `@ttsc/lint`.
 *
 * Register this descriptor under the `automovie` plugin key.
 * `template-sentinel` rejects a scaffold placeholder once it reaches compiled
 * source, while `state-presence` rejects a resident downstream record whose
 * configured upstream slot does not exist.
 */
export const automovie = {
  meta: {
    name: "@automovie/lint",
    namespace: "automovie",
    version,
  } as const,
  rules: ["state-presence", "template-sentinel"] as const,
  source: path.resolve(__dirname, "..", "native"),
} satisfies ITtscLintPlugin;

export default automovie;
