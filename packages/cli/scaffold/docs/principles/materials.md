# Material design principles

Material documents define construction, finish, scale, response, and state. They bind to stable surfaces owned by models or spaces and do not redefine those surfaces.

## Addressable material decisions {#addressable-material-decisions}

Every independently assignable construction, finish, texture family, junction, state, or material observation has one stable H2.

Review question: which material decision could be replaced or reviewed alone and therefore lacks its own owner?

Sources: [NASA on unique, bidirectionally traceable requirements](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

## Material information structure {#material-information-structure}

Every H2 first identifies its material owner, central construction or appearance decision, compatibility boundary, and downstream consequence, then develops layers, parameters, bindings, limits, and verification in paragraphs with distinct functions. Tables support comparison rather than replacing the authored relation among those facts.

Review question: can a reverse outline assign every paragraph and table one non-repeated material purpose?

Sources: [Purdue OWL on paragraph focus and support](https://owl.purdue.edu/owl/graduate_writing/introduction_to_writing/documents/drafting-your-document/organization-at-the-paragraph-level.pdf); [glTF on declarative material structure](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials)

## Construction and appearance separation {#material-construction-appearance}

Every file distinguishes physical layer/assembly facts from renderer-facing appearance parameters and states the deliberate relationship between them.

Review question: which visual setting is being presented as construction truth, or which construction promise has no visible proxy?

Sources: [glTF on material as a parameterized approximation of visual properties](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials)

## Binding interface contract {#material-binding-interface}

Every file names the stable surface vocabulary, orientation, coordinate convention, and compatibility conditions it requires without redefining host geometry or assigning a surface owned by another material document. Concrete assignments remain population roles under the material obligations.

Review question: can a model or space owner determine whether this material is compatible without surrendering geometry ownership or guessing a coordinate convention?

Sources: [glTF on mesh primitives binding geometry to materials](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes); [glTF on normalized texture coordinates](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#textures)

## Verification-addressable material claims {#material-verification-address}

Every consequential construction, scale, junction, response, and state claim identifies the observable sample that could falsify it and points to the population review role that will test it. This file maps its own claims; the material obligations define the complete shared conditions and sample set.

Review question: which material claim could be false while every sample named by this file still passes?

Sources: [NASA on a verification matrix that assigns a method to each requirement](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)
