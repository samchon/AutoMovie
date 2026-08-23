# Production-specific contract

Run this pass before bulk settings authorship and whenever research or later production work reveals a new production rule. This pass discovers and classifies the contract. Each adopted rule lives in its semantic owner, not in this guide or a status note.

## Inputs and authority

Collect the user's direct instructions, the production seed and assets, existing documents and Git history, subject and medium research, and choices available within the author's delegated authority. Preserve the meaning of a direct instruction instead of shortening it into a weaker label.

- A user-confirmed rule is binding. Record that authority and do not weaken, replace, or remove the rule without user approval.
- An author proposal becomes binding only when the author adopts it within delegated authority and records it as a production decision. Do not attribute it to the user.
- A fact derived from a source or asset retains its provenance and the fact status required by [settings.md](settings.md).

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

Separate a research finding from a method that selected files must keep applying. The finding is a research or settings fact. A recurring file condition may be a production-local principle only when the shared contracts do not already ask the complete question. Use configured evidence relations to carry an established fact downward instead of copying source lists into design, prose, or source code.

## Canonical owner

Give every adopted rule one owner:

| Meaning                                                                                            | Owner                                                                                              |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Delivery fact, world fact, subject, relationship, capability, constraint, or production-wide canon | Independent `docs/settings` H2                                                                     |
| Condition every selected file must satisfy                                                         | Production-local `docs/production-principles/<scope>.md`                                           |
| Role one or more units in a complete layer population must realize                                 | Production-local `docs/production-obligations/<layer>.md`                                          |
| Relationship already owned by settings, a design branch, narrative, or brief evidence              | Existing target, selected by an added claim only when the shared graph does not already express it |
| Independent target with different evidence behavior                                                | Descriptive plural or collective `docs/<family>`                                                   |
| Candidate that may be reusable but has not passed the shared admission test                        | `.wiki` research                                                                                   |

Narrative order is not a settings fact. A repeated visual or writing condition is not a distributed role. A role required somewhere in one population is not a per-file checklist. A representation choice is not a world capability, and a timed path is not a model interface. Do not copy one rule across settings, principles, obligations, and source.

Do not create a catch-all production contract file. In a settings H2, record direct authority as `**Status:** production decision, user-confirmed.` In a production-local target, state its authority, exact applicability, intended effect, success boundary, and representative failure. Supporting research does not become the authority that selected a creative decision.

## Activation and revision

Create every production-local target and its additive `claims` entry in `lint.config.ts` in one coherent change. Follow [Evidence staging](evidence-staging.md) for population, cardinality, exclusion, stage, and review semantics. An unselected target is not enforced, and an extra claim extends rather than replaces the shared graph.

Before settings leave `draft`, account for every direct instruction and adopted rule in its canonical owner. An omitted `claims` property or empty array is valid only after a literal audit finds no independent production-local target.

Later discoveries revise the earliest true owner. Preserve user authority, assess every affected host and descendant, propagate the change, and renew stale reviews before resuming blocked work. When another agent owns affected authorship, send the settled rule, authority, canonical document, applicability, activation behavior, affected hosts, and required recheck before explicitly resuming that owner.
