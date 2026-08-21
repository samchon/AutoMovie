# Building Finishes

What a surface is made of, and what covers it. Read this when a wall, floor, roof, or ceiling has to carry a material, a build-up, or a field of repeated modules.

The record those surfaces belong to is `BUILT_ENVIRONMENT`. How an image is bound to one at its real size is `MODEL_RECIPE`, and which constructor emits the coordinates that image samples through is `GEOMETRY`.

## Finishes: substance, surface, and build-up

Substance, surface, and build-up answer different questions, and collapsing them is what makes a wall lie about itself.

A surface answers what the material looks like: base colour, roughness, maps. A substance answers what it is made of: an open classification, and density, thermal conductivity, specific heat, sound absorption, vapour resistance, and service life, each optional and each `null` until measured. `null` is the honest state for a production that never ran a study, and it is what keeps an analysis from being fed a number nobody measured. One substance may be shown by different surfaces (the same stone polished and flamed), and one surface may stand in for different substances, which is exactly why they are not one record.

An assembly answers how thick the thing actually is. It is an ordered stack of layers on one host: each layer names an open construction `role`, whether it is a `solid`, a `cavity`, or a `membrane`, its thickness in metres, its substance, whether it is the visible `finish`, and whether it `wrapsOpening`. The stack is measured rather than drawn: an `axis`, a `sense`, and an `offset` say which host-local direction the layers advance along and where the first face sits, so one build-up is stated once and applied to a wall, a floor, and a soffit. `faces` declares whether each end is `exposed` or `concealed`, which is how a missing finish and a wasted one are both caught: an exposed end must be finished, a concealed end must not be, a finish buried behind another layer is a defect, and a second finish over the first is another.

A visible side that must take a different finish or light response owns a separate authored surface. A roof mass does not double as the ceiling below it, and one shared pane does not double as independently judged interior and exterior glazing. Use `buildAutoMovieRegionFace(` for each one-sided liner or pane, orient the two faces in opposite directions, and give them their real separation. This is blocking geometry with distinct ownership, not a view-dependent material trick.

The build-up, not the colour, is what sets a wall's overall thickness and the depth of a window reveal. A layer that wraps narrows the finished opening on every side and lines the jamb to its own depth; a layer that stops at the jamb does neither, and a wrapping layer cannot turn the corner from behind one that already stopped. At a junction between two build-ups, layers are matched by `role`, so the same word has to mean the same thing on both sides or the wrong layers continue. The engine ships no substances and no build-ups. A catalogue of real-world materials is content, and content is yours.

## Repeated modules on a surface

Tiles, bricks, stone slabs, boards, panels, and repeated ornament are not a texture repeat. A texture repeat knows nothing about the real module size, the joint between modules, the piece cut at a boundary, the opening the pattern steps around, or how many modules were consumed and how much was thrown away. A surface pattern is the program that knows all of it: you write the module law per zone, and the engine owns everything that must be identical on every run.

Declare the pattern over one host face: zones each with their own module program and reach, exclusions no module may cover, the nominal `joint` and the slack a measured gap may differ from it by, the `adjacency` distance at which two pieces still count as neighbours, the smallest acceptable surviving fraction of a module, an optional grain tolerance in degrees, a seed, and how many variants the seed may choose between. Several zones in one pattern is how a transition is expressed, and the neighbour scan measures across the border between zones exactly as it does inside one.

Read the results rather than the render. Findings come back as `sliver`, `unsupported-piece`, `module-overlap`, `joint-deviation`, and `grain-break`, each naming the occurrence ids involved, the measured quantity, and the limit it failed. Quantities come back as placed, whole, and cut counts with covered area, consumed area (a cut piece still costs a whole module), waste area and ratio, net region area, and joint area and length, per zone and in total. These are film-facing design measurements for comparing the authored pattern with its declared limits; they are not a bill of materials, a procurement take-off, or an instruction to order anything. A pattern that renders beautifully and wastes forty percent is a pattern whose declared layout can now be reconsidered.

Whole occurrences are emitted as exact instance transforms and cut ones are listed separately, because a cut piece needs its own geometry and cannot share a prototype. Feed the whole ones into an `explicit` instance set and give the cut ones real meshes.

Inside a building that `explicit` set is a `populations` entry rather than a world set, so the room it covers can answer for it. A wall of ashlar and a roof of slate are each one population naming the smallest space that contains the field, and the pieces the pattern cut are ordinary elements in the same space. Placing the run's output straight into the production world instead would leave the building unable to say what stands in its own rooms, which is the failure the population record exists to prevent.

The whole pattern path is callable from shot source, so none of it needs a script. `generateAutoMovieSurfacePattern(` takes the pattern and answers with `placements`, `quantities` and `findings`. `autoMoviePatternInstanceTransforms(` turns that answer's whole occurrences into instance transforms and hands back the cut ids you still owe geometry for. `autoMoviePatternTextureTransforms(` says how each laid piece samples its material, and reports by id any piece whose lay would need a shear the texture matrix has no term for, rather than skewing the image quietly.

## Look at the surface

A finish is a claim about how a surface reads at a distance, and no record states that. Only the picture does.

`captureFrame` with a `part` on the asset target frames the one part carrying the build-up, which is how a coursing scale or a tile that smeared across a floor becomes visible instead of arguable. `inspectSubject({ shot, subject })` opens the element or the room once the surface is placed, and a named space is sectioned automatically.

Judge at the distance the shot actually uses. A coursing that reads in the hand is a smear at room scale, and the reverse is just as common. Record the verdict with `prepareReview` and `submitReview` under `REVIEW_SUBJECT`.
