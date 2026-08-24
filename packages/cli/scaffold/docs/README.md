# Production documents

This is the generated project's only documentation root. The discovery directory contains open production-specific searches over complete H2 populations. The principles directory contains per-file review questions. Common obligations are per-unit questions, while each specialist obligation file contains roles that its whole layer allocates. All three directories are shared targets: do not put production facts or evidence tags in them. Named authoring branches hold production hosts, while separately named production target families extend the graph as described below.

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

Each active Markdown file contains explicitly anchored H2 owners. Every storyline, scenario, script, and brief file also contains anchored H3 and H4 owners. Outside an optional file-title H1, settings, research, and design files permit only H2 units, while film and brief prose permits only H2/H3/H4 units. Any other authored heading depth is a hard error. The film filenames, identities, nesting, and order stay exactly equal through storyline, scenario, and script.

Discovery is ordinary coverage over a complete authored H2 population, not a checklist repeated by every unit. Every H2 population answers `discovery/common.md`; settings adds `settings.md`, research and each design branch add nothing beyond common directly, storylines add `films.md` and `storylines.md`, scenarios add `films.md` and `scenarios.md`, script adds `films.md` and `scripts.md`, and briefs add `briefs.md`. H3 and H4 do not repeat the search. A retained result identifies its earliest semantic owner and current realization. A true no-result uses one population-wide exclusion that names the concrete inputs, risks, and sufficient existing owners examined. Settings backcasts the actual planned delivery and accounts for every independently consequential operative subject before a dependent layer begins.

Stages are disabled -> draft -> evidence -> review. Draft first without evidence tags. After the complete layer is coherent, switch to evidence and write truthful citations. Review adds target fingerprints and must be complete before a child layer starts. Empty active populations and files left in disabled populations are hard errors.

The project declaration is intentionally extensible because a production may need extra targets; only the additive `claims` list is that extension seam. `docs/discovery`, `docs/principles`, and `docs/obligations` are an exact reserved shared inventory whose H2s each contain one review question and one final sources line. Put a production-only file checklist under `docs/production-principles`, a production-only distributed role under `docs/production-obligations`, or another independent family in a descriptive plural directory, then append its typed claim to `claims`. H2 titles and anchors are globally unique across the complete shared-plus-local target inventory. A local target with no additive reference, an enabled local target pattern matching zero files, or a target carrying host-side evidence tags is a hard error. Never remove, filter, copy, replace, or weaken the shared populations, review requirements, cardinality, exclusions, or topology checks. If a new reusable target family is genuinely needed, change the shared inventory, population, negative tests, and routing guidance together in the scaffold repository.
