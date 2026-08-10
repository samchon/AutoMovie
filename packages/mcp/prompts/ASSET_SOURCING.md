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

## Texture and environment images

A PBR map and an equirectangular environment are assets like any other, and they carry three facts beyond licence and digest.

Media is decided by the bytes, not the extension. PNG, JPEG and WebP are sampled as material maps; a Radiance HDR is sampled only as scene image lighting. A renamed file, a placeholder that never got replaced, and an HDR bound as a base-color map are all refused before compilation, naming the material slot or scene that bound them.

Size is a shipping decision. Both edges must be whole positive pixel counts and neither may exceed the portable 8192 limit; downscale past that in a recorded processing step rather than shipping a tile no target samples without a driver-side rescale.

Decoding intent is part of the asset's identity. Base-color and emissive maps are colours stored in sRGB; metallic-roughness, normal and occlusion maps are measurements and must stay linear. One image bound under both intents is refused: the same pixels cannot be both a colour and a measurement, and the fix is two registered images, not one binding quietly decoded the wrong way.

Register each image with a typed use: `material-texture` naming the compiled model whose materials bind it, or `scene-environment` naming the shot whose scene lights itself from it. An image no model or scene binds any more is a stale use and is refused too, so the distributable never accumulates files nothing samples.

## Acceptance checklist

- exact source and license are available;
- attribution and redistribution obligations are satisfied;
- source and derived digests are recorded;
- parser facts and conversion identity are recorded;
- scale, axes, rig, color, audio, and bounds are normalized;
- production and consumer permission are explicit;
- image media, both edge lengths, and decoding intent are proved from the bytes;
- current asset review proves the delivery appearance and range;
- no untracked remote alias is required to recreate the accepted state.
