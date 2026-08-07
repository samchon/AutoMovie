import type { TtscLintRuleSetting } from "@ttsc/lint";

declare module "@ttsc/lint" {
  interface ITtscLintContributorRules {
    /**
     * Rejects the scaffold's implement-me sentinel once it reaches compiled
     * source. The rule's own diagnostic names the exact token; spelling it here
     * would make this file trip the rule it declares.
     *
     * A project with no sentinel is silent, including an otherwise empty
     * project. The rule takes no options.
     */
    "automovie/template-sentinel"?: TtscLintRuleSetting;
  }
}
