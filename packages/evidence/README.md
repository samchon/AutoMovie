# `@automovie/evidence`

This package turns one generated production's kind, population scope, branch stages, and additive claims into an `@ttsc/evidence` graph. It validates the project-owned physical documents, source populations, topology, and exact contract inventory before returning configuration. The production keeps its decisions and content in its own tracked files.

## Principles, obligations, and discovery

A principle is a no-exclusion checklist answered independently by every selected authored H2/H3/H4. An obligation uses ordinary coverage across the layer: its relevant authored H2s or an aggregate account under `docs/accounts/<layer>` collectively fulfill the target. Source obligations use the same coverage across selected public exports.

Upstream references ask each inheriting authored or source unit what it learned by exercising its actual parents. They permit a concrete exclusion when those parents proved sufficient. Settings and research have no upstream authored parents. Discovery instead uses flat `docs/contracts/*.md` file hosts, with one claim for each active authored layer. Retained rules live in their own contract files; only `contracts/index.md` may record a truthful population-wide no-result exclusion. Discovery begins in draft; authored evidence claims activate in evidence and acquire review requirements in review.

The graph's structural and freshness checks do not decide prose truth. The shipped evidence-graph and review-verification procedures own literal relationship review and whole-population comparison. Repeated review frames and pasted target questions remain semantic-review alarms.

## Rendered realization severity

The generated graph rule remains `error`. Map, model, space, material, instance, and motion source-to-design references, shot-to-scene references, and film-source-to-delivery references retain an error reference for their exact coverage and cardinality. At `review`, a second native reference requires their rendered review at `warning` severity so source compilation and initial capture can produce the still-missing observation. System evaluation, production serialization, source principles, upstream checks, source obligations, and every authored or account relationship retain error review requirements. The model review-set obligation defines the finite observation plan and retains error-level coverage.

`createAutoMovieSourceRealizationReferences` implements that split for the factory without changing selectors or interpreting native diagnostics. The manifest retains each reference's optional `severity` and `requireReview`; an absent override inherits the graph's error level. The reader still derives one source-owner lineage identity and its actual current review state. Warning-only lint is not completed review: physical `review` and `final` gates still require current observed evidence, including consumed-model coverage for film and brief and exact selected library owners. Source, target, generated output, or plan changes can reopen those independent obligations. The shipped [rendered-realization procedure](../template/scaffold/.agents/skills/evidence-graph/staging.md#rendered-realization-review) owns the policy table and capture-to-observation workflow.

`selectAutoMovieAuthoredContractFiles` selects common foundations and specialist contracts for each authored role. Language discovery, prose defaults, language style, and narrative families apply to treatments, scripts, and screenplays. The role selection is shared by graph generation and account admission in film, brief, and library projects.

`createAutoMovieAuthoredFileClaims` gives narrative and delivery documents their file parentage. Technical design foundation relationships stay with their consuming H2 units.

## Production-local obligations

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

Append the returned claim to the production declaration's `claims`. `documentRoot` defaults to `docs`; `docs/contracts` with a bare filename is also supported. The helper selects the full authored H2 population from `layer` and `populationScope`, plus the reserved aggregate `account` address. Actual contributors own the evidence; an aggregate file is useful when it owns a shared conclusion. Each contract document has one declaration, and account addresses remain unique.

The factory validates `autoMovieBinding` on the authored declaration and retains it for AutoMovie manifest readers. Its returned native graph contains copies of local claims with that AutoMovie-only property removed, so native schema validation receives only its supported claim fields. Shared claims and local reference constraints remain unchanged.

Disabled and draft claims remain declared but inactive. Evidence requires a present nonempty contract and positive coverage from eligible owners; review additionally requires current native fingerprints. The obligation reference uses error severity. Canonical admission preserves activation, severity, host population, and target reference. `inapplicable: true` represents an explicit first-pilot audit.

The manifest exposes eligible owners in `localBindings[].host`, contract `targets`, authored `population`, and the `distributed-coverage` relationship. Pilot-only inapplicable declarations appear in `localAudits`. `readAutoMovieContractRules` reads structured metadata from contract H2s.

For an existing production, reread the obligation at its actual contributors and retain valid evidence there. Remove retired contract citations and superseded account-to-population annotations. Review changed relationships from their current content, then synchronize generated instructions. The [staging procedure](../template/scaffold/.agents/skills/evidence-graph/staging.md#production-specific-claims) owns migration.

## Public surface

| Export | Purpose |
| --- | --- |
| `createAutoMovieEvidenceConfig` | Validate the sole production declaration and construct its native graph. |
| `IAutoMovieEvidenceConfigProps` | Declare project root, kind, language, scope, every branch stage, and additive claims. |
| `AutoMovieProductionKind`, `AutoMovieEvidenceStage` | Define the closed production-shape and branch-lifecycle vocabularies. |
| `createAutoMovieProductionPrincipleClaim` | Create a local per-unit no-exclusion checklist. |
| `createAutoMovieProductionObligationClaim` | Declare ordinary coverage for one local obligation document and its eligible authored and aggregate owners. |
| `createAutoMoviePopulationAccountClaims` | Build shared ordinary coverage with the same builder as local obligations. |
| `createAutoMovieContractBindingManifest` | Project shared relationships, local bindings and audits, and topology from validated claims. |
| `readAutoMovieProductionEvidence` | Read the manifest, authored owners, local contract rules, source bindings, and review alarms for production consumers. |
| `readAutoMovieProductionPackageIdentity` | Read the project identity manifest from its fixed path through an injected host boundary. |
| `isAutoMovieEvidenceIdentityFile` | Admit that manifest as one regular, non-symlink file, separately from the enumerated-population judgment. |
| `inspectAutoMovieEvidenceTopology` | Inspect the provider, consumer, status, and reason matrix. |
| `inspectAutoMovieEvidenceReviewAlarms` | Report repeated review frames and pasted target questions for substantive rereading. |
| `evidence` | Re-export the native lint plugin for the project's typed configuration. |

The factory, instruction synchronization, and production readers consume the same exported declaration. Additive claims extend the shared graph without replacing its populations, cardinality, topology, or physical-input guards. All shared targets live in the generated project's scaffold-local `docs` inventory, and all production-specific targets remain in its flat `docs/contracts` directory.
