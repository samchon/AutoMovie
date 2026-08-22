# Production kinds

The generated scaffold starts with `kind: null` and every stage disabled. Select exactly one `kind` in the graph declaration at the bottom of `lint.config.ts` when authorship begins. Runtime and aspect ratio do not decide the kind; authored structure does.

Every layer begins `disabled` with no governed hosts. For a layer forbidden by the selected kind, that state is permanent. For a required or planned layer, it means not begun; add its hosts and enter `draft` only after its direct parents reach `review`.

## Film

A film makes a narrative claim through `storylines -> scenarios -> script -> shots -> filmSources`. Use it for any narrative production, including a short film. Settings, production source, and the narrative ladder apply; model, space, material, instance, motion, and system branches apply when the film authors them. Briefs are disabled.

## Brief

A brief makes one bounded audiovisual claim directly through `briefs -> shots -> filmSources`. Use it for a simple short-form action, product turntable, locomotion demonstration, logo sting, or another result whose complete intent fits one delivery/shot/observation hierarchy. Local action may be present; independently authored causal character change, audience revelation, or scene-to-scene inheritance requires the film ladder. Narrative layers are disabled. Runtime alone never decides the shape.

## Library

A library authors reusable settings and whichever model, space, material, instance, motion, or system design/source branches apply, without a timed audiovisual result. Use it for a figure, prop, environment, building exterior/interior, material system, repeated population, rig, motion, light/effect/simulation/sound system, or compatible collection that has no shots. Production source is optional when the library needs to serialize a reviewed delivery contract; narrative, brief, shot, and film-source layers are disabled.

## Refusals

Do not keep an inapplicable or not-yet-started layer active and empty. Keep it `disabled` without governed Markdown or TypeScript hosts; the graph refuses both an active empty layer and a disabled layer whose hosts remain. Do not select `brief` to avoid an independently necessary narrative-refinement layer, and do not select `library` when the intended result is a rendered performance.
