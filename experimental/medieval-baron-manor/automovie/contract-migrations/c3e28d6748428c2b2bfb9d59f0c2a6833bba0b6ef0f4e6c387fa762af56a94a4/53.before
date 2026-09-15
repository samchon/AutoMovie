# Instance design principles

Instance documents define repeated or grouped use of reviewed prototypes. They own membership, stable identity, transform, variation, and population behavior, not prototype geometry.

## Prototype boundary {#instance-prototype-boundary}

Every set cites its prototype and restricts variation to declared parameters; silhouette, rig, or material construction that changes prototype identity returns to the owning design branch.

Review question: which member variation has crossed from placement into an unauthorized new asset?

Sources: [OpenUSD on instances sharing one prototype scene graph and restricting per-instance overrides](https://openusd.org/release/api/_usd__page__scenegraph_instancing.html)

## Single derivation authority {#instance-derivation-authority}

Every generated membership, identity, transform, and override has one declared derivation and input basis. A document states the rule and exceptional authored cases; it does not maintain an independent output list that can drift from that rule or depend on traversal order.

Review question: which generated value has two authorities, no derivation, or a result that changes when evaluation order changes?

Sources: [OpenUSD on authored stable ids and point-instancer inputs](https://openusd.org/release/api/class_usd_geom_point_instancer.html); [NASA on bidirectional derivation traceability](https://www.nasa.gov/reference/systems-engineering-handbook/)

## Verification-addressable population claims {#instance-verification-address}

Every consequential population claim in the current H2 identifies the member, subset, invariant, or worst case that could falsify it and points to the population review role that will test it. This unit maps its own claims; the instance obligations define complete membership, placement, tier, and review coverage.

Review question: which population claim could be false while every member or subset named by this H2 still passes?

Sources: [NASA on verification methods and evidence assigned to requirements](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)
