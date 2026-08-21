# Production kinds

Set exactly one `kind` in the `createAutoMovieEvidenceConfig` call in `lint.config.ts`. Runtime and aspect ratio do not decide the kind; authored structure does.

Every layer begins `disabled` with no governed hosts. For a layer forbidden by the selected kind, that state is permanent. For a required or planned layer, it means not begun; add its hosts and enter `draft` only after its direct parents reach `review`.

## Film

A film makes a narrative claim through `storylines -> scenarios -> script -> shots -> filmSources`. Use it for any narrative production, including a short film. Settings, production source, and the narrative ladder apply; model and motion branches apply when the film authors them. Briefs are disabled.

## Brief

A brief makes one bounded, non-narrative audiovisual claim directly through `briefs -> shots -> filmSources`. Use it for a product turntable, locomotion demonstration, logo sting, or another result whose meaning does not depend on dramatic causality, character choice, or audience revelation. Narrative layers are disabled. A short runtime alone never makes a work a brief; a ten-second story is still a film.

## Library

A library authors reusable settings, production source, and whichever model or motion design and source branches apply, without a timed audiovisual result. Use it for a figure, prop, environment, rig, or motion collection that has no shots. Narrative, brief, shot, and film-source layers are disabled.

## Refusals

Do not keep an inapplicable or not-yet-started layer active and empty. Keep it `disabled` without governed Markdown or TypeScript hosts; the factory refuses both an active empty layer and a disabled layer whose hosts remain. Do not select `brief` to avoid narrative work when the production makes a narrative claim, and do not select `library` when the intended result is a rendered performance.
