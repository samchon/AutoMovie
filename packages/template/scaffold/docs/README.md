# Production documents

This directory holds what this production authors. Every branch below is production-owned: its facts, its research, its designs, its prose, and its work-specific contracts.

The shared contracts those hosts answer are not copied here. `@automovie/template` publishes `docs/discovery`, `docs/principles`, and `docs/obligations`, and the graph resolves them from the installed package, so an author cites them by their evidence roots (`discovery/...`, `principles/...`, `obligations/...`) and never edits them. Discovery states the open searches a population must run. Principles are no-exclusion checklists every selected authored H2/H3/H4 answers for itself. Obligations are no-exclusion roles the layer's primary H2 population, or a source family's selected public-export population, covers one or more times as each item requires. Work-specific results become flat files in this project's `docs/contracts`; upgrading the package delivers new shared contracts without copying them into the project.

Choose one shape in lint.config.ts before authoring:

| Shape | Required authored route |
| --- | --- |
| Film | settings -> storylines -> scenarios -> script -> shots -> filmSources |
| Brief | settings -> briefs -> shots -> filmSources |
| Library | settings plus each matching design -> source branch it delivers |

For film and brief, reviewed `productionSources` is a parallel assembly input that must exist before `filmSources`; it does not interrupt the prose-to-shot identity ladder. Runtime alone does not choose the shape. A short or simple demonstration may be a brief when one delivery/shot/observation hierarchy completely owns it. A work whose causal, choice, or revelation structure needs independent storyline/scenario/script refinement is a film. Design branches are orthogonal to shape:

| Directory | Sole ownership |
| --- | --- |
| settings | production facts, identities, capabilities, limits, and delivery contract |
| research | retrievable external-source records and their production consequence |
| models | deterministic bounded representation of one subject or reusable object |
| spaces | world, site, building exterior/interior, room, zone, boundary, and circulation topology |
| materials | construction, finish, texture scale, optical response, and material state |
| instances | repeated/group membership, stable instance identity, transforms, variation, and placement |
| motions | deterministic state transition over time |
| systems | lighting, environment, effects, simulation, sound, services, and other coupled processes |
| storylines | film treatment: causal/formal development and audience change |
| scenarios | the same film units refined into executable physical progression |
| script | the same film units refined into final audiovisual screenplay |
| briefs | one bounded delivery/shot/observation hierarchy with no separate narrative-refinement ladder |

A film additionally answers `obligations/subjects.md` across its settings H2 population: `obligations/settings.md#operative-subject-inventory` decides whether every operative subject has an owner, and those roles decide what each owner settles.

Each active Markdown file contains explicitly anchored H2 owners. Every storyline, scenario, script, and brief file also contains anchored H3 and H4 owners. Outside an optional file-title H1, settings, research, and design files permit only H2 units, while film and brief prose permits only H2/H3/H4 units. Any other authored heading depth is a hard error. The film filenames, identities, nesting, and order stay exactly equal through storyline, scenario, and script.

Discovery is file-level coverage over the separate work-specific contract population, not a checklist repeated by authored units. Every active Markdown layer selects `docs/contracts/*.md` and answers `discovery/common.md`; settings adds `settings.md`, research and each design branch add nothing beyond common directly, storylines add `films.md` and `storylines.md`, scenarios add `films.md` and `scenarios.md`, script adds `films.md` and `scripts.md`, and briefs add `briefs.md`. A retained result becomes a flat contract file that identifies its earliest semantic owner and current realization. A true no-result is recorded only in `docs/contracts/index.md` and names the concrete inputs, risks, and sufficient existing owners examined. Authored H2/H3/H4 units describe the work and do not testify about the audit. Settings backcasts the actual planned delivery and accounts for every independently consequential operative subject before a dependent layer begins.

Stages are disabled -> draft -> evidence -> review. Draft authored hosts first without evidence tags; the separate contract audit is active at draft and carries discovery evidence only in each retained rule's comment preamble before H1. After the complete layer is coherent, switch to evidence and write truthful authored-host citations. Review adds target fingerprints and must be complete before a child layer starts. Empty active populations, an active layer with neither a retained contract nor a truthful negative ledger, and files left in disabled populations are hard errors.

The project declaration is intentionally extensible because a production may need extra targets; only the additive `claims` list is that extension seam. The shared inventory published by `@automovie/template` is exact, and its H2s each contain one review question and one final sources line. Put every production-only target directly under `docs/contracts` with a descriptive family-prefixed filename, then append the typed claim that selects the affected authored or source population. A retained rule carries its discovery host evidence only in the comment preamble before H1; target H2s themselves never carry host-side evidence. Only `docs/contracts/index.md` may carry truthful discovery exclusions, and it carries no positive evidence or H2 target. H2 titles and anchors are globally unique across the complete shared-plus-local target inventory. A local target with no additive reference, an enabled local target pattern matching zero files, a nested contract directory, or a contract with the wrong tag placement is a hard error. Never remove, filter, copy, replace, or weaken the shared populations, review requirements, cardinality, exclusions, or topology checks. If a new reusable target family is genuinely needed, change the shared inventory, population, negative tests, and routing guidance together in the scaffold repository.
