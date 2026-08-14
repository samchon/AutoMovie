# Asset Sourcing Handbook

Every external model, texture, sound, font, reference image, or generated artifact crosses a legal and technical trust boundary. Acquire first only when you can prove origin, permission, identity, conversion, and intended consumer.

## Selection

Define the need before searching: semantic role, required views, rig or articulation, scale, topology, materials, texture resolution, animation, audio facts, delivery raster, and modification rights. Prefer a simpler asset whose contract is known over a visually impressive asset that cannot be verified or controlled.

Inspect the authoritative source page and license, not a repost. Record creator, title, source URL, acquisition date, license id or text, attribution obligations, modification and redistribution terms, and any prohibited use. If the license is ambiguous, do not ship the asset.

## Byte identity

Store or register the exact acquired bytes and compute their digest before conversion. Record media type and facts. Conversion creates a derived asset with its own digest, tool identity, parameters, and parent provenance; never overwrite the only source while pretending it is unchanged.

Content identity is provider- and package-independent. Exact bytes may share one content identity only when the interpretation metadata that gives those bytes meaning is also identical. That reuse never merges source identity, acquisition event, provenance, rights, provider receipt, adoption decision, or adoption revision; each remains a separately reviewable record even when the content digest matches.

For archives, enumerate the selected member and preserve relevant license files. Reject path escapes, symlink surprises, executable payloads, malformed media, or content whose parsed facts disagree with its declaration.

## Technical normalization

For 3D assets, inspect coordinate handedness, up and forward axes, unit scale, rest pose, hierarchy, bone names, skin, materials, texture color spaces, animation clips, morphs, and bounds. Normalize once at ingest and verify the result through current asset turntables.

For audio, inspect codec, channels, sample rate, duration, loudness, loop points, and silence. For images, inspect decoded raster, color space, alpha, and orientation. For fonts, check embedding and redistribution rights for the delivery form.

## Consumer permission

Asset registration declares more than existence. Restrict each asset to the production and consumer roles it may serve. A sound cue source is not automatically authorized for model input. A character or style image sent to a repaint provider must be explicitly authorized as a rendition reference for that shot before any bytes leave the host.

## Generated and API assets

The user or delegated authoring agent chooses the source channel and, when applicable, provider, model, exact version, and execution boundary. AutoMovie validates the adopted result without choosing a provider from host availability or treating one provider as required. Record the chosen provider metadata, prompt, seed, controls, references, terms, and output digest. Do not claim reproducibility from a seed when model, scheduler, service implementation, or references are unpinned.

This handbook names no generation or marketplace service. Which services exist, what a generated result may lawfully be used for, and what a provider retains all move faster than this document does, so research the current state at acquisition time and record what you found beside the date you found it. A brand name written here as a recommendation would be stale before it was read.

Bytes nothing ever served have no acquisition URL, and inventing one is a fabrication. A provenance record carries either an `original` (the URL and digest of what was fetched) or a `generated` identity, never both: provider, exact model, provider-side request id or null, the verbatim instruction or null with its digest always recorded, the manifest inputs the request was conditioned on in request order, the digest of the bytes that came back, and a `reproducible` boolean. Answer that boolean honestly. Sampled image generation is usually irreproducible, and `false` is the correct record; a replay handle you cannot actually replay is worse than no handle.

Parts of that record are refusals rather than advice, and the seed is where an honest-looking entry fails. A `reproducible: true` carrying a null `seed` is rejected outright, because a reproducibility claim nobody can act on is worse than an admitted irreproducible draw. The mirror case is only a warning: a seed sitting beside `reproducible: false` is decoration rather than a contradiction, so it never stops a compile. The compiler keeps only the pass or fail of that validation, so nothing ever surfaces the warning to you, and the honest boolean has to come from you rather than from a refusal.

A seed that is not a whole number a provider could have handed back is rejected before either of those rules speaks, since a fractional or unbounded value is not null and would otherwise pass both while naming no draw at all. `promptDigest` and `outputDigest` are lowercase `sha256:` hex, and `outputDigest` must still equal the current bytes unless a recorded processing step explains what replaced them. On the fetched side, `original` is held to the same standard from the other direction: its digest is a `sha256:` hex, and its URL has to be an address something could actually be fetched from.

None of this arrives as a seed diagnostic, a licence diagnostic, or a use diagnostic. An incomplete acquisition of either shape, a blank licence identifier, a licence URL nothing could fetch, a use with no stated reason, and a processing step with no tool or command all compile to one `asset-provenance-incomplete` naming the asset path, so read the whole ledger entry rather than the field you edited last. Generated bytes carry the licence rule exactly as fetched bytes do: the provider's terms are the applicable licence, and an entry that leaves the identifier or its URL blank because a model produced the bytes is refused like any other incomplete entry.

## Observed design documents

A photograph, a surveyed plan, a scanned section, or a generated design study is evidence a design cites, and it travels in the opposite direction from a derived drawing. A drawing is output the design produces and can never disagree with it; an observed document is an input, and a reading of it is a claim.

Register the bytes as an asset with a `design-reference` use naming the observation document, then keep the reading in that document rather than in the building. The document holds the frames read from the asset, the raw marks observed in them, every attempted analysis including the ones that produced nothing, the semantic candidates proposed over those marks, and the issues still undecided. Scale is a reading too: a document carries scale candidates rather than one asserted metre-per-unit, because a bar scale, a stated ratio, and a measured known dimension are three readings that may disagree, and choosing between them is a decision somebody has to make and record.

Container support is honest and narrow. PNG, JPEG, and SVG are registrable and readable; PDF and DXF are registrable, but an analysis whose source-space extent they cannot supply reports `unsupported` rather than guessing a page size. An `unsupported` analysis is a result, not a failure to try, and it must stay visible instead of being deleted so the document looks complete.

Promotion is the one-way gate, and it reports separate lists rather than one verdict. `promoted` holds the readings settled enough to become metric geometry; `withheld` holds each candidate that stays an observation with a reason from a closed family (`unobserved`, `unknown-scale`, `ambiguous-candidate`, `open-issue`, `low-confidence`, `unsupported-geometry`) and a statement of what would have to change; `skipped` holds the analyses that were unsupported or never run. Nothing is design merely because it was registered. Never let a derived drawing be read back as an observation, and never quote an observation as the design's own truth.

## Texture and environment images

A PBR map and an equirectangular environment are assets like any other, and they carry further facts beyond licence and digest.

Media is decided by the bytes, not the extension. PNG, JPEG and WebP are sampled as material maps; a Radiance HDR is sampled only as scene image lighting. A renamed file, a placeholder that never got replaced, and an HDR bound as a base-color map are all refused before compilation, naming the material slot or scene that bound them.

Size is a shipping decision. Both edges must be whole positive pixel counts and neither may exceed the portable 8192 limit; downscale past that in a recorded processing step rather than shipping a tile no target samples without a driver-side rescale.

Decoding intent is part of the asset's identity. Base-color and emissive maps are colours stored in sRGB; metallic-roughness, normal and occlusion maps are measurements and must stay linear. One image bound under both intents is refused: the same pixels cannot be both a colour and a measurement, and the fix is two registered images, not one binding quietly decoded the wrong way.

Register each image with a typed use: `material-texture` naming the compiled model whose materials bind it, `scene-environment` naming the shot whose scene lights itself from it, or `design-reference` naming the observation document that reads it. An image no model, scene, or document binds any more is a stale use and is refused too, so the distributable never accumulates files nothing samples.

Every failure in this section compiles to one code, `asset-texture-unclosed`, and its message names the binding that broke rather than the rule it broke. The check is deferred until the models and scenes exist, so it appears late in a compile that already looked healthy.

## From registered bytes to a frame

A completed download is one step of several, and each later step has a refusal of its own. Walk the whole path before reporting an asset as delivered, because the steps that actually put a chair, a tree, or a fountain in the frame are the ones after acquisition.

The ledger is the file the production manifest names as its asset manifest, and its entries are sorted by code unit with no repeated path. An unsorted or duplicated ledger is `asset-manifest-order`; an absent one is `asset-manifest-missing`; one that is not valid JSON or does not satisfy the manifest type is `asset-manifest-invalid`. The last two stop the asset pass where it stands, so a malformed ledger hides every other asset diagnostic behind itself.

The bytes must be a real file the compiler was told to read. A project declares its content roots and content files in that same manifest, and a fetch that lands anywhere else is `asset-bytes-missing` however well the transfer went, which is the most common way a confident "asset acquired" report turns out to be nothing. The path itself is one canonical project-relative spelling, so a drive letter, a leading slash, a backslash, or a second casing of the same file is `asset-path-invalid`. A digest that no longer matches the file is `asset-digest-mismatch`, and bytes differing from what was fetched or generated with no recorded processing step are `asset-processing-missing`.

An external glTF-family model carries a second record beside its provenance: the ingest profile it was normalized under, an explicit LOD ledger instead of a filename convention, a collision proxy, and a measurement proxy. Absence never falls back to mesh inference, so an external model missing that record is `asset-model-provenance-missing` even when its bytes and licence are perfect. `MODEL_RECIPE` owns what a recipe then does with the model.

Nothing samples an asset because the asset exists. A model recipe consuming these bytes needs a `model-recipe` use naming that exact recipe in this production, or the compile answers `asset-use-missing`. A use naming a consumer the production does not have is `asset-use-dangling`, a second active use of one exclusive consumer is `asset-use-duplicate`, and a ledger that assigns an asset to a cue the active film does not carry is `asset-use-stale`.

A consumed model is then a review target in its own right. Until that review completes, the compile refuses with `asset-review-missing`, `asset-review-stale`, `asset-review-revise`, or `asset-review-incomplete`, and the refusal means what it says: no shot may import the model before its own review passes. Correction feedback on that review never authorizes deleting the asset. `REVIEW_ASSET` owns the views it demands.

Only a captured frame closes the path. Treat the asset as delivered when a frame shows it standing where it belongs, not when the file appeared on disk and not when the compile stopped complaining.

## Acceptance checklist

- exact source and license are available;
- attribution and redistribution obligations are satisfied;
- source and derived digests are recorded;
- parser facts and conversion identity are recorded;
- scale, axes, rig, color, audio, and bounds are normalized;
- production and consumer permission are explicit;
- image media, both edge lengths, and decoding intent are proved from the bytes;
- the bytes resolve inside a declared content root and the ledger stays in canonical path order;
- every typed use resolves to a consumer the production actually has;
- current asset review proves the delivery appearance and range;
- a captured frame shows the asset in place;
- no untracked remote alias is required to recreate the accepted state.
