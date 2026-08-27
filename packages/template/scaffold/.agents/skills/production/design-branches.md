# Design branches

Activate only branches the declared delivery actually owns. Film, brief, and library describe the output shape; they do not decide whether a production needs a model, building, finish, crowd, motion, light, effect, sound, or service. Every active branch advances from document to matching source after reviewed settings, and every source owner cites exactly one design file.

| Branch | Owns | Does not own |
| --- | --- | --- |
| `docs/models -> src/models` | fixed bounded representation, geometry, hierarchy, articulation interface, surface partitions, fidelity ceiling | fictional identity, material response, placement population, timed change |
| `docs/spaces -> src/spaces` | world/site/building exterior and interior, containment, adjacency, shared envelope, openings, levels, routes, clear dimensions | object mesh, finish, camera path |
| `docs/materials -> src/materials` | construction, finish, texture/projection scale, surface binding, optical/physical response, material state | host geometry or topology |
| `docs/instances -> src/instances` | prototype membership, stable ids, transforms, variation, LOD tiers, density, placement and overlap | prototype construction or reusable time transition |
| `docs/motions -> src/motions` | named deterministic state transition, endpoints, phases, paths, contacts, parameters, composition and interruption | capability authorization or target interface construction |
| `docs/systems -> src/systems` | coupled lighting, environment, effects, simulation, sound, services, clocks, budgets, dependencies and degradation | identities and structures consumed by the process |

Use settings for what exists, what it means, what it may do, and the common coordinate/time contract. A building's exterior and interior are two views of one space/envelope topology, not competing model files. A model exposes stable surface ids; a material binds to them. An instance points to a reviewed prototype; a silhouette-changing member returns to models. Motion changes one reviewed interface over time; a system coordinates processes or many owners.

Before drafting a branch, read its principle and obligation files in full, inventory independent owners, and run the same-answer test: if two proposed H2s would receive materially the same answer, merge or sharpen them. Then run the contradiction test in both directions: ask whether one item could pass while the other fails, and whether each can change without changing the other. Record interfaces as citations rather than copying decisions across branches.

The shared graph follows ownership direction: models may consume spaces; materials consume model or space surfaces; instances consume model prototypes, spatial placement, and declared material variation; motions may consume any other reviewed design interface; systems may consume models, spaces, materials, instances, and motions; briefs account for every active design branch. Motion and system documents may therefore cite one another when a coupled process and a reusable transition have distinct owners; neither may duplicate the other's state or path. These populations divide the cited targets among the hosts that actually use them. Omission from an unrelated host is not an exclusion; only a target unused by the complete host population receives one truthful population-wide exclusion. When a foundation branch later reaches review, its targets reopen every affected downstream review without serializing otherwise independent drafting.

Read [Models and motions](models-and-motions.md) when either of those branches is active. For spaces, materials, instances, or systems, apply the matching principle checklist to every design H2 and cover the matching design and source-obligation files across their respective H2 and export populations; do not import model or motion questions merely because all become rendered geometry.
