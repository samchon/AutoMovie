# Model-source upstream revision

What implementing a reviewed model unit proves wrong in that design or its inherited settings and space interfaces, and what is repaired there. Every selected model-source export answers for the model unit it realizes.

## Design revision from model-source work {#design-revision-from-model-source-work}

Implementation tests whether model design fixes constructible parts, extents, pivots, writable interfaces, parameter domains, contacts, and derived-data behavior. Report any geometry, joint, morph, attachment, bound, or invalidation rule the export could not implement without choosing locally. Repair the model or earliest upstream owner before changing source; constructor convenience and asset defaults do not authorize design.

`@evidence` names every upstream target repaired and the implementation case that exposed it. When the export exposes no defect, `@evidenceExclude` names its model parent and the concrete parts, dimensions, interfaces, domains, and derived data implemented as written. A parentless export or generic fidelity statement covers nothing.

Review question: what did implementing this model-source export prove wrong in its actual model or earlier parents, or which concrete parent decisions did it test and find sufficient?

Sources: [glTF 2.0 on meshes, nodes, skins, morph targets, and animations](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html); [NASA on design-to-implementation traceability](https://www.nasa.gov/reference/systems-engineering-handbook/)
