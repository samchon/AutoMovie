# Instance obligations

These roles are distributed across the instance-design H2 population. Instances own repeated membership and placement; the prototype model remains owned by its model design.

## Addressable instance decisions {#addressable-instance-decisions}

The instance population gives every independently generated set, subgroup, override family, placement rule, or population observation one stable H2.

Review question: which set can change independently but is still bundled under another population owner?

Sources: [NASA on unique, bidirectionally traceable requirements](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

## Prototype and membership {#instance-prototype-membership}

The population identifies each prototype, the exact members of every set, and the rule by which a member enters, leaves, or changes role.

Review question: can every rendered member be traced to one prototype and one declared set membership?

Sources: [OpenUSD on instances associated with shared prototypes](https://openusd.org/release/api/_usd__page__scenegraph_instancing.html)

## Stable identity and transform {#instance-identity-transform}

The population assigns stable instance identities and deterministic position, orientation, scale, parent frame, seed, and ordering rules.

Review question: can the same inputs reproduce the same member at the same transform without relying on traversal or creation order?

Sources: [OpenUSD on point-instancer ids, prototype indices, and transforms](https://openusd.org/release/api/class_usd_geom_point_instancer.html)

## Variation and representation tiers {#instance-variation-tiers}

The population bounds allowed per-member variation, hero overrides, density, level-of-detail tiers, and transitions without silently creating new models.

Review question: which visible difference is a permitted instance variation, and which requires a separately authored prototype?

Sources: [OpenUSD on shared prototype restrictions and per-instance overrides](https://openusd.org/release/api/_usd__page__scenegraph_instancing.html)

## Placement validity and review {#instance-placement-review}

The population defines overlap, clearance, terrain/host contact, culling, selection, and representative review samples, including worst-case members.

Review question: which deterministic probe exposes collision, drift, unstable membership, or an invalid tier transition?

Sources: [NASA on requirement-specific verification methods and evidence](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

## Set-dressing membership and placement {#instance-set-dressing-placement}

The complete instance population accounts for repeated or grouped set dressing, its prototype membership, stable member identities, placement rule and place, period, access, activity, or visual purpose. A member whose action, contact, state change, continuity fact, or audience inference matters is not discharged as dressing; it cites the separately reviewed prop model identity and preserves that identity through placement.

Review question: which dressing member lacks a placement purpose or prototype membership, and which supposed dressing member actually carries a prop action or continuity identity?

Sources: [StudioBinder guide to script breakdown elements](https://www.studiobinder.com/blog/the-complete-guide-to-mastering-script-breakdown-elements/); [OpenUSD scenegraph instancing](https://openusd.org/release/api/_usd__page__scenegraph_instancing.html)
