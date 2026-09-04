# Production documents

This directory is the production's self-contained evidence root. The generated [contract skill](../.agents/skills/contract/SKILL.md) routes to the exact live bindings, while this file owns only the physical document map.

The [contract-target procedure](../.agents/skills/evidence-graph/contract-targets.md) owns shared and language target forms. [Production-specific contract](../.agents/skills/evidence-graph/work-specific.md) owns local contract discovery and placement, [Evidence staging](../.agents/skills/evidence-graph/staging.md) owns annotations and branch stages, and [Production kinds](../.agents/skills/production-lifecycle/production-kinds.md) decides which authored rows are active. Read those owners instead of inferring semantics from directory names.

| Path | Physical owner |
| --- | --- |
| `discovery`, `upstream`, `principles`, `obligations` | Scaffold-supplied reusable contract targets. |
| `language` | The one creation-selected language contract module. |
| `contracts` | Flat production-specific targets and the optional no-result index. |
| `accounts` | One authored layer's whole-population obligation comparisons. |
| `settings` | Production facts, identities, capabilities, limits, and delivery conditions. |
| `research` | Optional external-source records and their production consequences. |
| `maps` | Broad world organization, site boundary, scale, temporal state, and external access. |
| `models` | Deterministic bounded representation of a subject or reusable object. |
| `spaces` | Building exterior or interior topology, enclosure, openings, and circulation inside the adopted site boundary. |
| `materials` | Construction, finish, texture scale, optical response, and material state. |
| `instances` | Repeated membership, stable identities, transforms, variation, and placement. |
| `motions` | Deterministic state transitions over time. |
| `systems` | Coupled lighting, environment, effects, simulation, sound, services, and other processes. |
| `treatments` | Film treatment units. |
| `scripts` | Film script delivery units. |
| `screenplays` | Film screenplay delivery units. |
| `briefs` | Direct-brief delivery, shot, and observation units. |

Reviewed delivery configuration is emitted from governed source into the production design record rather than authored as another document tree. `repaintSelectionReviews.ts` is the one tracked observation file outside `docs` and `src`; it records candidate observations, not production decisions.

This README is a tracked snapshot created with the scaffold. Follow [Static-document updates](../README.md#static-document-updates) before expecting an installed package upgrade, instruction sync, or contract migration to replace it.
