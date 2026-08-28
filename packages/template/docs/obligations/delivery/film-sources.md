# Film source obligations

These obligations divide assembly of reviewed local shots into the global audience timeline across the selected film-source population. Film source owns editorial mapping and auxiliary tracks, while screenplay or brief owns their meaning and shot source owns each local visual realization.

## Editorial-only assembly {#editorial-only-assembly}

Every video edit selects an authored shot, source interval, global start, handle, and transition without inventing local action, a subject capability, or a camera decision. Overlap is explicit, and the assembled endpoint equals the production runtime.

Review question: can every global video interval be traced to one reviewed local shot and every overlap to a declared transition?

Sources: [SMPTE standards overview for time and synchronization](https://www.smpte.org/standards); [Academy Digital Source Master project](https://www.oscars.org/science-technology/sci-tech-projects/academy-digital-source-master)

## Authored auxiliary tracks {#authored-auxiliary-tracks}

Every caption, audible item, timeline effect track, and intentionally silent structural track is authorized upstream with exact audience content and timing where those are creative choices. Every required accessibility product from `obligations/core/settings.md#accessibility-deliverable-states` that belongs to a film timeline or language version has an explicit track mapping; an intentionally absent or unsupported product is never disguised as an empty successful track. Shot-local visual effects remain owned by shot source. Pipeline fixtures remain visibly inert and are named as fixtures.

Review question: where are the text, language, audible meaning, effect, and time of every required non-video track authored and mapped, and would deleting a fixture leave audience meaning unchanged?

Sources: [W3C Timed Text Markup Language](https://www.w3.org/TR/ttml2/); [Web Audio API](https://www.w3.org/TR/webaudio/); [Academy Digital Source Master project](https://www.oscars.org/science-technology/sci-tech-projects/academy-digital-source-master)

## Deterministic timeline {#deterministic-timeline}

The edit is a pure build from the opened production context and fixed authored values. It carries no hidden clock, mutable history, asset discovery, or conditional creative fallback.

Review question: does the same reviewed source and context always produce the same ordered tracks and exact runtime?

Sources: [ECMAScript language specification](https://tc39.es/ecma262/); [Web Animations timing model](https://www.w3.org/TR/web-animations-1/#timing-model)
