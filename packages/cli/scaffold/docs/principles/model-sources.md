# Model source principles

These principles divide responsibility across TypeScript that constructs subjects, objects, environments, and formations from reviewed model documents. Construction owners, deterministic builders, and input boundaries cite the roles they perform; each file supplies a concrete exported class, while the separate exact design edge keeps every exported model type tied to one model document.

## Design-owned construction {#design-owned-construction}

Across the model-source population, exported construction owners realize cited model units and introduce no independent silhouette, dimension, material-zone, hierarchy, or fidelity decision. If implementation exposes a missing design choice, the model document changes first.

Review question: which design unit owns every visible constant and structural choice in this symbol?

Sources: [NASA systems engineering handbook on bidirectional traceability](https://www.nasa.gov/reference/systems-engineering-handbook/); [glTF 2.0 scene, node, geometry, and material structures](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#concepts)

## Deterministic build {#deterministic-build}

Every model-building entry point maps explicit inputs to the same hierarchy, transforms, geometry, materials, and bounds without hidden randomness, mutable global state, or camera-dependent geometry. Derived values have one owning derivation.

Review question: can two builds with equal inputs be proven structurally and numerically equivalent?

Sources: [ECMAScript specification on execution and numeric values](https://tc39.es/ecma262/); [glTF 2.0 asset and scene graph data model](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#concepts)

## Unsupported fidelity is explicit {#unsupported-fidelity-is-explicit}

Every model-source boundary that accepts a fidelity or articulation request rejects or visibly reports values outside its reviewed design instead of silently substituting a weaker representation. Sources with no such input keep their fixed proxy ceiling explicit. A declared blocking proxy remains acceptable within its stated review purpose.

Review question: what unsupported request would otherwise look deceptively successful, and how is it made explicit?

Sources: [glTF 2.0 extensions and required capability signaling](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#specifying-extensions); [OpenUSD glossary on model kinds and asset organization](https://openusd.org/release/glossary.html)
