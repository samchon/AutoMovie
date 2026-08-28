# Motion-source upstream revision

What implementing a reviewed motion unit proves wrong in that design or the writable interfaces it consumes, and what is repaired there. Every selected motion-source export answers for the motion unit it realizes.

## Design revision from motion-source work {#design-revision-from-motion-source-work}

Implementation tests whether motion design fixes inputs, time mapping, interpolation, writable channels, contacts, limits, and terminal states for arbitrary-time evaluation. Report any hidden clock, missing interface, impossible sample, discontinuity, or state dependency the export could not implement without choosing locally. Repair the motion or earliest settings, model, space, instance, material, or system owner; a code-only degree of freedom or clamp is not a repair.

`@evidence` names every upstream target repaired and the sample or boundary case that exposed it. When the export exposes no defect, `@evidenceExclude` names its motion parent and the concrete inputs, time basis, channels, limits, and terminal states implemented as written. A parentless export or generic animation-success claim covers nothing.

Review question: what did implementing this motion-source export prove wrong in its actual motion or earlier parents, or which concrete parent decisions did it test and find sufficient?

Sources: [Web Animations on arbitrary-time sampling and timing calculations](https://www.w3.org/TR/web-animations-1/); [glTF 2.0 on animation channels and samplers](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#animations)
