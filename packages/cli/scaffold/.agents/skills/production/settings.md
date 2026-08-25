# Settings

Settings are required by film, brief, and library shapes. Keep production canon in `docs/settings` as ordered Markdown files. A file is a domain namespace and every independent fact or constraint is an explicitly anchored H2.

Before bulk settings prose, complete the [production-specific contract](work-specific.md) pass. Record delivery scope, governing aim, audience or operator access, coordinate and unit convention, delivery review condition, the settings coverage map, and the operative-subject inventory before facts that depend on them. Backcast the actual planned film, brief, or library consumers so downstream work does not invent production-wide facts or constraints.

## Topology

Start from the applicable domains, then split, rename, or add ordered files as scale requires:

| Suggested file | Domain |
| --- | --- |
| `000-foundation.md` | production kind, delivery contract, governing aim, access, conventions, review condition, coverage map |
| `010-world-and-time.md` | inherited reality, world laws, chronology, and pre-delivery state |
| `020-space-and-environment.md` | places, distances, environment, hazards, and shared anchors |
| `030-subjects-and-relationships.md` | subjects, identities, relations, authority, and observable distinctions |
| `040-capabilities-and-limits.md` | permitted state changes, resources, costs, dependencies, and inability |
| `050-production-grammar.md` | work-wide visual, textual, audible, and formal constraints |
| `060-systems-and-opening-state.md` | cross-system dependencies and the initial production state |
| `070-sources-and-uncertainty.md` | source conflicts or unresolved decisions that are independent downstream facts |

Audit every domain and create no empty or irrelevant file. Mark an unused domain as inherited, outside delivery scope, or unresolved in the coverage map. A single dense domain may span as many ordered files as its independent H2 owners require, and a central owner may take a file of its own. Put direct support for a fact in its owning H2; use the final domain only when a conflict, interpretation, or uncertainty has independent consumers and a distinct review path.

## Decomposition and structure

Before drafting a file, inventory candidate owners and apply `docs/principles/settings.md#addressable-canon`. Split anything with its own consumer, fact status, change path, or review. After drafting, inspect overview prose, tables, lists, and embedded biographies or specifications for hidden owners, then split every bundle and repair the references that pointed at it.

For each resulting owner, settle the applicable boundary, status, operating conditions, authority or access, resources, dependencies, costs, limits, exceptions, present state, and downstream consequences. Those are completion questions rather than mandatory field labels.

Begin each H2 body with `**Status:**` and one or more of `externally supported`, `production invention`, `inherited default`, `derived`, or `unresolved`, plus a qualifier when the label alone hides scope. In `evidence` or `review`, evidence comments sit between the heading and this status line. End an H2 containing externally checkable claims with a `Sources:` line. A pure production decision needs no invented authority.

Apply the settings information-structure principle, then reverse-outline paragraphs by function. Split independently reviewable conditions, evidence, exceptions, and consequences; merge fragments and remove orientation that merely repeats the detailed body.

## Subject canon

`obligations/settings.md#operative-subject-inventory` decides whether every operative subject has an owner. In a film, `obligations/subjects.md` decides what each of those owners settles: the position it acts from, the motive that produces a choice, the information it starts with, the behavior an audience recognizes it by, the relationships it stands inside, and the change it can and cannot undergo. An inventory of names satisfies the first and leaves a scenario writer inventing the second.

Depth follows consequence. A central subject settles every role in usable detail, a one-shot subject settles the roles its single appearance actually exercises, and neither is allowed to be absent from the inventory.

After every downstream draft or revision, backcast its literal cast against that inventory. A new participant, or a group member who becomes an individual actor, is a settings defect: complete its canon here before the downstream work continues.

## Research and revision

Research every externally checkable precision rather than writing it from memory. Search results and collection portals are discovery routes; open the direct evidence and apply `docs/principles/settings.md#source-support` before accepting a claim. Use [research.md](research.md) when source identity and uncertainty need a separate production-consumed ledger.

Before leaving `draft`, audit every unresolved statement, every externally checkable precision, and every coverage-map domain against the questions research raised. Settle anything a downstream layer would otherwise have to invent; passing an unresolved value forward is an unstated invention task rather than a recorded uncertainty.

Keep only current canon and unresolved state in settings. Superseded decisions, migration notes, commit identifiers, and process history belong in `.wiki` or in Git, because a settings H2 that narrates its own history makes a downstream reader decide which version is in force.

Settings are authoritative, not frozen. When later work exposes a contradiction, implausible constraint, missing capability, or stronger decision, fix settings first, locate every citation and factual occurrence, reread adjacent consequences, repair descendants, and renew stale reviews. Do not rewrite canon merely to excuse a downstream mistake; compare research, delivery purpose, and total consequences first.

## Gate

Start an applicable settings layer at `settings: "draft"`. Before `evidence`, require a complete first version, stable H2 owners, no placeholders, a literal work-specific-rule audit, common and settings discovery searches, a settings-domain omission audit, complete operative-subject accounting, and truthful answers to every common unit obligation.

Run [Author process Self-Review](self-review.md) to its clean round before every stage transition and again after any repair. Follow [Evidence staging](evidence-staging.md) for evidence and review passes.
