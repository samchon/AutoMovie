# Sound Design Handbook

Sound establishes causality, scale, space, rhythm, attention, and continuity. Build it from semantic events and authored ambience rather than decorating the finished image with unrelated effects.

## Sound layers

- Dialogue carries language, intention, breath, and proximity.
- Foley makes contact and material action legible.
- Effects express events, machinery, weapons, weather, and exceptional forces.
- Ambience defines continuous place, time, population, and acoustic condition.
- Music shapes structure and emotion but must not erase required information.

Give each layer a narrative job. If two sounds compete for the same job, simplify or establish hierarchy.

## What an authored cue plays

An audio cue on the film timeline names its `asset` and states where it sits: a film-global start, a duration, the source frame the edit begins at, the span of source it uses, a gain, fades and a bus. The mix plays that asset read at its own rate from the stated offset, stretched only by the ratio between the source span and the film span, and silent past the asset's end rather than looped. Decoding happens outside the mix: whoever renders hands the decoded samples in, exactly as it does for synthesized dialogue, so a codec never reaches a mix that has to produce the same bytes on every machine.

A cue whose asset has not been decoded still sounds, as a bus-shaped stand-in: a bed for music, filtered noise for ambience and effects. That is scaffolding for a film mid-authoring and not the sound design: a review that judges a cue before its asset is decoded is judging the stand-in.

## Event-derived cues

Bind cues to semantic event ids and exact source times. Impact, muzzle, footfall, door contact, formation order, and transition sounds should inherit measured event time and world-space source. Preserve authored source offsets when an edit uses a later part of a cue or carries it across a cut.

Use deterministic procedural sound for bounded prototypes and effects the engine can derive. Register external samples with license, digest, technical facts, and consumer permission. A filename is not provenance.

## Spatialization

Resolve the emitter at cue time, including moving actors, props, cameras, and formations. Derive distance attenuation and pan from actual world position and listener state. A moving formation must not emit forever from its initial centroid.

A group is an extended source and the derived plan measures it as one. An event naming a formation or an instance set carries how many members sound, how far they are spread, and the level that many mutually uncorrelated sources produce, which rises as the square root of the count: ten voices sit about 10 dB over one and a hundred about 20 dB over one. Attenuation and pan are taken at the root-mean-square source-to-listener distance rather than at the centroid alone, so a sprawling mass underfoot does not attenuate as though it stood at one point, a wide near source occupies a span of the stereo field instead of a point in it, and a cue that closes the unit's ranks tightens it in the mix exactly as it tightens on screen. Name the subjects an event really has: the acoustic center is weighted by member count, so an event naming one figure and the mass behind it emits from the mass rather than from the empty midpoint between them.

Use spread or multiple emitters for large sources only when the shot scale needs it. Keep near-field details localized and distant mass coherent. A production may adopt a bounded direct-path profile that states its sound speed, distance law, spectral absorption, environment revision, and cut-boundary policy. The sound event keeps its visual `emissionFrame`; the derived `arrivalFrame` is when the listener hears it and may cross a shot boundary without moving the event itself. Use only that declared profile. Do not infer temperature, humidity, weather, or a provider from a place label, and do not disguise missing spectral inputs as a generic gain. Doppler, occlusion, diffraction, ground reflection, and any other unimplemented path remain absent or `unsupported`, not implied by the direct-path result.

When a shot is inside a built space, its acoustic response is adopted from declared evidence rather than guessed. Resolve the emitter and listener against the same spatial graph: outdoor sound uses the direct path, same-room sound may consume one bounded room response, and cross-room sound requires a declared transmission result. A scalar analysis may provide reverberation time and direct/diffuse balance; an authored impulse response or external acoustic result remains a different source kind. Every adopted result fixes its geometry mapping, units, frequency scope, sample rate where applicable, input and output digests, solver or provider metadata, and revision. The user or delegated authoring agent chooses the source and adoption; AutoMovie does not select a provider or ship an IR library.

Apply the adopted response to the declared bus or source and keep its identity in mix evidence. Never derive acoustic absorption from a texture, material appearance, room name, building style, or provider label. Use only authored substance coefficients and fixed analysis results whose revisions match the room, openings, furnishings, occupancy, emitter, and listener. The bounded response does not claim full wave acoustics, diffraction, an early-reflection pattern, speech transmission index, or building compliance. Missing inputs remain `unsupported` or `not-run`; a simple estimate is never promoted to an impulse response.

## Dialogue and speech

Write speakable lines and let the user or delegated authoring agent choose a recorded or synthesized voice source appropriate to the declared production. If that choice uses a provider, pin adapter, model, voice, version, controls, final source artifacts, and provenance in cache and receipt identity. AutoMovie requires no particular provider, model, or voice and never fills an omitted choice from host availability. A model alias that tracks remote `main` is not a reproducible revision.

Preserve actual sample-clock or aligned phoneme timing from the final decoded bytes for lip sync and caption alignment. Mouth motion follows the speaker's emission interval, not a later listener-arrival frame. Caption duration and Unicode character count do not reveal pronunciation timing. Normalize level, remove unintended leading/trailing silence without cutting expressive breath, and keep dialogue intelligible over effects and music.

Caption readability is evaluated only against a production-selected, versioned profile whose RFC 5646 well-formed language tag, complete grapheme execution identity, rate, line, duration, and gap limits are explicit. Copy the algorithm, revision, grapheme granularity, and requested/resolved locale or locale-neutral state from `AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION`; a mismatch remains `not-run` without fallback. Language comparison is ASCII case-insensitive while authored spelling is retained, and registry membership, Preferred-Value replacement, and language inference remain outside this validation. Readability and WebVTT consume the same authored presentation: CRLF and CR become LF, legal tabs and line breaks remain, prohibited controls are sanitized, and no automatic reflow is inferred. The user or delegated authoring agent owns that profile and its thresholds. When no profile is selected, report the actual segmentation identity, measured grapheme count, duration, rate, lines, and gaps with a `not-run` verdict; do not invent a default threshold or turn measure-only output into pass or fail.

## Mix hierarchy

Mix at the declared sample rate, channel layout, and codec profile. Maintain headroom. Control masking by timing, spectrum, level, and spatial placement before applying heavy processing. Use dynamics to preserve intelligibility, not to make every moment equally loud.

Shape ambience across edits with L-cuts and J-cuts. Crossfade room tone where continuity is intended; use a hard acoustic boundary only when story or place changes. Silence is an authored layer and should have a reason.

## Verification

Probe final media facts, resident sample count, duration, channel count, sample rate, codec, and audiovisual runtime. Derive the audio sample boundary from the exact reduced rational film rate with the shared nearest-half-up mapper; never estimate it from decimal `fps`. Listen on headphones and small speakers at a stable level. Check dialogue, event sync, spatial motion, loops, clipping, accidental gaps, captions, and the first and last second of every sequence.

## Evidence for a sound verdict

Sound has no turntable, so its evidence is the media facts and the delivered timeline rather than a frame. Probe the final media, then record what it proved in the evidence citation that owns it: the cut's own audio on its sequence owner, and the mix, the dialogue intelligibility, and the audiovisual runtime on the film source.

A picture review never discharges a sound obligation, and neither does a waveform nobody listened to.
