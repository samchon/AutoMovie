# `@automovie/evidence`

This package turns one generated production's kind, population scope, branch stages, and additive claims into an `@ttsc/evidence` graph. It validates the project-owned physical documents, source populations, topology, and exact contract inventory before returning configuration. The production keeps its decisions and content in its own tracked files.

## Principles, obligations, and discovery

A principle is a no-exclusion checklist answered independently by every selected authored H2/H3/H4. An authored obligation is answered by a dedicated H2 under `docs/accounts/<layer>`: that account owns exactly one obligation H2 and compares every H2 in the complete selected authored population. Common, language, and production-local authored obligations use the same account form. Source obligations retain distributed coverage across the family's selected public exports.

Upstream references ask each inheriting authored or source unit what it learned by exercising its actual parents. They permit a concrete exclusion when those parents proved sufficient. Settings and research have no upstream authored parents. Discovery instead uses flat `docs/contracts/*.md` file hosts, with one claim for each active authored layer. Retained rules live in their own contract files; only `contracts/index.md` may record a truthful population-wide no-result exclusion. Discovery begins in draft; authored evidence claims activate in evidence and acquire review requirements in review.

The graph's structural and freshness checks do not decide prose truth. The shipped evidence-graph and review-verification procedures own literal relationship review and whole-population comparison. Repeated review frames and pasted target questions remain semantic-review alarms.

## Rendered realization severity

The generated graph rule remains `error`. Map, model, space, material, instance, and motion source-to-design references, shot-to-scene references, and film-source-to-delivery references retain an error reference for their exact coverage and cardinality. At `review`, a second native reference requires their rendered review at `warning` severity so source compilation and initial capture can produce the still-missing observation. System evaluation, production serialization, source principles, upstream checks, source obligations, and every authored or account relationship retain error review requirements. The model review-set obligation is a finite pre-render plan and remains an error on both account references.

`createAutoMovieSourceRealizationReferences` implements that split for the factory without changing selectors or interpreting native diagnostics. The manifest retains each reference's optional `severity` and `requireReview`; an absent override inherits the graph's error level. The reader still derives one source-owner lineage identity and its actual current review state. Warning-only lint is not completed review: physical `review` and `final` gates still require current observed evidence, including consumed-model coverage for film and brief and exact selected library owners. Source, target, generated output, or plan changes can reopen those independent obligations. The shipped [rendered-realization procedure](../template/scaffold/.agents/skills/evidence-graph/staging.md#rendered-realization-review) owns the policy table and capture-to-observation workflow.

## Production-local accounts

Use the owning branch's values from the single `productionEvidence` declaration in `lint.config.ts`:

```ts
createAutoMovieProductionObligationClaim({
  name: "Models account for the production's local obligations",
  document: "contracts/obligations-models.md",
  account: "accounts/models/local-obligations.md",
  layer: "models",
  stage: productionEvidence.models,
  populationScope: productionEvidence.populationScope,
});
```

Append the returned claim to that declaration's `claims`. `documentRoot` defaults to `docs`; alternatively use `documentRoot: "docs/contracts"` and a bare filename. Each H2 in the contract document requires exactly one account H2. Different documents need different account files, and the complete authored H2 population is derived from `layer` and `populationScope`. Callers cannot replace it with a selected subset. Shared filenames and the settings story-subject account are reserved.

The factory validates `autoMovieBinding` on the authored declaration and retains it for AutoMovie manifest readers. Its returned native graph contains copies of local claims with that AutoMovie-only property removed, so native schema validation receives only its supported claim fields. Shared claims and local reference constraints remain unchanged.

Disabled and draft claims remain declared but inactive. Evidence requires physical accounts and targets; review additionally requires current native fingerprints on both references. Both references explicitly use `error` severity. Preserve the helper's omitted claim-level severity: canonical admission refuses any claim-level override, including `off` or `0` that would disable the entire native claim, and refuses a weaker rewritten reference. `inapplicable: true` is permitted only for an explicit first-pilot audit. Complete production and its authorized reset cannot use that disposition to escape a duty. A reset retains the complete denominator while its reset branches remain inactive draft material.

The manifest exposes the account in `localBindings[].host`, its contract in `targets`, and the compared authored H2 selector in `population`. Pilot-only inapplicable declarations appear in `localAudits` with the same identities. `readAutoMovieContractRules` continues to read optional structured metadata from the contract H2s; account H2s do not create new rule definitions.

Existing obligation callers must replace `files` and `symbol` with `account` and split plural documents into one declaration per document. Preserve authored facts and decisions, reread every selected H2 against the obligation, transfer the whole-population comparison to its dedicated account, remove superseded direct obligation annotations, and review the new relationships. Copying generic comparison text or refreshing fingerprints mechanically does not migrate the evidence. After the declaration and accounts are valid, `npm run sync` refreshes generated instructions while preserving these tracked inputs. The shipped [staging procedure](../template/scaffold/.agents/skills/evidence-graph/staging.md#production-specific-claims) owns the full migration workflow.

## Public surface

| Export | Purpose |
| --- | --- |
| `createAutoMovieEvidenceConfig` | Validate the sole production declaration and construct its native graph. |
| `IAutoMovieEvidenceConfigProps` | Declare project root, kind, language, scope, every branch stage, and additive claims. |
| `AutoMovieProductionKind`, `AutoMovieEvidenceStage` | Define the closed production-shape and branch-lifecycle vocabularies. |
| `createAutoMovieProductionPrincipleClaim` | Create a local per-unit no-exclusion checklist. |
| `createAutoMovieProductionObligationClaim` | Declare one local obligation document and its dedicated population account. |
| `createAutoMoviePopulationAccountClaims` | Generate the shared account family using the same dual-reference builder as local accounts. |
| `createAutoMovieContractBindingManifest` | Project shared relationships, local bindings and audits, and topology from validated claims. |
| `readAutoMovieProductionEvidence` | Read the manifest, authored owners, local contract rules, source bindings, and review alarms for production consumers. |
| `inspectAutoMovieEvidenceTopology` | Inspect the provider, consumer, status, and reason matrix. |
| `inspectAutoMovieEvidenceReviewAlarms` | Report repeated review frames and pasted target questions for substantive rereading. |
| `evidence` | Re-export the native lint plugin for the project's typed configuration. |

The factory, instruction synchronization, and production readers consume the same exported declaration. Additive claims extend the shared graph without replacing its populations, cardinality, topology, or physical-input guards. All shared targets live in the generated project's scaffold-local `docs` inventory, and all production-specific targets remain in its flat `docs/contracts` directory.
