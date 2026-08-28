# System design principles

System documents govern coupled processes such as lighting, environment, effects, simulation, sound, and building services. They do not absorb the identity or construction of the owners whose state they read or affect.

## System information structure {#system-information-structure}

Every H2 first identifies its process owner, central behavior, authority boundary, and downstream consequence, then develops interfaces, state basis, dependencies, limits, failures, and verification in paragraphs with distinct functions. State tables clarify transitions rather than replacing the rule that governs them.

Review question: can a reverse outline assign every paragraph and state table one non-repeated system purpose?

Sources: [Purdue OWL on paragraph focus and support](https://owl.purdue.edu/owl/graduate_writing/introduction_to_writing/documents/drafting-your-document/organization-at-the-paragraph-level.pdf); [NASA on interface and verification-ready system definitions](https://www.nasa.gov/reference/systems-engineering-handbook/)

## Authority confinement {#system-authority-confinement}

Every system H2 writes only the state channels its process owns and cites the map, model, space, material, instance, or motion owners it consumes. It does not redefine their identity, construction, capability, or transition merely because the process reads or affects them. Audience meaning remains in narrative or brief prose and is realized by shots rather than becoming a system input.

Review question: which output crosses the declared write boundary or silently takes ownership from a consumed branch?

Sources: [NASA Systems Engineering Handbook on interface definition and allocated responsibility](https://www.nasa.gov/reference/systems-engineering-handbook/)

## Explicit dependency basis {#system-dependency-basis}

Every output and state change in the current H2 traces to named inputs, dependencies, parameters, and an explicit evaluation basis. Hidden globals, ambient update order, and an unnamed prior sample do not authorize a result; the population obligations separately allocate shared clocks, ordering, and terminal states.

Review question: which result still depends on state or ordering that this H2 neither owns nor names as an input?

Sources: [W3C Web Animations on stateless, arbitrary-time evaluation](https://www.w3.org/TR/web-animations-1/#timing-model); [NASA on requirement and interface traceability](https://www.nasa.gov/reference/systems-engineering-handbook/)

## Verification-addressable system claims {#system-verification-address}

Every claimed behavior, limit, degradation, and failure in the current H2 identifies the observable result that could falsify it and points to the population review role that will test it. This unit maps its own claims; the system obligations define the complete stress, interaction, budget, and review set.

Review question: which system claim could be false while every observation named by this H2 still passes?

Sources: [NASA on requirements verification matrices, methods, and responsible levels](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)
