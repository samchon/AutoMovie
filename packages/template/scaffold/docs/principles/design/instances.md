# Instance design principles

Instance documents define repeated or grouped use of reviewed prototypes. They own membership, stable identity, transform, variation, and population behavior, not prototype geometry.

## Instance information structure {#instance-information-structure}

Every H2 first identifies its population owner, membership decision, prototype boundary, and downstream consequence, then develops derivation, variation, placement, limits, and verification in paragraphs with distinct functions. Member tables illustrate a rule or expected case rather than becoming a second authored population.

Review question: can a reverse outline assign every paragraph and table one non-repeated population purpose?

Sources: [Purdue OWL on paragraph focus and support](https://owl.purdue.edu/owl/graduate_writing/introduction_to_writing/documents/drafting-your-document/organization-at-the-paragraph-level.pdf); [OpenUSD on point-instancer structure](https://openusd.org/release/api/class_usd_geom_point_instancer.html)

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

## Prop and set-dressing boundary {#instance-prop-set-dressing-boundary}

An object is a story prop when a named action, contact, state change, continuity fact, or audience inference depends on its stable identity. Set dressing supplies place, period, activity, access, or visual organization without owning that performance state. A structural enclosure or route returns to spaces, and either class may use an instance population, but a convenient label never permits a prop to lose continuity or dressing to acquire invented dramatic agency.

Review question: which exact action or continuity fact makes this member a prop, or which spatial and visual function keeps it set dressing without promoting it into a story participant?

Sources: [StudioBinder guide to script breakdown elements](https://www.studiobinder.com/blog/the-complete-guide-to-mastering-script-breakdown-elements/); [OpenUSD scenegraph instancing](https://openusd.org/release/api/_usd__page__scenegraph_instancing.html)
