# External asset ingestion

## Deterministic asset decoding {#deterministic-asset-decoding}

<!-- @evidence requirements/13-external-inputs.md#proven-bounded-ingestion Converts supported resident asset bytes into typed records while preserving explicit failure and provenance boundaries. -->

`@automovie/ingest` inspects supported model containers and maps glTF nodes, skins, cameras, meshes, and animation channels into stable interface records. Unsupported structures and invalid resources are returned as explicit facts or refusals before a production consumes them.
