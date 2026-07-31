# Asset Sourcing Handbook

Every external model, texture, sound, font, reference image, or generated artifact crosses a legal and technical trust boundary. Acquire first only when you can prove origin, permission, identity, conversion, and intended consumer.

## Selection

Define the need before searching: semantic role, required views, rig or articulation, scale, topology, materials, texture resolution, animation, audio facts, delivery raster, and modification rights. Prefer a simpler asset whose contract is known over a visually impressive asset that cannot be verified or controlled.

Inspect the authoritative source page and license, not a repost. Record creator, title, source URL, acquisition date, license id or text, attribution obligations, modification and redistribution terms, and any prohibited use. If the license is ambiguous, do not ship the asset.

## Byte identity

Store or register the exact acquired bytes and compute their digest before conversion. Record media type and facts. Conversion creates a derived asset with its own digest, tool identity, parameters, and parent provenance; never overwrite the only source while pretending it is unchanged.

For archives, enumerate the selected member and preserve relevant license files. Reject path escapes, symlink surprises, executable payloads, malformed media, or content whose parsed facts disagree with its declaration.

## Technical normalization

For 3D assets, inspect coordinate handedness, up and forward axes, unit scale, rest pose, hierarchy, bone names, skin, materials, texture color spaces, animation clips, morphs, and bounds. Normalize once at ingest and verify the result through current asset turntables.

For audio, inspect codec, channels, sample rate, duration, loudness, loop points, and silence. For images, inspect decoded raster, color space, alpha, and orientation. For fonts, check embedding and redistribution rights for the delivery form.

## Consumer permission

Asset registration declares more than existence. Restrict each asset to the production and consumer roles it may serve. A sound cue source is not automatically authorized for model input. A character or style image sent to a repaint provider must be explicitly authorized as a rendition reference for that shot before any bytes leave the host.

## Generated and API assets

Record provider, model, exact version, execution boundary, prompt, seed, controls, references, terms, and output digest. Research current provider rights and retention policy at acquisition time. Do not claim reproducibility from a seed when model, scheduler, service implementation, or references are unpinned.

## Acceptance checklist

- exact source and license are available;
- attribution and redistribution obligations are satisfied;
- source and derived digests are recorded;
- parser facts and conversion identity are recorded;
- scale, axes, rig, color, audio, and bounds are normalized;
- production and consumer permission are explicit;
- current asset review proves the delivery appearance and range;
- no untracked remote alias is required to recreate the accepted state.
