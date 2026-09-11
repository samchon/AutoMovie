# Assets

Place project visual assets here. Register each asset's project-relative path, current SHA-256, and typed consumer bindings in `automovie/assets.json`. External glTF, GLB, and VRM entries also record an ingest profile, explicit LOD assets, and collision/measurement proxies. Compilation checks the declared records against the current bytes.

Supported ingest profiles are `gltf-static-v1`, `gltf-humanoid-v1`, and
`vrm-humanoid-v1`. The first LOD is `hero` and cites the owning model bytes.
Collision proxies are generated `capsule-v1` or `box-v1` shapes; measurement
proxies are generated `box-v1` or `humanoid-landmarks-v1` envelopes. All
parameters are explicit positive meters. A proxy may instead cite a registered
version-1 JSON proxy asset. Register every external glTF buffer or image
sidecar too. Sidecars and non-hero LODs use `model-resource` with the hero model
path as consumer id; JSON proxies use `model-proxy`. The builder validates
payload ranges and rig/profile compatibility and seals one digest closure. The
viewer serves only that closure and uses authoritative VRM or ingested glTF
humanoid mappings. External models are refused for anonymous formation members
whatever their profile. An instance set may select one only on the
`gltf-static-v1` profile; a humanoid profile is refused there too.
