# Motion source principles

These principles divide responsibility across reusable TypeScript motion constants and constructors. Constants carry reviewed values, while callable constructors own time mapping and input refusal; the separate exact design edge keeps every exported function and property tied to one motion document.

## Design-owned transition {#design-owned-transition}

Across the motion-source population, exported constants and constructors carry only the endpoints, phases, spatial relations, and parameter domains of their cited motion designs. Scene orchestration selects a motion but does not own its path.

Review question: can every branch and numeric transition be traced to the one cited motion design?

Sources: [Web Animations timing model](https://www.w3.org/TR/web-animations-1/#timing-model); [glTF 2.0 animations](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#animations)

## Pure time mapping {#pure-time-mapping}

Every callable motion constructor maps explicit state and parameters to one deterministic, time-addressed motion record, rejects an invalid authored time domain, and does not read scene-global clocks or frame history. Sampling that record remains the engine's responsibility; equal constructor inputs produce equal motion definitions.

Review question: what complete input tuple makes the motion replayable without hidden prior state?

Sources: [Web Animations timing calculations](https://www.w3.org/TR/web-animations-1/#timing-model); [ECMAScript specification](https://tc39.es/ecma262/)

## Invalid input is visible {#invalid-input-is-visible}

Every callable motion constructor refuses non-finite values, inverted durations, unsupported composition, and parameters outside its documented policy rather than producing a plausible but unauthorized path.

Review question: does every invalid input fail at the boundary before it can contaminate a rendered state?

Sources: [Web IDL numeric type and exception behavior](https://webidl.spec.whatwg.org/); [Web Animations effect timing validation](https://www.w3.org/TR/web-animations-1/#the-effecttiming-dictionaries)
