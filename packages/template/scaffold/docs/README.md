# Production documents

This directory is the production's self-contained evidence root. The generated [contract skill](../.agents/skills/contract/SKILL.md) routes to the exact live bindings, while this file owns only the physical document map.

The [contract-target procedure](../.agents/skills/evidence-graph/contract-targets.md) owns shared and language target forms. [Production-specific contract](../.agents/skills/evidence-graph/work-specific.md) owns local contract discovery and placement, [Evidence staging](../.agents/skills/evidence-graph/staging.md) owns annotations and branch stages, and [Production kinds](../.agents/skills/production-lifecycle/production-kinds.md) decides which authored rows are active. Read those owners instead of inferring semantics from directory names.

The table maps document roles; it does not require empty directories for inactive work. Create each authored directory when it receives real content at its applicable lifecycle stage. Shared contract targets remain scaffold-owned files.

| Path | Physical owner |
| --- | --- |
| `discovery`, `naturalness`, `upstream`, `principles`, `obligations` | Scaffold-supplied reusable contract targets. Naturalness applies only to dialogue, narration, and audience-read language in final screenplays; mechanical description remains construction text. |
| `language` | The one creation-selected language contract module. |
| `contracts` | Flat production-specific targets and the optional no-result index. |
| `accounts` | Optional aggregate H2 owners for shared and production-local obligations. |
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
| `screenplays` | Complete film screenplay construction units that settle audience-visible and audible content. |
| `final/screenplays` | Expression-only final screenplay units, mirroring reviewed construction identity exactly. |
| `briefs` | Direct-brief delivery, shot, and observation units. |

Reviewed delivery decisions are implemented as typed source values. Record observations at the authored owner that claims the result; [Ownership](../README.md#ownership) owns source placement and the project file boundary.

This README is a tracked snapshot created with the scaffold. Follow [Static-document updates](../README.md#static-document-updates) before expecting an installed package upgrade or instruction sync to replace it.
