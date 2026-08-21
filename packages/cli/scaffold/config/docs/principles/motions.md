# Motion design principles

Motion documents specify deterministic change of represented state over time. They consume settings capabilities and model interfaces without redefining either one.

## State endpoints {#state-endpoints}

Every motion file names its complete entry state, exit state, and the properties allowed to change. A hold is an authored interval with identical endpoints, not an absence of specification.

Review question: can a caller determine the exact state before and after the motion without executing it?

Sources: [Web Animations timing model](https://www.w3.org/TR/web-animations-1/#timing-model); [glTF 2.0 animation channels and samplers](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#animations)

## Temporal phases {#temporal-phases}

Every motion file applies the production time base to its own duration and phase boundaries, including easing and hold intervals where they affect the observed path. Narrative adverbs do not substitute for a timing function.

Review question: for any production time, can an implementer identify the active phase and its normalized progress?

Sources: [Web Animations timing calculations](https://www.w3.org/TR/web-animations-1/#timing-model); [glTF 2.0 animation sampler inputs and interpolation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#animation-sampler)

## Spatial relation {#spatial-relation}

Every motion file states its coordinate frame and every path, rotation convention, contact target, or directional relationship that its transition actually uses. Where contact applies, it uses the population's contact measurement policy rather than defining a private tolerance. Contact and direction are measured observations, not adjectives, and an inapplicable relation is not invented merely to fill the checklist.

Review question: which frame and tolerance decide whether the moving parts followed the intended path or maintained contact?

Sources: [glTF 2.0 node transformations](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#transformations); [NIST Technical Note 1297 on stating uncertainty](https://www.nist.gov/pml/nist-technical-note-1297)

## Parameter domain {#parameter-domain}

Every motion file defines its inputs, valid ranges, defaults, compatibility with the population's composition and interruption policy, and response to unsupported values. A reusable motion may vary only the degrees of freedom that its design document exposes.

Review question: can a caller know every accepted variation and every rejected request before calling the implementation?

Sources: [Web Animations effect timing parameters](https://www.w3.org/TR/web-animations-1/#the-effecttiming-dictionaries); [glTF 2.0 animation data model](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#animations)
