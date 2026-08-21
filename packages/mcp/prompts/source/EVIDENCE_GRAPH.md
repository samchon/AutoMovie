# Evidence Graph Handbook

A production's authored layout is its obligation graph. Files under `config/docs` define reusable production law; files under `docs` state one production's evidence; TypeScript realizes reviewed model, motion, and audiovisual contracts. An unpaid edge is a compile error.

Read `SOURCE_COMPOSITION` for source arrangement and `PRODUCTION_DESIGN` before replacing the starter. This guide owns production kinds, layer boundaries, citations, and staged review.

## Select one production kind

Set `kind` in `lint.config.ts`. The kinds are mutually exclusive, and authored structure rather than runtime decides among them.

| Kind | Result | Active result path |
| --- | --- | --- |
| `film` | a narrative audiovisual work, including a narrative short | `storylines -> scenarios -> script -> shots -> filmSources` |
| `brief` | one bounded non-narrative audiovisual result, such as a turntable, logo sting, or motion demonstration | `briefs -> shots -> filmSources` |
| `library` | reusable settings, production source, and applicable model or motion design and source, with no timed result | no prose-to-shot or film-source path |

A ten-second story is still a film. A long technical demonstration may still be a brief. Do not use `brief` to avoid defining dramatic causality, or `library` when delivery contains a shot.

Each layer is explicitly `disabled`, `evidence`, or `review`. `disabled` means the production does not contain it and its governed Markdown or TypeScript hosts are absent. `evidence` requires at least one governed host and complete citations. Every active Markdown file has an explicitly anchored H2 unit, film and brief ladder files also have explicitly anchored and correctly nested H3 and H4 units, and every governed source file has a named exported owner of the governed kind. `review` additionally requires current review fingerprints. The factory refuses residual, empty, and structurally empty populations. Select these states through `createAutoMovieEvidenceConfig`; do not rewrite graph populations to make a production pass.

## Reusable law and production evidence

The two document roots must not mix.

| Root | Holds | Changes when |
| --- | --- | --- |
| `config/docs/principles` | reusable rules: per-file checklists for authored Markdown and population coverage for heterogeneous source exports, one concern per anchored H2 | the reusable authoring standard changes |
| `config/docs/obligations` | distinct responsibilities distributed across a population | the population's required roles change |
| `docs` | researched facts and decisions for this production | the production changes |

An authored-document principle is a checklist. Every Markdown file in its governed layer cites every applicable H2, exclusions are refused, and each reason says how that file obeys the rule. A source principle is covered across the selected export population because constructors, motions, deliveries, and acceptance records have different applicable duties; every source H2 still needs concrete implementation evidence, while exact design edges prevent orphan or multiply owned exports. An obligation is document-population coverage: one host may own a role on behalf of the population, and a permitted exclusion means the whole production deliberately lacks it.

Never copy the same rule into both families. If every host must obey it, it is a principle. If the population must collectively allocate it, it is an obligation.

Before changing a principle, compare it with every sibling. Reduce each to the subject it governs and the decision it requires. If two can govern the same decision, merge them or redraw the boundary. Test one compliant case and one counterexample at the boundary, and check that obeying one cannot contradict another without an independently named concern.

The principal domain boundaries are strict:

- settings own facts, capabilities, constraints, and observable identity;
- models own deterministic representation, hierarchy, geometry allocation, articulation, materials, and fidelity limits;
- motions own endpoints, phases, time mapping, spatial path, parameter domain, contacts, and composition;
- storylines own cause and the audience's changed understanding;
- scenarios own executable physical progression and entry or exit state;
- scripts own final audience-visible, audience-readable, and audible expression and timing;
- briefs own one observable non-narrative progression;
- model and motion source own their reviewed representation or transition implementation and refuse unsupported behavior;
- shots own one reviewed scene's local visual composition and delivery acceptance;
- production source serializes reviewed settings into the engine-facing production record;
- film source owns global editorial mapping and auxiliary tracks without inventing local composition or audience content.

## The production layers

| Layer | Host | Direct evidence |
| --- | --- | --- |
| Research | `docs/research/*.md` | common and research principles; once a consumer exists, every research H2 is consumed by a downstream authored H2 |
| Settings | `docs/settings/*.md` | common and settings principles; settings obligations |
| Models | `docs/models/*.md` | settings; common and model principles; model obligations |
| Motions | `docs/motions/*.md` | settings and models; common and motion principles; motion obligations |
| Storylines | `docs/storylines/*.md` | settings; common, narrative, and storyline principles; storyline obligations |
| Scenarios | `docs/scenarios/*.md` | matching storyline units and settings; common, narrative, and scenario principles |
| Script | `docs/script/*.md` | matching scenario and storyline units and settings; common, narrative, and script principles |
| Briefs | `docs/briefs/*.md` | settings and any active model or motion branches; common and brief principles |
| Model source | subject classes under `src/units`, `src/objects`, `src/world`, and `src/formations` | exactly one model file; model design units and model-source principles |
| Motion source | exports under `src/motions` | exactly one motion file; motion design units and motion-source principles |
| Shots | exports under `src/shots` | exactly one script scene or brief shot; shot principles |
| Production source | exports in `src/production.ts` | settings; production-source principles |
| Film source | export in `src/film.ts` | every script sequence or brief delivery; film-source principles |

Research is an optional upstream branch. It may be drafted alone, but once any authored production layer is active, research must already be in `review` and every research H2 must support at least one downstream H2. Each entry records the identifiable source and used portion, its authority, material uncertainty or disagreement, and the exact production decision it constrains; the owning downstream layer still makes that decision.

## Exact unit identity

A film preserves the same anchored units through all three narrative layers:

```text
## sequence -> ## sequence
### scene   -> ### scene
#### beat   -> #### beat
```

Each scenario unit cites exactly one matching storyline unit. Each script unit cites exactly one matching scenario unit and one matching storyline unit. The script cites both because a scenario can itself be miswired. The factory also compares the ordered physical H2/H3/H4 anchors and nesting across active layers, so renamed, reordered, duplicated, unanchored, or cross-wired identities fail even if their citation counts are bijective. A shot cites exactly one script H3 scene for its local visual realization; film source cites every script H2 sequence for global edit and auxiliary-track assembly.

A brief uses `##` delivery, `###` shot, and `####` observation. Its shot cites exactly one brief H3 and film source cites every brief H2. It does not invent a storyline or scenario for an observable demonstration that makes no narrative claim.

Keep stable anchors even when display titles change. The screenplay index separately resolves exact beat text and `SCN-*` identities against storyline and script documents; it is not part of `@ttsc/evidence`, so moving prose requires updating the index too.

## Model and motion evidence

A settings subject is not a model. Settings say what the subject is and what it may do; `docs/models` says how the blocking representation implements that contract. Use one model document per represented subject and give every exported model class exactly one model owner.

A model capability is not a motion. Settings authorize the semantic capability and limit, the model binds that limit to a named joint or other stable representation interface, and a timed transition through it belongs in `docs/motions`. Record start and end state, time domain, phases and interpolation, spatial relation, invalid inputs, contacts, interruption, composition, and the observations that can disprove the motion. Give every exported motion function and property exactly one motion owner.

Motion implementation lives under `src/motions`. Subject methods may delegate to it. A shot composes motions but must not hide reusable transition math or grant a model a capability its reviewed documents do not authorize.

The graph selects governed model types exactly and motion functions and properties exactly. Every such owner cites one design file, and the population collectively covers every model or motion H2 and every source principle. Keep a helper outside these governed source directories when it implements no model or motion design fact; a governed symbol cannot cite zero or two design files.

## Writing citations

Markdown file citations live in one HTML comment before the H1. Citations owned by an H2, H3, or H4 live in the comment immediately after that heading. TypeScript uses JSDoc on the exact exported symbol.

Targets under a configured Markdown root omit the root itself:

```md
<!--
@evidence principles/common.md#purpose-fit This model document exists to make the soloist reviewable at blocking fidelity.
@evidence settings/010-soloist.md#soloist-identity-scale Preserves the stated height and followed silhouette.
-->
```

```text
/**
 * @evidence models/010-soloist.md The class constructs the one reviewed soloist representation.
 */
export class Soloist extends AutoMovieSubject {}
```

The reason is part of the contract. State what the host does about the target in language a reader of the target can verify. Cite the narrowest unit: a script scene cites a scenario scene anchor, not merely its file or a governing aim.

## Evidence stages and expiring review

A child may enter `evidence` only after every direct parent is in `review`. The factory refuses skipped or mixed topology before lint can report a false clean result. Advance one layer across the production before going deeper:

1. Set the next eligible layer to `evidence`.
2. Pay every citation and run the evidence gate.
3. Read each target and host and check their concrete relationship.
4. Copy only the compiler-issued fingerprint into a substantive review statement.
5. Set the layer to `review` and compile again.
6. Then activate its children.

Where review is required, the same host carries:

```text
@evidenceReview <target> #<digest> <what was checked>
```

Changing the target changes its digest and reopens every dependent review. For an allowed population exclusion, use `@evidenceExclude` and the compiler-required `@evidenceExcludeReview`. Never invent a digest, mechanically restore a stale outcome, or reuse one generic review sentence across unrelated hosts.

## What may be excluded

Principles and exact parent edges refuse exclusion. A host that cannot satisfy a principle is defective; a refinement without its exact parent is not that refinement.

Distributed obligations may allow one population-wide exclusion when the concern truly does not exist. This is a decided boundary, not an unfinished task. Put it on one visible carrier and explain the production-wide fact. A `@todo` is an error rather than an exclusion.

## Derived records and examples

`.automovie/design`, `generated`, and `renders` are compiler-owned or derived. JSON cannot host evidence citations, so typed source owns production design, models, motions, shots, and the film edit while `scripts/emitDesign.ts` emits design records. Correct source or design and regenerate; do not hand-edit output.

`src/examples` is outside the evidence populations by decision. It teaches a transferable technique against placeholder values, nothing imports it, and it is copied out and deleted. Adding finished content there ships an unowned library to every generated project.

## Verification

Do not trust a graph because its ordinary build is green. Falsify every new edge: remove one representative citation, run `internals/scaffold-evidence-gate.mjs`, and confirm the diagnostic names the intended missing relationship before restoring it.

Then build and test the repository, generate a fresh scaffold, run its source lint and evidence compile, and inspect its design output. When a render, pose, expression, geometry, or motion changed, capture it in a real GPU browser and inspect the relevant beauty, depth, normals, object-id, or subject view before claiming it works.
