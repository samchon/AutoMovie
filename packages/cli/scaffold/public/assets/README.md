# Assets

Place project-owned visual assets here. Register every distributable byte in
`.automovie/assets.json` with its source URL, license, original/current SHA-256,
processing chain, and reasoned use. External glTF, GLB, and VRM entries also
record an ingest profile, explicit LOD assets, and collision/measurement
proxies. `npm run lint` and compilation reject missing records, rights, or changed
bytes.

Supported ingest profiles are `gltf-static-v1`, `gltf-humanoid-v1`, and
`vrm-humanoid-v1`. The first LOD is `hero` and cites the owning model bytes.
Collision proxies are generated `capsule-v1` or `box-v1` shapes; measurement
proxies are generated `box-v1` or `humanoid-landmarks-v1` envelopes. All
parameters are explicit positive meters. A proxy may instead cite a registered
version-1 JSON proxy asset. Register every external glTF buffer or image
sidecar too. Sidecars and non-hero LODs use `model-resource` with the hero model
path as consumer id; JSON proxies use `model-proxy`. The compiler validates
payload ranges and rig/profile compatibility and seals one digest closure. The
viewer serves only that closure and uses authoritative VRM or ingested glTF
humanoid mappings. External models are refused for anonymous formation and
instance-set members until imported-mesh instancing is supported.
