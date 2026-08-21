# Motion design principles

Motion documents specify deterministic change of represented state over time. They consume settings capabilities and model interfaces without redefining either one.

## Addressable motion decisions {#addressable-motion-decisions}

Every independently callable, composable, revisable, or reviewable transition or observation has one stable H2. A transition with its own entry, exit, time domain, parameter set, interruption behavior, or consumer does not hide under another motion's heading, and a review protocol that several transitions share belongs to the population obligation rather than being copied.

Review question: which timed behavior could be selected, changed, or falsified independently and therefore still needs its own H2 owner?

This item owns motion-document address structure. The common substantive obligation owns each unit's completeness, and the exact source edge owns its implementation.

Sources: [NASA on unique identification and one requirement per statement](https://swehb.nasa.gov/pages/viewpage.action?pageId=146540037); [Web Animations timing model](https://www.w3.org/TR/web-animations-1/#timing-model)

## Motion information structure {#motion-information-structure}

Every H2 first identifies its subject, entry and exit, active time domain, and observable consequence, then develops phases, interpolation, spatial relations, invariants, limits, composition, parameters, and review samples in paragraphs with distinct functions. A table may make samples or parameter ranges clearer but does not replace the transition rule.

Review question: can a reverse outline give every paragraph one temporal or verification function without finding mixed transitions or repeated orientation?

This item owns information order inside a motion H2. `addressable-motion-decisions` owns the boundary between H2 units.

Sources: [Purdue OWL on paragraph focus and support](https://owl.purdue.edu/owl/graduate_writing/introduction_to_writing/documents/drafting-your-document/organization-at-the-paragraph-level.pdf); [George Mason Writing Center on reverse outlining](https://writingcenter.gmu.edu/writing-resources/writing-as-process/reverse-outlining)

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
