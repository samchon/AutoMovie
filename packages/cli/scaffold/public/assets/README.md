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
sidecar too: the compiler and local viewer serve only byte-exact ledger entries.
