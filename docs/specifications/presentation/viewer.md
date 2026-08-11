# Deterministic presentation

## Clocked visible performance {#clocked-visible-performance}

<!-- @evidence requirements/09-audible-world.md#declared-sound-performance Applies authored pose and derived expression state on the same explicit frame clock used by film sound and capture. -->

`@automovie/viewer` lowers compiled scenes, models, motion, expression, lighting, and guide passes into Three.js state at a caller-supplied time. It performs no authoring inference and leaves the animation loop and visual judgment to its host.
