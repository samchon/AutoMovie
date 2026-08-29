# Shot source obligations

These obligations divide responsibility across TypeScript shot deliveries and their adjacent acceptance exports. Delivery exports own local composition and deterministic shot time; acceptance exports own falsifying observations. Final timeline assembly and auxiliary tracks belong to film source. The separate exact scene edge keeps every governed export tied to one screenplay scene or brief shot.

## Contract-only composition {#contract-only-composition}

Every shot delivery export composes the local visual portion of exactly one screenplay scene or brief shot and introduces no new story event, subject capability, model construction decision, motion path, caption, sound, or editorial transition. It owns composition, camera, lighting, and the orchestration needed to realize that portion of its parent.

Review question: which line would change the delivered meaning if removed, and where is that meaning authorized upstream?

Sources: [NASA systems engineering handbook on allocation and traceability](https://www.nasa.gov/reference/systems-engineering-handbook/); [Academy Digital Source Master project](https://www.oscars.org/science-technology/sci-tech-projects/academy-digital-source-master)

## Explicit inputs and time {#explicit-inputs-and-time}

Every shot delivery export receives or declares all variable inputs, works in seconds, and produces the same composition for the same inputs. It delegates model building and motion evaluation to their owning sources rather than duplicating them.

Review question: can the shot be rendered at an arbitrary declared time without relying on hidden state or frame order?

Sources: [Web Animations timing model](https://www.w3.org/TR/web-animations-1/#timing-model); [glTF 2.0 scene graph concepts](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#scenes)

## Acceptance travels with delivery {#acceptance-travels-with-delivery}

The shot-source population pairs every delivery with observable acceptance conditions, falsifying thresholds, review instants, and view context beside the delivery it judges. Passing is not inferred from a successful render call.

Review question: which reproducible observation would fail this shot even when rendering completes without error?

Sources: [NASA systems engineering handbook on verification](https://www.nasa.gov/reference/systems-engineering-handbook/); [Academy Digital Source Master project](https://www.oscars.org/science-technology/sci-tech-projects/academy-digital-source-master)
