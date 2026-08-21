# Model design principles

Model documents specify the deterministic blocking representation that source code must construct. They neither redefine the subject's in-world identity nor prescribe changes over time.

## Representation contract {#representation-contract}

Every model file names the geometry strategy, hierarchy, reusable parts, and proxy status used to represent its settings subject. It applies the population's representation ceiling to this subject by naming the local observations the chosen proxy can and cannot support. When adjoining visible sides need different material or light responses, it gives them separate authored surface owners; one enclosing mass does not stand in for a ceiling, liner, or pane face with an independent response.

Review question: can an implementer build the intended blocking representation without choosing an unstated form or pretending a proxy is final fidelity?

Sources: [OpenUSD model and asset terminology](https://openusd.org/release/glossary.html); [glTF 2.0 meshes, skins, and instantiation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#geometry)

## Spatial convention {#spatial-convention}

Every model file states its local origin, any forward or up axis that differs from repository convention, occupied extents, and every pivot or fixed placement offset its representation uses. It derives local dimensions from the population's nominated scale reference; primitive defaults never become dimensions by accident. This principle owns the numeric placement of an already named pivot, while the articulation obligation separately decides whether that pivot is a motion-writable interface.

Review question: can the representation be placed, scaled, and compared without discovering a hidden coordinate convention in code?

Sources: [glTF 2.0 coordinate system and units](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units); [OpenUSD glossary definitions for transforms and prims](https://openusd.org/release/glossary.html)

## Reviewable structure {#reviewable-structure}

Every model file identifies its review-critical silhouette and every material, color zone, or articulation region its representation actually contains and that the population's neutral model-review set must expose. This maps subject-specific observations into shared views; it neither invents an inapplicable region nor redefines those views or chooses shot composition and dramatic lighting.

Review question: which fixed views and visible boundaries would falsify the model before it is used in motion or a shot?

Sources: [glTF 2.0 geometry and material structures](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#geometry); [Academy Digital Source Master project](https://www.oscars.org/science-technology/sci-tech-projects/academy-digital-source-master)
