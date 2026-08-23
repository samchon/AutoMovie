# Evidence Graph Handbook

A production's authored layout is its obligation graph. The generated project has one documentation root: shared targets live under `docs/principles` and `docs/obligations`, named authoring branches hold production hosts, separately named production target families extend the graph, and TypeScript realizes reviewed contracts. `lint.config.ts` contains the complete production kind, stage, and additive-claim selection; `@automovie/evidence` supplies the reusable graph mechanics. There is no second project-local config source.

Read `SOURCE_COMPOSITION` for source arrangement and `PRODUCTION_DESIGN` before emitting typed design records. This guide owns production kinds, layer boundaries, citations, topology integrity, and staged review.

## Start blank and select one kind

A new scaffold has `kind: null`, every stage disabled, empty governed host directories, no production design records, and no inherited evidence tags. The config still declares every population. The moment a governed host appears while disabled, or a stage becomes active without a host, lint refuses.

| Kind | Result | Required result path |
| --- | --- | --- |
| `film` | an audiovisual work that needs independent narrative refinement | `settings -> storylines -> scenarios -> script -> shots -> filmSources` |
| `brief` | one bounded audiovisual result, including a simple short, turntable, logo sting, or motion demonstration | `settings -> briefs -> shots -> filmSources` |
| `library` | reviewed reusable design/source branches with no timed shot result | `settings` plus applicable design/source branches |

For film and brief, reviewed `productionSources` is a parallel assembly input that must exist before `filmSources`; it does not interrupt the prose-to-shot identity ladder. Runtime alone does not choose. A short whose complete intent fits one delivery/shot/observation hierarchy may be a brief; a work that needs separate storyline, scenario, and script decisions is a film. Do not use `brief` to hide required narrative refinement or `library` when delivery contains a shot.

Research and design branches are orthogonal to kind. Activate them only when the delivery uses them:

| Branch | Owns |
| --- | --- |
| `settings` | production facts, identity, capability, constraint, access, units, and delivery/review condition |
| `research` | exact external source, used portion, authority, uncertainty, and affected production decision |
| `models -> src/models` | fixed bounded representation, hierarchy, articulation interface, surface partitions, fidelity ceiling |
| `spaces -> src/spaces` | world/site/building exterior and interior, containment, envelope, openings, levels, routes, clear dimensions |
| `materials -> src/materials` | construction, finish, texture/projection scale, surface binding, optical/physical response, state |
| `instances -> src/instances` | prototype membership, stable ids/transforms, variation, tiers, density, contact, placement |
| `motions -> src/motions` | named deterministic state transition, endpoints, phases, paths, parameters, composition, interruption |
| `systems -> src/systems` | coupled lighting, environment, effects, simulation, sound, service, clock, dependency, budget, degradation |

## Keep document roles disjoint

Shared principles are per-file checklists. Every governed Markdown file answers every applicable principle H2, with no exclusions. Common obligations are a per-unit checklist. Every governed H2 and every film/brief H3/H4 answers them directly. Layer obligations distribute distinct required roles across one H2 population; one host or several may discharge a role, but no role disappears because a glob matched nothing.

The authored-unit topology is closed. Outside an optional H1 title, settings, research, and design hosts use only anchored H2 units; storyline, scenario, script, and brief hosts use only anchored H2/H3/H4 units. Any other heading depth is a hard error rather than an ungoverned hiding place.

One H2 asks one falsifiable question. Before adding or changing a target:

1. Reduce every sibling H2 to its governing subject and required decision.
2. Run the same-answer test. If two items can receive materially the same answer, merge them or sharpen their subjects.
3. Run the contradiction test both ways. Prove one can pass while the other fails, and that changing one need not change the other.
4. Test one compliant boundary case and one counterexample.
5. Add the target, its population/reference wiring, routing prose, and a negative canary in the same change.

The principal boundaries are:

- settings says what exists, means, and may happen; it does not build it;
- models define one prototype representation; spaces define topology and usable place;
- models name stable surfaces; materials bind construction and response;
- instances repeat reviewed prototypes; they do not create new silhouettes;
- motions change one reviewed interface over time; systems coordinate coupled processes, owners, clocks, dependencies, and budgets;
- storylines own narrative development and audience change;
- scenarios own executable physical progression and entry/exit state;
- script owns final visible, written, audible, silent, and timed expression;
- briefs own one bounded delivery/shot/observation hierarchy with no separate narrative-refinement ladder;
- shots own local composition and acceptance for one reviewed scene or brief shot; film source owns only global edit and auxiliary-track mapping.

Foundation citations follow those ownership directions after the target branch reaches review. Models may consume spaces; materials consume model or space surfaces; instances consume model prototypes, spatial placement, and declared material variation; motions may consume any other design interface; systems may consume models, spaces, materials, instances, and motions; briefs account for every active design branch. Motion and system documents may cite one another when a coupled process and a reusable transition have distinct owners, but neither duplicates the other's state or path. The selected host population divides actual citations among the hosts that use each target. Omission from another host is not an exclusion, and only a target unused by the complete population receives one truthful population-wide exclusion.

## Shared targets and production-specific targets

The shared target inventory is exact and validated when `lint.config.ts` loads. Every shared and production-local target begins with one H1 and scope statement; every anchored H2 contains exactly one `Review question:` and one final `Sources:` line. H2 anchors and titles are globally unique across that complete target inventory. No target may contain host-side `@evidence`, `@evidenceExclude`, or review tags. A local target with no additive reference and an enabled local target pattern matching zero files are both refused. A file-wide recurring condition is a principle; a duty every unit owes is a common obligation; a role allocated somewhere in one layer is a layer obligation.

Production-specific rules remain under `docs` and are activated through additive typed entries in `claims`. The exact shared inventory reserves `docs/principles` and `docs/obligations`; use `docs/production-principles`, `docs/production-obligations`, or another descriptive family for local targets. Give every adopted rule one owner:

- a production fact or constraint is an independent settings H2;
- a condition every selected file must meet is a local principle;
- a role distributed across one layer is a local obligation;
- an independent family with different evidence behavior gets a descriptive plural directory and its own claim;
- an unproven reusable idea stays in working research.

The project declaration exposes only one extension seam for these additions: append typed entries to `claims`. That authority never permits deleting, filtering, copying, replacing, or weakening the shared claims, populations, paths, review requirements, cardinality, no-exclusion rules, host validation, target inventory, or stage topology.

## Exact film and brief identity

A film preserves identical relative filenames, anchors, nesting, and order through all three narrative layers:

```text
storylines/001.md     scenarios/001.md      script/001.md
## sequence           ## sequence           ## sequence
### scene             ### scene             ### scene
#### beat             #### beat             #### beat
```

Every scenario unit cites exactly one same-level storyline unit. Every script unit cites exactly one same-level scenario and storyline unit. The physical validator independently compares filenames and ordered H2/H3/H4 lineage, so a bijective but swapped citation still fails. A shot/acceptance export cites one script H3 scene; film source covers every script H2 sequence.

A brief uses H2 delivery, H3 shot, and H4 observation. Its source cites one H3 shot and film source covers every H2 delivery. It never invents a storyline or scenario merely to satisfy the film graph.

Keep anchors stable when titles change. The screenplay index separately resolves exact beat text and `SCN-*` identities; it is hand-authored and outside `@ttsc/evidence`, so prose changes update the index and every dependant.

## Source ownership

Every governed TypeScript file declares a named exported class, function, or property owner. Model branches require a concrete exported class and select every exported type for exact ownership; motion branches select every exported function and property; space, material, instance, and system branches select every exported type, function, and property. Each selected design owner cites exactly one file in its matching branch. The complete source branch collectively realizes every H2 and specialist source principle.

A helper that owns no model, space, material, instance, motion, system, shot, or production decision stays outside governed directories. A governed export may not cite zero or two matching design files. Cross-branch design dependencies are cited by the consuming design H2; its source implements that reviewed owner and imports the stable interface it names. Never make every motion cite every model or copy an interface into the motion document.

Production source covers reviewed settings and only serializes their engine-facing result. The blank viewer uses a neutral clear color; when it remains visible in the delivery, wire its replacement to reviewed production or system source rather than authoring an independent viewer look. Shot and acceptance exports each realize one script scene or brief shot. Film source covers every sequence/delivery and performs only timeline selection, source-time mapping, transitions, and auxiliary tracks.

## Stages and expiring review

Layers move through `disabled -> draft -> evidence -> review`.

1. Set the next eligible layer to draft and write its complete first version without evidence tags.
2. Audit scope, addressability, substantive completion, proportionality, placeholders, same answers, contradictions, and omissions.
3. Commit the coherent draft, set evidence, write truthful citations, and compile clean.
4. Read every target and host in full and test the concrete relationship.
5. Set review, copy only compiler-issued fingerprints into substantive review statements, and compile again.
6. Begin a child only after every direct parent is reviewed.

Research may be drafted before settings. Once enabled, it must reach review before settings begins. Every research H2 is then cited and interpreted by a settings H2; specialist and narrative layers consume that settings decision instead of creating a second research path. The relationship gains review fingerprints when settings reaches review. Design source waits for its matching design documents. Film or brief shots wait for reviewed prose and every active design branch's corresponding source. Film source waits for reviewed shots and production source.

Draft files containing evidence tags fail. Review fingerprints expire when a target changes. Never invent a digest, bulk-refresh stale reviews, lower a stage to hide debt, or move resident hosts into an ungoverned path.

## Write narrow truthful citations

Markdown file-principle citations live in one HTML comment before the H1. Unit obligations, foundations, and lineage live immediately after the owning H2/H3/H4. TypeScript citations live in JSDoc on the exact exported symbol. Targets omit the configured `docs` root:

```md
<!--
@evidence principles/common.md#purpose-fit This model file owns the one blocking representation later source constructs.
@evidence settings/010-subject.md#subject-scale Preserves the reviewed height and silhouette identity.
-->
```

```text
/**
 * @evidence models/010-subject.md This owner constructs exactly the reviewed subject representation.
 * @evidence models/010-subject.md#representation Implements this design unit without adding an uncited shape decision.
 * @evidence principles/model-sources.md#design-owned-construction Keeps the constructed constants within reviewed design.
 */
export class Subject extends AutoMovieSubject<IAutoMovieModelRecipe> {
  // reviewed properties and builders
}
```

The file target is the exact one-owner edge. H2 and source-principle targets divide implementation coverage across the selected exports in that file; when one export is the whole owner, it carries the complete applicable set.

The reason states what the host does about the target in language a target reader can verify. Cite the narrowest unit. Principles, common obligations, and exact lineage refuse exclusion. Use population-wide exclusion only where the configured reference permits it and the complete population truly lacks the named concern; pair it with the compiler-required exclusion review. Todo is an error, not an exclusion.

## Derived state and examples

`.automovie/design`, `generated`, and `renders` are derived or tool-owned. A new scaffold contains no production records and `scripts/emitDesign.ts` refuses. After reviewed source exists, add explicit imports and `emit` calls for exactly the records this production owns. Preserve the shell's project setter, unchanged-record, and orphan-inventory checks. JSON carries no evidence annotations; typed source owns the record. The screenplay index is the deliberate hand-authored exception.

`src/examples` is outside evidence populations and ships only transferable techniques against placeholder values. Delivered source never imports it. Copy a technique into the correct governed branch, adapt it, and do not grow examples into a finished content catalogue.

## Verify the negative space

Do not trust a green ordinary build. Falsify active-empty, disabled-with-host, premature-tag, ownerless-source, unlisted-target, target-side-tag, illegal-kind, unreviewed-parent, filename mismatch, anchor/nesting mismatch, missing citation, wrong cardinality, stale review, and weakened-population cases. Each must fail with the intended owner named, then the restored graph must pass.

Generate a fresh scaffold and prove:

- there is one `docs` root and no `config` directory;
- `lint.config.ts` imports no local graph config;
- its only graph implementation import is the published `@automovie/evidence` package;
- production host/source/design populations are empty;
- shared target inventory is exact and contains no evidence tags;
- source lint and scaffold canaries pass;
- design emission and production compile refuse the unselected blank state.

Compile the repository-only completed film fixture for production regression coverage. If render, pose, expression, geometry, material, instance, motion, or system output changed, inspect the applicable real-GPU views before claiming it works.
