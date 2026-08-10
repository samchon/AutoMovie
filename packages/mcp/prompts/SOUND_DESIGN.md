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

An audio cue on the film timeline names its `asset` and states where it sits: a film-global start, a duration, the source frame the edit begins at, the span of source it uses, a gain, fades and a bus. The mix plays that asset — read at its own rate from the stated offset, stretched only by the ratio between the source span and the film span, and silent past the asset's end rather than looped. Decoding happens outside the mix: whoever renders hands the decoded samples in, exactly as it does for synthesized dialogue, so a codec never reaches a mix that has to produce the same bytes on every machine.

A cue whose asset has not been decoded still sounds, as a bus-shaped stand-in — a bed for music, filtered noise for ambience and effects. That is scaffolding for a film mid-authoring and not the sound design: a review that judges a cue before its asset is decoded is judging the stand-in.


## Event-derived cues

Bind cues to semantic event ids and exact source times. Impact, muzzle, footfall, door contact, formation order, and transition sounds should inherit measured event time and world-space source. Preserve authored source offsets when an edit uses a later part of a cue or carries it across a cut.

Use deterministic procedural sound for bounded prototypes and effects the engine can derive. Register external samples with license, digest, technical facts, and consumer permission. A filename is not provenance.

## Spatialization

Resolve the emitter at cue time, including moving actors, props, cameras, and formations. Derive distance attenuation and pan from actual world position and listener state. A moving formation must not emit forever from its initial centroid.

A group is an extended source and the derived plan measures it as one. An event naming a formation or an instance set carries how many members sound, how far they are spread, and the level that many mutually uncorrelated sources produce, which rises as the square root of the count: ten voices sit about 10 dB over one and a hundred about 20 dB over one. Attenuation and pan are taken at the root-mean-square source-to-listener distance rather than at the centroid alone, so a sprawling mass underfoot does not attenuate as though it stood at one point, a wide near source occupies a span of the stereo field instead of a point in it, and a cue that closes the unit's ranks tightens it in the mix exactly as it tightens on screen. Name the subjects an event really has: the acoustic center is weighted by member count, so an event naming one figure and the mass behind it emits from the mass rather than from the empty midpoint between them.

Use spread or multiple emitters for large sources only when the shot scale needs it. Keep near-field details localized and distant mass coherent. Doppler, occlusion, reverberation, and delay must be deliberate and bounded; absence is preferable to an unverified simulation claim.

## Dialogue and speech

Write speakable lines and choose a voice identity appropriate to the declared production. Pin adapter, model, voice, version, and source artifacts in cache and receipt identity. A model alias that tracks remote `main` is not a reproducible revision.

Preserve actual sample-clock or aligned phoneme timing for lip sync. Caption duration and Unicode character count do not reveal pronunciation timing. Normalize level, remove unintended leading/trailing silence without cutting expressive breath, and keep dialogue intelligible over effects and music.

## Mix hierarchy

Mix at the declared sample rate, channel layout, and codec profile. Maintain headroom. Control masking by timing, spectrum, level, and spatial placement before applying heavy processing. Use dynamics to preserve intelligibility, not to make every moment equally loud.

Shape ambience across edits with L-cuts and J-cuts. Crossfade room tone where continuity is intended; use a hard acoustic boundary only when story or place changes. Silence is an authored layer and should have a reason.

## Verification

Probe final media facts, resident sample count, duration, channel count, sample rate, codec, and audiovisual runtime. Listen on headphones and small speakers at a stable level. Check dialogue, event sync, spatial motion, loops, clipping, accidental gaps, captions, and the first and last second of every sequence.
