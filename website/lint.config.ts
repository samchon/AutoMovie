import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * The website is presentation over the manor production and the viewer. Its
 * modules are page entry points and the host adapter they share, not public
 * contract carriers, so only the workspace correctness rules apply here.
 */
export default {
  extends: "../config/lint.config.ts",
} satisfies ITtscLintConfig;
