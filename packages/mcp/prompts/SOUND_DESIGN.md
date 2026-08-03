# Sound Design Handbook

Sound establishes causality, scale, space, rhythm, attention, and continuity. Build it from semantic events and authored ambience rather than decorating the finished image with unrelated effects.

## Sound layers

- Dialogue carries language, intention, breath, and proximity.
- Foley makes contact and material action legible.
- Effects express events, machinery, weapons, weather, and exceptional forces.
- Ambience defines continuous place, time, population, and acoustic condition.
- Music shapes structure and emotion but must not erase required information.

Give each layer a narrative job. If two sounds compete for the same job, simplify or establish hierarchy.

## Event-derived cues

Bind cues to semantic event ids and exact source times. Impact, muzzle, footfall, door contact, formation order, and transition sounds should inherit measured event time and world-space source. Preserve authored source offsets when an edit uses a later part of a cue or carries it across a cut.

Use deterministic procedural sound for bounded prototypes and effects the engine can derive. Register external samples with license, digest, technical facts, and consumer permission. A filename is not provenance.

## Spatialization

Resolve the emitter at cue time, including moving actors, props, cameras, and formations. Derive distance attenuation and pan from actual world position and listener state. A moving formation must not emit forever from its initial centroid.

Use spread or multiple emitters for large sources only when the shot scale needs it. Keep near-field details localized and distant mass coherent. Doppler, occlusion, reverberation, and delay must be deliberate and bounded; absence is preferable to an unverified simulation claim.

## Dialogue and speech

Write speakable lines and choose a voice identity appropriate to the declared production. Pin adapter, model, voice, version, and source artifacts in cache and receipt identity. A model alias that tracks remote `main` is not a reproducible revision.

Preserve actual sample-clock or aligned phoneme timing for lip sync. Caption duration and Unicode character count do not reveal pronunciation timing. Normalize level, remove unintended leading/trailing silence without cutting expressive breath, and keep dialogue intelligible over effects and music.

## Mix hierarchy

Mix at the declared sample rate, channel layout, and codec profile. Maintain headroom. Control masking by timing, spectrum, level, and spatial placement before applying heavy processing. Use dynamics to preserve intelligibility, not to make every moment equally loud.

Shape ambience across edits with L-cuts and J-cuts. Crossfade room tone where continuity is intended; use a hard acoustic boundary only when story or place changes. Silence is an authored layer and should have a reason.

## Verification

Probe final media facts, resident sample count, duration, channel count, sample rate, codec, and audiovisual runtime. Listen on headphones and small speakers at a stable level. Check dialogue, event sync, spatial motion, loops, clipping, accidental gaps, captions, and the first and last second of every sequence.
