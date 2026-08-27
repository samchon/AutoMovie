# Space source principles

Space source turns reviewed topology into stable engine-facing records without becoming a second spatial author.

## Design-owned topology {#space-source-design-ownership}

Every exported owner realizes one reviewed space document and introduces no unreviewed place, boundary, opening, route, dimension, or access rule.

Review question: can every emitted spatial fact be traced to exactly one reviewed H2?

Sources: [NASA on bidirectional requirement traceability](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

## Stable spatial identities {#space-source-stable-identities}

Every emitted space, surface, opening, level, zone, and route keeps stable ids, frames, units, bounds, and parent relationships across repeated builds.

Review question: do equal inputs emit identical identities, frames, topology, and dimensions?

Sources: [glTF on coordinate units and node hierarchy](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units); [buildingSMART on explicit space-boundary relations](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcRelSpaceBoundary.htm)

## Invalid topology is refused {#space-source-invalid-topology}

Cycles, missing hosts, contradictory bounds, blocked required routes, and exterior/interior mismatches produce explicit diagnostics rather than repaired or guessed geometry.

Review question: does each invalid topology case fail with its exact owner and cause?

Sources: [glTF on node hierarchy as disjoint strict trees](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#nodes-and-hierarchy); [NASA on verification results and requirement identity](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)
