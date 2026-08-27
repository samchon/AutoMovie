# Material obligations

These roles are distributed across the material-design H2 population. Materials own surface construction and response; models and spaces own the surfaces to which those materials bind.

## Material identity and assembly {#material-identity-assembly}

The population names every required construction or finish, its layers or composition, units, thickness or scale where relevant, and the authored substitutions allowed by the delivery.

Review question: which visible or physical material result still depends on an unnamed layer, unit, or substitution?

Sources: [glTF on explicit declarative material parameters](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials); [NASA on unique verifiable requirements](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

## Surface assignment {#material-surface-assignment}

The population maps materials to stable model or space surface owners and defines junction, edge, orientation, repetition, and face-specific behavior without taking ownership of the host geometry.

Review question: which face or junction can receive two incompatible finishes or no finish at all?

Sources: [glTF on mesh primitives binding geometry and materials](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes)

## Optical and physical response {#material-response}

The population allocates color space, texture scale, opacity, roughness, metalness, transmission, emission, normal/displacement scale, and any physical behavior actually required by the prototype.

Review question: which observable response is currently an adjective rather than a bounded parameter or reference?

Sources: [glTF on metallic-roughness parameters, opacity, and texture channels](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials)

## Material review set {#material-review-set}

The population defines neutral lighting, distance, angle, scale comparison, and state samples that reveal tiling, seams, face errors, and unsupported fidelity.

Review question: which repeatable sample would falsify construction, scale, or response before a dramatic shot can hide it?

Sources: [NASA on assigning verification methods to requirements](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)
