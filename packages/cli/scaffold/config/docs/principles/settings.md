# Settings principles

Settings state the production's facts, constraints, identities, and capabilities before any particular representation, motion, or scene is selected.

## Fact status {#fact-status}

Every settings unit distinguishes an externally supported fact, a production invention, a default, a derived value, and an unresolved decision. It gives the scope in which that status is valid.

This principle classifies the production fact itself; `common.md#declared-basis` separately traces how a document is entitled to inherit, derive, choose, or leave open a statement.

Review question: what authority and scope make each stated fact usable downstream?

Sources: [W3C PROV-O](https://www.w3.org/TR/prov-o/); [NIST on metrological traceability](https://www.nist.gov/calibrations/traceability)

## Capability boundary {#capability-boundary}

Every subject or environment capability states the state it may change, the frame and units in which limits are expressed, and any relevant inability. Settings authorize what can happen; they do not choose when a scene uses it or how source code realizes it.

Review question: could a downstream author tell what the subject can and cannot do without inventing an interface or scene?

Sources: [glTF 2.0 coordinate-system and units requirements](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units); [OpenUSD model and prim concepts](https://openusd.org/release/glossary.html)

## Observable identity {#observable-identity}

Every settings unit states the characteristics that must remain recognizable under the population's delivery review condition. It owns the identity to observe, not the shared delivery condition or the mesh, material construction, rig, camera, and lighting solution used to achieve recognition.

Review question: what visible or audible observation distinguishes this subject or place from a merely named placeholder?

Sources: [Academy Digital Source Master specification on defined image characteristics](https://www.oscars.org/science-technology/sci-tech-projects/academy-digital-source-master); [glTF 2.0 scene and asset concepts](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#concepts)
