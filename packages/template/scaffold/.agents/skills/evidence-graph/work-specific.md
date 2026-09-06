# Production-specific contract

When a child exposes a missing or false parent rule while applying a production-specific contract, follow [upstream revision](../production-lifecycle/upstream-revision.md) and repair the earliest owner before resuming the child. The local target records the adopted rule; it does not absorb corrective history or authorize downstream compensation.

Run this pass before bulk settings authorship and whenever research or later production work reveals a new production rule. This pass discovers and classifies the contract. Each adopted rule lives in its semantic owner, not in this document or a status note.

## Inputs and authority

Collect the user's direct instructions, the production seed and assets, existing documents and Git history, subject and medium research, and choices available within the author's delegated authority. Preserve the meaning of a direct instruction instead of shortening it into a weaker label.

- A user-confirmed rule is binding. Record that authority and do not weaken, replace, or remove the rule without user approval.
- An author proposal becomes binding only when the author adopts it within delegated authority and records it as a production decision. Do not attribute it to the user.
- A fact derived from a source or asset retains its provenance and the fact status required by [Settings](../production-lifecycle/settings.md).

If directives conflict with one another, shared instructions, established production canon, or authorized scope, stop the affected authorship. Identify the conflicting owners and downstream consequences, then obtain a decision from the authority that can change them.

## Discovery

Audit only the axes relevant to the production:

- production kind, delivery form, audience or operator, title, runtime or asset scope, and content boundaries;
- narrative entry, ending, chronology, sequence and scene pattern, access, disclosure, and formal devices for a film;
- visual language, graphic or material treatment, palette, scale, spatial convention, typography, captions, sound, and silence;
- subject-specific identity, representation ceiling, articulation, reusable motion, composition, and review observations;
- historical, scientific, legal, medical, cultural, or technical authenticity and its failure risks;
- recurring motifs, assets, transformations, prohibited substitutions, and deliberate departures from defaults.

Add an axis when the work needs it and create no rule merely to fill the list. Convert labels such as “cinematic,” “realistic,” “dynamic,” or “polished” into observable choices, applicable conditions, intended effects, and representative failures before adopting them.

Separate a research finding from a method that selected authored units must keep applying. The finding is a research or settings fact. A recurring unit condition may be a production-local principle only when the shared contracts do not already ask the complete question. Use configured evidence relations to carry an established fact downward instead of copying source lists into design, prose, or source code.

## Discovery evidence

Complete the open search before deciding whether it found a retained production contract. The applicable discovery claim is answered by `docs/contracts/*.md`, never by the authored population whose work caused the search. A retained result belongs in the one flat contract file that states the adopted rule, names its earliest semantic owner and current stage-appropriate realization, and has the additive claim that enforces it. A true no-result belongs only in `docs/contracts/index.md` as one population-wide exclusion naming the concrete inputs, risks, and sufficient shared owners examined. Deferred work, an audit assertion, an empty target family, or an empty contracts directory is not a no-result.

The graph runs that contract-hosted search once for each active authored population. Across all three production shapes those 13 populations are settings, research, maps, models, spaces, materials, instances, motions, systems, treatments, scripts, screenplays, and briefs. Film activates its narrative ladder and forbids briefs, brief activates briefs and forbids the narrative ladder, and library forbids both timed forms; each shape may activate research and whichever design branches it actually needs. Settings discovery backcasts those actual consumers without pre-authoring their content. After finding candidates, the settings operative-subject obligation accounts for every person, collective, object, environmental agent, institution, subsystem, and affected population that can independently change action, state, information, resources, control, or audience observation. Classify each in an existing owner, inherited default, outside-scope boundary, or unresolved owner; a needed unresolved subject blocks its consumer. Accounting is not the whole duty; [Settings](../production-lifecycle/settings.md#subject-canon) owns what each of those owners then settles.

## Canonical owner

Give every adopted rule one owner:

| Meaning | Owner |
| --- | --- |
| Delivery fact, world fact, subject, relationship, capability, constraint, or production-wide canon | Independent `docs/settings` H2 |
| Condition each selected authored unit must satisfy for itself | `docs/contracts/principles-common.md`, `-narratives.md`, or `-<layer>.md` |
| Role a layer's population covers between its units, with an observable failure and the repair it requires | `docs/contracts/obligations-common.md`, `-narratives.md`, or `-<layer>.md` |
| Relationship already owned by settings, a design branch, narrative, brief, or source evidence | That existing target, selected by an added claim only when the shared graph does not already express it |
| Independent target with different evidence behavior | A descriptively named `docs/contracts/<name>.md` |
| Nothing beyond the shared graph for a completed discovery duty | `docs/contracts/index.md`, whose exclusion names the risks examined and the sufficient shared owners |
| Candidate that may be reusable but has not passed the shared admission test | `.wiki` research |

Narrative order is not a settings fact. A repeated visual or writing condition is not a distributed role. A role required somewhere in one population is not a per-unit checklist. A representation choice is not a world capability, and a timed path is not a model interface. A condition belongs in a production principle file when every selected unit must answer it separately, and in a production obligation file when the selected population covers it between its units; putting a per-unit condition in an obligation lets one owner answer for the whole population. Do not copy one rule across settings, principles, obligations, and source.

Every production-specific target is a file directly under `docs/contracts`. Do not create family subdirectories or a catch-all production contract file; split rules among the semantic owners above. `index.md` is not that catch-all: it carries truthful discovery negatives and nothing else. In a settings H2, record direct authority as `**Status:** production decision, user-confirmed.` In a production-local target, state its authority, exact applicability, intended effect, success boundary, and representative failure. Supporting research does not become the authority that selected a creative decision.

## Activation and revision

Create every production-local target under `docs/contracts` and its additive `claims` entry in `lint.config.ts` in one coherent change. Follow [Evidence staging](staging.md) for population, cardinality, exclusion, stage, and review semantics. An unselected target is not enforced, and an extra claim extends rather than replaces the shared graph. The discovery host is automatic; the claim governing the production's authored or source population is not.

Before settings enter `draft` and bulk authorship begins, audit every direct instruction and adopted rule, classify its canonical owner, complete the initially applicable contract-hosted discovery searches, and create every retained production target and claim. The contract files are a separate host population and may already carry discovery answers while authored settings remain absent; settings-owned facts identified by the audit are realized during the settings draft. An omitted `claims` property or empty array is valid only after that literal audit finds no independent production-local target and records each applicable truthful negative on `docs/contracts/index.md`; an empty array is not evidence that the audit occurred.

Before settings leave `draft`, account for every direct instruction and adopted rule in its canonical owner, complete the operative-subject inventory, and rerun the discovery searches against the actual planned consumers and authored canon. A missing owner or newly exposed contract keeps settings in `draft` until the earliest owner, target, claim, and affected hosts are complete.

Later discoveries revise the earliest true owner. Preserve user authority, assess every affected host and descendant, propagate the change, and renew stale reviews before resuming blocked work. When another agent owns affected authorship, send the settled rule, authority, canonical document, applicability, activation behavior, affected hosts, and required recheck before explicitly resuming that owner.
