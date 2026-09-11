# Space obligations

These roles are distributed across the space-design H2 population. Space owns semantic topology and usable dimensions; model documents own the geometry used to depict a bounded object.

## Addressable spatial decisions {#addressable-spatial-decisions}

The space population gives every independently citable place, boundary, level, opening, route, clearance, or spatial observation one stable H2 owner.

Review question: which spatial fact could change independently and is still hidden inside another owner's prose?

Sources: [NASA on unique, bidirectionally traceable requirements](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

## Spatial reference and topology {#space-reference-topology}

The population establishes named world, site, building, level, room, zone, and local frames and the containment, adjacency, opening, and transition graph between them.

Review question: can every place and route be addressed without inferring a coordinate frame or crossing an unnamed boundary?

Sources: [buildingSMART on explicit space boundaries](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/concepts/Object_Connectivity/Space_Boundaries/Space_Boundaries_1st_Level/content.html); [glTF on coordinate system and units](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units)

## Exterior and interior interface {#space-envelope-interface}

The population reconciles exterior massing, envelope thickness, openings, storeys, interior clear dimensions, and shared surfaces so the two sides cannot describe incompatible buildings.

Review question: which shared opening, level, or surface would reveal a mismatch between exterior and interior intent?

Sources: [buildingSMART on adjacent spaces sharing boundary relations](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcRelSpaceBoundary.htm)

## Access, circulation, and clearance {#space-access-circulation}

The population identifies the represented entrances, connected destinations, routes, and closed boundaries required by the delivery. Their visible openings and connections agree with the authored spatial graph. For an explicitly authored movement or operation task, it also allocates the route, clear widths and heights, obstacles, and reachable regions against that task's actor, camera rig, or equipment profile.

Review question: which promised entrance or connection disagrees with the represented space, and which authored movement or operation task lacks a route that fits its declared profile?

This obligation owns spatial access and route allocation. `obligations/core/settings.md#design-dependent-subject-conditions` owns the user and equipment conditions consumed by an authored movement or operation task.

Sources: [NASA on verification methods and requirement-level responsibility](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

## Space review set {#space-review-set}

The population selects a finite set of plan, section, elevation, and perspective observations that can falsify its promised topology, scale, envelope alignment, and represented access. An authored traversal or operation task additionally selects observations of that task against its declared conditions. The observation set follows the delivered spatial claims.

Review question: which finite views expose every critical boundary and route?

Sources: [NASA on definitive requirement verification matrices](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)
