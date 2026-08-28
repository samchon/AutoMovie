# Space design principles

Space documents define where bodies may exist and move: world, site, building, exterior, interior, room, zone, boundary, opening, and route. They do not own the mesh used to depict an object, its finish, or a timed traversal.

## Spatial information structure {#space-information-structure}

Every H2 first identifies its spatial owner, central decision, coordinate basis, and downstream consequence, then develops relations, dimensions, interfaces, limits, and verification in paragraphs with distinct functions. A drawing or table clarifies those decisions rather than replacing them.

Review question: can a reverse outline assign every paragraph, drawing, and table one non-repeated spatial purpose?

Sources: [Purdue OWL on paragraph focus and support](https://owl.purdue.edu/owl/graduate_writing/introduction_to_writing/documents/drafting-your-document/organization-at-the-paragraph-level.pdf); [NASA on verification-ready requirement structure](https://www.nasa.gov/reference/systems-engineering-handbook/)

## Topology before geometry {#space-topology}

Every space H2 states its applicable containment, adjacency, connection, obstruction, access, and inside/outside relations before choosing implementation geometry.

Review question: can an implementer recover the complete place graph without reverse-engineering meshes?

Sources: [buildingSMART on spaces bounded by building elements](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/concepts/Object_Connectivity/Space_Boundaries/Space_Boundaries_1st_Level/content.html); [glTF on scenes, nodes, and hierarchy](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#scenes)

## Canonical boundary authority {#space-boundary-authority}

Every spatial relation, dimension, datum, and boundary stated or consumed by the current H2 has one canonical owner. The unit cites a fact owned elsewhere and states only its local consequence; it does not restate, remeasure, or silently override the shared fact.

Review question: which spatial value or relation in this H2 is authored twice, or consumed without an addressable owner?

Sources: [buildingSMART on explicit space-boundary relationships](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcRelSpaceBoundary.htm); [NASA on bidirectional traceability and interface ownership](https://www.nasa.gov/reference/systems-engineering-handbook/)

## Verification-addressable spatial claims {#space-verification-address}

Every consequential spatial claim in the current H2 identifies the observable relation, measurement, tolerance, or route result that could falsify it and points to the population review role that will test it. This unit maps its own claims; the space obligations define the complete shared review set.

Review question: which claim could fail in a plan, section, measurement, or traversal while every observation named by this H2 still passes?

Sources: [NASA on requirement-specific verification methods](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)
