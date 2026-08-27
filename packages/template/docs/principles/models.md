# Model design principles

Model documents specify the deterministic blocking representation that source code must construct. They neither redefine the subject's in-world identity nor prescribe changes over time.

## Addressable model decisions {#addressable-model-decisions}

Every independently implementable, citable, revisable, or reviewable representation decision has one stable H2. Geometry allocation, hierarchy, articulation interface, surface partition, fidelity boundary, and review observation with different consumers or change paths are not hidden inside one umbrella unit or repeated in another file. Material construction and response belong in materials; this layer owns only the stable surface that receives one.

Review question: which model decision could change or be implemented independently and therefore still needs its own H2 owner?

This item owns the model-document address structure. The common substantive obligation owns the completeness of each addressed design unit, and the exact source edge owns its implementation.

Sources: [NASA on unique identification and one requirement per statement](https://swehb.nasa.gov/pages/viewpage.action?pageId=146540037); [OpenUSD model and asset terminology](https://openusd.org/release/glossary.html)

## Model information structure {#model-information-structure}

Every H2 first identifies the represented part or observation, its central representation decision, applicable settings basis, and downstream consequence, then develops geometry, hierarchy, dimensions, surfaces, interfaces, limits, derivations, and review conditions in paragraphs with distinct functions. Tables and lists clarify mappings rather than replacing those decisions.

Review question: can a reverse outline give every paragraph one design function without finding a second hidden owner or repeated orientation?

This item owns information order inside a model H2. `addressable-model-decisions` owns the boundary between H2 units.

Sources: [Purdue OWL on paragraph focus and support](https://owl.purdue.edu/owl/graduate_writing/introduction_to_writing/documents/drafting-your-document/organization-at-the-paragraph-level.pdf); [George Mason Writing Center on reverse outlining](https://writingcenter.gmu.edu/writing-resources/writing-as-process/reverse-outlining)

## Representation contract {#representation-contract}

Every model file names the geometry strategy, hierarchy, reusable parts, and proxy status used to represent its settings subject. It applies the population's representation ceiling by naming the observations the proxy can and cannot support. When adjoining visible sides need different downstream responses, it gives them separate stable surface owners; the materials layer chooses their construction and appearance.

Review question: can an implementer build the intended blocking representation without choosing an unstated form or pretending a proxy is final fidelity?

Sources: [OpenUSD model and asset terminology](https://openusd.org/release/glossary.html); [glTF 2.0 meshes, skins, and instantiation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#geometry)

## Spatial convention {#spatial-convention}

Every model file states its local origin, any forward or up axis that differs from repository convention, occupied extents, and every pivot or fixed placement offset its representation uses. It derives local dimensions from the population's nominated scale reference; primitive defaults never become dimensions by accident. This principle owns the numeric placement of an already named pivot, while the articulation obligation separately decides whether that pivot is a motion-writable interface.

Review question: can the representation be placed, scaled, and compared without discovering a hidden coordinate convention in code?

Sources: [glTF 2.0 coordinate system and units](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units); [OpenUSD glossary definitions for transforms and prims](https://openusd.org/release/glossary.html)

## Reviewable structure {#reviewable-structure}

Every model file identifies its review-critical silhouette, surface partition, and articulation region that the population's neutral model-review set must expose. It does not choose the bound material, shot composition, or dramatic lighting.

Review question: which fixed views and visible boundaries would falsify the model before it is used in motion or a shot?

Sources: [glTF 2.0 geometry and material structures](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#geometry); [Academy Digital Source Master project](https://www.oscars.org/science-technology/sci-tech-projects/academy-digital-source-master)
