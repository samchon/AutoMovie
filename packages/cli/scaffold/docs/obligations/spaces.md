# Space obligations

These roles are distributed across the space-design H2 population. Space owns semantic topology and usable dimensions; model documents own the geometry used to depict a bounded object.

## Spatial reference and topology {#space-reference-topology}

The population establishes named world, site, building, level, room, zone, and local frames and the containment, adjacency, opening, and transition graph between them.

Review question: can every place and route be addressed without inferring a coordinate frame or crossing an unnamed boundary?

Sources: [buildingSMART on explicit space boundaries](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/concepts/Object_Connectivity/Space_Boundaries/Space_Boundaries_1st_Level/content.html); [glTF on coordinate system and units](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units)

## Exterior and interior interface {#space-envelope-interface}

The population reconciles exterior massing, envelope thickness, openings, storeys, interior clear dimensions, and shared surfaces so the two sides cannot describe incompatible buildings.

Review question: which shared opening, level, or surface would reveal a mismatch between exterior and interior intent?

Sources: [buildingSMART on adjacent spaces sharing boundary relations](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcRelSpaceBoundary.htm)

## Access, circulation, and clearance {#space-access-circulation}

The population allocates intended entrances, routes, reachable zones, clear widths/heights, obstacles, and intentionally inaccessible regions for every required actor, camera, or operator.

Review question: which required traversal or view lacks one continuous, dimensioned, unobstructed route?

Sources: [NASA on verification methods and requirement-level responsibility](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

## Space review set {#space-review-set}

The population defines plan, section, elevation, perspective, and traversal observations sufficient to falsify topology, scale, envelope alignment, and access independently of dramatic shot composition.

Review question: which finite views expose every critical boundary and route?

Sources: [NASA on definitive requirement verification matrices](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)
