# Material source principles

Material source turns reviewed construction and appearance into deterministic renderer-facing records without inventing a finish.

## Design-owned material construction {#material-source-design-ownership}

Every exported owner realizes one reviewed material document and introduces no unreviewed finish, layer, surface assignment, scale, or response.

Review question: can every emitted material fact be traced to exactly one reviewed H2?

Sources: [NASA on bidirectional requirement traceability](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

## Explicit renderer mapping {#material-source-renderer-mapping}

Construction and appearance parameters map explicitly into deterministic renderer values, color spaces, texture transforms, face bindings, and resource identities.

Review question: can each authored parameter be located in the renderer record without inference or a second default?

Sources: [glTF on declarative PBR materials and texture-coordinate interpretation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials)

## Invalid material state is refused {#material-source-invalid-state}

Missing surfaces or textures, invalid ranges, incompatible channels, unsupported states, and budget violations remain named diagnostics rather than silent defaults or substitutions.

Review question: does each invalid material input fail before a renderer can substitute a plausible image?

Sources: [glTF on required indices, media-type agreement, and bounded material fields](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
