import type { TtscLintRuleSetting } from "@ttsc/lint";

declare module "@ttsc/lint" {
  interface ITtscLintContributorRules {
    /**
     * Rejects the exact `AUTOMOVIE_IMPLEMENT_ME` scaffold sentinel.
     *
     * A project with no sentinel is silent, including an otherwise empty
     * project. The rule takes no options.
     */
    "automovie/template-sentinel"?: TtscLintRuleSetting;
  }
}
