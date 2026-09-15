# Live viewing while authoring

Create a live view only when the requested work needs visual inspection. The [project ownership boundary](../../../README.md#ownership) governs its source, HTML, assets, and configuration. The scaffold supplies no page, viewer command, preview factory, or template variant to fill in.

## Build the required view

Read the installed public viewer and engine APIs before choosing the view's implementation. Add the viewer dependency and browser tooling only when this work needs them, keeping their versions compatible with the production's installed packages. Declare required browser compiler libraries in the existing package configuration.

Import the production's actual geometry, scene, motion, and camera producers. Reuse the same deterministic functions and explicit inputs as its other consumers; do not copy geometry into a demonstration scene or invent an artifact that resembles a production result.

Choose the smallest view that answers the current question. A model may need framing and a turntable; an interior may need a navigable camera and sections; a film may need exact-time sampling and interval playback. Add controls for those needs, not a prebuilt menu of unrelated production modes. No filename, factory name, callback interface, or directory below the source root is prescribed here.

Keep browser runtime imports free of Node-only modules. Use package types and pure engine calculations across the boundary; perform required file or network acquisition at an explicit host boundary before deterministic execution. A type-only import does not introduce a runtime dependency.

## Keep the viewed source current

Run source lint and ensure the page consumes the current checked source. If a development server is useful, configure it in source and invoke it explicitly. A failed compilation or disconnected server must not leave an old image presented as the current result.

Keep output and cache writes outside the source-change loop. Coalesce repeated saves and release renderer, input, and animation resources when replacing a view or closing it. Preserve the producer's actual camera and state when controls change them rather than restoring stale control state on the next input.

## Record what was observed

Name the source revision, inputs, subject, time or pose, camera, raster, actual runtime, and any section or diagnostic material when recording an observation. A free camera does not prove collision or clearance, and an inspection cut does not represent an audience frame.

Follow [Capture](capture.md) when an observation needs a retained image or interval and [Production review](review.md) when deciding what that observation satisfies. A functioning page proves neither a completed delivery pipeline nor the quality of the complete work.
